import { randomUUID } from "node:crypto";
import { spawn, type ChildProcess } from "node:child_process";
import { Readable, Writable } from "node:stream";
import {
  ClientSideConnection,
  ndJsonStream,
  PROTOCOL_VERSION,
  RequestError,
  type Client,
  type CreateTerminalRequest,
  type CreateTerminalResponse,
  type KillTerminalRequest,
  type KillTerminalResponse,
  type ReadTextFileRequest,
  type ReadTextFileResponse,
  type ReleaseTerminalRequest,
  type ReleaseTerminalResponse,
  type RequestPermissionRequest,
  type RequestPermissionResponse,
  type SessionNotification,
  type TerminalExitStatus,
  type TerminalOutputRequest,
  type TerminalOutputResponse,
  type WaitForTerminalExitRequest,
  type WaitForTerminalExitResponse,
  type WriteTextFileRequest,
  type WriteTextFileResponse,
} from "@agentclientprotocol/sdk";
import type {
  AgentAdapter,
  AgentConfig,
  AgentResult,
  SandboxHandle,
  StepEvent,
} from "@agentgrader/core";

const DEFAULT_WORKSPACE_ROOT = "/app";
const TERMINAL_OUTPUT_TRUNCATE_LIMIT = 4000;

interface TerminalState {
  outputFile: string;
  exitFile: string;
  pidFile: string;
  released: boolean;
}

function resolveAcpSpawn(config: AgentConfig): { command: string; args: string[] } {
  if (!config.acp_command) {
    throw new Error(
      "acp_command is required in agent config when using AcpAgentAdapter (e.g. acp_command: cursor-agent).",
    );
  }

  const explicitArgs = config.acp_args ?? [];
  if (explicitArgs.length > 0) {
    return { command: config.acp_command, args: explicitArgs };
  }

  const parts = config.acp_command.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) {
    throw new Error("acp_command must not be empty.");
  }

  return { command: parts[0]!, args: parts.slice(1) };
}

function resolveSandboxPath(path: string, workspaceRoot: string): string {
  if (path.startsWith("/")) {
    return path;
  }
  return `${workspaceRoot}/${path}`.replace(/\/+/g, "/");
}

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

function sliceFileContent(content: string, line?: number | null, limit?: number | null): string {
  if (line == null && limit == null) {
    return content;
  }

  const lines = content.split("\n");
  const start = Math.max((line ?? 1) - 1, 0);
  const end = limit == null ? lines.length : start + limit;
  return lines.slice(start, end).join("\n");
}

class SandboxAcpClient implements Client {
  private readonly terminals = new Map<string, TerminalState>();
  private stepIndex = 0;

  constructor(
    private readonly sandbox: SandboxHandle,
    private readonly workspaceRoot: string,
    private readonly onStep: (step: StepEvent) => void,
  ) {}

  private emitStep(partial: {
    kind: StepEvent["kind"];
    tool?: string;
    content?: string;
    tokensIn?: number;
    tokensOut?: number;
    cachedTokens?: number;
    costUsd?: number;
  }) {
    const step: StepEvent = {
      index: this.stepIndex++,
      timestamp: Date.now(),
      tokensIn: partial.tokensIn ?? 0,
      tokensOut: partial.tokensOut ?? 0,
      cachedTokens: partial.cachedTokens ?? 0,
      costUsd: partial.costUsd ?? 0,
      kind: partial.kind,
      tool: partial.tool,
      content: partial.content,
    };
    this.onStep(step);
  }

  async requestPermission(params: RequestPermissionRequest): Promise<RequestPermissionResponse> {
    const allowOption =
      params.options.find((option) => option.kind === "allow_once" || option.kind === "allow_always") ??
      params.options[0];

    if (!allowOption) {
      return { outcome: { outcome: "cancelled" } };
    }

    this.emitStep({
      kind: "tool_call",
      tool: "requestPermission",
      content: params.toolCall.title ?? params.toolCall.toolCallId,
    });

    return {
      outcome: {
        outcome: "selected",
        optionId: allowOption.optionId,
      },
    };
  }

  async sessionUpdate(params: SessionNotification): Promise<void> {
    const update = params.update;

    switch (update.sessionUpdate) {
      case "agent_message_chunk":
        this.emitStep({
          kind: "message",
          content: extractTextContent(update),
        });
        break;
      case "agent_thought_chunk":
        this.emitStep({
          kind: "thinking",
          content: extractTextContent(update),
        });
        break;
      case "tool_call":
        this.emitStep({
          kind: "tool_call",
          tool: update.title ?? update.toolCallId,
          content: update.kind ?? String(update.status ?? ""),
        });
        break;
      case "tool_call_update":
        this.emitStep({
          kind: "tool_result",
          tool: update.title ?? update.toolCallId,
          content: String(update.status ?? ""),
        });
        break;
      default:
        break;
    }
  }

  async readTextFile(params: ReadTextFileRequest): Promise<ReadTextFileResponse> {
    const path = resolveSandboxPath(params.path, this.workspaceRoot);

    this.emitStep({
      kind: "tool_call",
      tool: "fs/read_text_file",
      content: path,
    });

    try {
      const raw = await this.sandbox.readFile(path);
      const content = sliceFileContent(raw, params.line, params.limit);
      this.emitStep({
        kind: "tool_result",
        tool: "fs/read_text_file",
        content: `${content.length} bytes`,
      });
      return { content };
    } catch {
      throw RequestError.resourceNotFound(path);
    }
  }

  async writeTextFile(params: WriteTextFileRequest): Promise<WriteTextFileResponse> {
    const path = resolveSandboxPath(params.path, this.workspaceRoot);

    this.emitStep({
      kind: "tool_call",
      tool: "fs/write_text_file",
      content: path,
    });

    try {
      await this.sandbox.writeFile(path, params.content);
      this.emitStep({
        kind: "tool_result",
        tool: "fs/write_text_file",
        content: "ok",
      });
      return {};
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : String(err);
      throw RequestError.internalError({ path }, message);
    }
  }

  async createTerminal(params: CreateTerminalRequest): Promise<CreateTerminalResponse> {
    const terminalId = randomUUID();
    const outputFile = `/tmp/acp-term-${terminalId}.out`;
    const exitFile = `/tmp/acp-term-${terminalId}.exit`;
    const pidFile = `/tmp/acp-term-${terminalId}.pid`;
    const cwd = params.cwd ?? this.workspaceRoot;
    const args = (params.args ?? []).map(shellQuote).join(" ");
    const envPrefix =
      params.env && params.env.length > 0
        ? `${params.env.map((entry) => `${entry.name}=${shellQuote(entry.value)}`).join(" ")} `
        : "";
    const command = `${envPrefix}${shellQuote(params.command)}${args ? ` ${args}` : ""}`;
    const shellCmd = [
      `cd ${shellQuote(cwd)}`,
      `(${command}) > ${shellQuote(outputFile)} 2>&1; echo $? > ${shellQuote(exitFile)} & echo $! > ${shellQuote(pidFile)}`,
    ].join(" && ");

    this.emitStep({
      kind: "tool_call",
      tool: "terminal/create",
      content: params.command,
    });

    const spawnResult = await this.sandbox.exec(shellCmd);
    if (spawnResult.exitCode !== 0) {
      throw RequestError.internalError(
        { command: params.command, stderr: spawnResult.stderr },
        `Failed to start terminal command: ${spawnResult.stderr || spawnResult.stdout}`,
      );
    }

    this.terminals.set(terminalId, {
      outputFile,
      exitFile,
      pidFile,
      released: false,
    });

    this.emitStep({
      kind: "tool_result",
      tool: "terminal/create",
      content: terminalId,
    });

    return { terminalId };
  }

  async terminalOutput(params: TerminalOutputRequest): Promise<TerminalOutputResponse> {
    const terminal = this.getTerminal(params.terminalId);
    const output = await this.readOptionalFile(terminal.outputFile);
    const exitStatus = await this.readExitStatus(terminal);

    this.emitStep({
      kind: "tool_call",
      tool: "terminal/output",
      content: params.terminalId,
    });

    // Surface the command's actual stdout/stderr as a tool_result, mirroring
    // the AI SDK adapter's executeCommand result. Without this, `agr trace`
    // can't show what a terminal command printed, and toolkit scripts that
    // self-report adoption via a "<name>: ..." marker line (see
    // wasCommandUsed in @agentgrader/core) are invisible on ACP runs.
    this.emitStep({
      kind: "tool_result",
      tool: "terminal/output",
      content: TERMINAL_OUTPUT_TRUNCATE_LIMIT < output.length
        ? `${output.slice(0, TERMINAL_OUTPUT_TRUNCATE_LIMIT)}\n... (truncated)`
        : output,
    });

    return {
      output,
      truncated: false,
      exitStatus,
    };
  }

  async waitForTerminalExit(params: WaitForTerminalExitRequest): Promise<WaitForTerminalExitResponse> {
    const terminal = this.getTerminal(params.terminalId);
    const deadline = Date.now() + 180_000;

    while (Date.now() < deadline) {
      const exitStatus = await this.readExitStatus(terminal);
      if (exitStatus) {
        this.emitStep({
          kind: "tool_result",
          tool: "terminal/wait_for_exit",
          content: String(exitStatus.exitCode ?? "signal"),
        });
        return {
          exitCode: exitStatus.exitCode ?? null,
          signal: exitStatus.signal ?? null,
        };
      }
      await sleep(100);
    }

    throw RequestError.internalError(
      { terminalId: params.terminalId },
      "Timed out waiting for terminal command to exit.",
    );
  }

  async killTerminal(params: KillTerminalRequest): Promise<KillTerminalResponse | void> {
    const terminal = this.getTerminal(params.terminalId);
    const pid = (await this.readOptionalFile(terminal.pidFile)).trim();
    if (pid) {
      await this.sandbox.exec(`kill -TERM ${shellQuote(pid)} 2>/dev/null || kill -KILL ${shellQuote(pid)} 2>/dev/null || true`);
    }
    this.emitStep({
      kind: "tool_call",
      tool: "terminal/kill",
      content: params.terminalId,
    });
  }

  async releaseTerminal(params: ReleaseTerminalRequest): Promise<ReleaseTerminalResponse | void> {
    const terminal = this.getTerminal(params.terminalId);
    if (terminal.released) {
      return;
    }

    const pid = (await this.readOptionalFile(terminal.pidFile)).trim();
    if (pid) {
      await this.sandbox.exec(`kill -TERM ${shellQuote(pid)} 2>/dev/null || true`);
    }

    terminal.released = true;
    this.terminals.delete(params.terminalId);

    await this.sandbox.exec(
      `rm -f ${shellQuote(terminal.outputFile)} ${shellQuote(terminal.exitFile)} ${shellQuote(terminal.pidFile)}`,
    );

    this.emitStep({
      kind: "tool_result",
      tool: "terminal/release",
      content: params.terminalId,
    });
  }

  private getTerminal(terminalId: string): TerminalState {
    const terminal = this.terminals.get(terminalId);
    if (!terminal || terminal.released) {
      throw RequestError.invalidParams({ terminalId }, `Unknown or released terminal: ${terminalId}`);
    }
    return terminal;
  }

  private async readOptionalFile(path: string): Promise<string> {
    try {
      return await this.sandbox.readFile(path);
    } catch {
      return "";
    }
  }

  private async readExitStatus(terminal: TerminalState): Promise<TerminalExitStatus | null> {
    const exitRaw = (await this.readOptionalFile(terminal.exitFile)).trim();
    if (!exitRaw) {
      return null;
    }

    const exitCode = Number.parseInt(exitRaw, 10);
    return {
      exitCode: Number.isNaN(exitCode) ? null : exitCode,
      signal: null,
    };
  }
}

function extractTextContent(chunk: { content: { type: string; text?: string } }): string | undefined {
  if (chunk.content.type === "text") {
    return chunk.content.text;
  }
  return undefined;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function killProcess(proc: ChildProcess) {
  if (proc.exitCode != null || proc.signalCode != null) {
    return;
  }
  proc.kill("SIGTERM");
  setTimeout(() => {
    if (proc.exitCode == null && proc.signalCode == null) {
      proc.kill("SIGKILL");
    }
  }, 2_000).unref();
}

export class AcpAgentAdapter implements AgentAdapter {
  readonly name = "acp";

  async solve(input: {
    prompt: string;
    sandbox: SandboxHandle;
    config: AgentConfig;
    onStep: (step: StepEvent) => void;
  }): Promise<AgentResult> {
    const { prompt, sandbox, config, onStep } = input;
    const { command, args } = resolveAcpSpawn(config);
    const workspaceRoot = config.acp_cwd ?? DEFAULT_WORKSPACE_ROOT;

    const client = new SandboxAcpClient(sandbox, workspaceRoot, onStep);

    let proc: ChildProcess | undefined;
    let connection: ClientSideConnection | undefined;

    try {
      proc = spawn(command, args, {
        stdio: ["pipe", "pipe", "pipe"],
        env: {
          ...process.env,
          ...(config.acp_env ?? {}),
        },
      });

      const stdin = proc.stdin;
      const stdout = proc.stdout;
      if (!stdin || !stdout) {
        throw new Error(`Failed to open stdio pipes for ACP agent: ${command}`);
      }

      proc.on("error", (err) => {
        onStep({
          index: 0,
          kind: "message",
          timestamp: Date.now(),
          tokensIn: 0,
          tokensOut: 0,
          cachedTokens: 0,
          costUsd: 0,
          content: `ACP subprocess error: ${err.message}`,
        });
      });

      const stream = ndJsonStream(
        Writable.toWeb(stdin),
        Readable.toWeb(stdout) as unknown as ReadableStream<Uint8Array>,
      );

      connection = new ClientSideConnection(() => client, stream);

      await connection.initialize({
        protocolVersion: PROTOCOL_VERSION,
        clientCapabilities: {
          fs: {
            readTextFile: true,
            writeTextFile: true,
          },
          terminal: true,
        },
        clientInfo: {
          name: "Agentgrader",
          version: "1.0.0",
        },
      });

      const session = await connection.newSession({
        cwd: workspaceRoot,
        mcpServers: [],
      });

      const stepTimeoutMs = config.step_timeout_ms ?? 120_000;
      let timedOut = false;

      // ACP has no dedicated system-prompt field (NewSessionRequest/PromptRequest
      // carry no such slot), so `config.system_prompt` - including the
      // toolkits skills addendum run-single.ts appends to it - is sent as a
      // leading text block in the same prompt turn, ahead of the task prompt.
      const promptBlocks: { type: "text"; text: string }[] = [];
      if (config.system_prompt) {
        promptBlocks.push({ type: "text", text: config.system_prompt });
      }
      promptBlocks.push({ type: "text", text: prompt });

      let promptResponse;
      try {
        promptResponse = await Promise.race([
          connection.prompt({
            sessionId: session.sessionId,
            prompt: promptBlocks,
          }),
          new Promise<never>((_, reject) => {
            setTimeout(() => {
              timedOut = true;
              void connection?.cancel({ sessionId: session.sessionId }).catch(() => undefined);
              reject(new Error(`ACP prompt timed out after ${stepTimeoutMs}ms (step_timeout_ms).`));
            }, stepTimeoutMs);
          }),
        ]);
      } catch (err: unknown) {
        if (timedOut) {
          const finalDiff = await sandbox.gitDiff().catch(() => "");
          return {
            finished: false,
            finalDiff,
            error:
              err instanceof Error
                ? err.message
                : `ACP prompt timed out after ${stepTimeoutMs}ms (step_timeout_ms).`,
          };
        }
        throw err;
      }

      const finalDiff = await sandbox.gitDiff();
      const finished = promptResponse.stopReason === "end_turn";

      return {
        finished,
        finalDiff,
        error: finished
          ? undefined
          : `ACP agent stopped with reason: ${promptResponse.stopReason}`,
      };
    } catch (err: unknown) {
      const finalDiff = await sandbox.gitDiff().catch(() => "");
      return {
        finished: false,
        finalDiff,
        error: err instanceof Error ? err.message : String(err),
      };
    } finally {
      if (connection) {
        await Promise.race([connection.closed, sleep(2_000)]);
      }
      if (proc) {
        killProcess(proc);
      }
    }
  }
}

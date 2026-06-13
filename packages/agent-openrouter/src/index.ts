import { experimental_createMCPClient, generateText, NoSuchToolError, tool } from "ai";
import { Experimental_StdioMCPTransport } from "ai/mcp-stdio";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { AgentAdapter, AgentResult, McpServerConfig, StepEvent } from "@agentgrader/core";
import { z } from "zod";

/** a connected mcp client, narrowed to the bits we use (so we can close it again). */
interface McpClientHandle {
  tools(): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}

function resolveProvider(config: { provider?: string; model?: string }): string {
  if (config.provider) return config.provider;

  const modelName = config.model || "";
  const hasOpenRouterKey = Boolean(process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY);

  if (!hasOpenRouterKey) {
    if (/^claude-/i.test(modelName) && process.env.ANTHROPIC_API_KEY) {
      return "anthropic";
    }
    if (/^(gpt-|o[0-9])/i.test(modelName) && process.env.OPENAI_API_KEY) {
      return "openai";
    }
  }

  return "openrouter";
}

export class AiSdkAgentAdapter implements AgentAdapter {
  readonly name = "ai-sdk";

  async solve(input: {
    prompt: string;
    sandbox: any;
    config: any;
    onStep: (step: StepEvent) => void;
  }): Promise<AgentResult> {
    const { prompt, sandbox, config, onStep } = input;

    // builds a model instance for `modelName`, resolving its provider the
    // same way as the primary model. Used both for the primary model and for
    // `escalate_model` (which may be on a different provider).
    const buildModel = (modelName: string): { model: any; provider: string } => {
      const modelProvider = resolveProvider({ ...config, model: modelName });

      if (modelProvider === "anthropic") {
        if (!process.env.ANTHROPIC_API_KEY) {
          throw new Error(
            "ANTHROPIC_API_KEY is not set. Set it in your environment or .env file to use provider: anthropic.",
          );
        }
        const anthropic = createAnthropic({
          apiKey: process.env.ANTHROPIC_API_KEY,
        });
        return { model: anthropic(modelName), provider: modelProvider };
      } else if (modelProvider === "openai") {
        if (!process.env.OPENAI_API_KEY) {
          throw new Error(
            "OPENAI_API_KEY is not set. Set it in your environment or .env file to use provider: openai.",
          );
        }
        const openai = createOpenAI({
          apiKey: process.env.OPENAI_API_KEY,
        });
        return { model: openai(modelName), provider: modelProvider };
      } else {
        // Default to openrouter
        const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY;
        if (!apiKey) {
          throw new Error(
            "OPENROUTER_API_KEY (or OPENAI_API_KEY) is not set. Set it in your environment or .env file to use provider: openrouter.",
          );
        }
        const openrouter = createOpenAI({
          baseURL: "https://openrouter.ai/api/v1",
          apiKey,
          headers: {
            "HTTP-Referer": "https://github.com/agentgrader/agr",
            "X-Title": "Agentgrader",
          },
        });
        return { model: openrouter(modelName), provider: modelProvider };
      }
    };

    const modelName = config.model || "gpt-4o-mini";
    const { model, provider } = buildModel(modelName);

    let submitted = false;
    let stepIndex = 0;
    let loopError: string | undefined;

    // tools the agent can call inside the sandbox
    const localTools = {
      executeCommand: tool({
        description: "Execute a terminal bash command inside the sandbox container.",
        parameters: z.object({
          command: z.string(),
        }),
        execute: async ({ command }) => {
          const res = await sandbox.exec(command);
          return {
            stdout: res.stdout,
            stderr: res.stderr,
            exitCode: res.exitCode,
          };
        },
      }),
      readFile: tool({
        description: "Read the content of a file in the sandbox workspace.",
        parameters: z.object({
          path: z.string(),
        }),
        execute: async ({ path }) => {
          try {
            const content = await sandbox.readFile(path);
            return { content };
          } catch (err: any) {
            return { error: err.message };
          }
        },
      }),
      writeFile: tool({
        description: "Write content to a file in the sandbox workspace.",
        parameters: z.object({
          path: z.string(),
          content: z.string(),
        }),
        execute: async ({ path, content }) => {
          try {
            await sandbox.writeFile(path, content);
            return { success: true };
          } catch (err: any) {
            return { error: err.message };
          }
        },
      }),
      submit: tool({
        description: "Submit the solution when the task is fully completed and verified.",
        parameters: z.object({
          summary: z.string().describe("A summary of changes made."),
        }),
        execute: async ({ summary }) => {
          submitted = true;
          return { message: "Solution submitted successfully." };
        },
      }),
    };

    // connect to any configured MCP servers and merge their tools in,
    // namespaced by server name to avoid collisions with local tools or
    // tools from other servers
    const mcpClients: McpClientHandle[] = [];
    const mcpTools: Record<string, unknown> = {};
    const mcpServers = (config.mcp_servers ?? {}) as Record<string, McpServerConfig>;

    for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
      try {
        const transport =
          "command" in serverConfig
            ? new Experimental_StdioMCPTransport({
                command: serverConfig.command,
                args: serverConfig.args,
                env: serverConfig.env,
              })
            : // note: the installed AI SDK version only supports "sse" as a
              // remote transport type, regardless of the configured `type`
              { type: "sse" as const, url: serverConfig.url, headers: serverConfig.headers };

        const client = (await experimental_createMCPClient({ transport })) as McpClientHandle;
        mcpClients.push(client);

        const serverTools = await client.tools();
        for (const [toolName, toolDef] of Object.entries(serverTools)) {
          mcpTools[`${serverName}_${toolName}`] = toolDef;
        }
      } catch (err: any) {
        console.error(`Failed to connect to MCP server "${serverName}": ${err.message}`);
      }
    }

    const allTools = { ...localTools, ...mcpTools } as typeof localTools;
    let tools = allTools;

    if (config.tools?.length) {
      const allowlist = new Set<string>(config.tools);
      const localToolNames = Object.keys(localTools);
      const availableNames = new Set(Object.keys(allTools));

      for (const name of allowlist) {
        if (!availableNames.has(name)) {
          console.warn(
            `Tool "${name}" listed in config.tools was not found among local tools (${localToolNames.join(", ")}) or connected MCP server tools - ignoring.`,
          );
        }
      }

      if (!allowlist.has("submit")) {
        console.warn(
          "tools allowlist did not include 'submit' - adding it automatically, as it is required to end a run.",
        );
      }

      const effectiveAllowlist = new Set([...allowlist, "submit"]);
      tools = Object.fromEntries(
        Object.entries(allTools).filter(([key]) => effectiveAllowlist.has(key)),
      ) as typeof localTools;

      console.log(`Tool allowlist active: ${Object.keys(tools).join(", ")}`);
    }

    // rough pricing per model — good enough for cost tracking
    const getPricing = (model: string) => {
      const name = model.toLowerCase();
      if (name.includes("claude-3-5-sonnet")) {
        return { input: 3 / 1000000, output: 15 / 1000000 };
      }
      if (name.includes("gpt-4o")) {
        return { input: 5 / 1000000, output: 15 / 1000000 };
      }
      if (name.includes("mini") || name.includes("flash")) {
        return { input: 0.15 / 1000000, output: 0.6 / 1000000 };
      }
      // unknown model, use a conservative estimate
      return { input: 2 / 1000000, output: 10 / 1000000 };
    };

    const pricing = getPricing(modelName);

    // per-step inactivity watchdog. NOT AbortSignal.timeout: that would cap
    // the ENTIRE multi-step loop at step_timeout_ms (a 50-step run dies
    // mid-flight at the deadline no matter how well it is progressing), and
    // its unref'd timer doesn't keep the event loop alive - if an abort
    // mid-step strands the loop with no live handles, the process exits 0
    // silently with no error and no result. A ref'd timer that is reset on
    // every finished step gives the intended semantics (abort only when a
    // single step stalls) and pins the event loop until the run settles.
    const stepTimeoutMs = config.step_timeout_ms || 120_000;
    const watchdogController = new AbortController();
    const onStepTimeout = () => {
      // log BEFORE aborting: if the abort's rejection path itself stalls
      // (observed: a stranded provider connection that ignores the signal),
      // this line is the only evidence the watchdog fired at all.
      console.error(`[watchdog] no step finished for ${stepTimeoutMs}ms - aborting the agent loop`);
      watchdogController.abort(
        new DOMException(`step exceeded step_timeout_ms (${stepTimeoutMs}ms)`, "TimeoutError"),
      );
    };
    let watchdog = setTimeout(onStepTimeout, stepTimeoutMs);
    const resetWatchdog = () => {
      clearTimeout(watchdog);
      watchdog = setTimeout(onStepTimeout, stepTimeoutMs);
    };

    // hard escape hatch: aborting the signal SHOULD reject generateText,
    // but a provider connection that already died silently can strand the
    // SDK's promise so the rejection never happens. Give it 15s after the
    // abort to unwind on its own, then force the loop to end so the run
    // still reaches scoring and cleanup.
    const forceSettleAfterAbort = new Promise<never>((_, reject) => {
      watchdogController.signal.addEventListener("abort", () => {
        const escapeTimer = setTimeout(() => {
          console.error(
            "[watchdog] generateText did not settle within 15s of abort - forcing the loop to end",
          );
          reject(watchdogController.signal.reason);
        }, 15_000);
        // don't keep the process alive just for this timer once the run ends
        if (typeof (escapeTimer as any).unref === "function") (escapeTimer as any).unref();
      });
    });

    // a single system message + the task prompt, instead of `system` +
    // `prompt`. This lets us attach `providerOptions.anthropic.cacheControl`
    // to the system message - Anthropic caches everything up to and
    // including the marked block (tools + system prompt), so repeated runs
    // with the same agent config (e.g. `agr bench`/matrix sweeps) only pay
    // full price for that prefix once per 5-minute cache window. Harmless on
    // other providers, which simply ignore the unrecognized providerOptions
    // key.
    const systemPrompt =
      config.system_prompt ||
      "You are an expert software engineering agent. Solve the coding task in the sandbox. Use tools to inspect, modify, and run tests. Call 'submit' when done.";
    const messages = [
      {
        role: "system" as const,
        content: systemPrompt,
        ...(provider === "anthropic"
          ? { providerOptions: { anthropic: { cacheControl: { type: "ephemeral" as const } } } }
          : {}),
      },
      { role: "user" as const, content: prompt },
    ];

    // lazily-built model for `escalate_model`, reused across steps once
    // escalation triggers.
    let escalatedModel: any;

    try {
      await Promise.race([
        generateText({
          model,
          maxSteps: config.max_steps || 30,
          abortSignal: watchdogController.signal,
          tools,
          messages,
          experimental_telemetry: { isEnabled: true },
          // start on the cheap/default model; once the agent has spent
          // `escalate_after_steps` steps without calling `submit`, switch to
          // `escalate_model` for the rest of the run (e.g. haiku -> sonnet
          // when the cheap model is struggling). No-op unless both
          // `escalate_after_steps` and `escalate_model` are set.
          experimental_prepareStep: async ({ stepNumber }) => {
            if (
              !submitted &&
              config.escalate_model &&
              config.escalate_after_steps != null &&
              stepNumber >= config.escalate_after_steps
            ) {
              if (!escalatedModel) {
                escalatedModel = buildModel(config.escalate_model).model;
                console.error(
                  `[escalate] step ${stepNumber} >= escalate_after_steps (${config.escalate_after_steps}) - switching to ${config.escalate_model}`,
                );
              }
              return { model: escalatedModel };
            }
            return undefined;
          },
          // small models (e.g. haiku) sometimes call a toolkit/skill's CLI name
          // (e.g. "view-structure") as if it were a tool, rather than running it
          // via executeCommand. Without this, the AI SDK throws and aborts the
          // entire run on the first such mistake. Repair by replaying the call
          // as `executeCommand <toolName> <args...>` so the agent gets a real
          // result and can keep going.
          experimental_repairToolCall: async ({ toolCall, tools: availableTools, error }) => {
            if (!NoSuchToolError.isInstance(error) || !("executeCommand" in availableTools)) {
              return null;
            }

            let args: Record<string, unknown> = {};
            try {
              args = JSON.parse(toolCall.args);
            } catch {}

            const argString = Object.values(args)
              .map((value) =>
                typeof value === "string"
                  ? `'${value.replace(/'/g, `'\\''`)}'`
                  : JSON.stringify(value),
              )
              .join(" ");

            return {
              ...toolCall,
              toolName: "executeCommand",
              args: JSON.stringify({ command: `${toolCall.toolName} ${argString}`.trim() }),
            };
          },
          onStepFinish: ({ text, toolCalls, toolResults, usage, providerMetadata }) => {
            resetWatchdog();
            const promptTokens = usage?.promptTokens || 0;
            const completionTokens = usage?.completionTokens || 0;

            // Anthropic prompt-cache stats (0 for providers/models without
            // cache support, or when nothing was cached yet).
            const cacheReadTokens = Number(providerMetadata?.anthropic?.cacheReadInputTokens ?? 0);
            const cacheCreationTokens = Number(
              providerMetadata?.anthropic?.cacheCreationInputTokens ?? 0,
            );
            const regularInputTokens = Math.max(
              0,
              promptTokens - cacheReadTokens - cacheCreationTokens,
            );
            // cache reads are billed at 0.1x the input price, cache writes
            // at 1.25x (5-minute TTL) - see Anthropic's prompt caching docs.
            const stepCost =
              regularInputTokens * pricing.input +
              cacheReadTokens * pricing.input * 0.1 +
              cacheCreationTokens * pricing.input * 1.25 +
              completionTokens * pricing.output;

            // forward step events to whoever is listening (dashboard, db, etc)
            if (text) {
              onStep({
                index: stepIndex++,
                kind: "message",
                tokensIn: promptTokens,
                tokensOut: completionTokens,
                cachedTokens: cacheReadTokens,
                costUsd: stepCost,
                timestamp: Date.now(),
                content: text,
              });
            }

            for (const tc of toolCalls) {
              onStep({
                index: stepIndex++,
                kind: "tool_call",
                tool: tc.toolName,
                tokensIn: 0,
                tokensOut: 0,
                cachedTokens: 0,
                costUsd: 0,
                timestamp: Date.now(),
                content: JSON.stringify(tc.args),
              });
            }

            for (const tr of toolResults) {
              onStep({
                index: stepIndex++,
                kind: "tool_result",
                tool: tr.toolName,
                tokensIn: 0,
                tokensOut: 0,
                cachedTokens: 0,
                costUsd: 0,
                timestamp: Date.now(),
                content: JSON.stringify(tr.result),
              });
            }
          },
        }),
        forceSettleAfterAbort,
      ]);
    } catch (err: any) {
      loopError =
        err.name === "AbortError" || err.name === "TimeoutError"
          ? `Aborted: a single step exceeded step_timeout_ms (${stepTimeoutMs}ms) with no progress. Raise step_timeout_ms in agent.yaml if individual steps are legitimately slow.`
          : err.message;
      console.error(`Error in generateText agent loop: ${err.message}`);
    } finally {
      clearTimeout(watchdog);
      for (const client of mcpClients) {
        try {
          await client.close();
        } catch (e) {}
      }
    }

    const finalDiff = await sandbox.gitDiff();

    return {
      finished: submitted,
      finalDiff,
      error: loopError,
    };
  }
}

export { AiSdkAgentAdapter as OpenRouterAgentAdapter };

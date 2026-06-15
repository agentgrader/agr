import { readFileSync } from "node:fs";
import type {
  PatchApplyResult,
  SandboxHandle,
  SandboxProvider,
  SandboxStdioProcess,
} from "@agentgrader/core";
import {
  copyDirectoryRecursiveViaWriteFile,
  initializeSandboxWorkspace,
  localFileBaseName,
} from "@agentgrader/core";
import { Sandbox } from "e2b";

export class E2bSandboxHandle implements SandboxHandle {
  readonly sandboxBridgeId: string;

  constructor(private sandbox: Sandbox) {
    this.sandboxBridgeId = sandbox.sandboxId;
  }

  async exec(
    cmd: string,
    timeoutMs = 180_000,
  ): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut?: boolean }> {
    try {
      const result = await this.sandbox.commands.run(cmd, {
        cwd: "/app",
        timeoutMs,
      });
      return {
        stdout: result.stdout,
        stderr: result.stderr,
        exitCode: result.exitCode,
      };
    } catch (err: any) {
      if (String(err?.message ?? err).includes("timeout")) {
        return {
          stdout: "",
          stderr: `[sandbox] command timed out after ${timeoutMs}ms: ${cmd}`,
          exitCode: 124,
          timedOut: true,
        };
      }
      throw err;
    }
  }

  async writeFile(path: string, content: string): Promise<void> {
    await this.sandbox.files.write(path, content);
  }

  async readFile(path: string): Promise<string> {
    const content = await this.sandbox.files.read(path);
    return typeof content === "string" ? content : new TextDecoder().decode(content);
  }

  async gitDiff(): Promise<string> {
    const res = await this.exec("git diff");
    return res.stdout;
  }

  async applyPatch(diff: string): Promise<PatchApplyResult> {
    if (!diff || !diff.trim()) {
      return { applied: true, repaired: false, output: "Empty patch - nothing to apply." };
    }

    const patchPath = `/tmp/agr-patch-${Date.now()}.diff`;
    await this.writeFile(patchPath, diff.endsWith("\n") ? diff : `${diff}\n`);

    const attempts: { label: string; cmd: string; repaired: boolean }[] = [
      { label: "git apply", cmd: `git apply --whitespace=nowarn "${patchPath}"`, repaired: false },
      {
        label: "git apply --3way",
        cmd: `git apply --3way --whitespace=nowarn "${patchPath}"`,
        repaired: true,
      },
      {
        label: "patch --fuzz=3",
        cmd: `patch -p1 --fuzz=3 --batch < "${patchPath}"`,
        repaired: true,
      },
    ];

    const log: string[] = [];
    for (const attempt of attempts) {
      const res = await this.exec(attempt.cmd);
      log.push(`$ ${attempt.label}\n${res.stdout}${res.stderr}`.trim());
      if (res.exitCode === 0) {
        await this.exec(`rm -f "${patchPath}"`);
        return { applied: true, repaired: attempt.repaired, output: log.join("\n\n") };
      }
    }

    await this.exec(`rm -f "${patchPath}"`);
    return { applied: false, repaired: false, output: log.join("\n\n") };
  }

  async spawnStdio(cmd: string): Promise<SandboxStdioProcess> {
    let stdoutHandler: ((chunk: string) => void) | undefined;
    let stderrHandler: ((chunk: string) => void) | undefined;
    let exitHandler: ((code: number | null) => void) | undefined;

    const handle = await this.sandbox.commands.run(cmd, {
      cwd: "/app",
      background: true,
      stdin: true,
      onStdout: (stdout) => stdoutHandler?.(stdout),
      onStderr: (stderr) => stderrHandler?.(stderr),
    });

    void handle.wait().then(
      (result) => exitHandler?.(result.exitCode),
      () => exitHandler?.(1),
    );

    return {
      write(data: string) {
        void handle.sendStdin(data);
      },
      onStdout(handler) {
        stdoutHandler = handler;
      },
      onStderr(handler) {
        stderrHandler = handler;
      },
      onExit(handler) {
        exitHandler = handler;
        if (handle.exitCode !== undefined) handler(handle.exitCode);
      },
      close() {
        void handle.closeStdin();
      },
    };
  }

  async destroy(): Promise<void> {
    await this.sandbox.kill();
  }
}

export class E2bSandboxProvider implements SandboxProvider {
  readonly name = "e2b";

  async create(opts: {
    image?: string;
    gitSnapshot?: string;
    toolkits?: string[];
  }): Promise<SandboxHandle> {
    if (!process.env.E2B_API_KEY) {
      throw new Error("E2B_API_KEY is required for the e2b sandbox provider.");
    }

    const sandbox = opts.image
      ? await Sandbox.create(opts.image)
      : await Sandbox.create();
    const handle = new E2bSandboxHandle(sandbox);

    await initializeSandboxWorkspace(
      handle,
      {
        copyDirectory: async (localPath, remotePath, excludes = []) => {
          if (excludes.length === 0) {
            await copyDirectoryRecursiveViaWriteFile(handle, localPath, remotePath, excludes);
            return;
          }
          await copyDirectoryRecursiveViaWriteFile(handle, localPath, remotePath, excludes);
        },
        copyFile: async (localFile, remoteDir) => {
          const content = readFileSync(localFile);
          const remotePath = `${remoteDir}/${localFileBaseName(localFile)}`;
          await handle.writeFile(remotePath, content.toString("utf-8"));
        },
      },
      { gitSnapshot: opts.gitSnapshot, toolkits: opts.toolkits },
    );

    return handle;
  }
}

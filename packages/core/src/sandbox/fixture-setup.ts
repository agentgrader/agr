import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { basename, join, resolve } from "node:path";
import type { SandboxHandle } from "../adapters/sandbox-provider";

export interface SandboxWorkspaceSetup {
  copyDirectory(localPath: string, remotePath: string, excludes?: string[]): Promise<void>;
  copyFile(localFile: string, remoteDir: string): Promise<void>;
}

export interface InitializeSandboxOptions {
  gitSnapshot?: string;
  toolkits?: string[];
  setupTimeoutMs?: number;
}

function shouldExclude(name: string, excludes: string[]): boolean {
  return excludes.includes(name);
}

export async function copyDirectoryRecursiveViaWriteFile(
  handle: SandboxHandle,
  localPath: string,
  remotePath: string,
  excludes: string[] = [],
): Promise<void> {
  await handle.exec(`mkdir -p "${remotePath}"`);
  for (const entry of readdirSync(localPath)) {
    if (shouldExclude(entry, excludes)) continue;
    const localEntry = join(localPath, entry);
    const remoteEntry = `${remotePath}/${entry}`;
    if (statSync(localEntry).isDirectory()) {
      await copyDirectoryRecursiveViaWriteFile(handle, localEntry, remoteEntry, []);
    } else {
      const content = readFileSync(localEntry, "utf-8");
      await handle.writeFile(remoteEntry, content);
    }
  }
}

export async function initializeSandboxWorkspace(
  handle: SandboxHandle,
  setup: SandboxWorkspaceSetup,
  opts: InitializeSandboxOptions,
): Promise<void> {
  await handle.exec("mkdir -p /app");

  if (opts.gitSnapshot) {
    const localPath = resolve(opts.gitSnapshot);
    if (existsSync(localPath)) {
      await setup.copyDirectory(localPath, "/app");
    }
  }

  await handle.exec(
    "git init && git config user.email 'agent@agentgrader.local' && git config user.name 'Agentgrader' && git add -A && git commit -m 'initial' || true",
  );

  const setupTimeoutMs = opts.setupTimeoutMs ?? 120_000;

  for (const toolkitOpt of opts.toolkits ?? []) {
    const toolkitPath = resolve(toolkitOpt);
    if (!existsSync(toolkitPath)) continue;

    await setup.copyDirectory(toolkitPath, "/app", ["bin", "setup.sh"]);

    const binPath = resolve(toolkitPath, "bin");
    if (existsSync(binPath)) {
      await handle.exec("mkdir -p /usr/local/bin");
      await setup.copyDirectory(binPath, "/usr/local/bin");
      await handle.exec("chmod +x /usr/local/bin/* || true");
    }

    const setupPath = resolve(toolkitPath, "setup.sh");
    if (existsSync(setupPath)) {
      await setup.copyFile(setupPath, "/tmp");
      const res = await handle.exec("sh /tmp/setup.sh && rm -f /tmp/setup.sh", setupTimeoutMs);
      if (res.exitCode !== 0) {
        throw new Error(`Toolkit setup.sh failed (exit ${res.exitCode}): ${res.stderr || res.stdout}`);
      }
    }
  }
}

export function localFileBaseName(localFile: string): string {
  return basename(localFile);
}

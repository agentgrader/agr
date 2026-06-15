import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import {
  copyDirectoryRecursiveViaWriteFile,
  initializeSandboxWorkspace,
  localFileBaseName,
} from "./fixture-setup";
import type { SandboxHandle } from "../adapters/sandbox-provider";

function createMockHandle(): SandboxHandle & { commands: string[]; files: Map<string, string> } {
  const commands: string[] = [];
  const files = new Map<string, string>();
  return {
    commands,
    files,
    exec: async (cmd, _timeoutMs) => {
      commands.push(cmd);
      return { exitCode: 0, stdout: "", stderr: "" };
    },
    readFile: async (path) => files.get(path) ?? "",
    writeFile: async (path, content) => {
      files.set(path, content);
    },
    gitDiff: async () => "",
    destroy: async () => {},
  };
}

describe("localFileBaseName", () => {
  test("returns the basename of a path", () => {
    expect(localFileBaseName("/tmp/toolkits/foo/setup.sh")).toBe("setup.sh");
  });
});

describe("copyDirectoryRecursiveViaWriteFile", () => {
  test("copies files into the sandbox via writeFile", async () => {
    const dir = mkdtempSync(join(tmpdir(), "agr-fixture-"));
    try {
      writeFileSync(join(dir, "hello.txt"), "world", "utf-8");
      const handle = createMockHandle();
      await copyDirectoryRecursiveViaWriteFile(handle, dir, "/app/fixture");
      expect(handle.files.get("/app/fixture/hello.txt")).toBe("world");
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("initializeSandboxWorkspace", () => {
  test("runs setup.sh with timeout and fails on non-zero exit", async () => {
    const toolkitDir = mkdtempSync(join(tmpdir(), "agr-toolkit-"));
    try {
      writeFileSync(join(toolkitDir, "setup.sh"), "exit 1", "utf-8");
      const handle = createMockHandle();
      handle.exec = async (cmd) => {
        handle.commands.push(cmd);
        if (cmd.includes("setup.sh")) {
          return { exitCode: 1, stdout: "", stderr: "setup failed" };
        }
        return { exitCode: 0, stdout: "", stderr: "" };
      };

      await expect(
        initializeSandboxWorkspace(handle, {
          copyDirectory: async () => {},
          copyFile: async (localFile, remoteDir) => {
            await handle.writeFile(`${remoteDir}/${localFileBaseName(localFile)}`, "exit 1");
          },
        }, { toolkits: [toolkitDir], setupTimeoutMs: 1000 }),
      ).rejects.toThrow("Toolkit setup.sh failed");
    } finally {
      rmSync(toolkitDir, { recursive: true, force: true });
    }
  });

  test("copies toolkit bin scripts into /usr/local/bin", async () => {
    const toolkitDir = mkdtempSync(join(tmpdir(), "agr-toolkit-"));
    try {
      const binDir = join(toolkitDir, "bin");
      mkdirSync(binDir);
      writeFileSync(join(binDir, "my-tool"), "#!/bin/sh\necho ok", "utf-8");
      const handle = createMockHandle();

      await initializeSandboxWorkspace(handle, {
        copyDirectory: async (localPath, remotePath) => {
          if (localPath.endsWith("/bin")) {
            await handle.writeFile(`${remotePath}/my-tool`, "#!/bin/sh\necho ok");
          }
        },
        copyFile: async () => {},
      }, { toolkits: [toolkitDir] });

      expect(handle.commands.some((c) => c.includes("chmod +x /usr/local/bin/*"))).toBe(true);
    } finally {
      rmSync(toolkitDir, { recursive: true, force: true });
    }
  });
});

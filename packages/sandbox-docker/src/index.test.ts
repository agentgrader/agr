import { chmodSync, mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { SandboxHandle } from "@agentgrader/core";
import { afterEach, describe, expect, test } from "bun:test";
import Docker from "dockerode";
import { DockerSandboxProvider } from "./index";

// These tests spin up real containers, so they only run when a Docker daemon
// is reachable - skip cleanly (rather than fail) in environments without
// Docker, e.g. a sandboxed CI runner.
let dockerAvailable = false;
try {
  await new Docker().ping();
  dockerAvailable = true;
} catch {}

const maybeDescribe = dockerAvailable ? describe : describe.skip;

// `node:20` is the provider's default image and is already pulled by other
// tests/dev workflows in this repo, so these tests don't trigger a pull.
const IMAGE = "node:20";

// container create + destroy (docker stop's default grace period) can take
// well past bun:test's 5s default per-test/hook timeout.
const TIMEOUT = 30_000;

maybeDescribe("DockerSandboxProvider", () => {
  const provider = new DockerSandboxProvider();
  let handle: SandboxHandle | undefined;
  let fixtureDir: string | undefined;

  afterEach(async () => {
    if (handle) {
      await handle.destroy();
      handle = undefined;
    }
    if (fixtureDir) {
      rmSync(fixtureDir, { recursive: true, force: true });
      fixtureDir = undefined;
    }
  });

  test(
    "create() commits the fixture into /app; writeFile/readFile + gitDiff reflect later edits",
    async () => {
      fixtureDir = mkdtempSync(join(tmpdir(), "fixture-"));
      writeFileSync(join(fixtureDir, "README.md"), "hello fixture\n");

      handle = await provider.create({ image: IMAGE, gitSnapshot: fixtureDir });

      const pwd = await handle.exec("pwd");
      expect(pwd.stdout.trim()).toBe("/app");

      expect(await handle.readFile("/app/README.md")).toBe("hello fixture\n");

      const log = await handle.exec("git log --oneline");
      expect(log.stdout).toContain("initial");

      const cleanStatus = await handle.exec("git status --porcelain");
      expect(cleanStatus.stdout.trim()).toBe("");

      await handle.writeFile("/app/README.md", "edited fixture\n");
      expect(await handle.readFile("/app/README.md")).toBe("edited fixture\n");

      const diff = await handle.gitDiff();
      expect(diff).toContain("README.md");
      expect(diff).toContain("-hello fixture");
      expect(diff).toContain("+edited fixture");
    },
    TIMEOUT,
  );

  test(
    "spawnStdio() bridges stdio to a process running inside the container",
    async () => {
      handle = await provider.create({ image: IMAGE });
      if (!handle.spawnStdio) throw new Error("spawnStdio not implemented");

      const proc = await handle.spawnStdio("cat");

      const chunks: string[] = [];
      proc.onStdout((chunk) => chunks.push(chunk));
      const exitCode = new Promise<number | null>((resolve) => proc.onExit(resolve));

      proc.write("hello sandbox\n");
      await new Promise((resolve) => setTimeout(resolve, 1000));
      proc.close();

      expect(await exitCode).toBe(0);
      expect(chunks.join("")).toContain("hello sandbox");
    },
    TIMEOUT,
  );

  describe("toolkit injection", () => {
    let toolkitDir: string | undefined;

    afterEach(() => {
      if (toolkitDir) {
        rmSync(toolkitDir, { recursive: true, force: true });
        toolkitDir = undefined;
      }
    });

    test(
      "puts bin/ on PATH, copies .claude/skills into /app, and runs setup.sh",
      async () => {
        toolkitDir = mkdtempSync(join(tmpdir(), "toolkit-"));

        mkdirSync(join(toolkitDir, "bin"), { recursive: true });
        const toolPath = join(toolkitDir, "bin", "hello-tool");
        writeFileSync(toolPath, "#!/bin/sh\necho hello-from-toolkit\n");
        chmodSync(toolPath, 0o755);

        mkdirSync(join(toolkitDir, ".claude", "skills", "demo"), { recursive: true });
        writeFileSync(
          join(toolkitDir, ".claude", "skills", "demo", "SKILL.md"),
          "---\nname: demo\ndescription: A demo skill.\n---\n\nBody for demo.\n",
        );

        writeFileSync(join(toolkitDir, "setup.sh"), "#!/bin/sh\necho setup-ran > /tmp/setup-marker\n");

        handle = await provider.create({ image: IMAGE, toolkits: [toolkitDir] });

        // bin/ contents land on PATH and are executable
        const toolRes = await handle.exec("hello-tool");
        expect(toolRes.exitCode).toBe(0);
        expect(toolRes.stdout).toContain("hello-from-toolkit");

        // .claude/skills/ is copied into /app
        const skillRes = await handle.exec("cat /app/.claude/skills/demo/SKILL.md");
        expect(skillRes.stdout).toContain("name: demo");

        // setup.sh ran exactly once at sandbox-creation time
        const setupRes = await handle.exec("cat /tmp/setup-marker");
        expect(setupRes.stdout).toContain("setup-ran");

        // bin/ and setup.sh themselves aren't copied into /app
        const binCheck = await handle.exec("test -e /app/bin && echo yes || echo no");
        expect(binCheck.stdout.trim()).toBe("no");
        const setupCheck = await handle.exec("test -e /app/setup.sh && echo yes || echo no");
        expect(setupCheck.stdout.trim()).toBe("no");

        // toolkit injection happens after the initial commit, so it shows up
        // as untracked rather than as a diff against the fixture
        const status = await handle.exec("git status --porcelain");
        expect(status.stdout).toContain("?? .claude/");
      },
      TIMEOUT,
    );

    test(
      "skips toolkits whose directory doesn't exist",
      async () => {
        handle = await provider.create({ image: IMAGE, toolkits: ["/no/such/toolkit"] });
        const pwd = await handle.exec("pwd");
        expect(pwd.stdout.trim()).toBe("/app");
      },
      TIMEOUT,
    );
  });
});

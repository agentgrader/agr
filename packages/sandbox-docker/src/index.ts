import { execFile } from "node:child_process";
import { existsSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join, resolve } from "node:path";
import { Readable, Writable } from "node:stream";
import type { PatchApplyResult, SandboxHandle, SandboxProvider } from "@agentgrader/core";
import Docker from "dockerode";

export class DockerSandboxHandle implements SandboxHandle {
  private container: Docker.Container;

  constructor(container: Docker.Container) {
    this.container = container;
  }

  async exec(
    cmd: string,
    timeoutMs = 180_000,
  ): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut?: boolean }> {
    const exec = await this.container.exec({
      Cmd: ["sh", "-c", cmd],
      AttachStdout: true,
      AttachStderr: true,
      WorkingDir: "/app",
    });

    const stream = await exec.start({});
    const stdoutBuffer: string[] = [];
    const stderrBuffer: string[] = [];

    const stdoutWritable = new Writable({
      write(chunk, encoding, callback) {
        stdoutBuffer.push(chunk.toString());
        callback();
      },
    });

    const stderrWritable = new Writable({
      write(chunk, encoding, callback) {
        stderrBuffer.push(chunk.toString());
        callback();
      },
    });

    this.container.modem.demuxStream(stream, stdoutWritable, stderrWritable);

    // poll until the exec'd process exits, but never longer than `timeoutMs`
    // - a hanging command (agent-induced infinite loop, a test that never
    // returns, an install that never connects) would otherwise block this
    // call - and everything awaiting it (scoring, cleanup, the whole run) -
    // forever, with no log output to explain why.
    const start = Date.now();
    let running = true;
    let inspectData: any;
    let timedOut = false;
    while (running) {
      inspectData = await exec.inspect();
      running = inspectData.Running;
      if (running) {
        if (Date.now() - start >= timeoutMs) {
          timedOut = true;
          break;
        }
        await new Promise((resolve) => setTimeout(resolve, 50));
      }
    }

    if (timedOut) {
      stdoutBuffer.push(
        `\n[sandbox] command timed out after ${timeoutMs}ms and was abandoned: ${cmd}\n`,
      );
      return {
        stdout: stdoutBuffer.join(""),
        stderr: stderrBuffer.join(""),
        exitCode: 124,
        timedOut: true,
      };
    }

    return {
      stdout: stdoutBuffer.join(""),
      stderr: stderrBuffer.join(""),
      exitCode: inspectData?.ExitCode ?? 0,
    };
  }

  async writeFile(path: string, content: string): Promise<void> {
    // make sure the directory exists before writing
    const dir = dirname(path);
    await this.exec(`mkdir -p "${dir}"`);

    // write via tar + putArchive (like copyFileToContainer) rather than a
    // hijacked exec stdin stream: under Bun, `exec.start({hijack: true,
    // stdin: true})` never receives the HTTP upgrade response and hangs
    // forever, since docker-modem's hijack path relies on a raw socket
    // `upgrade` event that Bun's http client doesn't emit.
    const localDir = mkdtempSync(join(tmpdir(), "agr-write-"));
    try {
      const localFile = join(localDir, basename(path));
      writeFileSync(localFile, content);
      await copyFileToContainer(this.container, localFile, dir);
    } finally {
      rmSync(localDir, { recursive: true, force: true });
    }
  }

  async readFile(path: string): Promise<string> {
    const res = await this.exec(`cat "${path}"`);
    if (res.exitCode !== 0) {
      throw new Error(`Failed to read file ${path}: ${res.stderr}`);
    }
    return res.stdout;
  }

  async gitDiff(): Promise<string> {
    const res = await this.exec("git diff");
    return res.stdout;
  }

  async applyPatch(diff: string): Promise<PatchApplyResult> {
    if (!diff || !diff.trim()) {
      return { applied: true, repaired: false, output: "Empty patch - nothing to apply." };
    }

    const patchPath = `/tmp/agr-patch-${Date.now()}-${Math.random().toString(36).slice(2)}.diff`;
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

  async destroy(): Promise<void> {
    try {
      // `remove({force: true})` is equivalent to `docker rm -f`: it SIGKILLs
      // a running container immediately and removes it in one call. A
      // separate `stop()` first would send SIGTERM and wait out Docker's
      // ~10s default grace period before SIGKILL - pointless for these
      // short-lived, disposable sandboxes.
      await this.container.remove({ force: true });
    } catch (e: any) {
      // "no such container" (HTTP 404) is expected if it's already gone;
      // anything else is worth surfacing, since a swallowed error here is
      // how containers silently pile up instead of being removed.
      if (e?.statusCode !== 404) {
        console.error(`Failed to remove sandbox container: ${e.message || e}`);
      }
    }
  }
}

/**
 * Tars a local directory and copies it into the container at `containerPath`,
 * optionally excluding top-level entries (e.g. a toolkit's `bin/` directory,
 * which gets copied to `/usr/local/bin` separately).
 *
 * The tarball is built into an in-memory buffer (rather than piping a
 * `tar` child process's stdout directly into `putArchive`'s request
 * stream) because, when this runs inside a Mastra workflow step, the
 * piped-stream variant's `putArchive` callback never fires - the request
 * silently hangs forever with no error, which made every test case with a
 * fixture appear to "complete" instantly with no agent activity at all.
 */
async function copyDirToContainer(
  container: Docker.Container,
  localPath: string,
  containerPath: string,
  excludes: string[] = [],
): Promise<void> {
  const args = ["--no-xattrs"];
  for (const exclude of excludes) {
    args.push("--exclude", exclude);
  }
  args.push("-cf", "-", "-C", localPath, ".");

  const tarBuffer = await new Promise<Buffer>((resolve, reject) => {
    execFile("tar", args, {
      env: { ...process.env, COPYFILE_DISABLE: "1" },
      maxBuffer: 1024 * 1024 * 1024,
      encoding: "buffer",
    }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });

  await new Promise<void>((resolve, reject) => {
    container.putArchive(tarBuffer, { path: containerPath }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

async function copyFileToContainer(
  container: Docker.Container,
  localFile: string,
  containerPath: string,
): Promise<void> {
  const dir = dirname(localFile);
  const base = basename(localFile);

  const tarBuffer = await new Promise<Buffer>((resolve, reject) => {
    execFile("tar", ["--no-xattrs", "-cf", "-", "-C", dir, base], {
      env: { ...process.env, COPYFILE_DISABLE: "1" },
      maxBuffer: 1024 * 1024 * 1024,
      encoding: "buffer",
    }, (err, stdout) => {
      if (err) reject(err);
      else resolve(stdout);
    });
  });

  await new Promise<void>((resolve, reject) => {
    container.putArchive(tarBuffer, { path: containerPath }, (err) => {
      if (err) reject(err);
      else resolve();
    });
  });
}

export interface OrphanedSandbox {
  id: string;
  image: string;
  status: string;
  createdAt?: number;
}

export class DockerSandboxProvider implements SandboxProvider {
  readonly name = "docker";
  private docker: Docker;

  constructor() {
    this.docker = new Docker();
  }

  /**
   * Lists sandbox containers created by this provider (identified by the
   * `agentgrader.sandbox` label), regardless of which run created them.
   * Useful for finding sandboxes left behind by a run that was killed
   * before its `cleanup` step could call `destroy()`.
   */
  async listSandboxes(): Promise<OrphanedSandbox[]> {
    const containers = await this.docker.listContainers({
      all: true,
      filters: { label: ["agentgrader.sandbox=true"] },
    });

    return containers.map((c) => ({
      id: c.Id,
      image: c.Image,
      status: c.Status,
      createdAt: c.Labels?.["agentgrader.createdAt"]
        ? Number(c.Labels["agentgrader.createdAt"])
        : undefined,
    }));
  }

  /** Force-stops and removes a sandbox container by id. */
  async removeSandbox(id: string): Promise<void> {
    const container = this.docker.getContainer(id);
    await container.remove({ force: true });
  }

  async create(opts: {
    image?: string;
    gitSnapshot?: string;
    toolkits?: string[];
  }): Promise<SandboxHandle> {
    const image = opts.image || "node:20";

    try {
      await this.docker.ping();
    } catch (e: any) {
      throw new Error(
        `Could not connect to Docker (${e.message}). Make sure Docker is installed and running.`,
      );
    }

    // pull if not cached locally
    let imageExists = false;
    try {
      await this.docker.getImage(image).inspect();
      imageExists = true;
    } catch (e) {}

    if (!imageExists) {
      console.log(`Docker image "${image}" not found locally. Pulling...`);
      const stream = await this.docker.pull(image);
      await new Promise<void>((resolve, reject) => {
        this.docker.modem.followProgress(stream, (err, res) => {
          if (err) reject(err);
          else resolve();
        });
      });
      console.log(`Docker image "${image}" successfully pulled.`);
    }

    // create and immediately start the container. Labeled so leftover
    // sandboxes (e.g. from a run whose process was killed before `cleanup`
    // could call destroy()) can be found and removed later via
    // `agr cleanup` instead of accumulating silently.
    const container = await this.docker.createContainer({
      Image: image,
      Cmd: ["tail", "-f", "/dev/null"],
      Tty: true,
      WorkingDir: "/app",
      Labels: {
        "agentgrader.sandbox": "true",
        "agentgrader.createdAt": String(Date.now()),
      },
    });

    await container.start();
    const handle = new DockerSandboxHandle(container);

    // make sure /app exists even on bare images
    await handle.exec("mkdir -p /app");

    // copy fixture into /app if a path was given
    if (opts.gitSnapshot) {
      const localPath = resolve(opts.gitSnapshot);
      if (existsSync(localPath)) {
        await copyDirToContainer(container, localPath, "/app");
      }
    }

    // init a git repo so we can diff what the agent changed later
    await handle.exec(
      "git init && git config user.email 'agent@agentgrader.local' && git config user.name 'Agentgrader' && git add -A && git commit -m 'initial' || true",
    );

    // inject toolkits (custom CLI tools + Agent Skills docs) after the
    // initial commit, so they're untracked and don't show up in gitDiff()
    for (const toolkitOpt of opts.toolkits ?? []) {
      const toolkitPath = resolve(toolkitOpt);
      if (!existsSync(toolkitPath)) continue;

      // copy everything except bin/ and setup.sh into /app (e.g. .claude/skills/...)
      await copyDirToContainer(container, toolkitPath, "/app", ["bin", "setup.sh"]);

      // copy bin/ contents onto PATH and make them executable
      const binPath = resolve(toolkitPath, "bin");
      if (existsSync(binPath)) {
        await handle.exec("mkdir -p /usr/local/bin");
        await copyDirToContainer(container, binPath, "/usr/local/bin");
        await handle.exec("chmod +x /usr/local/bin/* || true");
      }

      // run setup.sh once, if present, so toolkit commands can rely on
      // dependencies (e.g. `pip install pytest`) being present up front
      // instead of every invocation re-checking/installing them
      const setupPath = resolve(toolkitPath, "setup.sh");
      if (existsSync(setupPath)) {
        await copyFileToContainer(container, setupPath, "/tmp");
        await handle.exec("sh /tmp/setup.sh && rm -f /tmp/setup.sh");
      }
    }

    return handle;
  }
}

export interface PatchApplyResult {
  /** true if the patch was applied successfully (with or without repair) */
  applied: boolean;
  /** true if a fallback/repair strategy (3-way merge or `patch --fuzz`) was needed */
  repaired: boolean;
  /** combined output/diagnostics from the apply attempt(s) */
  output: string;
}

export interface SandboxHandle {
  /**
   * Runs `cmd` in the sandbox. If it hasn't finished after `timeoutMs`
   * (default 180000), stops waiting and returns with `timedOut: true` and
   * `exitCode: 124` (the conventional shell timeout exit code) - the process
   * may still be running inside the container, but `destroy()` will reap it.
   * Without this, a single hanging command (an agent-induced infinite loop,
   * a network-dependent install that never connects, ...) blocks the entire
   * run - including scoring and cleanup - forever.
   */
  exec(
    cmd: string,
    timeoutMs?: number,
  ): Promise<{ stdout: string; stderr: string; exitCode: number; timedOut?: boolean }>;
  writeFile(path: string, content: string): Promise<void>;
  readFile(path: string): Promise<string>;
  gitDiff(): Promise<string>;
  /**
   * Applies a unified diff to the sandbox's working tree.
   *
   * Mirrors SWE-bench's patch-application robustness: tries `git apply`
   * first, then falls back to `git apply --3way`, then `patch --fuzz=3`.
   * Implementations should report whether a fallback ("repair") was needed.
   */
  applyPatch(diff: string): Promise<PatchApplyResult>;
  destroy(): Promise<void>;
}

export interface SandboxProvider {
  readonly name: string; // "docker" | "e2b" | "daytona"
  create(opts: {
    image?: string;
    gitSnapshot?: string;
    /**
     * Absolute paths to local "toolkit" directories to inject into the
     * sandbox, in addition to `gitSnapshot`. A toolkit may contain a `bin/`
     * directory (custom CLI tools, made executable and put on `PATH`) and a
     * `.claude/skills/` directory (Agent Skills documentation, see
     * `runner/skills.ts`).
     */
    toolkits?: string[];
  }): Promise<SandboxHandle>;
}

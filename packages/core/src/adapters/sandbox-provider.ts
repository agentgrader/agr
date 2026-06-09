export interface SandboxHandle {
  exec(cmd: string): Promise<{ stdout: string; stderr: string; exitCode: number }>;
  writeFile(path: string, content: string): Promise<void>;
  readFile(path: string): Promise<string>;
  gitDiff(): Promise<string>;
  destroy(): Promise<void>;
}

export interface SandboxProvider {
  readonly name: string; // "docker" | "e2b" | "daytona"
  create(opts: { image?: string; gitSnapshot?: string }): Promise<SandboxHandle>;
}

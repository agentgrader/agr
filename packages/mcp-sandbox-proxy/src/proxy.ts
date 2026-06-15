import { spawn } from "node:child_process";

function shellQuote(value: string): string {
  return `'${value.replace(/'/g, `'\\''`)}'`;
}

export function parseProxyArgs(argv: string[]): { bridgeId: string; innerCommand: string } {
  const bridgeIdx = argv.indexOf("--bridge-id");
  if (bridgeIdx < 0 || !argv[bridgeIdx + 1]) {
    throw new Error("Usage: agr-mcp-proxy --bridge-id <containerId> -- <command...>");
  }
  const bridgeId = argv[bridgeIdx + 1]!;
  const sepIdx = argv.indexOf("--");
  if (sepIdx < 0 || sepIdx + 1 >= argv.length) {
    throw new Error("Missing inner command after --");
  }
  const innerParts = argv.slice(sepIdx + 1);
  const innerCommand = innerParts.map(shellQuote).join(" ");
  return { bridgeId, innerCommand };
}

export function runProxy(bridgeId: string, innerCommand: string): void {
  const child = spawn("docker", ["exec", "-i", bridgeId, "sh", "-c", innerCommand], {
    stdio: ["pipe", "pipe", "pipe"],
  });

  process.stdin.pipe(child.stdin!);
  child.stdout?.pipe(process.stdout);
  child.stderr?.pipe(process.stderr);

  child.on("exit", (code) => process.exit(code ?? 1));
  process.stdin.on("end", () => child.stdin?.end());
}

if (import.meta.main) {
  const { bridgeId, innerCommand } = parseProxyArgs(process.argv.slice(2));
  runProxy(bridgeId, innerCommand);
}

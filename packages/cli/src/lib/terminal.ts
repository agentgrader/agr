export const ANSI = {
  reset: "\x1b[0m",
  bold: "\x1b[1m",
  dim: "\x1b[2m",
  green: "\x1b[32m",
  cyan: "\x1b[36m",
  yellow: "\x1b[33m",
  magenta: "\x1b[35m",
  gray: "\x1b[90m",
};

export function stdoutSupportsColor(): boolean {
  return Boolean(process.stdout.isTTY);
}

export function paint(text: string, code: string, colors = stdoutSupportsColor()): string {
  if (!colors) return text;
  return `${code}${text}${ANSI.reset}`;
}

export function shortenHomePath(absPath: string): string {
  const home = process.env.HOME;
  if (home && absPath.startsWith(home)) {
    return `~${absPath.slice(home.length)}`;
  }
  return absPath;
}

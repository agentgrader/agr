import { basename, resolve } from "node:path";
import { ANSI, paint, shortenHomePath, stdoutSupportsColor } from "./terminal";

export interface CliOutputOptions {
  colors?: boolean;
}

function useColors(opts?: CliOutputOptions): boolean {
  return opts?.colors ?? stdoutSupportsColor();
}

function rule(width: number, colors: boolean): string {
  return paint("─".repeat(width), ANSI.gray, colors);
}

function commandLine(command: string, colors: boolean): string {
  return paint("  →  ", ANSI.dim, colors) + paint(command, ANSI.cyan, colors);
}

export function formatCommandHeader(command: string, opts?: CliOutputOptions): string {
  const colors = useColors(opts);
  return (
    ""
    + "\n"
    + paint("  agentgrader", `${ANSI.bold}${ANSI.cyan}`, colors)
    + paint(` · ${command}`, ANSI.dim, colors)
    + "\n"
  );
}

export function formatRunContext(opts: {
  testCaseName: string;
  configPath?: string;
  model: string;
  colors?: boolean;
}): string {
  const colors = useColors(opts);
  const lines: string[] = [formatCommandHeader("run", { colors })];

  lines.push(paint(`  ${opts.testCaseName}`, ANSI.bold, colors));
  lines.push("");

  if (opts.configPath) {
    const configLabel = shortenHomePath(resolve(opts.configPath));
    lines.push(
      paint("  config  ", ANSI.dim, colors)
        + paint(basename(opts.configPath), ANSI.cyan, colors)
        + paint(`  ${configLabel}`, ANSI.gray, colors),
    );
  }

  lines.push(
    paint("  model   ", ANSI.dim, colors) + paint(opts.model, ANSI.cyan, colors),
  );
  lines.push("");

  return lines.join("\n");
}

export function formatOverrideLine(
  label: string,
  from: string,
  to: string,
  opts?: CliOutputOptions,
): string {
  const colors = useColors(opts);
  return (
    paint(`  ${label}  `, ANSI.dim, colors)
    + paint(from, ANSI.gray, colors)
    + paint(" → ", ANSI.dim, colors)
    + paint(to, ANSI.cyan, colors)
  );
}

export function formatMissingApiKeyBlock(opts: {
  envVar: string;
  envPath?: string;
  command?: string;
  testCaseName?: string;
  configPath?: string;
  model?: string;
  colors?: boolean;
}): string {
  const colors = useColors(opts);
  const command = opts.command ?? "run";
  const lines: string[] = [formatCommandHeader(command, { colors })];

  if (opts.testCaseName) {
    lines.push(paint(`  ${opts.testCaseName}`, ANSI.bold, colors));
    lines.push("");
  }

  if (opts.configPath) {
    const configLabel = shortenHomePath(resolve(opts.configPath));
    lines.push(
      paint("  config  ", ANSI.dim, colors)
        + paint(basename(opts.configPath), ANSI.cyan, colors)
        + paint(`  ${configLabel}`, ANSI.gray, colors),
    );
  }

  if (opts.model) {
    lines.push(
      paint("  model   ", ANSI.dim, colors) + paint(opts.model, ANSI.cyan, colors),
    );
  }

  if (opts.testCaseName || opts.configPath || opts.model) {
    lines.push("");
  }

  lines.push(paint("  ✗  ", `${ANSI.bold}${ANSI.red}`, colors) + paint("missing API key", ANSI.bold, colors));
  lines.push("");

  const where = opts.envPath
    ? shortenHomePath(opts.envPath)
    : ".env in your project root";

  lines.push(
    paint("  · ", ANSI.yellow, colors)
      + paint(opts.envVar, ANSI.bold, colors)
      + paint(" is not set", ANSI.dim, colors),
  );
  lines.push(
    paint("  · ", ANSI.yellow, colors)
      + paint(`add it to `, ANSI.dim, colors)
      + paint(where, ANSI.cyan, colors)
      + paint(" or export it in your shell", ANSI.dim, colors),
  );
  lines.push("");
  lines.push(rule(44, colors));
  lines.push("");
  lines.push(commandLine("agr doctor", colors));
  lines.push("");

  return lines.join("\n");
}

export function formatNoAgentConfigError(opts?: CliOutputOptions): string {
  const colors = useColors(opts);
  const lines: string[] = [formatCommandHeader("run", { colors })];

  lines.push(paint("  ✗  ", `${ANSI.bold}${ANSI.red}`, colors) + paint("no agent config", ANSI.bold, colors));
  lines.push("");
  lines.push(
    paint("  · ", ANSI.yellow, colors)
      + paint("pass ", ANSI.dim, colors)
      + paint("--config <path>", ANSI.cyan, colors)
      + paint(" to the CLI", ANSI.dim, colors),
  );
  lines.push(
    paint("  · ", ANSI.yellow, colors)
      + paint("or add ", ANSI.dim, colors)
      + paint("agent_config: <path>", ANSI.cyan, colors)
      + paint(" to your agr.yaml", ANSI.dim, colors),
  );
  lines.push("");

  return lines.join("\n");
}

export function formatRunStartLine(opts?: CliOutputOptions): string {
  const colors = useColors(opts);
  return paint("  starting…", ANSI.dim, colors) + "\n";
}

export function formatNextSteps(commands: string[], opts?: CliOutputOptions): string {
  const colors = useColors(opts);
  const joined = commands.map((cmd) => paint(cmd, ANSI.cyan, colors)).join(paint("  |  ", ANSI.gray, colors));
  return "\n" + paint("  next  ", ANSI.dim, colors) + joined + "\n";
}

export function formatWarning(message: string, opts?: CliOutputOptions): string {
  const colors = useColors(opts);
  return paint("  !  ", ANSI.yellow, colors) + paint(message, ANSI.dim, colors);
}

export function formatSuccess(message: string, opts?: CliOutputOptions): string {
  const colors = useColors(opts);
  return paint("  ✓  ", ANSI.green, colors) + paint(message, ANSI.dim, colors);
}

export type DoctorCheckStatus = "pass" | "fail" | "warn" | "skip";

export interface DoctorCheckLine {
  label: string;
  status: DoctorCheckStatus;
  detail?: string;
}

export function formatDoctorOutput(checks: DoctorCheckLine[], opts?: CliOutputOptions): string {
  const colors = useColors(opts);
  const lines: string[] = [formatCommandHeader("doctor", { colors })];

  for (const check of checks) {
    const icon =
      check.status === "pass"
        ? paint("  ✓  ", ANSI.green, colors)
        : check.status === "warn"
          ? paint("  !  ", ANSI.yellow, colors)
          : check.status === "skip"
            ? paint("  -  ", ANSI.gray, colors)
            : paint("  ✗  ", ANSI.red, colors);

    const label = paint(check.label, check.status === "fail" ? ANSI.bold : ANSI.reset, colors);
    const detail = check.detail
      ? paint(`  ${check.detail}`, ANSI.gray, colors)
      : "";

    lines.push(icon + label + detail);
  }

  lines.push("");
  return lines.join("\n");
}

export function formatDoctorSummary(
  failureCount: number,
  warningCount: number,
  opts?: CliOutputOptions,
): string {
  const colors = useColors(opts);

  if (failureCount === 0 && warningCount === 0) {
    return (
      formatSuccess("all checks passed", { colors })
      + paint(" · ready to run ", ANSI.dim, colors)
      + paint("agr bench", ANSI.cyan, colors)
      + "\n"
    );
  }

  if (failureCount > 0) {
    return (
      paint("  ✗  ", ANSI.red, colors)
      + paint(`${failureCount} check(s) failed`, ANSI.bold, colors)
      + paint(" · fix the issues above and re-run ", ANSI.dim, colors)
      + paint("agr doctor", ANSI.cyan, colors)
      + "\n"
    );
  }

  return (
    paint("  !  ", ANSI.yellow, colors)
    + paint(`${warningCount} warning(s)`, ANSI.bold, colors)
    + paint(" · review before running comparison sweeps", ANSI.dim, colors)
    + "\n"
  );
}

export function printRunContext(opts: Parameters<typeof formatRunContext>[0]): void {
  console.log(formatRunContext({ ...opts, colors: opts.colors ?? stdoutSupportsColor() }));
}

export function printMissingApiKeyError(opts: Parameters<typeof formatMissingApiKeyBlock>[0]): void {
  console.error(formatMissingApiKeyBlock({ ...opts, colors: opts.colors ?? stdoutSupportsColor() }));
}

export function printNoAgentConfigError(opts?: CliOutputOptions): void {
  console.error(formatNoAgentConfigError({ ...opts, colors: opts?.colors ?? stdoutSupportsColor() }));
}

export function printRunStartLine(opts?: CliOutputOptions): void {
  console.log(formatRunStartLine({ ...opts, colors: opts?.colors ?? stdoutSupportsColor() }));
}

export function printNextSteps(commands: string[], opts?: CliOutputOptions): void {
  console.log(formatNextSteps(commands, { ...opts, colors: opts?.colors ?? stdoutSupportsColor() }));
}

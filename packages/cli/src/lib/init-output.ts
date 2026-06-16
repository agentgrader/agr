import { basename, relative, resolve } from "node:path";
import { ANSI, paint, shortenHomePath, stdoutSupportsColor } from "./terminal";

export type InitScaffoldKind = "default" | "blank" | "python";

export interface InitOutputOptions {
  root: string;
  kind: InitScaffoldKind;
  taskName?: string;
  ci?: boolean;
  colors?: boolean;
}

interface FileRow {
  path: string;
  hint: string;
}

function projectSlug(root: string): string {
  const abs = resolve(root);
  const rel = relative(process.cwd(), abs);
  if (rel === "" || rel === ".") return basename(abs) || ".";
  return rel;
}

function fileRows(opts: InitOutputOptions): FileRow[] {
  const rows: FileRow[] = [
    { path: "agent.yaml", hint: "claude-haiku-4-5 · anthropic · 15 steps" },
    { path: ".env.example", hint: "copy to .env and add your API key" },
    { path: ".gitignore", hint: ".agr/ history · .env secrets" },
  ];

  if (opts.kind === "blank") {
    rows.push({ path: "tasks/", hint: "drop test cases here · tasks/<name>/agr.yaml" });
  } else if (opts.kind === "python") {
    const name = opts.taskName ?? "hello-world-python";
    rows.push({ path: `tasks/${name}/agr.yaml`, hint: "implement add() in math.py · pytest" });
    rows.push({ path: `tasks/${name}/fixture/`, hint: "starter python project" });
  } else {
    rows.push({ path: "tasks/hello-world/agr.yaml", hint: "implement add() in math.js · node --test" });
    rows.push({ path: "tasks/hello-world/fixture/", hint: "starter node project" });
  }

  if (opts.ci) {
    rows.push({ path: ".github/workflows/agr.yml", hint: "CI comparison sweep on push and PR" });
  }

  return rows;
}

function padPath(path: string, width: number): string {
  if (path.length >= width) return path;
  return path + " ".repeat(width - path.length);
}

function rule(width: number, colors: boolean): string {
  const line = "─".repeat(width);
  return paint(line, ANSI.gray, colors);
}

export function formatInitOutput(opts: InitOutputOptions): string {
  const colors = opts.colors ?? false;
  const slug = projectSlug(opts.root);
  const location = shortenHomePath(resolve(opts.root));
  const rows = fileRows(opts);
  const pathWidth = Math.max(...rows.map((r) => r.path.length), "path".length);

  const lines: string[] = [];

  lines.push("");
  lines.push(
    paint("  agentgrader", `${ANSI.bold}${ANSI.cyan}`, colors)
      + paint(" · init", ANSI.dim, colors),
  );
  lines.push(
    paint("  ", ANSI.reset, colors)
      + paint(slug, ANSI.bold, colors)
      + paint(`  ${location}`, ANSI.gray, colors),
  );
  lines.push("");

  lines.push(paint("  created", ANSI.bold, colors));
  for (const row of rows) {
    lines.push(
      paint("  ", ANSI.reset, colors)
        + paint("· ", ANSI.green, colors)
        + paint(padPath(row.path, pathWidth), ANSI.cyan, colors)
        + paint(`  ${row.hint}`, ANSI.gray, colors),
    );
  }
  lines.push("");

  if (opts.kind === "python") {
    lines.push(paint("  note", ANSI.yellow, colors));
    lines.push(paint("  pytest must be available in the sandbox image for the python example", ANSI.gray, colors));
    lines.push("");
  }

  lines.push(rule(44, colors));
  lines.push("");

  if (opts.kind === "blank") {
    lines.push(paint("  1", ANSI.magenta, colors) + paint("  set ANTHROPIC_API_KEY in .env (see .env.example)", ANSI.dim, colors));
    lines.push(paint("  2", ANSI.magenta, colors) + paint("  author tasks/<name>/agr.yaml + fixture/", ANSI.dim, colors));
    lines.push(paint("  3", ANSI.magenta, colors) + paint("  agr list-tests", ANSI.cyan, colors) + paint("  then  ", ANSI.dim, colors) + paint("agr run <name>", ANSI.cyan, colors));
    lines.push(paint("  4", ANSI.magenta, colors) + paint("  agr status", ANSI.cyan, colors) + paint("  to watch runs accumulate", ANSI.dim, colors));
  } else {
    const task = opts.taskName ?? (opts.kind === "python" ? "hello-world-python" : "hello-world");
    lines.push(paint("  1", ANSI.magenta, colors) + paint("  cp .env.example .env  and set ANTHROPIC_API_KEY", ANSI.dim, colors));
    lines.push(
      paint("  2", ANSI.magenta, colors)
        + paint("  agr run ", ANSI.dim, colors)
        + paint(`${task} --verbose`, ANSI.cyan, colors),
    );
    lines.push(
      paint("  3", ANSI.magenta, colors)
        + paint("  agr trace --last", ANSI.cyan, colors)
        + paint("  replay the agent", ANSI.dim, colors),
    );
    lines.push(
      paint("  4", ANSI.magenta, colors)
        + paint("  agr status", ANSI.cyan, colors)
        + paint("  solve rate and spend", ANSI.dim, colors),
    );
  }

  if (opts.ci) {
    lines.push(
      paint("  5", ANSI.magenta, colors)
        + paint("  add ANTHROPIC_API_KEY as a GitHub Actions secret", ANSI.dim, colors),
    );
  }

  lines.push("");
  return lines.join("\n");
}

export function printInitOutput(opts: InitOutputOptions): void {
  console.log(formatInitOutput({ ...opts, colors: opts.colors ?? stdoutSupportsColor() }));
}

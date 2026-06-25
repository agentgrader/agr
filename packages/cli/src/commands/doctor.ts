import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";
import {
  formatDoctorOutput,
  formatDoctorSummary,
  type DoctorCheckLine,
} from "../lib/cli-output";
import { stdoutSupportsColor } from "../lib/terminal";

type CheckResult = DoctorCheckLine;

function check(label: string, fn: () => CheckResult["status"] | { status: CheckResult["status"]; detail?: string }): CheckResult {
  try {
    const result = fn();
    if (typeof result === "string") return { label, status: result };
    return { label, status: result.status, detail: result.detail };
  } catch (err: any) {
    return { label, status: "fail", detail: err.message };
  }
}

export async function doctorCommand(opts: { db?: string; suite?: string; json?: boolean }) {
  const dbPath = opts.db ?? ".agr/db.sqlite";
  const suiteDir = opts.suite ?? "tasks";

  const results: CheckResult[] = [];

  results.push(check("Docker daemon", () => {
    try {
      execSync("docker info --format '{{.ServerVersion}}'", { stdio: "pipe" });
      return "pass";
    } catch {
      return { status: "fail", detail: "Docker not running or not installed (required for sandbox execution)" };
    }
  }));

  results.push(check("ANTHROPIC_API_KEY", () => {
    if (process.env.ANTHROPIC_API_KEY) {
      const key = process.env.ANTHROPIC_API_KEY;
      const preview = `${key.slice(0, 8)}...${key.slice(-4)}`;
      return { status: "pass", detail: preview };
    }
    return { status: "warn", detail: "not set (required for provider: anthropic)" };
  }));

  results.push(check("OPENAI_API_KEY", () => {
    if (process.env.OPENAI_API_KEY) {
      const key = process.env.OPENAI_API_KEY;
      const preview = `${key.slice(0, 8)}...${key.slice(-4)}`;
      return { status: "pass", detail: preview };
    }
    return { status: "skip", detail: "not set (only needed for provider: openai or LLM judge with openai)" };
  }));

  results.push(check("E2B_API_KEY", () => {
    if (process.env.E2B_API_KEY) return { status: "pass", detail: "set" };
    return { status: "skip", detail: "not set (only needed for --sandbox e2b)" };
  }));

  results.push(check(`Database (${dbPath})`, () => {
    if (existsSync(resolve(dbPath))) return "pass";
    return { status: "warn", detail: "not found (will be created on first run)" };
  }));

  const agentConfigPaths = ["agent.yaml", "agent.yml"];
  results.push(check("Agent config (agent.yaml)", () => {
    const found = agentConfigPaths.find(p => existsSync(resolve(p)));
    if (found) return { status: "pass", detail: resolve(found) };
    return { status: "warn", detail: "not found in cwd (pass --config <path> to agr run/bench, or run `agr init`)" };
  }));

  results.push(check(`Test cases (${suiteDir}/)`, () => {
    if (!existsSync(resolve(suiteDir))) {
      return { status: "warn", detail: `directory not found (create ${suiteDir}/ and add agr.yaml files, or run \`agr init\`)` };
    }
    try {
      const found = execSync(
        `find ${resolve(suiteDir)} -name "agr.yaml" -maxdepth 5 2>/dev/null | head -1`,
        { stdio: "pipe" }
      ).toString().trim();
      if (found) return { status: "pass", detail: `found at least one agr.yaml under ${suiteDir}/` };
      return { status: "warn", detail: `no agr.yaml found under ${suiteDir}/ (add test cases or run \`agr init\`)` };
    } catch {
      return { status: "warn", detail: `could not scan ${suiteDir}/` };
    }
  }));

  results.push(check("Runtime", () => {
    const version = process.version;
    return { status: "pass", detail: `Node.js ${version}` };
  }));

  // DB health checks (only when DB exists)
  if (existsSync(resolve(dbPath))) {
    try {
      const { statSync } = await import("node:fs");
      const sizeMb = statSync(resolve(dbPath)).size / 1024 / 1024;
      results.push(check(`Database size (${dbPath})`, () => {
        if (sizeMb > 100) return { status: "warn", detail: `${sizeMb.toFixed(1)} MB (consider: agr prune --before 30d --dry-run)` };
        if (sizeMb > 500) return { status: "fail", detail: `${sizeMb.toFixed(1)} MB — very large, run: agr prune --before 30d --yes` };
        return { status: "pass", detail: `${sizeMb.toFixed(1)} MB` };
      }));

      const { initDb, listRuns } = await import("@agentgrader/store");
      const db = initDb(dbPath);
      const allRuns = await listRuns(db);
      const erroredRuns = allRuns.filter(r => r.status === "failed" && r.passed == null);
      results.push(check("Errored runs", () => {
        if (erroredRuns.length > 10) return { status: "warn", detail: `${erroredRuns.length} runs errored (crashed before scoring); check sandbox/API connectivity` };
        if (erroredRuns.length > 0) return { status: "pass", detail: `${erroredRuns.length} errored run(s) (non-zero is normal)` };
        return "pass";
      }));
    } catch {
      // DB checks optional
    }
  }

  const failures = results.filter(r => r.status === "fail");
  const warnings = results.filter(r => r.status === "warn");

  if (opts.json) {
    console.log(JSON.stringify({
      passed: failures.length === 0,
      failureCount: failures.length,
      warningCount: warnings.length,
      checks: results,
    }));
    if (failures.length > 0) process.exit(1);
    return;
  }

  const colors = stdoutSupportsColor();
  console.log(formatDoctorOutput(results, { colors }));
  console.log(formatDoctorSummary(failures.length, warnings.length, { colors }));

  if (failures.length > 0) process.exit(1);
}

export interface TraceStepLike {
  kind: string;
  tool?: string | null;
  content?: string | null;
}

/**
 * `executeCommand`/`terminal/create` calls all collapse into one bucket,
 * hiding which actual binary ran - so a custom toolkit's CLI tools (e.g.
 * `find-usages`, `view-structure`) are indistinguishable from generic shell
 * exploration (`find`, `grep`, `cat`, ...) in tool-usage breakdowns. Split
 * each by the first word of its command so toolkit adoption shows up as its
 * own row (e.g. `executeCommand:find-usages`, `terminal/create:pytest`).
 */
export function bucketToolName(step: TraceStepLike): string {
  const name = step.tool ?? "(unknown)";
  if (!step.content) return name;

  if (name === "executeCommand") {
    try {
      const args = JSON.parse(step.content);
      const firstWord = typeof args?.command === "string" ? args.command.trim().split(/\s+/)[0] : "";
      return firstWord ? `executeCommand:${firstWord}` : name;
    } catch {
      return name;
    }
  }

  if (name === "terminal/create") {
    const firstWord = step.content.trim().split(/\s+/)[0];
    return firstWord ? `terminal/create:${firstWord}` : name;
  }

  return name;
}

export function countToolCalls(steps: TraceStepLike[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const step of steps) {
    if (step.kind !== "tool_call") continue;
    const name = bucketToolName(step);
    counts.set(name, (counts.get(name) ?? 0) + 1);
  }
  return counts;
}

export function mergeToolCounts(target: Map<string, number>, source: Map<string, number>) {
  for (const [name, count] of source) {
    target.set(name, (target.get(name) ?? 0) + count);
  }
}

/**
 * Checks whether a command-name (e.g. `run-tests`, `pytest`) was invoked at
 * least once among the given steps, either directly as a tool name or as
 * the first word of an `executeCommand`/`terminal/create` command. Used by
 * `require_tools_before_submit` to check toolkit-tool adoption.
 *
 * Also counts as "used" if a tool_result's output contains a
 * `<commandName>: ` marker line - this lets a composite toolkit tool (e.g.
 * `rename-symbol` running `run-tests` internally) satisfy adoption for the
 * tool it wraps, as long as the wrapped tool prints a self-identifying
 * output line (run-tests does: `run-tests: running <files>`).
 */
export function wasCommandUsed(steps: TraceStepLike[], commandName: string): boolean {
  for (const step of steps) {
    if (step.kind === "tool_call") {
      const bucketed = bucketToolName(step);
      if (bucketed === commandName) return true;
      if (bucketed === `executeCommand:${commandName}`) return true;
      if (bucketed === `terminal/create:${commandName}`) return true;
    }
    if (step.kind === "tool_result" && step.content?.includes(`${commandName}: `)) {
      return true;
    }
  }
  return false;
}

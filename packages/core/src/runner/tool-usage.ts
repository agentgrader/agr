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
 * How a command's adoption was detected: `"direct"` means the agent invoked
 * it itself (as a tool name, `tool_<name>` entry, or executeCommand/
 * terminal/create first word); `"wrapped"` means it was only credited via a
 * `<commandName>: ` self-identification marker in another tool's output
 * (e.g. `inspect-code` findings folded into `show-diff`'s output, or
 * `run-tests` run internally by `rename-symbol`).
 */
export type CommandUsageSource = "direct" | "wrapped";

/**
 * Determines whether and how a command-name (e.g. `run-tests`, `pytest`) was
 * used among the given steps. Returns `"direct"` if invoked directly as a
 * tool name, as the first word of an `executeCommand`/`terminal/create`
 * command, or via the `tool_<name_with_underscores>` first-class tool entry
 * agent-openrouter registers for each toolkit skill (e.g. `tool_rename_symbol`
 * for `rename-symbol`). Returns `"wrapped"` if it was only credited via a
 * `<commandName>: ` marker line in a tool_result's output - this lets a
 * composite toolkit tool (e.g. `rename-symbol` running `run-tests`
 * internally, or `show-diff` folding in `inspect-code`) satisfy adoption for
 * the tool it wraps, as long as the wrapped tool prints a self-identifying
 * output line. Returns `undefined` if the command was never used.
 */
export function getCommandUsageSource(steps: TraceStepLike[], commandName: string): CommandUsageSource | undefined {
  const toolEntryName = `tool_${commandName.replace(/-/g, "_")}`;
  let wrapped: CommandUsageSource | undefined;
  for (const step of steps) {
    if (step.kind === "tool_call") {
      const bucketed = bucketToolName(step);
      if (bucketed === commandName) return "direct";
      if (bucketed === `executeCommand:${commandName}`) return "direct";
      if (bucketed === `terminal/create:${commandName}`) return "direct";
      if (bucketed === toolEntryName) return "direct";
    }
    if (step.kind === "tool_result" && step.content?.includes(`${commandName}: `)) {
      wrapped = "wrapped";
    }
  }
  return wrapped;
}

/**
 * Checks whether a command-name was used at all, regardless of mechanism.
 * Used by `require_tools_before_submit` to check toolkit-tool adoption.
 * See {@link getCommandUsageSource} for the detection rules.
 */
export function wasCommandUsed(steps: TraceStepLike[], commandName: string): boolean {
  return getCommandUsageSource(steps, commandName) !== undefined;
}

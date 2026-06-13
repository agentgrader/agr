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
function bucketToolName(step: TraceStepLike): string {
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

export function printToolUsageBlock(
  counts: Map<string, number>,
  opts?: { indent?: string; header?: string },
) {
  const indent = opts?.indent ?? "  ";
  if (opts?.header) {
    console.log(opts.header);
  }
  if (counts.size === 0) {
    console.log(`${indent}(no tool_call steps recorded)`);
    return;
  }

  const nameWidth = Math.max(...[...counts.keys()].map((n) => n.length));
  let totalCalls = 0;
  for (const [name, count] of [...counts.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`${indent}${name.padEnd(nameWidth)}  ${count}`);
    totalCalls += count;
  }
  console.log(`${indent}Total: ${totalCalls} tool call(s) across ${counts.size} distinct tool(s)`);
}

export interface TraceStepLike {
  kind: string;
  tool?: string | null;
}

export function countToolCalls(steps: TraceStepLike[]): Map<string, number> {
  const counts = new Map<string, number>();
  for (const step of steps) {
    if (step.kind !== "tool_call") continue;
    const name = step.tool ?? "(unknown)";
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

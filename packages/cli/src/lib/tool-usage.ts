export { countToolCalls, mergeToolCounts, type TraceStepLike } from "@agentgrader/core";

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

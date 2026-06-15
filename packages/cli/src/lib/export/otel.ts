type TraceRow = {
  stepIndex: number;
  kind: string;
  tool: string | null;
  content: string | null;
  tokensIn: number;
  tokensOut: number;
  costUsd: number;
  timestamp: number;
};

export function tracesToOtelJson(runId: string, traces: TraceRow[]) {
  return {
    resourceSpans: [
      {
        resource: { attributes: [{ key: "service.name", value: { stringValue: "agentgrader" } }] },
        scopeSpans: [
          {
            scope: { name: "agentgrader.trace" },
            spans: traces.map((trace) => ({
              traceId: runId.replace(/-/g, "").padEnd(32, "0").slice(0, 32),
              spanId: String(trace.stepIndex).padStart(16, "0").slice(-16),
              name: trace.tool ?? trace.kind,
              kind: trace.kind === "tool_call" ? "SPAN_KIND_CLIENT" : "SPAN_KIND_INTERNAL",
              startTimeUnixNano: String(trace.timestamp * 1_000_000),
              attributes: [
                { key: "agr.kind", value: { stringValue: trace.kind } },
                { key: "agr.content", value: { stringValue: (trace.content ?? "").slice(0, 500) } },
                { key: "agr.tokens_in", value: { intValue: trace.tokensIn } },
                { key: "agr.tokens_out", value: { intValue: trace.tokensOut } },
                { key: "agr.cost_usd", value: { doubleValue: trace.costUsd } },
              ],
            })),
          },
        ],
      },
    ],
  };
}

export function tracesToOtelJsonl(runId: string, traces: TraceRow[]): string {
  return `${JSON.stringify(tracesToOtelJson(runId, traces))}\n`;
}

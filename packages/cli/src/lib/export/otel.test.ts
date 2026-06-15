import { describe, expect, test } from "bun:test";
import { tracesToOtelJson, tracesToOtelJsonl } from "./otel";

const traces = [
  {
    stepIndex: 0,
    kind: "tool_call",
    tool: "read_file",
    content: "hello",
    tokensIn: 10,
    tokensOut: 0,
    costUsd: 0.001,
    timestamp: 1_700_000_000,
  },
  {
    stepIndex: 1,
    kind: "agent_message",
    tool: null,
    content: "done",
    tokensIn: 0,
    tokensOut: 5,
    costUsd: 0.002,
    timestamp: 1_700_000_001,
  },
];

describe("tracesToOtelJson", () => {
  test("maps traces to OTLP-style resourceSpans", () => {
    const runId = "3f1c2e2a-8b4d-4e1f-9c3a-1a2b3c4d5e6f";
    const payload = tracesToOtelJson(runId, traces);
    const spans = payload.resourceSpans[0]!.scopeSpans[0]!.spans;

    expect(spans).toHaveLength(2);
    expect(spans[0]!.name).toBe("read_file");
    expect(spans[0]!.kind).toBe("SPAN_KIND_CLIENT");
    expect(spans[1]!.kind).toBe("SPAN_KIND_INTERNAL");
    expect(spans[0]!.traceId).toHaveLength(32);
    expect(spans[0]!.attributes?.some((a) => a.key === "agr.kind")).toBe(true);
  });
});

describe("tracesToOtelJsonl", () => {
  test("returns a single JSON line", () => {
    const line = tracesToOtelJsonl("run-id", traces);
    expect(line.endsWith("\n")).toBe(true);
    expect(JSON.parse(line.trim()).resourceSpans).toBeDefined();
  });
});

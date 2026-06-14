import { describe, expect, test } from "bun:test";
import { computeListColumnLayout, fitCell, formatListRow } from "./list-table-layout";

describe("fitCell", () => {
  test("pads short values", () => {
    expect(fitCell("PASS", 6)).toBe("PASS  ");
  });

  test("truncates long values", () => {
    expect(fitCell("very-long-test-case-name", 10)).toBe("very-long…");
  });
});

describe("computeListColumnLayout", () => {
  test("grows flexible columns with terminal width", () => {
    const narrow = computeListColumnLayout(90, false);
    const wide = computeListColumnLayout(160, false);
    expect(wide.testCase).toBeGreaterThan(narrow.testCase);
    expect(wide.agent).toBeGreaterThan(narrow.agent);
    expect(wide.width).toBeGreaterThan(narrow.width);
  });
});

describe("formatListRow", () => {
  test("fills the configured row width", () => {
    const layout = computeListColumnLayout(120, true);
    const row = formatListRow(layout, true, {
      marker: "A",
      status: "PASS",
      runId: "909297f1",
      testCase: "cleanup-unused-import",
      agent: "claude-haiku-jetbrains-tools",
      model: "claude-haiku-4-5-20251001",
      when: "24 minutes ago",
      cost: "$0.078",
      steps: "28 steps",
    });
    expect(row.length).toBeLessThanOrEqual(layout.width);
  });
});

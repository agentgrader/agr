import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { describeUsage, printQualityBreakdown } from "./trace";

let logSpy: ReturnType<typeof spyOn>;

beforeEach(() => {
  logSpy = spyOn(console, "log").mockImplementation(() => {});
});

afterEach(() => {
  logSpy.mockRestore();
});

function loggedLines(): string[] {
  return logSpy.mock.calls.map((call) => call[0] as string);
}

describe("describeUsage", () => {
  test("renders 'direct' as called directly", () => {
    expect(describeUsage("direct", true)).toBe("OK (called directly)");
  });

  test("renders 'wrapped' as via another tool's output", () => {
    expect(describeUsage("wrapped", true)).toBe("OK (via another tool's output)");
  });

  test("renders undefined with usedFallback as a mechanism-not-recorded note", () => {
    expect(describeUsage(undefined, true)).toBe("OK (mechanism not recorded for this run)");
  });

  test("renders undefined without usedFallback as MISSING", () => {
    expect(describeUsage(undefined, false)).toBe("MISSING");
  });
});

describe("printQualityBreakdown tool-adoption/tool-usage", () => {
  test("shows the credit mechanism for each required tool", () => {
    const metrics = JSON.stringify({
      "tool-adoption": {
        passed: true,
        detail: "All required tool(s) were used at least once: run-tests, inspect-code",
        required: ["run-tests", "inspect-code"],
        missing: [],
        usedVia: { "run-tests": "wrapped", "inspect-code": "wrapped" },
      },
    });

    printQualityBreakdown(metrics);

    const lines = loggedLines();
    expect(lines).toContain("Tool adoption (require_tools_before_submit): OK");
    expect(lines).toContain("    run-tests: OK (via another tool's output)");
    expect(lines).toContain("    inspect-code: OK (via another tool's output)");
  });

  test("shows MISSING for required tools that were never used", () => {
    const metrics = JSON.stringify({
      "tool-adoption": {
        passed: false,
        detail: "Missing required tool(s) before submit: run-tests, inspect-code",
        required: ["run-tests", "inspect-code"],
        missing: ["run-tests", "inspect-code"],
        usedVia: {},
      },
    });

    printQualityBreakdown(metrics);

    const lines = loggedLines();
    expect(lines).toContain("Tool adoption (require_tools_before_submit): MISSING");
    expect(lines).toContain("    run-tests: MISSING");
    expect(lines).toContain("    inspect-code: MISSING");
  });

  test("falls back to 'mechanism not recorded' for runs predating usedVia", () => {
    const metrics = JSON.stringify({
      "tool-adoption": {
        passed: true,
        detail: "All required tool(s) were used at least once: run-tests, inspect-code",
        required: ["run-tests", "inspect-code"],
        missing: [],
      },
    });

    printQualityBreakdown(metrics);

    const lines = loggedLines();
    expect(lines).toContain("    run-tests: OK (mechanism not recorded for this run)");
    expect(lines).toContain("    inspect-code: OK (mechanism not recorded for this run)");
  });

  test("shows the credit mechanism for tracked tools that were used", () => {
    const metrics = JSON.stringify({
      "tool-usage": {
        tracked: ["find-usages", "show-diff"],
        used: ["show-diff"],
        unused: ["find-usages"],
        usedVia: { "show-diff": "direct" },
        detail: "Used 1/2 tracked tool(s): show-diff",
      },
    });

    printQualityBreakdown(metrics);

    const lines = loggedLines();
    expect(lines).toContain("Tool usage (track_tools): Used 1/2 tracked tool(s): show-diff");
    expect(lines).toContain("    show-diff: OK (called directly)");
    expect(lines).toContain("  Not used: find-usages");
  });
});

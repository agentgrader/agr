import { afterEach, beforeEach, describe, expect, spyOn, test } from "bun:test";
import { printToolUsageBlock } from "./tool-usage";

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

describe("printToolUsageBlock", () => {
  test("prints a message when there are no recorded tool calls", () => {
    printToolUsageBlock(new Map());

    expect(loggedLines()).toEqual(["  (no tool_call steps recorded)"]);
  });

  test("prints counts sorted by descending count, padded to the widest name", () => {
    const counts = new Map([
      ["readFile", 2],
      ["executeCommand:rename-symbol", 5],
      ["writeFile", 3],
    ]);

    printToolUsageBlock(counts);

    expect(loggedLines()).toEqual([
      `  executeCommand:rename-symbol  5`,
      `  writeFile                     3`,
      `  readFile                      2`,
      `  Total: 10 tool call(s) across 3 distinct tool(s)`,
    ]);
  });

  test("uses a custom indent and prints an optional header", () => {
    const counts = new Map([["find-usages", 1]]);

    printToolUsageBlock(counts, { indent: "    ", header: "Tool usage:" });

    expect(loggedLines()).toEqual([
      "Tool usage:",
      "    find-usages  1",
      "    Total: 1 tool call(s) across 1 distinct tool(s)",
    ]);
  });

  test("omits the header when none is given", () => {
    printToolUsageBlock(new Map([["submit", 1]]));

    expect(loggedLines()).not.toContain(undefined);
    expect(loggedLines()[0]).not.toBe(undefined);
    expect(loggedLines().some((line) => line === "Tool usage:")).toBe(false);
  });
});

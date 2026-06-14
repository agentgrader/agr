import { describe, expect, test } from "bun:test";
import { bucketToolName, countToolCalls, mergeToolCounts, wasCommandUsed } from "./tool-usage";

describe("bucketToolName", () => {
  test("falls back to '(unknown)' when tool is missing", () => {
    expect(bucketToolName({ kind: "tool_call" })).toBe("(unknown)");
  });

  test("returns the tool name unchanged when content is empty", () => {
    expect(bucketToolName({ kind: "tool_call", tool: "readFile" })).toBe("readFile");
  });

  test("buckets executeCommand by the first word of the JSON-encoded command", () => {
    const step = {
      kind: "tool_call",
      tool: "executeCommand",
      content: JSON.stringify({ command: "find-usages Foo src/" }),
    };
    expect(bucketToolName(step)).toBe("executeCommand:find-usages");
  });

  test("falls back to the tool name when executeCommand content is not valid JSON", () => {
    const step = { kind: "tool_call", tool: "executeCommand", content: "not json" };
    expect(bucketToolName(step)).toBe("executeCommand");
  });

  test("falls back to the tool name when executeCommand has no command field", () => {
    const step = { kind: "tool_call", tool: "executeCommand", content: JSON.stringify({}) };
    expect(bucketToolName(step)).toBe("executeCommand");
  });

  test("buckets terminal/create by the first word of the raw command string", () => {
    const step = { kind: "tool_call", tool: "terminal/create", content: "pytest -q" };
    expect(bucketToolName(step)).toBe("terminal/create:pytest");
  });

  test("leaves other tools untouched even with content present", () => {
    const step = { kind: "tool_call", tool: "readFile", content: "src/foo.py" };
    expect(bucketToolName(step)).toBe("readFile");
  });
});

describe("countToolCalls", () => {
  test("only counts tool_call steps, bucketed", () => {
    const steps = [
      { kind: "tool_call", tool: "terminal/create", content: "pytest -q" },
      { kind: "tool_result", tool: "terminal/create", content: "terminal-1" },
      { kind: "tool_call", tool: "terminal/create", content: "pytest tests/" },
      { kind: "tool_call", tool: "readFile", content: "src/foo.py" },
    ];
    const counts = countToolCalls(steps);
    expect(counts.get("terminal/create:pytest")).toBe(2);
    expect(counts.get("readFile")).toBe(1);
    expect(counts.has("terminal/create")).toBe(false);
  });
});

describe("mergeToolCounts", () => {
  test("adds source counts into target, summing overlapping keys", () => {
    const target = new Map([["readFile", 2]]);
    const source = new Map([
      ["readFile", 3],
      ["writeFile", 1],
    ]);
    mergeToolCounts(target, source);
    expect(target.get("readFile")).toBe(5);
    expect(target.get("writeFile")).toBe(1);
  });
});

describe("wasCommandUsed", () => {
  test("matches a direct tool_call name", () => {
    const steps = [{ kind: "tool_call", tool: "run-tests" }];
    expect(wasCommandUsed(steps, "run-tests")).toBe(true);
  });

  test("matches an executeCommand whose first word is the command name", () => {
    const steps = [
      { kind: "tool_call", tool: "executeCommand", content: JSON.stringify({ command: "run-tests src/" }) },
    ];
    expect(wasCommandUsed(steps, "run-tests")).toBe(true);
  });

  test("matches a terminal/create call whose first word is the command name", () => {
    const steps = [{ kind: "tool_call", tool: "terminal/create", content: "run-tests src/" }];
    expect(wasCommandUsed(steps, "run-tests")).toBe(true);
  });

  test("matches a tool_result containing a '<commandName>: ' self-identification marker", () => {
    const steps = [
      { kind: "tool_call", tool: "terminal/create", content: "rename-symbol Foo Bar src/" },
      { kind: "tool_result", tool: "terminal/output", content: "run-tests: running 2 file(s)\n2 passed" },
    ];
    expect(wasCommandUsed(steps, "run-tests")).toBe(true);
  });

  test("returns false when the command never appears", () => {
    const steps = [
      { kind: "tool_call", tool: "readFile", content: "src/foo.py" },
      { kind: "tool_result", tool: "readFile", content: "def foo(): ..." },
    ];
    expect(wasCommandUsed(steps, "run-tests")).toBe(false);
  });
});

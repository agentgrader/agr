import { describe, expect, test } from "bun:test";
import { TapTestResultParser } from "./test-result-parser";

describe("TapTestResultParser", () => {
  const parser = new TapTestResultParser();

  test("has the expected name", () => {
    expect(parser.name).toBe("tap");
  });

  test("parses ok and not ok lines into PASS/FAIL", () => {
    const output = `
TAP version 13
1..2
ok 1 - should succeed on first attempt
not ok 2 - should retry on failure and succeed
`;
    expect(parser.parse(output)).toEqual({
      "should succeed on first attempt": "PASS",
      "should retry on failure and succeed": "FAIL",
    });
  });

  test("treats a trailing '# SKIP' or '# TODO' directive as SKIP", () => {
    const output = `
ok 1 - should be skipped # SKIP not implemented yet
not ok 2 - should be a todo # TODO fix later
ok 3 - normal pass
`;
    expect(parser.parse(output)).toEqual({
      "should be skipped": "SKIP",
      "should be a todo": "SKIP",
      "normal pass": "PASS",
    });
  });

  test("ignores non-test lines (version, plan, comments)", () => {
    const output = `
TAP version 13
1..1
# a plain comment
ok 1 - the only test
`;
    expect(parser.parse(output)).toEqual({ "the only test": "PASS" });
  });

  test("handles lines without a leading '-' before the test name", () => {
    const output = `ok 1 no dash here\nnot ok 2 also no dash`;
    expect(parser.parse(output)).toEqual({
      "no dash here": "PASS",
      "also no dash": "FAIL",
    });
  });

  test("strips trailing carriage returns (CRLF output)", () => {
    const output = "ok 1 - crlf test\r\nnot ok 2 - another crlf test\r\n";
    expect(parser.parse(output)).toEqual({
      "crlf test": "PASS",
      "another crlf test": "FAIL",
    });
  });

  test("skips lines that would produce an empty test name", () => {
    const output = `ok 1 -\nok 2 - # SKIP\nok 3 - real test`;
    expect(parser.parse(output)).toEqual({ "real test": "PASS" });
  });

  test("returns an empty map for output with no TAP result lines", () => {
    expect(parser.parse("no tap output here\njust some logs")).toEqual({});
  });
});

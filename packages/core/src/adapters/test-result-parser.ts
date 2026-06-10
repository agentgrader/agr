/**
 * Parses raw test-runner output into a per-test status map, so scorers can
 * compare individual test outcomes against FAIL_TO_PASS / PASS_TO_PASS lists
 * (SWE-bench style).
 */

export type TestStatus = "PASS" | "FAIL" | "SKIP";

/** Maps a test's display name to its outcome. */
export type TestStatusMap = Record<string, TestStatus>;

export interface TestResultParser {
  readonly name: string;
  parse(output: string): TestStatusMap;
}

/**
 * Parses TAP (Test Anything Protocol) output, as produced by
 * `node --test --test-reporter=tap` (or `tsx --test --test-reporter=tap`).
 *
 * Handles lines of the form:
 *   ok 1 - should succeed on first attempt
 *   not ok 2 - should retry on failure and succeed
 *   ok 3 - should be skipped # SKIP
 */
export class TapTestResultParser implements TestResultParser {
  readonly name = "tap";

  parse(output: string): TestStatusMap {
    const map: TestStatusMap = {};
    const lineRe = /^\s*(ok|not ok)\s+\d+\s*-?\s*(.*)$/;

    for (const rawLine of output.split("\n")) {
      const line = rawLine.replace(/\r$/, "");
      const match = line.match(lineRe);
      if (!match) continue;

      const [, statusToken, rest] = match;
      let name = rest.trim();
      let directive: string | undefined;

      const hashIdx = name.indexOf("#");
      if (hashIdx !== -1) {
        directive = name.slice(hashIdx + 1).trim();
        name = name.slice(0, hashIdx).trim();
      }

      if (!name) continue;

      if (directive && /^(skip|todo)/i.test(directive)) {
        map[name] = "SKIP";
        continue;
      }

      map[name] = statusToken === "ok" ? "PASS" : "FAIL";
    }

    return map;
  }
}

import { describe, expect, test } from "bun:test";
import { matchAnyGlob, matchGlob } from "./glob";

describe("matchGlob", () => {
  test("matches a literal path exactly", () => {
    expect(matchGlob("src/index.ts", "src/index.ts")).toBe(true);
    expect(matchGlob("src/index.ts", "src/other.ts")).toBe(false);
  });

  test("`*` matches within a single path segment", () => {
    expect(matchGlob("src/*.ts", "src/index.ts")).toBe(true);
    expect(matchGlob("src/*.ts", "src/lib/index.ts")).toBe(false);
  });

  test("`**` matches across path segments", () => {
    expect(matchGlob("src/**/*.ts", "src/lib/index.ts")).toBe(true);
    expect(matchGlob("src/**/*.ts", "src/index.ts")).toBe(true);
    expect(matchGlob("**/*.test.ts", "packages/core/src/runner/glob.test.ts")).toBe(true);
  });

  test("`?` matches exactly one character, never `/`", () => {
    expect(matchGlob("file?.ts", "file1.ts")).toBe(true);
    expect(matchGlob("file?.ts", "file12.ts")).toBe(false);
    expect(matchGlob("a?b", "a/b")).toBe(false);
  });

  test("escapes regex special characters in the pattern", () => {
    expect(matchGlob("src/index.ts", "src/indexXts")).toBe(false);
    expect(matchGlob("a+b.ts", "a+b.ts")).toBe(true);
    expect(matchGlob("a(b).ts", "a(b).ts")).toBe(true);
  });

  test("strips a leading './' from both pattern and path", () => {
    expect(matchGlob("./src/*.ts", "src/index.ts")).toBe(true);
    expect(matchGlob("src/*.ts", "./src/index.ts")).toBe(true);
  });

  test("`*` does not match across a `/`", () => {
    expect(matchGlob("*.ts", "src/index.ts")).toBe(false);
    expect(matchGlob("*.ts", "index.ts")).toBe(true);
  });
});

describe("matchAnyGlob", () => {
  test("returns true if any pattern matches", () => {
    expect(matchAnyGlob(["*.md", "src/**/*.ts"], "src/runner/glob.ts")).toBe(true);
    expect(matchAnyGlob(["*.md", "*.json"], "src/runner/glob.ts")).toBe(false);
  });

  test("returns false for an empty pattern list", () => {
    expect(matchAnyGlob([], "src/runner/glob.ts")).toBe(false);
  });
});

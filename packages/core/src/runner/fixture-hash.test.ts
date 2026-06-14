import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, describe, expect, test } from "bun:test";
import { hashFixture } from "./fixture-hash";

describe("hashFixture", () => {
  let dir: string;

  afterEach(() => {
    if (dir) rmSync(dir, { recursive: true, force: true });
  });

  test("is stable for the same fixture contents", () => {
    dir = mkdtempSync(join(tmpdir(), "fixture-"));
    writeFileSync(join(dir, "a.txt"), "hello");
    writeFileSync(join(dir, "b.txt"), "world");

    expect(hashFixture(dir)).toBe(hashFixture(dir));
  });

  test("changes when a file's contents change", () => {
    dir = mkdtempSync(join(tmpdir(), "fixture-"));
    writeFileSync(join(dir, "a.txt"), "hello");
    const before = hashFixture(dir);

    writeFileSync(join(dir, "a.txt"), "goodbye");
    expect(hashFixture(dir)).not.toBe(before);
  });

  test("changes when a file is renamed, even with the same content", () => {
    dir = mkdtempSync(join(tmpdir(), "fixture-"));
    writeFileSync(join(dir, "a.txt"), "hello");
    const before = hashFixture(dir);

    rmSync(join(dir, "a.txt"));
    writeFileSync(join(dir, "b.txt"), "hello");
    expect(hashFixture(dir)).not.toBe(before);
  });

  test("is independent of filesystem iteration order", () => {
    const dirA = mkdtempSync(join(tmpdir(), "fixture-a-"));
    const dirB = mkdtempSync(join(tmpdir(), "fixture-b-"));
    try {
      writeFileSync(join(dirA, "a.txt"), "1");
      writeFileSync(join(dirA, "b.txt"), "2");
      // create in reverse order
      writeFileSync(join(dirB, "b.txt"), "2");
      writeFileSync(join(dirB, "a.txt"), "1");

      expect(hashFixture(dirA)).toBe(hashFixture(dirB));
    } finally {
      rmSync(dirA, { recursive: true, force: true });
      rmSync(dirB, { recursive: true, force: true });
    }
  });

  test("ignores files under node_modules, .git, dist, and .turbo", () => {
    dir = mkdtempSync(join(tmpdir(), "fixture-"));
    writeFileSync(join(dir, "a.txt"), "hello");
    const before = hashFixture(dir);

    for (const ignored of ["node_modules", ".git", "dist", ".turbo"]) {
      mkdirSync(join(dir, ignored), { recursive: true });
      writeFileSync(join(dir, ignored, "ignored.txt"), "should not affect the hash");
    }

    expect(hashFixture(dir)).toBe(before);
  });

  test("descends into nested directories", () => {
    dir = mkdtempSync(join(tmpdir(), "fixture-"));
    writeFileSync(join(dir, "a.txt"), "hello");
    const before = hashFixture(dir);

    mkdirSync(join(dir, "nested"), { recursive: true });
    writeFileSync(join(dir, "nested", "c.txt"), "world");

    expect(hashFixture(dir)).not.toBe(before);
  });

  test("falls back to hashing the path string when the fixture dir doesn't exist", () => {
    const missing = join(tmpdir(), "does-not-exist-fixture-xyz");
    expect(hashFixture(missing)).toBe(hashFixture(missing));
    expect(hashFixture(missing)).not.toBe(hashFixture(missing + "-other"));
  });
});

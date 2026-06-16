import { describe, expect, test } from "bun:test";
import { parseSince } from "./parse-since";

describe("parseSince", () => {
  test("returns a past Unix epoch for relative second duration", () => {
    const before = Math.floor(Date.now() / 1000);
    const ts = parseSince("30s");
    const after = Math.floor(Date.now() / 1000);
    expect(ts).toBeLessThanOrEqual(before - 29);
    expect(ts).toBeGreaterThanOrEqual(after - 31);
  });

  test("returns a past Unix epoch for relative minute duration", () => {
    const ts = parseSince("5m");
    const expected = Math.floor((Date.now() - 5 * 60000) / 1000);
    expect(Math.abs(ts - expected)).toBeLessThanOrEqual(1);
  });

  test("returns a past Unix epoch for relative hour duration", () => {
    const ts = parseSince("2h");
    const expected = Math.floor((Date.now() - 2 * 3600000) / 1000);
    expect(Math.abs(ts - expected)).toBeLessThanOrEqual(1);
  });

  test("returns a past Unix epoch for relative day duration", () => {
    const ts = parseSince("7d");
    const expected = Math.floor((Date.now() - 7 * 86400000) / 1000);
    expect(Math.abs(ts - expected)).toBeLessThanOrEqual(1);
  });

  test("parses an ISO date string to Unix epoch seconds", () => {
    const ts = parseSince("2026-01-01T00:00:00Z");
    expect(ts).toBe(Math.floor(Date.parse("2026-01-01T00:00:00Z") / 1000));
  });

  test("throws a readable error for an unrecognized format", () => {
    expect(() => parseSince("not-a-date")).toThrow(/--since: unrecognized format/);
    expect(() => parseSince("3x")).toThrow(/--since: unrecognized format/);
  });

  test("1h gives a value close to 3600 seconds in the past", () => {
    const ts = parseSince("1h");
    const nowTs = Math.floor(Date.now() / 1000);
    expect(nowTs - ts).toBeGreaterThanOrEqual(3599);
    expect(nowTs - ts).toBeLessThanOrEqual(3601);
  });
});

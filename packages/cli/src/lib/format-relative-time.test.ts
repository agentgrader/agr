import { describe, expect, test } from "bun:test";
import { formatRelativeTime, formatRunWhen } from "./format-relative-time";

const NOW = Date.parse("2026-06-14T12:00:00.000Z");

describe("formatRelativeTime", () => {
  test("shows just now for very recent runs", () => {
    expect(formatRelativeTime(Math.floor(NOW / 1000) - 3, NOW)).toBe("just now");
  });

  test("shows seconds ago under one minute", () => {
    expect(formatRelativeTime(Math.floor(NOW / 1000) - 45, NOW)).toBe("45 seconds ago");
  });

  test("shows minutes ago under one hour", () => {
    expect(formatRelativeTime(Math.floor(NOW / 1000) - 5 * 60, NOW)).toBe("5 minutes ago");
  });

  test("falls back to an absolute date after one week", () => {
    expect(formatRelativeTime(Math.floor(NOW / 1000) - 10 * 24 * 60 * 60, NOW)).toContain("2026");
  });
});

describe("formatRunWhen", () => {
  test("includes both relative and absolute text for recent runs", () => {
    const when = formatRunWhen(Math.floor(NOW / 1000) - 30, NOW);
    expect(when).toContain("seconds ago");
    expect(when).toContain("(");
  });
});

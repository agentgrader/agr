import { test } from "node:test";
import assert from "node:assert";
import { sumTransformed } from "./counter";

const double = async (n: number) => n * 2;

test("should return 0 for empty array", async () => {
  const result = await sumTransformed([], double);
  assert.strictEqual(result, 0);
});

test("should sum transformed values correctly", async () => {
  const result = await sumTransformed([1, 2, 3], double);
  assert.strictEqual(result, 12); // 2 + 4 + 6 = 12
});

test("should handle single value", async () => {
  const result = await sumTransformed([5], double);
  assert.strictEqual(result, 10);
});

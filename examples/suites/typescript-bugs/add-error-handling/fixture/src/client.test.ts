import { test } from "node:test";
import assert from "node:assert";
import { fetchWithRetry } from "./client";

test("should succeed on first attempt", async () => {
  let calls = 0;
  const res = await fetchWithRetry("http://example.com", async () => {
    calls++;
    return "ok";
  });
  assert.strictEqual(res, "ok");
  assert.strictEqual(calls, 1);
});

test("should retry on failure and succeed", async () => {
  let calls = 0;
  const res = await fetchWithRetry("http://example.com", async () => {
    calls++;
    if (calls < 3) {
      throw new Error("Timeout");
    }
    return "retry-ok";
  });
  assert.strictEqual(res, "retry-ok");
  assert.strictEqual(calls, 3);
});

test("should fail after 4 total attempts (1 initial + 3 retries)", async () => {
  let calls = 0;
  await assert.rejects(
    fetchWithRetry("http://example.com", async () => {
      calls++;
      throw new Error("Network Error");
    }),
    /Network Error/
  );
  assert.strictEqual(calls, 4);
});

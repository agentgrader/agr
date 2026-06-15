import { describe, expect, test } from "bun:test";
import { E2bSandboxProvider } from "./index";

describe("E2bSandboxProvider", () => {
  test("requires E2B_API_KEY", async () => {
    const prev = process.env.E2B_API_KEY;
    delete process.env.E2B_API_KEY;
    const provider = new E2bSandboxProvider();
    await expect(provider.create({})).rejects.toThrow("E2B_API_KEY");
    if (prev) process.env.E2B_API_KEY = prev;
  });
});

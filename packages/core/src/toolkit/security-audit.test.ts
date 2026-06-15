import { describe, expect, test } from "bun:test";
import { mkdtempSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { tmpdir } from "node:os";
import { auditToolkitDirectory } from "./security-audit";

describe("auditToolkitDirectory", () => {
  test("flags curl in bin scripts", () => {
    const dir = mkdtempSync(join(tmpdir(), "agr-audit-"));
    mkdirSync(join(dir, "bin"), { recursive: true });
    writeFileSync(join(dir, "bin", "fetch-data"), "#!/bin/sh\ncurl https://example.com\n");
    const findings = auditToolkitDirectory(dir);
    expect(findings.some((f) => f.rule === "outbound-curl" || f.rule === "remote-url")).toBe(true);
  });
});

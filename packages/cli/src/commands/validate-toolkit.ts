import { resolve } from "node:path";
import { auditToolkitDirectory, hasAuditErrors } from "@agentgrader/core";

export async function validateToolkitCommand(dir: string, opts?: { strict?: boolean }) {
  const toolkitDir = resolve(dir);
  const findings = auditToolkitDirectory(toolkitDir);

  if (findings.length === 0) {
    console.log(`[OK] No security findings in ${toolkitDir}`);
    return;
  }

  for (const finding of findings) {
    const label = finding.severity === "error" ? "[FAIL]" : "[WARN]";
    console.log(`${label} ${finding.file}: ${finding.message} (${finding.rule})`);
  }

  if (hasAuditErrors(findings) || (opts?.strict && findings.length > 0)) {
    process.exit(1);
  }
}

import { resolve } from "node:path";
import { auditToolkitDirectory, hasAuditErrors } from "@agentgrader/core";

export async function validateToolkitCommand(dir: string, opts?: { strict?: boolean; json?: boolean }) {
  const toolkitDir = resolve(dir);
  const findings = auditToolkitDirectory(toolkitDir);
  const failed = hasAuditErrors(findings) || (opts?.strict && findings.length > 0);

  if (opts?.json) {
    console.log(JSON.stringify({
      dir: toolkitDir,
      passed: !failed,
      findings: findings.map((f) => ({ file: f.file, severity: f.severity, rule: f.rule, message: f.message })),
    }));
    if (failed) process.exit(1);
    return;
  }

  if (findings.length === 0) {
    console.log(`[OK] No security findings in ${toolkitDir}`);
    console.log(`\nNext: agr toolkit-list ${dir}  |  agr bench --suite tasks/ --strict-toolkits`);
    return;
  }

  for (const finding of findings) {
    const label = finding.severity === "error" ? "[FAIL]" : "[WARN]";
    console.log(`${label} ${finding.file}: ${finding.message} (${finding.rule})`);
  }

  if (failed) {
    console.log(`\nFix the findings above, then re-run: agr validate-toolkit ${dir}`);
    process.exit(1);
  }
}

import { existsSync, readdirSync, readFileSync, statSync } from "node:fs";
import { join, resolve } from "node:path";
import { parseSkillMarkdown } from "../runner/skills";

export type AuditSeverity = "error" | "warn";

export interface AuditFinding {
  severity: AuditSeverity;
  file: string;
  message: string;
  rule: string;
}

const NETWORK_PATTERNS: Array<{ rule: string; pattern: RegExp; severity: AuditSeverity }> = [
  { rule: "outbound-curl", pattern: /\bcurl\b/i, severity: "warn" },
  { rule: "outbound-wget", pattern: /\bwget\b/i, severity: "warn" },
  { rule: "outbound-nc", pattern: /\bnc\s/i, severity: "error" },
  { rule: "remote-url", pattern: /https?:\/\/(?!localhost|127\.0\.0\.1)/i, severity: "warn" },
];

const DESTRUCTIVE_PATTERNS: Array<{ rule: string; pattern: RegExp }> = [
  { rule: "destructive-rm", pattern: /rm\s+-rf\s+\// },
  { rule: "destructive-chmod", pattern: /chmod\s+777\s+\// },
];

const PRIVILEGE_PATTERNS: Array<{ rule: string; pattern: RegExp }> = [
  { rule: "sudo", pattern: /\bsudo\b/ },
  { rule: "su-command", pattern: /\bsu\s+-/ },
];

const ENV_EXFIL_PATTERNS: Array<{ rule: string; pattern: RegExp }> = [
  { rule: "env-key-echo", pattern: /echo\s+\$[A-Z0-9_]*KEY/i },
  { rule: "home-read", pattern: /cat\s+~\// },
];

function scanContent(file: string, content: string): AuditFinding[] {
  const findings: AuditFinding[] = [];
  for (const { rule, pattern, severity } of NETWORK_PATTERNS) {
    if (pattern.test(content)) findings.push({ severity, file, rule, message: `Matched ${rule}` });
  }
  for (const { rule, pattern } of DESTRUCTIVE_PATTERNS) {
    if (pattern.test(content)) findings.push({ severity: "error", file, rule, message: `Matched ${rule}` });
  }
  for (const { rule, pattern } of PRIVILEGE_PATTERNS) {
    if (pattern.test(content)) findings.push({ severity: "error", file, rule, message: `Matched ${rule}` });
  }
  for (const { rule, pattern } of ENV_EXFIL_PATTERNS) {
    if (pattern.test(content)) findings.push({ severity: "warn", file, rule, message: `Matched ${rule}` });
  }
  return findings;
}

function listFiles(dir: string): string[] {
  const files: string[] = [];
  if (!existsSync(dir)) return files;
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) files.push(...listFiles(full));
    else files.push(full);
  }
  return files;
}

export function auditToolkitDirectory(toolkitDir: string): AuditFinding[] {
  const root = resolve(toolkitDir);
  const findings: AuditFinding[] = [];

  const binDir = join(root, "bin");
  if (existsSync(binDir)) {
    for (const file of readdirSync(binDir)) {
      const full = join(binDir, file);
      if (!statSync(full).isFile()) continue;
      const content = readFileSync(full, "utf-8");
      if (!content.trim()) {
        findings.push({ severity: "warn", file: full, rule: "empty-bin", message: "Empty bin script" });
      }
      if (!content.startsWith("#!")) {
        findings.push({ severity: "warn", file: full, rule: "missing-shebang", message: "Missing shebang" });
      }
      findings.push(...scanContent(full, content));

      const skillPath = join(root, ".claude/skills", file, "SKILL.md");
      if (existsSync(skillPath)) {
        try {
          const skill = parseSkillMarkdown(readFileSync(skillPath, "utf-8"), skillPath, join(root, ".claude/skills", file));
          if (skill.frontmatter.name !== file) {
            findings.push({
              severity: "warn",
              file: skillPath,
              rule: "skill-name-mismatch",
              message: `SKILL name "${skill.frontmatter.name}" does not match bin/${file}`,
            });
          }
        } catch (err: any) {
          findings.push({
            severity: "error",
            file: skillPath,
            rule: "invalid-skill",
            message: err.message ?? "Invalid SKILL.md",
          });
        }
      }
    }
  }

  const setupPath = join(root, "setup.sh");
  if (existsSync(setupPath)) {
    findings.push(...scanContent(setupPath, readFileSync(setupPath, "utf-8")));
  }

  for (const file of listFiles(join(root, ".claude"))) {
    if (file.endsWith("SKILL.md")) continue;
    if (/\.(sh|bash)$/.test(file)) {
      findings.push(...scanContent(file, readFileSync(file, "utf-8")));
    }
  }

  return findings;
}

export function hasAuditErrors(findings: AuditFinding[]): boolean {
  return findings.some((f) => f.severity === "error");
}

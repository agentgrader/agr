import { z } from "zod";

/**
 * Frontmatter for a Claude Agent Skill (`SKILL.md`).
 *
 * This is intentionally a conservative subset of the published Agent Skills
 * spec: `name` and `description` are the two fields that are solidly
 * documented as always loaded into context for skill discovery (progressive
 * disclosure - the rest of SKILL.md is only read on demand). `allowed-tools`,
 * `disallowed-tools`, and `license` are reasonably well documented optional
 * fields. Anything else is passed through unvalidated via `.passthrough()`
 * so we don't reject SKILL.md files that use additional frontmatter we
 * haven't verified.
 */
export const SkillFrontmatterSchema = z
  .object({
    /** lowercase letters, numbers, hyphens; max 64 chars */
    name: z
      .string()
      .max(64)
      .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/, "name must be lowercase letters, numbers, and hyphens"),
    /** third-person description of what the skill does and when to use it; max 1024 chars */
    description: z.string().max(1024),
    "allowed-tools": z.array(z.string()).optional(),
    "disallowed-tools": z.array(z.string()).optional(),
    license: z.string().optional(),
  })
  .passthrough();

export type SkillFrontmatter = z.infer<typeof SkillFrontmatterSchema>;

/** A discovered skill: parsed frontmatter, markdown body, and its location on disk. */
export interface Skill {
  frontmatter: SkillFrontmatter;
  /** markdown body of SKILL.md, with the frontmatter block stripped */
  body: string;
  /** absolute path to the SKILL.md file */
  path: string;
  /** absolute path to the skill's directory (for resolving bundled scripts/resources) */
  dir: string;
}

/**
 * MCP server configuration, mirroring the `mcpServers` entries used by
 * `.mcp.json` configs:
 *
 *  - stdio servers are launched as a local subprocess and spoken to over
 *    stdin/stdout (`command` + optional `args`/`env`).
 *  - http/sse servers are remote endpoints reached over HTTP(S) (`url` +
 *    optional `headers`).
 */
export const McpServerConfigSchema = z.union([
  z.object({
    command: z.string(),
    args: z.array(z.string()).optional(),
    env: z.record(z.string()).optional(),
  }),
  z.object({
    type: z.enum(["http", "sse"]).optional(),
    url: z.string(),
    headers: z.record(z.string()).optional(),
  }),
]);

export type McpServerConfig = z.infer<typeof McpServerConfigSchema>;

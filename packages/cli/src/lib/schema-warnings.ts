import type { z } from "zod";

/**
 * Returns top-level keys present in `raw` that aren't part of `schema`.
 *
 * zod's `.parse()` silently strips unrecognized keys, so a config field
 * that a newer `@agentgrader/core` understands (e.g. `step_timeout_ms`,
 * `escalate_after_steps`) but an older, version-skewed `core` doesn't will
 * be dropped with no error - the field has no effect and nothing tells you
 * why.
 */
export function findUnrecognizedKeys(schema: z.ZodObject<any>, raw: unknown): string[] {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) return [];
  const known = new Set(Object.keys(schema.shape));
  return Object.keys(raw).filter((key) => !known.has(key));
}

/**
 * Logs a `[WARN]` to stderr for any top-level key in `raw` that `schema`
 * doesn't recognize. Non-fatal - parsing still proceeds with those keys
 * dropped, matching zod's default behavior.
 */
export function warnUnrecognizedKeys(schema: z.ZodObject<any>, raw: unknown, context: string): void {
  const extra = findUnrecognizedKeys(schema, raw);
  if (extra.length === 0) return;
  const fields = extra.map((key) => `"${key}"`).join(", ");
  console.warn(
    `[WARN] ${context}: unrecognized field(s) ${fields} - these are silently ignored. ` +
      `Likely causes: a typo, or your installed @agentgrader/core doesn't support this field yet ` +
      `(e.g. step_timeout_ms, escalate_after_steps/escalate_model). Check your @agentgrader/core version.`,
  );
}

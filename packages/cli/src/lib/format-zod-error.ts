import type { ZodError } from "zod";

/** Formats a ZodError as a human-readable, one-issue-per-line summary. */
export function formatZodError(err: ZodError, fileLabel: string): string {
  const lines = err.issues.map((issue) => {
    const path = issue.path.join(".") || "(root)";
    return `  - ${path}: ${issue.message}`;
  });
  return `Invalid ${fileLabel}:\n${lines.join("\n")}`;
}

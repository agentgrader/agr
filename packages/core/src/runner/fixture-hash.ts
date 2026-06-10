import { createHash } from "node:crypto";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { join, relative, sep } from "node:path";

const IGNORED_DIRS = new Set(["node_modules", ".git", "dist", ".turbo"]);

/**
 * Computes a stable SHA-256 hash over the contents (and relative paths) of a
 * fixture directory. Used to key cached baseline test results - if the
 * fixture changes, the baseline must be recomputed.
 */
export function hashFixture(fixtureDir: string): string {
  const hash = createHash("sha256");

  let files: string[] = [];
  try {
    files = listFilesRecursive(fixtureDir).sort();
  } catch {
    // fixture path doesn't exist (yet) - hash the path string itself so
    // callers still get a stable, if degenerate, key.
    hash.update(fixtureDir);
    return hash.digest("hex");
  }

  for (const file of files) {
    const rel = relative(fixtureDir, file).split(sep).join("/");
    hash.update(rel);
    hash.update(readFileSync(file));
  }

  return hash.digest("hex");
}

function listFilesRecursive(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (IGNORED_DIRS.has(entry.name)) continue;
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...listFilesRecursive(full));
    } else if (entry.isFile() || entry.isSymbolicLink()) {
      try {
        if (statSync(full).isFile()) out.push(full);
      } catch {
        // broken symlink - skip
      }
    }
  }
  return out;
}

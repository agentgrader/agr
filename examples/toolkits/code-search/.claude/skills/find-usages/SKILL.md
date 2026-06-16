---
name: find-usages
description: Use this skill to find all references to a named symbol (function, class, variable, type) across the project before renaming, refactoring, or deleting it.
allowed-tools:
  - executeCommand
---

# find-usages

`find-usages` is a CLI tool on `PATH` inside the sandbox that searches for every occurrence of a given symbol name across JS/TS source files.

## When to use it

- Before renaming a function or variable, to find all call sites that need updating.
- Before deleting a helper, to confirm nothing still references it.
- When debugging a runtime error caused by an unexpected caller.
- When the task says "refactor X" and you need to understand the blast radius first.

## Usage

Run via the `executeCommand` tool:

```
find-usages <symbol> [path]
```

- `symbol` — the exact name to search for (e.g. `formatDuration`, `UserService`, `MAX_RETRIES`).
- `path` — optional directory to search (defaults to `/app`).

Output is `grep -n` format: `file:line:matched line`. Exits 0 even when no matches are found.

## Example

```
$ find-usages formatDuration src/
src/commands/bench.tsx:367:  const avgDurNote = `  avg: ${formatDuration(avg)}/run`;
src/ui/Dashboard.tsx:52:  FAIL ${formatDuration(run.durationMs)} ($...
src/lib/format-relative-time.ts:14:export function formatDuration(ms: number): string {
```

## Tip

Combine with `find-todos` to understand both where a symbol is used and whether its implementation is flagged as incomplete.

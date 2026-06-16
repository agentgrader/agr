---
name: recent-changes
description: List the most recently modified files in the git repo (optionally under a subdirectory), so you can identify which parts of the codebase are actively changing before deciding where to make edits.
allowed-tools:
  - executeCommand
---

# recent-changes

`recent-changes` scans git history to find which files have been modified most recently, helping you orient quickly in a codebase before making changes.

## When to use it

- At the start of a task, to understand which areas are "hot" and may relate to the bug or feature.
- When looking for recently introduced changes that might be the source of a regression.
- To avoid editing stale or unrelated parts of the codebase.

## Usage

Run it via the `executeCommand` tool:

```
recent-changes [path] [--limit N]
```

- `path` (optional): restrict to a subdirectory (default: entire repo).
- `--limit N` (optional): number of files to show (default: 20).

## Example

```
$ recent-changes src/ --limit 5
3 hours ago          src/commands/bench.tsx
5 hours ago          src/lib/format-relative-time.ts
2 days ago           src/ui/Dashboard.tsx
3 days ago           src/commands/trace.ts
1 week ago           src/lib/report/types.ts
```

## Notes

- Output is deduplicated: each file appears once, for the most recent commit that touched it.
- Only tracked files that currently exist on disk are shown.
- Requires git to be available in the sandbox (standard on most CI images and SWE-bench fixtures).

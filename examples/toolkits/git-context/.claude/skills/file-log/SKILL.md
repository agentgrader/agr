---
name: file-log
description: Show the recent commit history for a specific file, including commit messages and authors, so you can understand why code was written the way it was or when a change was introduced.
allowed-tools:
  - executeCommand
---

# file-log

`file-log` shows the git log for a single file, giving you commit messages and timing that explain the evolution of that file over time.

## When to use it

- To understand the intent behind code that looks surprising or unclear.
- To identify which commit introduced a bug (narrows down what to revert or fix).
- To see whether a file was recently changed as part of a related feature.

## Usage

Run it via the `executeCommand` tool:

```
file-log <file> [--limit N]
```

- `file`: path to the file to inspect (relative to repo root).
- `--limit N` (optional): number of commits to show (default: 10).

## Example

```
$ file-log src/commands/bench.tsx --limit 4
a1b2c3d  3 hours ago   Alice   feat: add avg steps/run to bench result line
e4f5a6b  2 days ago    Bob     fix: bench multi-config failed cases
c7d8e9f  5 days ago    Alice   feat: bench startup breakdown N x M = K
1a2b3c4  1 week ago    Bob     feat: bench dry-run preview
```

## Notes

- Shows only commits that touched the specified file (uses `git log -- <file>`).
- Works for deleted files too (shows history up to the deletion).
- Requires git to be available in the sandbox.

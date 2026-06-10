---
name: find-todos
description: Use this skill to quickly locate TODO, FIXME, and XXX comments across the codebase. Useful when asked to clean up outstanding work items, audit technical debt, or check whether existing code already flags the issue you're about to fix.
allowed-tools:
  - executeCommand
---

# find-todos

`find-todos` is a small CLI tool, available on `PATH` inside the sandbox, that
greps the project for `TODO`, `FIXME`, and `XXX` comments in JS/TS source
files.

## When to use it

- Before starting a task, to check whether there's already a comment
  describing the issue you've been asked to fix.
- When asked to "clean up TODOs" or address outstanding technical debt.
- As a quick repo-wide audit of unfinished work before submitting.

## Usage

Run it via the `executeCommand` tool:

```
find-todos [path]
```

- `path` is optional and defaults to the current directory (`/app`).
- Output uses `grep -n` formatting: `path:line:matched line`.
- If nothing is found, it prints "No TODO/FIXME/XXX comments found in <path>"
  and exits successfully.

## Example

```
$ find-todos src/
src/utils/parser.ts:42:  // TODO: handle empty input
src/api/routes.ts:108:  // FIXME: this leaks a file descriptor on error
```

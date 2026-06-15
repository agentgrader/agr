---
"agentgrader": minor
---

Lower the friction of getting started: `agr init --blank` scaffolds just `agent.yaml` plus an empty `tasks/` directory (no sample test case), and the new `agr list-tests [dir]` command recursively lists every test case's `name`, path, and description. `agr run <testCase>` now also accepts a directory containing an `agr.yaml`, or a bare test case name / directory basename resolved by searching the current directory, so `agr run hello-world` works without typing the full path to `agr.yaml`.

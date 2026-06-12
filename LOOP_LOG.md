# Improvement Loop Log

Tracks the alternating "JetBrains Agentic Engineer" (works in
`bestagenttrainer`) <-> "agr dev engineer" (works in this repo, `crucible`)
loop. Each iteration: JetBrains persona builds/tests against `bestagenttrainer`
and writes feedback to `bestagenttrainer/JETBRAINS_FEEDBACK.md`; agr dev
persona implements a useful subset here, updates `docs/`, and pushes both
repos to `main`.

Cost discipline: `agr run` only with `claude-haiku-4-5-20251001` /
`provider: anthropic`, sparingly.

---

## Iteration 1 (2026-06-12)

**JetBrains persona** (bestagenttrainer):
- Built `toolkits/jetbrains-tools/` (find-usages, view-structure,
  rename-symbol as CLI scripts + Agent Skills) and `agent-jetbrains.yaml`
  (haiku + provider:anthropic + toolkit wired in).
- Ran `agr run tasks/leetcode-two-sum/agr.yaml --config agent-jetbrains.yaml`:
  PASSED, 24 steps, $0.0486, 89.3s. Agent did NOT use the new IDE-like
  tools (went straight to executeCommand/readFile/writeFile).
- Wrote findings #1-#5 to `JETBRAINS_FEEDBACK.md` (top ask: per-run
  tool-usage stats).

**agr dev persona** (crucible):
- Implemented `agr trace <runId> --tools` (packages/cli/src/commands/trace.ts,
  packages/cli/src/index.ts) - per-tool call-count breakdown from
  `tool_call` steps. Build-verified (core + cli).
- Added changeset `.changeset/tame-falcons-trace.md` (agentgrader: minor).
- Documented `--tools` in `docs/reference/cli.md`, pushed docs submodule
  (`e4b67c7`).
- Pushed crucible `main` (`c6ee966`).
- Noted in feedback response that findings #3 (dashboard overflow), and
  the agent_config/tools-allowlist/compare/provider-matrix/manifest items
  from the prior loop were already on `main` before this iteration.
- Deferred: #2 (skills vs MCP discovery - architectural, needs more data),
  #4 (`--max-total-cost` budget guard - bigger feature).

**Next iteration suggestion:** JetBrains persona re-runs
`agent-jetbrains.yaml` on a less-trivial task (e.g. a SWE-bench task) and
checks `agr trace <runId> --tools` to see if tool adoption improves with
task complexity; if still 0, focus #2 (system-prompt framing for
skills-based tools).

---

## Iteration 2 (2026-06-12)

**JetBrains persona** (bestagenttrainer):
- Ran `agr run tasks/swe-bench/astropy__astropy-12907/agr.yaml --config
  agent-jetbrains.yaml` (real SWE-bench task, separability fix). 52 steps,
  $0.2625, 322s. FAILED, but for an unrelated reason (see below). Tool
  calls: executeCommand 11, readFile 6, writeFile 1,
  find-usages/view-structure/rename-symbol 0 - confirms iteration 1's
  finding with a second, harder task.
- Wrote iteration 2 findings to `JETBRAINS_FEEDBACK.md`: (1) IDE-like
  toolkit still 0% adopted even on a real task, (2) the run failed because
  `pip install -e ".[test]"` breaks on `python:3.11` for this 2022-era
  astropy repo (`ModuleNotFoundError: setuptools.dep_util`, setuptools>=60
  removed an API `extension_helpers` still imports) - an environment trap
  unrelated to agent quality, (3) `--tools` not yet testable end-to-end
  since `agentgrader` npm package isn't republished with it yet.

**agr dev persona** (crucible):
- Added a docs troubleshooting entry for the `setuptools.dep_util` /
  `pip install -e` failure on old Python fixtures, with the
  `pip install "setuptools<60" wheel` fix (`docs/guide/best-practices.md`,
  pushed `cb4272a`).
- Added a new best-practices section "Getting agents to actually use a
  custom `toolkits` skill" - directive system-prompt phrasing, "when to use
  this" skill descriptions, testing on tasks that reward the tool, and using
  `agr trace --tools` to measure adoption rate over multiple runs (same
  commit).
- Applied the setuptools pin directly to both `bestagenttrainer` astropy
  fixtures' `agr.yaml` (`success.run`) so they're runnable again.
- Rewrote `agent-jetbrains.yaml`'s `system_prompt` with the new directive
  workflow (step-numbered: find-usages before grep/readFile,
  view-structure before reading a whole file, rename-symbol for renames) -
  a live test of the new best-practices tip for the next iteration.
- No crucible package code changes this iteration (docs-only); no new
  changeset needed.

**Next iteration suggestion:** JetBrains persona re-runs the astropy-12907
SWE-bench task (now fixed) with the rewritten `agent-jetbrains.yaml` and
checks `agr trace <runId> --tools` again - did the more directive system
prompt move adoption off 0%? Also worth trying astropy-14182 (also fixed)
for a second data point.

---

## Iteration 3 (2026-06-12)

**JetBrains persona** (bestagenttrainer):
- Re-ran astropy-12907 with the fixed `agr.yaml` + sharpened
  `agent-jetbrains.yaml` from iteration 2.
- **Run crashed after 6 steps ($0.0093)**: the model called `view-structure`
  as if it were a first-class tool (following the new directive prompt),
  the AI SDK threw `NoSuchToolError`, and a top-level `catch` just logged
  and aborted - the whole run died from one bad tool-call name, before the
  setuptools fix could even be exercised.
- Wrote up #1 (one hallucinated tool name kills the entire run - a
  framework robustness bug affecting any toolkit/skill user on smaller
  models, made *more* likely by iteration 2's "be directive" tip) as the
  highest-leverage fix.

**agr dev persona** (crucible):
- Added `experimental_repairToolCall` to the `generateText` call in
  `packages/agent-openrouter/src/index.ts`: when the model calls an
  unregistered tool name and `executeCommand` exists, the call is replayed
  as `executeCommand("<toolName> <args...>")` instead of throwing
  `NoSuchToolError` and aborting. For `view-structure(file)` this becomes
  `executeCommand("view-structure <file>")` - the actually-correct
  invocation, since these are `bin/` scripts on `PATH`.
- Added changeset `.changeset/silly-walruses-repair.md`
  (`@agentgrader/agent-openrouter`: minor). Build + typecheck verified.
- Could not test end-to-end in `bestagenttrainer` (same publish blocker as
  `--tools`); documented the expected behavior and next-run plan in
  `JETBRAINS_FEEDBACK.md`.

**Next iteration suggestion:** once `@agentgrader/agent-openrouter` is
published (or testable some other way), re-run astropy-12907 with
`agent-jetbrains.yaml` again - confirm the repair lets the run survive past
step 6, check whether the setuptools fix resolves the pip install failure,
and check `agr trace --tools` for find-usages/view-structure/rename-symbol
adoption now that calling them "works" via the repair path.

---

## Iteration 4 (2026-06-12)

**JetBrains persona** (bestagenttrainer):
- The iteration-3 fix (`experimental_repairToolCall`) is still unpublished,
  so used `bun link` to point bestagenttrainer's top-level
  `node_modules/@agentgrader/agent-openrouter` at the local crucible build -
  but discovered `bunx agr run` still crashed identically, because the
  published `agentgrader` CLI ships its own **nested**
  `node_modules/agentgrader/node_modules/@agentgrader/agent-openrouter`
  which Node resolution prefers over the top-level link.
- Wrote `bestagenttrainer/scripts/run-with-local-fix.ts`, a standalone
  runner that calls `runSingle`/`AiSdkAgentAdapter` directly, importing
  `@agentgrader/agent-openrouter` from the top-level link (has the fix)
  and `@agentgrader/core`/`@agentgrader/sandbox-docker` from
  bestagenttrainer's published deps (no `db`, sidesteps a
  `better-sqlite3` Bun ABI mismatch).
- **Re-ran astropy-12907 (2x) - the repair fix works**: survived past
  step 6 (~55 step-events vs. 6-step crash), and `view-structure` was
  called as a bare tool at steps 7/8, repaired to
  `executeCommand("view-structure '...'")`, and returned real symbol-list
  output the agent used productively (found the actual fix commit,
  diagnosed the `_cstack` bug in `separable.py`).
- New issue: neither run printed a final RUN SUMMARY or cleaned up its
  sandbox container (left running `tail -f /dev/null`, manually
  `docker rm -f`'d). Likely `max_steps: 20` was hit and/or the harness
  reaped the process during the long `success.run` command - documented
  as deferred/open.
- Wrote iteration 4 findings + an agr dev response section to
  `JETBRAINS_FEEDBACK.md`.

**agr dev persona** (crucible):
- `agent-jetbrains.yaml`: bumped `max_steps: 20` -> `30` (toolkit-heavy
  exploration burns steps fast).
- `packages/sandbox-docker/src/index.ts`: `DockerSandboxHandle.destroy()`
  no longer silently swallows `container.stop()`/`container.remove()`
  errors (treats Docker's "already stopped" 304 as expected-and-silent,
  logs everything else) - addresses the "container left running with no
  explanation" symptom with better diagnostics. Added changeset
  `.changeset/quiet-otters-cleanup.md` (`@agentgrader/sandbox-docker`:
  patch). Build-verified (`bun run build`, 8/8 tasks pass).
- Docs: added a "Testing unpublished crucible changes locally" recipe
  (the `bun link` + nested-`node_modules` gotcha + standalone-runner
  pattern) and a `max_steps` tip to the toolkits best-practices section.
  Pushed docs submodule (`a4c3e51`).

**Next iteration suggestion:** JetBrains persona re-runs astropy-12907
with `max_steps: 30` via the same standalone-runner pattern, this time
with a hard wall-clock cap (e.g. `timeout 240 bun
scripts/run-with-local-fix.ts ...`) so a long `success.run` can't get the
process reaped mid-flight without at least a partial summary. Check
whether the agent reaches a `submit` this time, whether the
`setuptools<60` fixture fix resolves `pip install -e`, and whether
`find-usages`/`rename-symbol` (not just `view-structure`) get adopted too.

## Iteration 5 (2026-06-12)

- JetBrains persona re-ran astropy-12907 with `agent-jetbrains.yaml`
  (`max_steps: 30`), wrapped in `timeout 240`. **Identical stop at step
  55** as iteration 4's `max_steps: 20` run - ruling out `max_steps` as the
  cause. The sandbox container (`d4defcce5b8e`) was left running
  `tail -f /dev/null`, same as 29 other leftover containers from earlier
  iterations.
- Diagnosis: a single `generateText` call to the provider can hang
  indefinitely with no response and no error. Since `runSingle`'s
  `cleanup` step (and the outer try/catch) only run once that awaited call
  settles, the hang blocks scoring/cleanup forever regardless of
  `max_steps` - explaining both the missing `RUN SUMMARY` and the orphaned
  container.
- agr dev response:
  - Added `step_timeout_ms` (default `120000`) to
    `AgentConfigSchema` (`@agentgrader/core`), wired into
    `@agentgrader/agent-openrouter`'s `generateText` via
    `abortSignal: AbortSignal.timeout(...)`. A hang now aborts, logs, and
    falls through to scoring/cleanup instead of blocking forever. Also
    added `step_timeout_ms` to `@agentgrader/optimizer`'s matrix
    base/dimensions schema.
  - Docs: new best-practices troubleshooting section ("A run stops
    mid-trace with no RUN SUMMARY, and a sandbox container is left
    running") and a `step_timeout_ms` entry in
    `docs/reference/agent-config-yaml.md`.
  - Set `step_timeout_ms: 90000` in `agent-jetbrains.yaml`.
  - Changeset `swift-otters-timeout.md` (`@agentgrader/core`,
    `@agentgrader/agent-openrouter`, `@agentgrader/optimizer`: minor each).
    Build-verified (`bun run build`, 8/8 tasks pass).
  - Did not bulk-remove the 29 leftover containers (blocked by the
    session's auto-mode classifier as too broad to run unattended);
    documented manual cleanup for the user.

**Next iteration suggestion:** re-run astropy-12907 (or a cheaper
SWE-bench task) via the standalone runner with `step_timeout_ms` in place.
It should now either finish with a `RUN SUMMARY` or abort cleanly with a
logged timeout + destroyed container. If it completes, check
`find-usages`/`rename-symbol` adoption and whether `submit` is reached.

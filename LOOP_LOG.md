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

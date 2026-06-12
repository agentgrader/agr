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

# agentgrader

## 1.7.1

### Patch Changes

- Fix npm install by replacing `workspace:*` dependency specifiers with published semver ranges in `agentgrader` and `@agentgrader/sandbox-e2b`.
- Updated dependencies
  - @agentgrader/sandbox-e2b@2.0.1

## 1.7.0

### Minor Changes

- patch descriptions

### Patch Changes

- Updated dependencies
  - @agentgrader/core@1.4.0
  - @agentgrader/agent-acp@3.0.0
  - @agentgrader/agent-openrouter@5.0.0
  - @agentgrader/optimizer@3.0.0
  - @agentgrader/sandbox-docker@5.0.0
  - @agentgrader/sandbox-e2b@2.0.0
  - @agentgrader/scorer-llm-judge@3.0.0
  - @agentgrader/scorer-static@3.0.0

## 1.6.0

### Minor Changes

- aedf957: `agr bench` now accepts optional positional test case names/paths (same resolution forms as `agr run` and `agr validate`). Pass one or more names without `--suite` to resolve them directly (`agr bench hello-world --matrix matrix.yaml`), or alongside `--suite` to filter the loaded suite to a named subset (`agr bench task-a task-b --suite tasks/ --configs agent.yaml`).
- 3377bd5: Add `--tags <tags>` flag to `agr bench`: filter a `--suite` run to only test cases whose `tags:` list matches at least one of the supplied comma-separated values. Useful for running language-specific or difficulty subsets of a large suite.
- 34ae35b: Add `agr list` command: an interactive TUI for browsing saved runs from `.agr/db.sqlite`, viewing run details (diff, trace preview), and comparing the diffs of two runs side by side. Use `--plain` for a non-interactive text listing, or `--limit`/`--db` to adjust the source.

  The interactive UI runs in the terminal's alternate screen buffer with a responsive column layout that adapts to the terminal width, fixed-height panels to avoid scroll jitter, and a full screen clear on navigation or resize so stale content never lingers. The run detail view lets you switch between the diff and trace panes with `Tab`/`t`, each with independent scrolling.

- e1e5269: Lower the friction of getting started: `agr init --blank` scaffolds just `agent.yaml` plus an empty `tasks/` directory (no sample test case), and the new `agr list-tests [dir]` command recursively lists every test case's `name`, path, and description. `agr run <testCase>` now also accepts a directory containing an `agr.yaml`, or a bare test case name / directory basename resolved by searching the current directory, so `agr run hello-world` works without typing the full path to `agr.yaml`.
- c595af7: Add `agr toolkit-list <dir>` command: lists a toolkit's `bin/` tools alongside their `.claude/skills/<name>/SKILL.md` descriptions, flagging tools with no skill doc. With `--check-config <agent.yaml>`, diffs the toolkit's `bin/` tools against that config's `track_tools`/`require_tools_before_submit` (including matrix files' `base:`-nested lists), surfacing tools that exist in the toolkit but aren't tracked by a given agent config, and vice versa.
- ce314f1: `agr validate` now accepts multiple test case names/paths in one invocation (`agr validate task-a task-b task-c --strict`). Each is validated in turn; the command exits 1 if any fail and prints a summary (`N/M validations passed`). Single-case behaviour is unchanged.

### Patch Changes

- 1629ce7: `aggregateResults` tests now cover `avgStepsCount` in the main averages test and the missing-fields zero-fallback test.
- 0d98de9: `agr bench --save-baseline` snapshots now record `avgDurationMs` and `avgStepsCount` in their aggregates. `agr compare-baseline` Markdown output now shows `Avg duration` and `Avg steps` rows with percentage deltas alongside solve rate and avg cost.
- 4e841b5: `agr bench --save-baseline` now records `avgTokensIn` and `avgTokensOut`; `agr compare-baseline` output shows `Avg tokens in` and `Avg tokens out` rows with percentage deltas when token data is available.
- 4ec56e8: `agr bench` result summary now shows `avg: $X.XXXX/run` alongside total cost when there are multiple runs, so you can quickly assess per-run spend for large suites. Multi-config result also shows per-config avg.
- bf213ff: `agr bench` result now shows `avg: Xs/run` alongside avg cost when running multiple runs. Multi-config breakdown shows per-config avg duration, helping compare speed vs cost tradeoffs across agent configs.
- fef5e0e: `agr bench` result now shows `avg: N steps/run` alongside avg cost and avg duration when running multiple test cases; multi-config breakdown also shows per-config avg step count. Duration avg note now consistently uses `avg:` prefix matching cost.
- 67c16e0: `agr bench` result summary now shows `avg: Nin/Mout tok/run` when token data is available; multi-config per-config breakdown also shows per-config avg token counts for model cost and token-efficiency comparisons.
- d1b1482: `agr bench` now accepts `--dry-run`: resolves test cases and agent configs (including matrix expansion), prints the full task x config matrix with total job count, and exits without opening Docker, spending any API budget, or writing to the database. Useful before large bench runs or matrix sweeps to confirm the scope looks right.
- b18fb47: `agr bench` result summary now shows `elapsed: Xs` (wall-clock time for the full benchmark), making it easy to see how long the bench took without timing it externally.
- 5bfd486: `agr bench` result summary now distinguishes test failures (agent ran but test didn't pass) from errored runs (sandbox crash), printing separate `Failed:` and `Errored:` lines with the first 60 chars of the error message for crashed runs.
- b07b478: `agr bench` (single-config) now prints a `Failed: case-a, case-b` line after the result summary when there are up to 10 failing test cases, so you can see at a glance which tests need attention without opening `agr list`.
- 45f41e2: `agr bench` now prints `Inspect:` instead of `Next:` when a CI gate fires (`--fail-on-failure`, `--min-solve-rate`), signaling that the user should debug rather than proceed to the next workflow step.
- 6b825ad: `agr bench --json` outputs the full bench result as a single JSON object and suppresses the live Ink dashboard, making it easy to consume bench results in scripts and CI pipelines (e.g. `result=$(agr bench --suite tasks/ --json); echo $result | jq .solveRate`)
- c28b238: `agr bench` now shows `Failed: N cases (see \`agr list\`)`and`Errored: N cases`when more than 10 cases fail or crash, instead of silently omitting the failure detail. Previously the`Failed:` line was only printed for up to 10 failures.
- 1fe5662: `agr bench --limit N` runs only the first N test cases after tag/suite filtering; useful for quick smoke tests on large suites without running the full set
- a75f8e4: `agr bench` multi-config result now shows `Failed:` and `Errored:` sub-lines per agent config when test cases fail, so you can see at a glance which test cases each config is stuck on without inspecting individual traces.
- a87e90f: `agr bench --suite tasks/ --name <substring>` filters test cases by name substring (case-insensitive), applied after `--tags` and `--skip-tags`; useful for quickly running a subset of a large suite without listing every case explicitly
- 89ad141: Print a context-aware "Next:" hint at the end of `agr bench` showing the most useful follow-up commands (trace/compare/export depending on whether multiple configs ran).
- fce93ce: `agr bench --only-failed` runs only the test cases that failed on their most recent run in the local DB; enables tight fix-and-retry loops: bench the full suite, fix failing cases, then re-run only those with `--only-failed`; exits cleanly (code 0) when all previously-failed test cases have since passed
- c69097b: `agr bench --shuffle` randomizes the order of test cases before running; reduces order-dependent bias in large suites and helps surface order-sensitive flaky tests
- 7919ed8: `agr bench --suite tasks/ --skip-tags slow` excludes test cases with any of the specified tags from the run; applied after `--tags` so you can include a broad set and then exclude a subset; prints a warning when used without `--suite`
- 42b4aec: `agr bench` now prints `Starting N run(s), concurrency: M` before the live dashboard starts, making the total job count and concurrency setting visible without `--dry-run`.
- bf17ce6: `agr bench` startup log now shows the test-case x config breakdown when running multiple configs: `Starting 3 test case(s) x 2 config(s) = 6 run(s), concurrency: 2`. Single-config output is unchanged.
- ff3dc10: Improve `agr bench` startup and completion output: config load now prints name+model for `--config`/`--configs`; suite mode prints discovery count; non-matrix runs print a plain-text `Result: N/M PASS (X%) cost: $Y` summary line after the dashboard (useful for CI logs where Ink rendering may not persist). Also fixes singular/plural "config"/"configs" in the shared agent_config log.
- bd4a4ee: `agr bench --strict-toolkits` now prints the specific security findings that caused the audit failure, matching the output of `agr validate-toolkit`, instead of only printing the toolkit path.
- 39d9f60: `agr bench` tag breakdown now annotates rows with `all passed` or `none passed` when a tag has 100% or 0% solve rate, making it easy to spot perfectly-solved or completely-stuck tag groups at a glance.
- 1af012c: `agr bench` now shows `Inspect:` instead of `Next:` when solve rate is 0% (all cases failed), even without `--fail-on-failure` or `--min-solve-rate`, since a 0% result always means the user needs to debug rather than proceed.
- e489a94: `metrics["tool-adoption"]`/`metrics["tool-usage"]` now record `usedVia: "direct" | "wrapped"` per tool, via the new `getCommandUsageSource` (refactored from `wasCommandUsed`). `agr trace --quality` prints `OK (called directly)` vs. `OK (via another tool's output)` vs. `MISSING` per required/tracked tool, falling back to `OK (mechanism not recorded for this run)` for runs predating this change. Previously both cases were reported identically as `OK`, making it impossible to tell whether a required tool was actually invoked or only credited because a composite tool wrapped it.
- 67c16e0: `agr cleanup --yes` now prints `Next: agr bench | agr list` after removing leftover sandbox containers.
- fa55256: Added `agr run` usage examples to CLI help (`agr run hello-world`, `agr run hello-world --config agent.yaml --verbose`, `agr run tasks/fix-bug/agr.yaml --fail-on-failure`). Also added a bare `agr bench hello-world` example to the bench command.
- eeb36f3: The `examples/toolkits/code-search` example toolkit now includes `SKILL.md` files for `find-todos` and `find-usages`, and adds a `find-usages` bin script. This demonstrates the skills progressive-disclosure system and gives new users a complete, working multi-tool toolkit reference.
- e0935af: `agr compare` now shows run duration in human-readable format (`45.0s`, `2m 30s`) instead of raw milliseconds, consistent with `agr trace`. The `formatDuration` helper is now shared from `lib/format-relative-time`.
- bbbee41: `agr compare --last-two --test-case <name>` compares the two most recent runs for a specific test case; useful when you run a suite and want to diff before/after for one task without looking up run IDs
- 92bcd47: `agr compare --last-two` compares the two most recent runs without needing to specify run IDs. The multi-config bench `Next:` hint now suggests `agr compare --last-two --only-diff`.
- dafe154: Add "Next:" hints to `agr compare` and `agr compare-baseline --output`: `agr compare` now suggests tracing either run after the step diff summary; `agr compare-baseline` with `--output` now suggests posting the file as a PR comment or inspecting the latest run with `--quality`.
- e9dcffe: `agr doctor` runs a pre-flight check of the local environment: Docker daemon, API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, E2B_API_KEY), database accessibility, agent config presence, and test case discovery; exits 1 when any required check fails
- f148d8b: `agr doctor --json` outputs environment check results as a single JSON object with `passed`, `failureCount`, `warningCount`, and `checks[]` (per-check `label`, `status`, `detail`); useful in setup scripts and CI initialization workflows
- 145f225: `agr export runs` and `agr export traces` now print the record count in the output message, e.g. `Export written to export-runs.json (42 records)`.
- fefea3c: `agr export runs --format csv` writes a CSV file with one row per run; all fields (`id`, `testCaseId`, `agentConfigId`, `passed`, `costUsd`, `durationMs`, `stepsCount`, `tokensIn`, `tokensOut`, `matrixId`, `metrics`) are included as columns; `metrics` is JSON-serialized; default filename is `export-runs.csv`
- a349e67: `agr export runs --last-matrix` exports runs for the most recent matrix sweep without requiring the matrix ID. The `agr bench --matrix` Next: hint now uses this shortcut.
- 9b4de3d: `agr export runs --passed` and `--failed` filter exported runs by outcome; mutually exclusive flags, combinable with `--since`, `--test-case`, `--config`, and `--limit`
- 3103bec: `agr export runs --since <duration|date>` filters to runs created after a given point; accepts relative durations (1h, 24h, 7d, 30s) or ISO timestamps
- 25e35e5: `agr export runs` now includes `stepsCount`, `tokensIn`, and `tokensOut` in each exported run record alongside the existing cost, duration, and metrics fields.
- 785c136: `agr export runs --test-case <id>` and `--config <id>` filter exported runs by test case or agent config (substring match); combinable with `--since`, `--matrix-id`, and `--limit`
- 11ec1d0: `agr export traces` now accepts `--last` to export the most recent run's traces without needing to specify a run ID, mirroring the `agr trace --last` shortcut.
- caaa026: `agr export traces --test-case <name>` exports traces for all matching runs of a test case without requiring a run ID; `--config`, `--since`, `--passed`, and `--limit` also filter multi-run trace exports; `agr export traces --last --test-case <name>` now correctly scopes to the most recent run for that test case (was silently ignoring `--test-case` before)
- 8b84eef: Added `fix-missing-await` TypeScript bug test case to `examples/suites/typescript-bugs/` — a classic async loop mistake where forgetting `await` produces NaN. Strengthens the reference suite used by `agr bench --suite examples/suites/typescript-bugs/`. Also adds a CI test that validates all example test cases load without schema errors.
- 8f704a6: Add `formatDuration` unit tests covering sub-second, sub-minute, and multi-minute cases, plus the zero-millisecond edge case.
- 7732195: Added `examples/toolkits/git-context` as a second reference toolkit with two tools: `recent-changes` (shows recently modified files in git history) and `file-log` (shows commit history for a specific file), both with `SKILL.md` progressive disclosure docs.
- f8b81fb: `agr validate <testCase>` now accepts the same path/directory/name forms as `agr run` (resolved via `resolveTestCasePath`), so `agr validate hello-world` works without typing the full path to `agr.yaml`.
- 2569849: `agr init --ci` (and `agr init --blank --ci`) writes `.github/workflows/agr.yml` — a GitHub Actions workflow that installs agentgrader and runs `agr bench --suite tasks/ --fail-on-failure` on push and pull_request, wiring the CI gate in one command
- 5e4081b: `agr init --example python` (or `--example py`) scaffolds a Python test case instead of the default JavaScript one: `fixture/math.py` with an unimplemented `add()` and `fixture/test_math.py` verified with `pytest -x`, so Python developers can start without writing boilerplate YAML
- b02108e: `agr init` now creates a `.gitignore` in the scaffolded directory (skipped if one already exists) that ignores `.agr/` (run history and exports) and `.env`, preventing accidental commits of the local SQLite database.
- edbd008: `agr init` and `agr init --blank` next-steps output now includes `agr status` as step 4, helping new users discover the DB summary command.
- 8b66d48: `agr list --plain` now shows run duration alongside cost and step count, so you can compare run performance at a glance without opening the trace.
- f62b30e: `agr list --plain` footer now shows actionable next-step hints (`agr trace --last`, `agr compare --last-two`, `agr list` for TUI) instead of the previous circular "Open interactively with `agr list`" message.
- f9fd9ef: `agr list --since <duration|date>` filters the run list to runs after a given point; applied before `--limit` so you get the N most recent within the window
- 2794103: `agr list --config <name>` and `agr status --config <name>` filter by agent config (substring match); enables comparing two configs side-by-side via `agr status --config agent-a` and `agr status --config agent-b`
- 715621a: `agr list --passed` / `agr list --failed` and `agr status --passed` / `agr status --failed` filter runs by outcome; mutually exclusive; mirrors `agr export runs --passed/--failed`; `--failed` in list shows failing runs for triage; `--failed` in status shows cost and avg duration of failing runs
- dc50e6d: `agr list --test-case <name>` filters the run list to a specific test case (substring match); consistent with `--test-case` on `status`, `trace`, and `compare`
- 00a2981: `agr list-tests --count` prints only the number of matching test cases as a bare integer, making it easy to use in shell scripts and CI conditions (e.g., `if [ $(agr list-tests --count) -eq 0 ]; then echo "no tests"; fi`)
- ce314f1: `agr list-tests` now accepts `--json` to print results as a JSON array (`name`, `path`, `relativePath`, optional `description`) instead of a human-readable table. Useful for CI scripts that enumerate test cases without parsing columnar output.
- a0a9964: `agr list-tests --name <substring>` filters test cases by name substring (case-insensitive), complementing `agr bench --name` for discovery workflows
- 6f5336f: `agr list-tests` now shows a context-aware `Next:` hint: with `--tags` it suggests `agr bench --suite <dir> --tags <tags>`; with multiple results it suggests `agr bench --suite <dir>`; for a single result it suggests `agr run <name>`.
- a050f61: Show tags inline in `agr list-tests` and `agr bench --dry-run` output: when any test case in the set has tags, each row prints its tags in `[tag1, tag2]` form at the end of the line. Rows without tags stay clean. Also updates `agr init` step 3 to suggest `agr trace --last` instead of requiring a runId.
- e411a38: `agr list --plain` now shows `tokens: Nin/Mout` per run when token data is available; `agr list` TUI detail panel also shows token counts alongside cost, duration, and step count.
- edbd008: `agr bench --matrix` summary now shows `tok:Nin/Mout` per config when any run has token data, making model token-efficiency visible in matrix sweeps.
- 410cbb6: `parseSince` utility now has unit tests covering relative durations (s, m, h, d), ISO date strings, and error cases for unrecognized formats
- 1b85545: `agr bench --report` HTML and Markdown by-config tables now include an `Avg duration` column alongside avg cost, making speed vs cost comparisons visible in the report.
- 38ca4dd: `agr bench --report` HTML and Markdown by-config tables now include an `Avg steps` column, making step efficiency visible alongside cost and duration for multi-config comparisons.
- 57420ab: `agr bench --report` HTML and Markdown by-config tables now include `Avg tokens in` and `Avg tokens out` columns, surfacing the per-config token averages already computed by `aggregateResults`.
- c43c79d: `agr bench --report` HTML and Markdown reports now show duration in human-readable format (`1m 30s`) instead of raw milliseconds, consistent with all other views.
- 2cebab9: `agr bench --report` HTML and Markdown reports now include a `Steps` column alongside cost and duration, making it easier to spot agents that used unexpectedly many or few steps.
- ec81cdf: `agr run` and `agr bench` now warn when `--report <format>` is passed without `--output <path>`, instead of silently writing no report.
- 4e8bb13: `agr run <name> --max-steps <n>` and `agr bench --suite tasks/ --max-steps <n>` override `max_steps` from the agent config without editing YAML; useful for budget-capped smoke tests (`--max-steps 5`) or extended runs (`--max-steps 50`)
- 2df2338: `agr run <name> --model <model>` and `agr bench --suite tasks/ --model <model>` override the model for the run without editing the agent YAML; useful for quick model comparisons or one-off runs with a different model
- b73d039: `agr run --json` outputs the run result as a single JSON object and suppresses the live Ink UI, making it easy to use in scripts and CI pipelines (e.g. `result=$(agr run hello-world --json); echo $result | jq .passed`)
- a96208d: `agr run` now shows a context-aware next hint: on pass it suggests `agr bench <name>` to scale up to a full benchmark; on fail it shows the existing `Inspect:` trace hints for debugging.
- ffe68e1: `agr run <name> --repeat N --json` outputs a single JSON object with `passedRuns`, `totalRuns`, `solveRate`, `totalCostUsd`, `avgCostUsd`, `avgDurationMs`, and a `runs` array; previously `--json` was silently ignored when combined with `--repeat`
- c5381ea: `agr run <name> --repeat <n>` runs the same test case N times sequentially and prints a solve-rate summary (`X/N PASS (Y%)`, avg cost, avg duration); useful for flakiness testing and verifying statistical consistency of a fix before scaling up with `agr bench`; each run is recorded in the DB and traceable via `agr trace --last --test-case <name>`
- f86261f: `agr run` now exits with a clear error when no agent config is available (neither `--config` on the CLI nor `agent_config:` in the test case's `agr.yaml`), instead of silently falling back to a hardcoded `gpt-4o-mini` baseline that required an unrelated API key. Behaviour now matches `agr bench`, which already errored in this situation.
- bc1dffb: `agr run` now prints the resolved `agr.yaml` path alongside the test case name in its startup line, so name-based resolution is transparent. `agr bench` prints which test cases were loaded (direct-resolution mode) or which subset was kept after filtering (suite + positional names). `agr list-tests` now prints one compact line per test case (name, path, description) instead of a multi-line block, making large lists faster to scan.
- dfaf812: `agr run` next/inspect hint now uses the actual run ID (`agr trace <runId>`) instead of `--last`, so the reference stays stable even after subsequent runs.
- 5d12804: Print `agr trace --last` tip at the end of every `agr run` so the next debugging step is always visible.
- a22deb3: `agr run` RUN SUMMARY now shows duration in human-readable format (`1m 30s`) using the shared `formatDuration` utility, consistent with `agr trace`, `agr compare`, and `agr list --plain`.
- 75f4b10: `agr status --by-config` shows a per-config breakdown: solve rate, avg cost, avg duration, and avg tokens per agent config, sorted by solve rate descending; combinable with `--since` and `--test-case` to scope the data; `--json` emits a `byConfig` array; enables A/B analysis across multiple agent configs without running `agr status --config <name>` for each one
- 539ce9a: `agr status --by-test-case` shows a per-test-case breakdown: solve rate, avg cost, avg duration, sorted by solve rate ascending (hardest first); combinable with `--since` and `--config` to scope the data; `--json` emits a `byTestCase` array; pairs with `agr bench --only-failed` to identify and re-run the hardest test cases
- 5f2c839: Added `agr status` command: prints a quick summary of the local run database (total runs, pass/fail counts, unique test cases and configs, total cost, and last run timestamp) without launching the interactive TUI.
- 67c16e0: `agr status --json` emits machine-readable JSON output for use in CI scripts and shell pipelines; `agr status` now also shows total token counts (`Tokens: N in / M out`) when token data is available in the database.
- fb1ba54: `agr status --since <duration|date>` restricts DB summary stats to runs after a given point; `parseSince` extracted to shared lib used by both `export` and `status` commands
- b9a4f93: `agr status --test-case <name>` shows solve rate, avg cost, and avg duration for a specific test case; `--json` adds `solveRate`, `avgCostUsd`, `avgDurationMs`, and `testCase` fields; all views now show solve rate and avg cost/duration
- c69097b: `agr status --by-config --top <n>` and `agr status --by-test-case --top <n>` cap the breakdown output to the N highest-scoring configs or N hardest test cases; useful when many configs or test cases would produce an overwhelming list
- 6371cc7: Fix non-deterministic test case discovery order: `findTestCaseYamlFiles` now sorts directory entries before recursing, ensuring consistent `--suite` ordering across platforms (Linux `readdirSync` returns filesystem/inode order, not alphabetical).
- 24c1f05: `agr bench --suite` and `agr validate --suite` now print `agr list-tests <dir>` as a debug hint when no test cases are found or no cases match the tag filter, instead of exiting silently.
- 25433f9: Propagate `--tags` filtering to `agr list-tests` and `agr validate --suite`: both commands now accept `--tags <comma-separated>` to scope output or validation to test cases whose `tags:` list overlaps with the requested tags. `agr list-tests --json` output also includes the `tags` array when present. `TestCaseSummary` gains an optional `tags` field.
- f25953e: Warn when `--tags` is passed to `agr bench` or `agr validate` without `--suite`: previously the flag silently had no effect; now prints `Warning: --tags has no effect without --suite`.
- e4a9691: `agr toolkit-list` now prints a `Next:` hint in the base case (no `--check-config`) and a fix-and-rerun or proceed hint after `--check-config` completes, completing the toolkit audit workflow hints.
- 0aee805: `agr toolkit-list --check-config`: when untracked tools are found, print the exact `track_tools` YAML snippet to add rather than just listing tool names.
- bb5e878: `agr trace --last --config <name>` and `agr compare --last-two --config <name>` scope to the most recent run(s) for a specific agent config (substring match on `agentConfigId`); completes the `--test-case`/`--config` filter symmetry across all per-run debug commands; combinable with `--test-case` for narrow scoping
- 9132fa9: `agr trace` and `agr compare` run headers now show `tokens: N in / M out` when token data is available, making total token usage visible at a glance alongside cost and duration.
- 75eeab5: `agr trace` now shows run duration in human-readable format (`45.0s`, `2m 30s`) instead of raw milliseconds (`45000ms`), making long-running runs easier to scan at a glance.
- 5822f70: `agr trace` now accepts `--last` to inspect the most recent run in `.agr/db.sqlite` without copying a UUID. Works with `--tools` and `--quality`: `agr trace --last --tools`. The `[runId]` argument is now optional when `--last` is given.
- 27d9203: Fix `agr trace --last --tools` and `agr trace --last` (step display): both were calling `getTraces(db, undefined)` instead of using the resolved run ID, resulting in 0 steps shown when `--last` was used without an explicit run ID.
- 12f3640: `agr trace --last --test-case <name>` traces the most recent run for a specific test case; pairs with `agr compare --last-two --test-case` for per-task debug workflows without needing run IDs
- ae89fc3: `agr trace` now prints a `Next:` hint at the end of each view mode: the default view suggests `--quality` and `--tools`; `--quality` suggests `--tools`; `--tools` suggests `--quality`. All three also suggest `agr compare --last-two`.
- d07da47: `agr trace` now shows `steps: N` in the run header, consistent with `agr compare` which already showed step count.
- afe5aa7: `agr bench` live dashboard and `agr list` TUI detail panel now show duration in human-readable format (`1m 30s`) using the shared `formatDuration` utility, consistent with all other views.
- b9205bb: `agr validate` now prints a fix-and-rerun instruction when validation fails, matching the `agr validate-toolkit` behavior. Single-case failures show `agr validate <name>`; multi-case failures list only the failing names (or `--suite <dir>` when all failed).
- d5889c9: `agr validate --json` outputs validation results as a single JSON object with `passed`, `passedCount`, `totalCount`, and a `results` array (per-test-case: `name`, `path`, `ok`, `checks[]`); suppresses per-check console output for scripting and CI pipelines
- a3ac12f: Add "Next:" hint after `agr validate` succeeds: single-case validation suggests `agr run <name>` and `agr bench <name>`; suite validation suggests `agr bench --suite <dir>` and the matrix form.
- 5822f70: `agr validate` now accepts `--suite <dir>` to validate every test case found recursively under a directory, without having to list names explicitly. Mirrors `agr bench --suite`. Useful in CI as `agr validate --suite tasks/ --strict`.
- 4046bf2: `agr validate-toolkit` now prints a `Next:` hint on success and a fix-and-rerun instruction on failure, so the workflow is clear without consulting the docs.
- Updated dependencies [4e841b5]
- Updated dependencies [e489a94]
- Updated dependencies [30ee67c]
- Updated dependencies [e489a94]
- Updated dependencies [e489a94]
- Updated dependencies [e489a94]
- Updated dependencies [9f387b8]
- Updated dependencies [e489a94]
- Updated dependencies [e489a94]
- Updated dependencies [32b05c2]
  - @agentgrader/optimizer@2.0.2
  - @agentgrader/core@1.3.2
  - @agentgrader/agent-openrouter@4.1.0
  - @agentgrader/agent-acp@2.0.3
  - @agentgrader/sandbox-docker@4.2.0
  - @agentgrader/sandbox-e2b@1.0.1

## 1.5.1

### Patch Changes

- 76f766a: Add `agr toolkit-add <name> [--dir <toolkitDir>]`: scaffolds a new toolkit tool as a `bin/<name>` shell script stub plus a matching `.claude/skills/<name>/SKILL.md` stub, following the layout used by `toolkits/jetbrains-tools`. Both files are TODO-filled templates - implement the script and fill in the skill description, then reference `<toolkitDir>` from `toolkits:` in an agent config or test case. Previously, adding a new toolkit tool meant hand-copying an existing `bin/`+`SKILL.md` pair and editing every reference.
- ae11ad1: Fix `expandMatrix` silently dropping `base.require_tools_before_submit`: it was missing from `MatrixBaseSchema` (so zod stripped it) and from the per-combination `AgentConfig` it builds, so `metrics["tool-adoption"]` never appeared for `agr bench --matrix` runs even when configured in `base`.
- caf23c3: Add `require_tools_before_submit: string[]` to agent config: a list of command names (e.g. a toolkit's `run-tests`, or a generic `pytest`/`biome`) that should have been invoked at least once before `submit`. Checked against `executeCommand`/`terminal/create` first-words and direct tool names via the new `wasCommandUsed` helper. Never blocks the run - purely annotates `metrics["tool-adoption"]` (`{ passed, detail, required, missing }`), surfaced by `agr trace --quality` and a new `TOOL ADOPTION BY CONFIG` footer in `agr bench`. Lets users measure whether a custom toolkit's tools are configured but unused, without manually grepping trace output.
- 4f141ee: Add an optional `track_tools` agent config field for non-gating toolkit-tool
  adoption analytics. Listed command names are checked the same way as
  `require_tools_before_submit`, but the result only annotates
  `metrics["tool-usage"]` (used/unused breakdown) without affecting
  `metrics["tool-adoption"]` or pass/fail. `agr trace --quality` now prints a
  "Tool usage (track_tools)" section when this metric is present. Useful for
  watching adoption trends of optional toolkit tools (e.g. a new
  `show-call-hierarchy`) over many runs without making them required.
- e5862a3: Bucket `executeCommand` (AI SDK adapter) and `terminal/create` (ACP adapter) calls by the first word of the command in `agr trace --tools` and the `agr bench` `TOOL USAGE BY CONFIG` footer (e.g. `executeCommand:find-usages`, `terminal/create:pytest` instead of one opaque `executeCommand`/`terminal/create` bucket). Previously, a custom toolkit's CLI tools were indistinguishable from generic shell exploration (`find`, `grep`, `cat`, ...) in tool-usage breakdowns, making it impossible to measure adoption of toolkit-provided commands for either adapter.
- Updated dependencies [6c3c87b]
- Updated dependencies [631b5af]
- Updated dependencies [3b2181d]
- Updated dependencies [49beb87]
- Updated dependencies [4f141ee]
  - @agentgrader/agent-acp@2.0.1
  - @agentgrader/core@1.3.1
  - @agentgrader/optimizer@2.0.1
  - @agentgrader/sandbox-docker@4.1.0

## 1.5.0

### Minor Changes

- After every `agr bench` run, print a `TOOL USAGE BY CONFIG` summary that aggregates `tool_call` counts from the SQLite trace per agent config. Makes toolkit/MCP adoption visible across a full bench sweep without running `agr trace --tools` on each run individually.

## 1.4.0

### Minor Changes

- 402cc11: `DockerSandboxProvider` now labels every sandbox container with `agentgrader.sandbox=true` and a creation timestamp, and exposes `listSandboxes()`/`removeSandbox()`. The CLI gets a new `agr cleanup` command that lists (or, with `--yes`, removes) leftover sandbox containers - e.g. from a run whose process was killed before its `cleanup` step could call `destroy()`. Combined with `step_timeout_ms`, this gives a way to both prevent and clean up the orphaned `tail -f /dev/null` containers that previously accumulated silently across runs.
- Add `@agentgrader/agent-acp` with `AcpAgentAdapter`: Agentgrader acts as an ACP client, spawns ACP-compatible agents (Claude Code, Cursor Agent, etc.) over stdio via `@agentclientprotocol/sdk`, and routes fs/terminal tool calls into the Docker sandbox. `@agentgrader/core` gains optional `acp_command`, `acp_args`, `acp_cwd`, and `acp_env` on `AgentConfig`. The CLI adds `--adapter` (`ai-sdk` | `acp`) for `agr run` and `--adapters` for `agr bench`.
- 8873f9a: Two cost/analytics improvements driven by the `provider: anthropic` setups in the JetBrains feedback loop:

  - **Anthropic prompt caching**: `@agentgrader/agent-openrouter` now sends the system prompt + tools as a `messages`-array system message with `providerOptions.anthropic.cacheControl: { type: "ephemeral" }` when `provider: anthropic`. Anthropic caches everything up to and including that block, so repeated runs with the same `agent.yaml` (e.g. `agr bench`/matrix sweeps) only pay full price for the system-prompt+tools prefix once per 5-minute cache window. No effect on other providers, which ignore the unrecognized `providerOptions` key.
  - **Cache stats in traces**: step events now carry `cachedTokens` (tokens served from Anthropic's prompt cache), persisted as a new `traces.cached_tokens` column. `agr trace <runId>` shows `cached:N` per step and a `prompt cache: X/Y input tokens served from cache (Z%)` summary line. Cost calculation also now accounts for the discounted cache-read (0.1x) and cache-write (1.25x) input pricing instead of charging full input price for cached tokens.
  - **Model escalation hook**: new optional `agent.yaml` fields `escalate_after_steps` and `escalate_model`. If the agent hasn't called `submit` after `escalate_after_steps` steps, `@agentgrader/agent-openrouter` switches to `escalate_model` (via the AI SDK's `experimental_prepareStep`, which fires before every step/LLM call) for the rest of the run - e.g. start on `claude-haiku-4-5` and escalate to a stronger model only if the cheap model is struggling, mirroring how IDE chat agents (Cursor, JetBrains) let you pick different models per turn.

- 9c911e7: `AgentResult` now has an optional `error` field, populated by `@agentgrader/agent-openrouter` whenever the `generateText` loop itself throws or aborts (including a `step_timeout_ms` timeout, with a message pointing at that setting). `runSingle` surfaces this as `metrics.agentError`, and `agr trace` prints it as `agent error:` when present. This distinguishes "the agent never got to `submit`, the loop itself errored or was aborted" from "the agent submitted but its solution failed scoring", both of which previously looked identical (`finished: false`, no detail).
- 25edd16: `agr run` now renders a proper Ink TUI instead of plain `console.log` streaming: a live step list (color-coded by kind - tool calls in blue, tool results in green, messages in white, thinking in gray - truncated to 200 chars, full detail with `--verbose`, a compact step/cost counter without it), a final summary panel (PASS/FAIL, steps, cost, duration, prompt-cache hit rate, error and regression/diff/localization metric lines), and - new - a colorized unified diff of `finalDiff` (green `+`/red `-`/cyan `@@` hunks, capped at 60 lines). Exit codes are unchanged (`0` on a completed run regardless of pass/fail, `1` if `runSingle` throws).

  Also removes every emoji/pictographic glyph from CLI output across `agr run`, `agr bench`, `agr validate`, `agr compare`, and the top-level CLI error handler, replacing them with plain bracketed labels (`[OK]`/`[WARN]`/`[FAIL]`, `PASS`/`FAIL`, `[error]`) and Ink/ANSI color - "no emoji anywhere" is now a CLI-wide convention.

- f4b1345: New `agr init [dir] [--force]` command scaffolds a minimal, runnable project: a `agent.yaml` agent config (`claude-haiku-4-5-20251001`, `provider: anthropic`) plus a tiny self-contained `tasks/hello-world` test case (implement `add(a, b)` in `math.js` so `node --test math.test.js` passes - no `npm install`/`pip install` required inside the sandbox). Refuses to overwrite an existing `agent.yaml` unless `--force` is passed, and prints next-step instructions (`agr run tasks/hello-world/agr.yaml --config agent.yaml --verbose`) so a new user can try `agr run` immediately.
- c6ee966: Add `agr trace <runId> --tools` flag, printing a tool-usage breakdown (call counts per tool name across the run's `tool_call` steps). Useful for checking whether custom toolkit/MCP tools were actually used by the agent versus only made available.
- 52f0c5c: `agr run`, `agr bench`, and `agr validate` now warn on stderr when `agent.yaml` or `agr.yaml` contains a top-level key that the installed `@agentgrader/core` doesn't recognize, e.g. `[WARN] agent config "agent.yaml": unrecognized field(s) "step_timeout_ms" - these are silently ignored. ...`.

  This catches a "config version-skew" trap found in the JetBrains feedback loop: zod's `.parse()` silently drops unrecognized keys, so a field your YAML sets (`step_timeout_ms`, `escalate_after_steps`/`escalate_model`, etc.) can have zero effect with no error if `@agentgrader/core` predates that field. The warning makes this immediately visible instead of looking like the field "just doesn't help".

### Patch Changes

- Updated dependencies [b90b9b7]
- Updated dependencies [0324c8a]
- Updated dependencies [402cc11]
- Updated dependencies
- Updated dependencies [8873f9a]
- Updated dependencies [9c911e7]
- Updated dependencies [3d853b6]
- Updated dependencies [eaa310f]
- Updated dependencies [3f69bd2]
- Updated dependencies [490e98d]
  - @agentgrader/agent-openrouter@4.0.0
  - @agentgrader/core@1.3.0
  - @agentgrader/sandbox-docker@4.0.0
  - @agentgrader/agent-acp@2.0.0
  - @agentgrader/store@1.1.0
  - @agentgrader/optimizer@2.0.0
  - @agentgrader/scorer-static@2.0.0

## 1.3.0

### Minor Changes

- Use `agent_config` from `agr.yaml` as default for `agr run`; bench fallback when all test cases share the same path.

### Patch Changes

- Updated dependencies
- Updated dependencies
  - @agentgrader/core@1.2.0
  - @agentgrader/agent-openrouter@3.0.0
  - @agentgrader/optimizer@1.0.0
  - @agentgrader/sandbox-docker@3.0.0
  - @agentgrader/scorer-static@1.0.0

## 1.2.0

### Minor Changes

- Add `agr compare <runIdA> <runIdB>` to compare step traces of two runs side by side, with `--full` and `--only-diff` options.

## 1.1.0

### Minor Changes

- Add `--configs-dir` and `--manifest` to `agr bench` for loading multiple agent config files from a directory or a bench manifest YAML with glob support.

## 1.0.7

### Patch Changes

- Truncate long config names in bench dashboard; improve import-pr test-runner detection and clone-fixture messaging; add validate --strict tip when execution checks are skipped.
- Updated dependencies
- Updated dependencies
  - @agentgrader/agent-openrouter@2.0.3
  - @agentgrader/optimizer@0.1.1

## 1.0.6

### Patch Changes

- Bump @agentgrader/store dependency to ^1.0.3 for getRunsByMatrixId export.
- Add --verbose to agr run; CLI help examples; --config alias for bench; improve import-pr scaffolding and validate UX (--strict, skip warnings); clearer run summary for skipped scorers.
- Updated dependencies
- Updated dependencies
  - @agentgrader/core@1.1.3
  - @agentgrader/store@1.0.3

## 1.0.5

### Patch Changes

- `agr run`/`agr validate`/`agr bench` now print a readable, one-issue-per-line summary when an `agr.yaml` test case or agent config YAML fails schema validation, instead of dumping the raw Zod error as JSON.
- Updated dependencies
  - @agentgrader/sandbox-docker@2.0.2

## 1.0.4

### Patch Changes

- 99b8f7d: The `agr` CLI now loads `.env` from the current working directory via `dotenv/config`, so `ANTHROPIC_API_KEY`/`OPENAI_API_KEY`/`OPENROUTER_API_KEY` set in a project's `.env` file are picked up. Additionally, `AiSdkAgentAdapter` now throws a clear error naming the missing environment variable instead of silently falling back to a `"mock-key"` and failing with a cryptic "Missing Authentication header" from the provider.
- Updated dependencies [99b8f7d]
  - @agentgrader/agent-openrouter@2.0.1

## 1.0.3

### Patch Changes

- 8c85583: Running a command with missing required arguments (e.g. `agr run` with no test case path) now prints a friendly error and the command's help instead of crashing with a raw `CACError` stack trace.
- Updated dependencies [8c85583]
  - @agentgrader/core@1.1.1

## 1.0.2

### Patch Changes

- 81eff8a: fix critical workspace dependency resolution issue on npm by replacing `workspace:*` with exact caret versions.
- Updated dependencies [94a1869]
- Updated dependencies [81eff8a]
- Updated dependencies [ef07b0a]
  - @agentgrader/agent-openrouter@2.0.0
  - @agentgrader/core@1.1.0
  - @agentgrader/store@1.0.2
  - @agentgrader/sandbox-docker@2.0.0

## 1.0.1

### Patch Changes

- Fix critical workspace dependency resolution issue on npm by replacing `workspace:*` with exact caret versions.
- Updated dependencies
  - @agentgrader/core@1.0.1
  - @agentgrader/store@1.0.1
  - @agentgrader/sandbox-docker@1.0.1
  - @agentgrader/agent-openrouter@1.0.1

## 1.0.0

### Major Changes

- initial release of the agentgrader cli and core framework.

### Patch Changes

- Updated dependencies
  - @agentgrader/core@1.0.0
  - @agentgrader/store@1.0.0
  - @agentgrader/sandbox-docker@1.0.0
  - @agentgrader/agent-openrouter@1.0.0

# agentgrader

## 1.7.4

### Patch Changes

- 2f3b36d: `agr bench --ci` is a shorthand that enables the most common CI-appropriate settings: `--fail-on-failure`, `--show-failures`, and `--github-step-summary`; individual flags still override when specified explicitly; `agr init --ci` workflow now uses `agr bench --suite tasks/ --ci` for cleaner CI configs
- 289ebb3: `agr bench --suite tasks/ --config agent.yaml --compare-baseline baselines/main.json` automatically compares the bench result against a saved baseline snapshot and prints a Markdown report after the bench completes; equivalent to running `agr compare-baseline --current baselines/main.json` afterwards but in a single command; combine with `--fail-on-failure` to gate CI on regressions
- f750847: `agr bench --config-filter <name>` filters loaded agent configs by name substring (case-insensitive) after loading from `--configs-dir` or `--manifest`; useful for running a subset of a config directory without editing files or listing paths explicitly (e.g. `--configs-dir ./agents --config-filter fast`)
- c2fbced: `agr bench --suite tasks/ --configs a.yaml,b.yaml --config-grid` prints a PASS/FAIL grid (rows: test cases, columns: agent configs) after the bench completes; only shown when at least 2 configs were run; gives an at-a-glance view of which test cases passed for which configs without needing to separately run `agr status --grid`
- b289e70: `agr bench --dry-run` now shows an estimated total cost based on historical average cost for test cases that have prior runs in the DB; format: `Estimated cost: ~$X.XXXX (avg $Y.YYYY/run based on N of M test case(s) with history)`; gracefully skips cost estimate if no DB exists or no matching history is found
- dbc4e72: `agr bench --emit-metrics` writes key bench metrics to `$GITHUB_OUTPUT` (SOLVE_RATE, PASSED_RUNS, FAILED_RUNS, TOTAL_RUNS, TOTAL_COST_USD, AVG_COST_USD); enables downstream GitHub Actions steps to read metrics via `steps.<id>.outputs.SOLVE_RATE` and make conditional decisions (e.g. skip deployment if solve rate dropped)
- 581614e: `agr bench --github-step-summary` appends bench results as Markdown to `$GITHUB_STEP_SUMMARY`, making pass/fail results appear in GitHub Actions step summary pages; includes overall solve rate with status emoji, total cost, and a per-config table when running multiple configs; no-ops with a warning when the env var is not set; add to CI workflows for free bench visibility without any extra tooling
- ee745f1: `agr bench --json` now includes a `byTestCase` array in the output alongside `byConfig`, showing per-test-case pass/fail counts, solve rate, and total cost; `--min-pass-count` is also now wired into the `gateReasons` output; enables downstream tooling to build per-task reports from a single bench JSON output
- fc4faf8: `agr bench --max-cost 1.50` exits with code 1 if the total bench cost exceeds $1.50; the reason is printed alongside other gate failures; useful as a budget gate in CI to prevent runaway spend on large bench runs; combinable with `--min-solve-rate`, `--min-pass-count`, and `--fail-on-failure`
- 936a8ab: `agr bench --min-pass-count 8` exits with code 1 if fewer than 8 runs pass in total; complements `--min-solve-rate` (which is rate-based): `--min-pass-count 1` fails if nothing passed, `--min-pass-count N` requires N absolute successes regardless of total run count; the exit reason is printed at the end of the bench summary
- 3a99bbb: `agr bench --suite tasks/ --min-test-cases 5` fails with exit code 1 and a clear error message if the resolved suite has fewer than 5 test cases; guards against accidentally running on an empty or misconfigured suite directory, especially useful in CI where a misconfigured `--suite` path or `--tags` filter could silently produce a 100% solve rate with 0 runs
- 8623f18: `agr bench --suite tasks/ --config agent.yaml --only-unrun` runs only test cases with no recorded runs in the DB; prints the selected case names; exits cleanly (code 0) when all cases have runs; the natural companion to `agr list-tests --unrun` and the inverse of `--only-failed`; useful for building initial coverage of a large suite
- c2e3b23: `agr bench --output-json bench-result.json` writes the full bench result JSON to a file after the bench completes; always produced regardless of `--json` flag; same structure as `--json` stdout output (including `byTestCase`, `byConfig`, `runs`, `gateReasons`); useful in CI when you want both human-readable terminal output and a machine-readable result file for downstream tooling
- 34380ed: `agr bench --output-run-ids run-ids.txt` writes all completed run IDs to a file (one per line) after the bench and prints a confirmation; useful in CI where stdout capture is awkward (e.g., GitHub Actions `$GITHUB_OUTPUT`); complements `--print-ids` which writes to stdout
- 6ded81a: `agr bench --print-ids` prints all completed run IDs to stdout after the bench (one per line, under a `Run IDs:` header); enables shell pipelines like `agr bench ... --print-ids | tail -1 | xargs agr trace` or iterating over all run IDs with a `while read id` loop; combinable with all other bench flags
- b5a5dfe: `agr bench --print-passed` prints only the run IDs of passing runs to stdout (one per line); `agr bench --print-failed` does the same for failing/errored runs; both complement `--print-ids` for filtered pipeline use cases (e.g. piping failing run IDs to `xargs agr trace` for investigation)
- eef2330: `agr bench --repeat <n>` runs each test case N times per config to measure solve rate with statistical significance; useful for pass@k metrics and detecting flaky tests (e.g. `--repeat 5` runs 5 trials per test case and the result summary shows the overall solve rate across all trials)
- 4c2606c: `agr bench --sample N` randomly selects N test cases from the suite without replacement; prints the selected names so the draw is reproducible by inspection; combinable with `--suite`, `--tags`, `--config`, and all other bench flags; useful for quick sanity checks on large task sets without running everything
- 81bcd34: `agr bench --sample 5 --seed 42` makes `--sample` and `--shuffle` reproducible: the same seed always produces the same test case ordering or selection, enabling controlled experiments where you want to compare two bench runs on identical subsets; without `--seed`, a random seed is used (existing behavior)
- 86f879e: `agr bench --show-failures` prints a compact list of failing test cases after the bench completes, including each run ID as an `agr trace <id>` shortcut and up to 80 characters of the error message; avoids having to separately run `agr status --by-test-case --below 100` to identify which tasks to investigate
- afd2ae1: `agr bench --suite tasks/ --config agent.yaml --skip-passing-since 24h` skips test cases that have a passing run within the given time window; prints how many were skipped; exits cleanly when all cases have recent passes; enables incremental bench runs for large suites where only recently-failing or never-run cases need to be re-executed
- 166028d: `agr cleanup --json` outputs the result as a JSON object `{found, removed, containers[]}` with `{id, image, status, ageMs}` per container; without `--yes` lists containers without removing; with `--yes` reports which were successfully removed
- fb7c47b: `agr --version` and `agr -v` now print the installed CLI version (e.g. `agr/1.7.3`); useful for CI debugging and bug reports
- 012006b: `agr compare-baseline --current baselines/main.json --github-step-summary` appends the Markdown comparison report to `$GITHUB_STEP_SUMMARY`; works with `--format md` (the default); complements `agr bench --github-step-summary` for a complete GitHub Actions step summary showing both the bench result and the regression comparison
- 4e45d24: `agr compare --first-and-last` compares the oldest and most recent run (useful for tracking progress over time); combine with `--test-case` to scope to a single task (`agr compare --first-and-last --test-case hello-world --only-diff`); supports all the same output options as `--last-two` including `--full`, `--only-diff`, and `--json`
- f0bdd96: `agr compare --json` outputs the comparison as a single JSON object `{runA, runB, divergentCount, totalSteps, firstDivergence, steps[]}` for scripting and CI pipelines; combinable with `--last-two`, `--test-case`, and `--config`
- 438e0ff: `agr compare --passing-vs-failing --test-case hello-world` automatically compares the most recent failing run (A) vs the most recent passing run (B); shows what the agent does differently when it passes vs fails; combine with `--only-diff` to highlight divergences; supports all the same output options as `--last-two`
- 9f836a5: `agr cost --by-test-case` prints cost breakdown per test case sorted most expensive first (plain: tab-separated `$total\ttestCaseId\t(N runs, avg $X/run)`; JSON: `{total, totalCostUsd, byTestCase: [{testCaseId, total, totalCostUsd, avgCostUsd}]}`); `agr cost --by-config` does the same per agent config; combinable with all existing cost filters (`--since`, `--passed`, `--last-matrix`, etc.)
- be2135c: `agr cost --by-model` prints cost breakdown per model (total cost, run count, avg cost/run), sorted most expensive first; JSON: `{total, totalCostUsd, byModel: [{model, total, totalCostUsd, avgCostUsd}]}`; completes the cost command breakdown set alongside `--by-test-case` and `--by-config`
- 7546572: New `agr cost` command prints total cost for matching runs as a plain dollar amount (e.g. `$1.2345`); supports all the same filters as `agr count` (`--since`, `--test-case`, `--config`, `--model`, `--sandbox`, `--passed`, `--failed`, `--last-matrix`); `--json` emits `{totalCostUsd, avgCostUsd, total, dbPath}`; useful for quick budget checks in CI (`agr cost --last-matrix` after a bench) or shell scripting (`agr cost --since 24h --json | jq .avgCostUsd`)
- 4ce22a2: `agr cost --total` prints the total cost as a plain decimal number (e.g. `1.2345`) for shell script use: `COST=$(agr cost --total --since 7d)`; `agr cost --avg` prints the average cost per run; both skip the `$` prefix for easy arithmetic; combinable with all existing filter flags (`--since`, `--test-case`, `--config`, `--model`, etc.)
- eeec8db: `agr count --by-model` prints run counts per model (total, passed, failed, solve rate %), sorted by most runs first; JSON: `{total, byModel: [{model, total, passed, failed, solveRate}]}`; completes the count breakdown set alongside `--by-test-case` and `--by-config`
- 32718bf: `agr count --by-test-case` prints run counts per test case sorted by total runs (plain: tab-separated `total\ttestCaseId\t(N passed, M failed)`; JSON: `{total, byTestCase: [{testCaseId, total, passed, failed}]}`); `agr count --by-config` does the same per agent config; combinable with `--since`, `--passed`, `--failed`, and all filter flags; useful in CI scripts to find test cases with too few runs for statistical significance (`--by-test-case --json | jq '.byTestCase[] | select(.total < 3)'`)
- 58dbc14: `agr count` prints the number of runs matching the given filters as a plain number (or `--json` for `{total, passed, failed, dbPath}`); supports the same filters as `agr list` (`--since`, `--test-case`, `--config`, `--model`, `--sandbox`, `--passed`, `--failed`, `--matrix-id`, `--last-matrix`); useful for CI badges, shell conditions, and quick sanity checks without launching the TUI
- 04aa82d: `agr count --errored` counts runs that crashed before scoring (status "failed" with no pass/fail verdict, distinct from `--failed` which counts scored failures); combinable with `--since`, `--test-case`, `--config`, and all other count filters; useful for CI monitoring of infrastructure errors vs evaluation failures
- f34eb72: `agr count --regression` counts test cases that have regressed: at least one historical passing run but the most recent N consecutive runs all failed (N = 3 by default, override with `--regression-window N`); prints a plain integer; `--json` emits `{regressions, regressionWindow, dbPath}`; useful in CI gate scripts (`if [ $(agr count --regression) -gt 0 ]; then echo "REGRESSIONS DETECTED"; fi`)
- fed0c22: `agr count --by-test-case --json` and `--by-config --json` now include `solveRate` (0-100) in each entry alongside `total`, `passed`, and `failed`; plain text output also shows the solve rate percentage; enables `jq '.byTestCase[] | select(.solveRate < 50)'` without needing arithmetic
- 3a2458a: `agr doctor` now includes two DB health checks when `.agr/db.sqlite` exists: (1) **Database size** -- warns at 100 MB and suggests `agr prune`, fails above 500 MB; (2) **Errored runs** -- warns when more than 10 runs crashed before scoring (indicating connectivity or sandbox issues)
- 7206201: `agr doctor` now includes two additional DB health checks: **Stuck runs** (warns when any run has been in "running" status for more than 2 hours, suggesting a hung sandbox) and **Regressions** (warns when test cases have regressed — 3+ consecutive failures after historical passes — pointing to `agr status --regression` for details)
- eef430a: `agr bench --dry-run --json` outputs the planned matrix as a JSON object `{testCases, agentConfigs, totalRuns, concurrency}` for CI pipelines that need to inspect what will run before committing to a full bench
- 7f33134: `agr export runs --columns id,testCaseId,passed,costUsd --format csv` selects which columns to include in the export output; unknown column names print a warning and are ignored; valid columns: `id`, `testCaseId`, `agentConfigId`, `passed`, `costUsd`, `durationMs`, `stepsCount`, `tokensIn`, `tokensOut`, `matrixId`, `metrics`; applies to CSV, JSON, and JSONL formats; omitting `metrics` avoids large JSON blobs that make CSV files difficult to work with in spreadsheets
- c8cd685: `agr export runs` gains `--model <name>` (filter by model substring, same as `agr list --model`) and `--sort <field>` (sort by date, cost, duration, or steps before applying `--limit`); useful for exporting only haiku runs sorted by cost for post-hoc analysis
- 041524c: `agr export runs --run-ids-file ids.txt` exports only runs whose IDs appear in the given file (one run ID per line); enables the pipeline `agr bench --output-run-ids ids.txt && agr export runs --run-ids-file ids.txt --format csv` to export exactly the runs from a specific bench session; combinable with all other export filters
- c64bc97: `agr export runs --deduplicate --format csv --output snapshot.csv` keeps only the most recent run per (test case, agent config) pair before exporting; mirrors `agr list --latest`; useful for creating current-state snapshots for downstream analysis or training datasets without needing to manually deduplicate
- 259f2bb: `agr export runs` now includes `status`, `error`, `sandboxProvider`, and `createdAt` in the default output alongside existing fields; these can be selected individually with `--columns status,error,createdAt`; the `error` field is useful for distinguishing agent failures from infrastructure errors; `createdAt` enables time-series analysis
- d6ec019: `agr export runs` gains `--sandbox <provider>` and `--error <substring>` filters, completing filter parity with `agr list`; both accept case-insensitive substring matches and print a count before exporting
- ffef25a: `agr export summary --output summary.json` exports a comprehensive summary JSON file containing overall stats (total runs, pass/fail counts, solve rate, cost), per-test-case breakdown sorted by solve rate, and per-config breakdown; `--since <window>` scopes to recent runs; useful for dashboards, CI artifacts, and automated reporting
- a494618: `agr export traces --all --format jsonl --output all-traces.jsonl` exports traces for all runs in the database without requiring any filter; combine with `--limit N` to cap total runs exported; previously required at least `--test-case`, `--config`, `--since`, or `--run-id`
- 483592e: `agr init --ci` now generates an updated GitHub Actions workflow that uses `--github-step-summary` (bench results appear in the Actions step summary page), `--show-failures` (compact failure list at the end), and a final `agr status --summary` step (always runs even on failure to show overall state); the generated workflow is a better starting point for CI integration
- 1c7a80a: `agr init --ci` now generates an enhanced GitHub Actions workflow that: (1) uses `--output-json bench-result.json` to save a machine-readable result file, (2) adds a "Check for regressions" step using `agr status --regression --fail-on-regression` (always runs), (3) uploads `bench-result.json` as a CI artifact for downstream tooling
- 579aefd: `agr init --ci` now generates a v4 workflow that: (1) gives the bench step an `id: bench` so outputs are accessible in subsequent steps, (2) adds `--emit-metrics` to the bench step so `steps.bench.outputs.SOLVE_RATE` etc. are available for conditional logic, (3) adds `--emit-metrics` to the summary step for final status metrics
- b1acc52: `agr init --model <model>` and `agr init --provider <provider>` customize the scaffolded `agent.yaml` without editing it afterward; useful when starting a project with a non-default provider (e.g. `agr init --model gpt-4o --provider openai`)
- 4f9ecbb: `agr list --active` filters to show only currently in-progress runs (status = running); combinable with `--plain`, `--json`, and all other list filters; useful for checking if a bench is still running or detecting stuck/hung runs that never completed
- 3624483: `agr list --all` loads every run from the database ignoring the default 100-run cap; useful with `--plain`, `--json`, and `--sort` when you need the full run history (e.g. `agr list --all --json | jq length`)
- b08601d: `agr list` now supports `--min-cost <amount>`, `--max-cost <amount>`, `--min-steps <n>`, and `--max-steps <n>` filters; combinable with all existing filters and `--plain`/`--json`; useful for finding expensive outlier runs (`--min-cost 0.10`), cheap runs (`--max-cost 0.005`), runaway step-count agents (`--min-steps 50`), or runs that terminated early (`--max-steps 5`)
- 52fabd7: `agr list --min-duration <ms>` and `--max-duration <ms>` filter runs by wall-clock duration in milliseconds; `--min-duration 60000` finds runs taking over a minute (slow or stalled agents); `--max-duration 5000` finds runs that terminated very early; combinable with all existing list filters and `--plain`/`--json`; completes the set of numeric range filters alongside `--min-cost/--max-cost` and `--min-steps/--max-steps`
- 7569450: `agr list --error <substring>` filters runs to those whose error message contains the given substring (case-insensitive); useful for finding all runs that failed with a specific error type (e.g. `--error timeout`, `--error rate limit`); combinable with all other `agr list` flags
- 72c6a5c: `agr list --json` outputs the run list as a JSON array (fields: `id`, `testCaseId`, `testCaseName`, `agentConfigId`, `agentConfigName`, `agentModel`, `passed`, `costUsd`, `durationMs`, `stepsCount`, `tokensIn`, `tokensOut`, `error`, `matrixId`, `createdAt`, `completedAt`); suppresses plain-text and TUI output; combinable with all existing filters (`--since`, `--test-case`, `--config`, `--passed`, `--failed`, `--limit`)
- 3d218a6: `agr list --latest` deduplicates the run list to show only the most recent run per (test case, agent config) pair, giving a current-state snapshot rather than full history; combinable with `--plain`, `--json`, `--passed`, `--failed`, `--test-case`, `--config`, `--model`, and all other filters; useful for a quick "how is everything doing right now" view without needing `agr status --by-test-case`
- dfe6d14: `agr list --matrix-id <id>` and `agr list --last-matrix` filter the run list to a single bench matrix sweep; mirrors the same flags on `agr export runs` so you can browse a sweep interactively or in plain/JSON mode without first exporting (e.g. `agr list --last-matrix --plain`)
- b794835: `agr list --model <substring>` filters runs to those where the agent model matches the given substring (case-insensitive); useful for comparing run histories across model versions (e.g. `agr list --plain --model haiku`)
- 25d2483: `agr list --sandbox <provider>` filters the run list to runs with a matching sandbox provider substring (e.g. `--sandbox e2b` or `--sandbox docker`); mirrors `agr status --by-sandbox` for filter symmetry and is combinable with all other `agr list` flags
- 7f9b1f6: `agr list --sort <field>` sorts runs by `cost`, `duration`, or `steps` (descending); default `date` preserves previous newest-first order (e.g. `agr list --plain --sort cost` shows most expensive runs first)
- 5cd2e6a: `agr list-tests --run-counts` shows run counts (total, passed, failed) alongside each test case in the suite, sorted fewest runs first; `0 runs [unrun]` marks never-executed cases; `--json` adds `runs`, `passed`, `failed` fields to each test case entry; useful for identifying under-covered test cases and planning where to run more bench iterations
- d1d87d8: `agr list-tests --unrun` shows only test cases with no recorded runs in `.agr/db.sqlite`; prints a compact list with name and path; when combined with `--count` prints a bare integer; when combined with `--json` emits a JSON array; useful for finding tasks in a suite that have never been executed; gracefully handles missing DB (treats all test cases as unrun)
- 18ebfb8: `agr run --provider <name>` and `agr bench --provider <name>` override the provider for all agent configs without editing YAML; useful for quick cross-provider comparisons (e.g. `--provider openrouter`); also fixes `agr bench --report-dir` not being passed through to the bench command
- 53fc9ec: New `agr prune --before <duration|date> --yes` command deletes runs and their traces older than the given cutoff; `--dry-run` previews without deleting; `--yes` confirms deletion; `--json` emits `{deleted, cutoff, dbPath}`; useful for keeping the database lean after long eval campaigns (e.g. `agr prune --before 30d --yes`)
- 5e78d62: `agr prune` now supports three additional filter modes: `--test-case <name>` deletes all runs for a specific test case (substring match, useful for resetting a test case and starting fresh), `--config <name>` deletes runs for a specific agent config, and `--errored` deletes all errored runs (status=failed with no pass/fail score, useful for clearing crashed sandbox artifacts); all filters are combinable with `--before` and each other; `--before` is no longer required when another filter is specified
- 6435e76: `agr run --report-dir <dir>` and `agr bench --report-dir <dir>` auto-generate a timestamped report filename (`run-<timestamp>.<ext>` / `bench-<timestamp>.<ext>`) under the given directory when `--output` is not specified; useful in CI where you always want a report artifact but do not want to hardcode the filename
- b6919a5: `agr run --dry-run` prints the resolved test case, agent config, model, provider, sandbox, and any override flags without executing the run; combine with `--json` for machine-readable output; mirrors `agr bench --dry-run` for single-run inspection
- dec6ac2: `agr run hello-world --repeat 5 --min-pass-rate 0.8` exits with code 1 if the solve rate across repeated runs falls below the threshold (0-1); more flexible than `--fail-on-failure` (which fails on any single failure); useful for CI gates on flaky tests where occasional failures are acceptable but consistent failures are not
- 479fcc6: `agr run --save-baseline <path>` captures a single run's result as a baseline JSON snapshot for later comparison with `agr compare-baseline`; also works with `--repeat N` to save all N runs as a multi-run baseline
- 0552ccb: `agr run hello-world --show-trace` prints all trace steps with content previews after the run completes; useful in CI where the interactive TUI is not available; output matches what `agr trace --last` would show but inline in the run command output
- 84345b1: `agr run --until-pass` runs a test case repeatedly until it passes, stopping immediately on the first passing attempt; `--max-attempts N` caps the total (default 5); prints per-attempt status (`PASS`/`FAIL`/`ERROR`) and a summary showing which attempt passed and total cost; `--json` emits `{passed, attempts, maxAttempts, totalCostUsd, runs[]}`; useful for verifying that a flaky fix actually works without manually re-running
- d950af1: `agr status --by-test-case --above 80` filters breakdown output to entries with solve rate strictly above n%; complement to `--below`; works with `--by-config` and `--by-model` too; `--above 0` excludes never-passing cases, `--above 80` shows consistently high-performing entries; combinable with `--below` for a solve-rate range filter
- 8f18ebd: `agr status --by-test-case --below 100` filters breakdown output to entries with solve rate strictly below n%; works with `--by-config` and `--by-model` too; `--below 100` shows anything with at least one failure, `--below 50` shows entries failing more than half the time; combinable with `--top`, `--sort-by`, `--since`, and all filter flags
- 2570be2: `agr status --best-config` prints the agent config ID with the highest solve rate as a plain string; `agr status --best-model` does the same for models; `--json` emits `{configId/model, solveRate, total, passed, avgCostUsd}`; combinable with `--since`, `--test-case`, and all filter flags; useful for CI scripts that automatically promote the best-performing config to production
- 67924e8: `agr status --best-test-case` prints the test case ID with the highest solve rate as a plain string; `--json` emits `{testCaseId, solveRate, total, passed, avgCostUsd}`; complement to `--worst-test-case`; useful for identifying the easiest or most stable test case in your eval suite
- 00086ca: `agr status --by-day` shows a per-day breakdown (runs, solve rate, total cost) sorted oldest-first; useful for spotting when a regression started across a multi-day bench period; combinable with `--since`, `--top`, `--test-case`, `--config`, `--model`, `--sandbox`; `--json` emits `{byDay: [{day, total, passed, failed, solveRate, totalCostUsd, avgCostUsd}]}`
- e28a058: `agr status --by-matrix` shows a per-sweep breakdown (date, total runs, solve rate, avg cost) sorted newest-first; useful for tracking solve rate trends across multiple `agr bench --matrix` runs; combinable with `--since`, `--test-case`, `--config`, `--model`, and `--top`
- 97a99d7: `agr status --by-model` shows a per-model breakdown (solve rate, avg cost, avg duration, avg tokens) sorted by solve rate; useful for comparing haiku vs opus vs sonnet performance across all runs; combinable with `--since`, `--test-case`, `--config`, and `--json`
- f3c9bd3: `agr status --by-sandbox` shows a per-sandbox breakdown (solve rate, avg cost, avg duration) sorted by solve rate; useful for comparing docker vs e2b performance across all runs; combinable with `--since`, `--test-case`, `--config`, and `--json`
- 116c7fb: `agr status --by-week` shows a per-calendar-week breakdown (runs, solve rate, total cost) sorted oldest first; higher-level view than `--by-day` for long-running eval suites; weeks are labeled `YYYY-Www`; combinable with `--since`, `--top`, `--test-case`, `--config`, and all filter flags; `--json` emits `{byWeek: [{week, total, passed, failed, solveRate, totalCostUsd, avgCostUsd}]}`
- ad82cc8: `agr status --count` prints total run count as a plain integer for shell scripting: `RUNS=$(agr status --count --since 7d)`; `--json` emits `{totalRuns, passedRuns, failedRuns, erroredRuns}`; complement to `--solve-rate` and `agr cost --total` for building CI budget/gate scripts without parsing full status output
- 9de4c08: `agr status --db-info` prints a database overview: file size, total run count, unique test case count, unique config count, and date range of runs; suggests `agr prune` when the DB exceeds 50 MB; `--json` emits `{dbPath, sizeMb, totalRuns, uniqueTestCases, uniqueConfigs, oldestRun, newestRun}`; great starting point for understanding an unfamiliar eval setup
- 8c19c14: `agr status --emit-metrics` writes current status metrics to `$GITHUB_OUTPUT` (SOLVE_RATE, PASSED_RUNS, FAILED_RUNS, TOTAL_RUNS, TOTAL_COST_USD, AVG_COST_USD, ERRORED_RUNS); also continues to show the normal status output; combinable with `--since` for scoped metrics; complements `agr bench --emit-metrics` for a complete set of GitHub Actions outputs across the bench lifecycle
- 9989122: `agr status --errors` shows a deduplicated list of error messages across errored and failed runs, sorted by frequency; each entry shows count, affected test cases, and an `agr trace <runId>` shortcut for the first occurrence; combinable with `--since`, `--test-case`, `--config`, and all existing filter flags; `--json` emits `{errors: [{message, count, exampleRunId, testCaseIds}]}`
- 1a641ef: `agr status --regression --fail-on-regression` exits with code 1 if any test cases have regressed; enables direct use as a CI gate step (e.g. in `agr init --ci` workflows): `agr status --regression --fail-on-regression` after a bench run catches regressions before merging a PR
- e773f49: `agr status --flaky` shows test cases that have both passes and failures across their run history, sorted closest-to-50/50 first; each entry shows total runs, pass/fail counts, solve rate, and avg cost; combinable with `--since`, `--config`, `--model`, `--top`, and all filter flags; `--json` emits `{flaky: [{testCaseId, total, passed, failed, solveRate, avgCostUsd, variance}]}`; useful for identifying eval cases that need more runs to be statistically reliable
- ac90269: `agr status --github-step-summary` appends a Markdown status summary to `$GITHUB_STEP_SUMMARY`; shows overall pass rate with emoji, total cost, and avg cost; no-op with warning when env var is not set; `agr init --ci` now uses this in the always-running summary step so CI dashboards show eval state even when the bench step fails
- 1655885: `agr status --grid` shows a cross-tab matrix with test cases as rows and agent configs as columns; each cell shows the latest PASS, FAIL, or `--` (no run) for that pair; combinable with `--since`, `--test-case`, `--config`, and all filter flags; `--json` emits `{testCaseIds, configIds, grid: [{testCaseId, configs: {configId: boolean|null}}]}`; useful for seeing coverage and regressions across multiple configs at a glance
- 29e9b8a: `agr status --matrix-id <id>` and `agr status --last-matrix` restrict all stats (overall, --by-config, --by-model, --by-sandbox, etc.) to a single bench matrix sweep; useful for analyzing a specific parameter sweep without needing to re-run or filter by date
- 84fef4e: `agr status --by-test-case --min-runs 5` filters breakdowns to only show entries with at least N total runs; works with `--by-config` and `--by-model` too; combinable with `--below`, `--top`, `--sort-by`, `--since`, and all filter flags; useful for excluding test cases that haven't been run enough to produce statistically meaningful solve rates
- a7b59fd: `agr status --model <substring>` restricts the DB summary to runs where the agent model contains the given substring (case-insensitive); mirrors `agr list --model` for consistent filter symmetry across analytics commands (e.g. `agr status --model haiku --by-config`)
- eda5138: `agr status --percentiles` adds p50 and p95 cost and duration stats to the base status output alongside the existing average; `--json` includes `p50CostUsd`, `p95CostUsd`, `p50DurationMs`, `p95DurationMs`; useful for spotting expensive outlier runs that skew the mean cost upward
- 481d391: `agr status --regression` finds test cases that have regressed: they have at least one historical passing run but their most recent N consecutive runs all failed (N = 3 by default, override with `--regression-window N`); shows the last pass timestamp and last run ID for quick trace access; `--json` emits `{regressions: [{testCaseId, recentFails, lastPassAt, lastRunId}]}`
- 861998a: `agr status --report-card` prints a comprehensive health check combining: overall summary stats, regression count (test cases with consecutive failures after prior passes), and flaky test count; `--json` emits `{summary, regressions, flaky}`; useful as a quick "how is my eval suite doing?" overview without needing to run multiple commands
- c8072af: `agr status --by-test-case --rolling 5` computes solve rate using only the most recent 5 runs per test case (newest first); works with `--by-config` and `--by-model` too; useful for evaluating current agent quality without historical failures from early development dragging down the score; combinable with `--min-runs`, `--below`, `--top`, `--sort-by`, `--since`, and all filter flags
- d2e93e4: `agr status --sandbox <provider>` restricts all stats to runs with a matching sandbox provider (substring match, e.g. `--sandbox e2b`); complements `--by-sandbox` breakdown and is combinable with `--model`, `--by-config`, `--by-model`, `--matrix-id`, and other filters for cross-dimensional analysis
- b7f2c20: `agr status --by-test-case --show-ids` appends `last run: agr trace <id>` to each breakdown row, showing the most recent run ID as a direct trace shortcut; works with `--by-config` and `--by-model` too; `lastRunId` is also included in `--json` output; useful for quickly tracing the last run of a failing test case without needing to look up the ID separately
- 362e56c: `agr status --by-test-case --show-last-pass` appends the relative time of the most recent passing run to each row (e.g. `last pass: 2h ago`); shows `last pass: never` for test cases with no passing runs; `lastPassAt` is also included in `--json` output; useful for identifying test cases that haven't passed recently even if their historical solve rate looks OK
- c8f6e87: `agr status --solve-rate` prints the solve rate as a plain number (e.g. `83.3`) suitable for CI shell conditions (`if [ $(agr status --solve-rate --since 24h) -lt 80 ]; then ...`); combinable with all filter flags (`--since`, `--test-case`, `--config`, `--model`); `--json` emits `{solveRate, passedRuns, failedRuns, totalRuns, dbPath}`; complement to `agr cost` and `agr count` for scriptable analytics
- d17db10: `agr status --by-test-case --sort-by duration` (also `--by-config`, `--by-model`) sorts the breakdown by avg duration per run descending (slowest first); completes the `--sort-by` field set alongside `solve-rate` (default), `cost`, and `runs`; useful for finding slow test cases or configs that are taking too long
- a85980a: `agr status --by-test-case --sort-by last-pass` sorts test cases by when they most recently passed (most recently first); test cases that have never passed sort last; best combined with `--show-last-pass` to see the timestamps; completes the `--sort-by` field set alongside `solve-rate`, `cost`, `runs`, and `duration`
- 278c422: `agr status --by-test-case --sort-by cost` (and `--by-config`, `--by-model`) sorts breakdowns by avg cost/run descending (most expensive first); also supports `--sort-by runs` (most runs first); default remains `solve-rate` (hardest/best first); useful for cost optimization and identifying which test cases or configs consume the most budget
- d586c4b: `agr status --summary` prints a compact one-liner with all key stats, e.g. `127 runs: 89 PASS (70%)  |  $1.2345 total  avg: $0.0097/run  |  last: 2m ago`; `--json` emits `{totalRuns, passedRuns, failedRuns, solveRate, totalCostUsd, avgCostUsd, lastRunAt, dbPath}`; combinable with all filter flags; great for shell prompts and CI log prefixes
- 948593e: `agr status --since <window> --trend` compares the current window to the equal-length window before it, showing solve-rate delta (pp), run count delta, and avg cost delta with directional arrows; useful for catching regressions after bench runs; combinable with `--test-case`, `--config`, `--sandbox`; `--json` emits `{current, previous, delta}` for scripting
- 5d10a93: `agr status --worst-config` and `agr status --worst-model` print the agent config ID / model name with the lowest solve rate as plain strings; `--json` emits `{configId, solveRate, ...}` / `{model, solveRate, ...}`; complement the existing `--best-config` / `--best-model` options for identifying underperforming configs or models in A/B bench results
- 0ed4acf: `agr status --worst-test-case` prints the test case ID with the lowest solve rate as a plain string; `--json` emits `{testCaseId, solveRate, total, passed, avgCostUsd}`; complement to `--best-config`; useful in CI scripts for identifying the hardest test case: `HARDEST=$(agr status --worst-test-case)`
- 990b12a: `agr run --step-timeout <ms>` and `agr bench --step-timeout <ms>` override `step_timeout_ms` for this run without editing the agent YAML; useful in CI to cap per-LLM-call latency and abort stuck provider requests faster than the default 120s
- a45db57: `agr run --temperature <n>` and `agr bench --temperature <n>` override the temperature for all agent configs without editing YAML; useful for reproducibility experiments and quick sensitivity checks (e.g. `--temperature 0` for deterministic runs)
- 1962cd5: `agr toolkit-list --json` outputs a structured JSON object `{toolkitDir, tools[], auditFindings[], ok}` for CI scripting; with `--check-config` also includes `{untracked[], trackedButMissing[], checkConfig}`; combinable with `jq .ok` for pass/fail gating in pipelines
- eab724b: `agr trace --last --min-cost 0.001` shows only steps costing at least $0.001; `--max-cost 0.0001` shows only cheap/free steps; both filter before `--top-cost`; header shows `N step(s) costing >= $X of M total`; combinable with all other trace filter and view flags
- fdbb551: `agr trace --last --cost-summary` shows total run cost broken down by step kind with percentage and proportional bar chart; `--json` emits `{totalCostUsd, byKind: [{kind, costUsd, pct}]}`; complements `--kind-summary` (step counts) with cost perspective; useful for understanding which step types drive the most spend in a run
- becb16e: `agr trace --last --find-tool bash` filters the trace to only show steps where the tool name contains "bash" (case-insensitive substring match); combinable with `--json` for structured output; useful for debugging agent tool usage patterns; equivalent to `--kind tool_call --grep bash` but more ergonomic for tool-name filtering
- 90025f6: `agr trace --full` prints complete step content without the default 200-character truncation; combinable with `--steps`, `--grep`, and all run-selection flags; useful when a tool result or LLM response is cut off mid-sentence
- a450189: `agr trace --last --grep <pattern>` shows only steps whose label or content contains the pattern (case-insensitive); the header shows `N matching step(s) for "error" of 127 total`; combinable with `--steps` for compound filtering (range first, then grep); useful for finding where a specific error, tool call, or string appears in a long trace
- 74de430: `agr trace --json` outputs the run trace as a JSON object; default mode emits `{run, steps[]}`, `--quality` emits `{run, metrics}`, `--tools` emits `{run, toolUsage}`; combinable with `--last`, `--test-case`, and `--config`
- 32c661e: `agr trace --last --kind llm_response` filters steps to those with an exact kind match (e.g. `llm_response`, `tool_call`, `tool_result`); the header shows `N step(s) of kind "llm_response" of M total`; combinable with `--steps`, `--grep`, `--full`, `--top-cost`, and all run-selection flags; cleaner than `--grep` when you know the exact step type and don't want false positives from content matches
- 9d508b7: `agr trace --last --kind-summary` shows a compact table counting all steps by kind (e.g. `llm_response`, `tool_call`, `tool_result`) with a proportional bar chart; `--json` emits `{run, total, kinds: [{kind, count}]}`; gives a structural overview of what the agent did without reading through the full trace
- 29ec1b5: `agr trace --last` gains `--model <substring>`, `--passed`, and `--failed` scope flags; combine them to find and trace the most recent run matching multiple criteria (e.g. `agr trace --last --model haiku --failed` traces the most recent haiku run that failed)
- 9c56b54: `agr trace --last --output-json trace.json` saves the full trace (run metadata + all steps) as pretty-printed JSON to the given path (parent directories are created automatically); also prints the normal text trace to stdout unless `--json` is also set; useful for post-processing with `jq` or sharing a trace for debugging
- 8103e45: `agr trace --last --reverse` prints steps in reverse order (latest step first); the header shows `N step(s) (reversed)`; combinable with `--steps`, `--grep`, `--kind`, `--full`, and all run-selection flags; useful for quickly seeing how a long trace ended without scrolling past all the early steps
- d66b789: `agr trace --last --stats` shows a compact token and cost statistics summary: total/avg/max tokens per step, prompt cache hit rate, and total cost; `--json` emits `{totalSteps, totalIn, totalOut, totalCached, avgIn, avgOut, maxIn, maxOut, cacheHitPct, totalCostUsd}`; useful for quickly understanding token usage patterns without reading the full trace
- 587e0ce: `agr trace --last --step-count` prints the total step count as a plain number; `--json` emits `{stepCount, filteredCount, runId}`; combinable with all run-selection flags (`--last`, `--test-case`, `--config`, `--passed`, `--failed`); useful in CI for asserting agent step budgets (`if [ $(agr trace --last --step-count) -gt 50 ]; then echo "Too many steps"; fi`)
- ace6ca5: `agr trace --steps <range>` shows only the specified stepIndex range (e.g. `--steps 40-60` or `--steps 42`); the header shows `N step(s) [40-60] of 127 total` so context is not lost; combinable with `--last`, `--json`, and all run-selection flags; useful for navigating long traces without scrolling through hundreds of steps
- 21a369b: `agr trace --last --top-cost 5` shows only the 5 most expensive steps sorted by cost descending; the header shows `top N most expensive step(s) of M total (sorted by cost desc)`; combinable with `--full`, `--grep`, `--steps`, and all run-selection flags; useful for finding where a run's token budget was spent
- 990b12a: `agr validate --suite tasks/ --name <substring>` filters test cases by name substring (case-insensitive) before validating; mirrors `agr bench --name` and `agr list-tests --name`
- 62a7a3f: `agr validate-toolkit --json` outputs the audit result as a JSON object `{dir, passed, findings[]}` with `{file, severity, rule, message}` per finding; exits with code 1 on failure (same as human mode); combinable with `--strict`
- 8cc9ed1: New `agr watch` command polls `.agr/db.sqlite` every N seconds (default 3) and prints new runs as they appear; skips all pre-existing runs so only newly completed runs are shown; supports `--test-case`, `--config`, and `--interval` filters; `--json` emits one JSON line per run (NDJSON) for piping to `jq`; useful for monitoring a long bench from a second terminal without the full Ink dashboard
- b92b2f5: `agr watch --count 10` exits with code 0 as soon as exactly 10 new runs (of any status) are seen; useful for "wait until this bench of N test cases completes" without needing to know which test cases passed or failed; complements `--min-pass-count` (gates on passing runs) and `--min-pass-rate` (gates on solve rate)
- 455bc36: `agr watch --exit-on-fail` exits with code 1 as soon as any failing run appears (useful for fail-fast CI patterns); `agr watch --exit-on-pass` exits with code 0 as soon as any passing run appears (useful for waiting until a fix is confirmed); both print a message identifying the triggering run ID before exiting
- 4079ff5: `agr watch --min-pass-rate 0.8` exits with code 0 as soon as the rolling solve rate across all seen runs reaches 80%; `agr watch --min-pass-count 5` exits with code 0 as soon as at least 5 passing runs have been seen; both are useful for scripting "wait until the bench reaches a target quality level"
- 726c231: `agr watch --timeout 300` exits with code 2 if no new run appears within 300 seconds; useful in CI to detect stalled bench processes (e.g. if the bench crashes without writing any runs, watch won't wait forever); resets the timeout counter each time a new run appears

## 1.7.3

### Patch Changes

- Load `.env` from the project tree, scaffold `.env.example` on init, preflight missing API keys before runs, and catch adapter errors without Mastra stack traces.
- Updated dependencies
  - @agentgrader/core@1.4.1

## 1.7.2

### Patch Changes

- Restyle `agr init` success output with colors, file tree hints, and numbered next steps.

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

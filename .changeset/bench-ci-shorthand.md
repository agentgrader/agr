---
"agentgrader": patch
---

`agr bench --ci` is a shorthand that enables the most common CI-appropriate settings: `--fail-on-failure`, `--show-failures`, and `--github-step-summary`; individual flags still override when specified explicitly; `agr init --ci` workflow now uses `agr bench --suite tasks/ --ci` for cleaner CI configs

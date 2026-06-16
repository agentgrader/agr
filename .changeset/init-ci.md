---
"agentgrader": patch
---

`agr init --ci` (and `agr init --blank --ci`) writes `.github/workflows/agr.yml` — a GitHub Actions workflow that installs agentgrader and runs `agr bench --suite tasks/ --fail-on-failure` on push and pull_request, wiring the CI gate in one command

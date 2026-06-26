---
"agentgrader": patch
---

`agr bench --suite tasks/ --min-test-cases 5` fails with exit code 1 and a clear error message if the resolved suite has fewer than 5 test cases; guards against accidentally running on an empty or misconfigured suite directory, especially useful in CI where a misconfigured `--suite` path or `--tags` filter could silently produce a 100% solve rate with 0 runs

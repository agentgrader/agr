---
"agentgrader": patch
---

Added `fix-missing-await` TypeScript bug test case to `examples/suites/typescript-bugs/` — a classic async loop mistake where forgetting `await` produces NaN. Strengthens the reference suite used by `agr bench --suite examples/suites/typescript-bugs/`. Also adds a CI test that validates all example test cases load without schema errors.

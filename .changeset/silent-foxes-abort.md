---
"@agentgrader/agent-openrouter": patch
---

Fix a crash in the `step_timeout_ms` watchdog's own error-handling: when the escape-hatch timer forced the agent loop to end, the `catch` block read `err.name`/`err.message` on a rejection value that can be `undefined` (Bun's `AbortController.abort(reason)` does not reliably populate `signal.reason`), throwing `TypeError: undefined is not an object (evaluating 'err.name')` instead of the intended `Aborted: a single step exceeded step_timeout_ms (...)` message.

The watchdog itself fired correctly and the run still finished with a `RUN SUMMARY` - only the reported `error` text was wrong/confusing (`agr trace`'s "agent error:" line showed the `TypeError` instead of the actual timeout reason). Now checks `watchdogController.signal.aborted` directly rather than relying on the caught value's shape.

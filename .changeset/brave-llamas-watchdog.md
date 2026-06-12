---
"@agentgrader/agent-openrouter": minor
---

`step_timeout_ms` is now a true per-step inactivity watchdog instead of `AbortSignal.timeout`. The previous implementation had two serious flaws discovered in real runs: the signal capped the ENTIRE multi-step loop at `step_timeout_ms` (long, healthy runs could be cut off mid-flight), and `AbortSignal.timeout`'s unref'd timer neither kept the event loop alive nor reliably fired when a provider connection silently died - leaving the run either hanging forever or, worse, exiting 0 with no error, no result, and a leaked sandbox container. The new implementation arms a ref'd timer that is reset on every finished step and aborts only when a single step makes no progress for `step_timeout_ms`; the ref'd timer also pins the event loop, so a stranded provider request can no longer silently drain the process.

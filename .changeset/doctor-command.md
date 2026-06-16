---
"agentgrader": patch
---

`agr doctor` runs a pre-flight check of the local environment: Docker daemon, API keys (ANTHROPIC_API_KEY, OPENAI_API_KEY, E2B_API_KEY), database accessibility, agent config presence, and test case discovery; exits 1 when any required check fails

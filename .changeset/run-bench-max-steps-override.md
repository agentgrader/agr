---
"agentgrader": patch
---

`agr run <name> --max-steps <n>` and `agr bench --suite tasks/ --max-steps <n>` override `max_steps` from the agent config without editing YAML; useful for budget-capped smoke tests (`--max-steps 5`) or extended runs (`--max-steps 50`)

---
"agentgrader": patch
---

`agr run --temperature <n>` and `agr bench --temperature <n>` override the temperature for all agent configs without editing YAML; useful for reproducibility experiments and quick sensitivity checks (e.g. `--temperature 0` for deterministic runs)

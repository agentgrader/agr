---
"agentgrader": patch
---

`agr bench --sample 5 --seed 42` makes `--sample` and `--shuffle` reproducible: the same seed always produces the same test case ordering or selection, enabling controlled experiments where you want to compare two bench runs on identical subsets; without `--seed`, a random seed is used (existing behavior)

---
"agentgrader": patch
---

`agr trace` now prints a `Next:` hint at the end of each view mode: the default view suggests `--quality` and `--tools`; `--quality` suggests `--tools`; `--tools` suggests `--quality`. All three also suggest `agr compare --last-two`.

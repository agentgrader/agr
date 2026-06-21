---
"agentgrader": patch
---

`agr run hello-world --repeat 5 --min-pass-rate 0.8` exits with code 1 if the solve rate across repeated runs falls below the threshold (0-1); more flexible than `--fail-on-failure` (which fails on any single failure); useful for CI gates on flaky tests where occasional failures are acceptable but consistent failures are not

---
"agentgrader": patch
---

Fix non-deterministic test case discovery order: `findTestCaseYamlFiles` now sorts directory entries before recursing, ensuring consistent `--suite` ordering across platforms (Linux `readdirSync` returns filesystem/inode order, not alphabetical).

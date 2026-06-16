---
"agentgrader": patch
---

`agr list-tests --count` prints only the number of matching test cases as a bare integer, making it easy to use in shell scripts and CI conditions (e.g., `if [ $(agr list-tests --count) -eq 0 ]; then echo "no tests"; fi`)

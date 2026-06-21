---
"agentgrader": patch
---

`agr bench --print-ids` prints all completed run IDs to stdout after the bench (one per line, under a `Run IDs:` header); enables shell pipelines like `agr bench ... --print-ids | tail -1 | xargs agr trace` or iterating over all run IDs with a `while read id` loop; combinable with all other bench flags

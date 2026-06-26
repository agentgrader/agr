---
"agentgrader": patch
---

`agr export runs --run-ids-file ids.txt` exports only runs whose IDs appear in the given file (one run ID per line); enables the pipeline `agr bench --output-run-ids ids.txt && agr export runs --run-ids-file ids.txt --format csv` to export exactly the runs from a specific bench session; combinable with all other export filters

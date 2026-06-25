---
"agentgrader": patch
---

`agr bench --dry-run` now shows an estimated total cost based on historical average cost for test cases that have prior runs in the DB; format: `Estimated cost: ~$X.XXXX (avg $Y.YYYY/run based on N of M test case(s) with history)`; gracefully skips cost estimate if no DB exists or no matching history is found

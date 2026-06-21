---
"agentgrader": patch
---

`agr status --by-test-case --above 80` filters breakdown output to entries with solve rate strictly above n%; complement to `--below`; works with `--by-config` and `--by-model` too; `--above 0` excludes never-passing cases, `--above 80` shows consistently high-performing entries; combinable with `--below` for a solve-rate range filter

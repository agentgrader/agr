---
"@agentgrader/agent-acp": patch
---

The ACP adapter now sends `config.system_prompt` (including the `toolkits`
skills addendum that `run-single.ts` appends, listing each bundled tool's
name and description) as a leading text block in the same prompt turn, ahead
of the task prompt. ACP has no dedicated system-prompt field, so previously
`system_prompt` was silently dropped for `--adapter acp` runs: an ACP agent
running with `toolkits:` configured had the toolkit files copied into its
sandbox, but no way to learn what those tools were for short of exploring the
filesystem itself.

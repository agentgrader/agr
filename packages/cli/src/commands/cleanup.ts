import { DockerSandboxProvider } from "@agentgrader/sandbox-docker";

/**
 * `agr cleanup [--yes]`
 *
 * Lists sandbox containers left behind by runs whose process exited (or was
 * killed) before the `cleanup` workflow step could call `destroy()` - e.g. a
 * hung provider request that was reaped by an external timeout. These show
 * up as containers running `tail -f /dev/null`, labeled
 * `agentgrader.sandbox=true`.
 *
 * Without `--yes`, only lists what would be removed. With `--yes`, removes
 * each one (force stop + remove).
 */
export async function cleanupCommand(opts: { yes?: boolean; json?: boolean }) {
  const provider = new DockerSandboxProvider();
  const sandboxes = await provider.listSandboxes();

  if (sandboxes.length === 0) {
    if (opts.json) {
      console.log(JSON.stringify({ found: 0, removed: 0, containers: [] }));
    } else {
      console.log("No leftover sandbox containers found.");
    }
    return;
  }

  if (opts.json && !opts.yes) {
    console.log(JSON.stringify({
      found: sandboxes.length,
      removed: 0,
      containers: sandboxes.map((s) => ({
        id: s.id,
        image: s.image,
        status: s.status,
        ageMs: s.createdAt ? Date.now() - s.createdAt : null,
      })),
    }));
    return;
  }

  if (!opts.json) {
    console.log(`Found ${sandboxes.length} sandbox container(s):\n`);
    for (const sandbox of sandboxes) {
      const age = sandbox.createdAt
        ? `${Math.round((Date.now() - sandbox.createdAt) / 60000)}m old`
        : "age unknown";
      console.log(`  ${sandbox.id.slice(0, 12)}  ${sandbox.image.padEnd(20)} ${sandbox.status} (${age})`);
    }
  }

  if (!opts.yes) {
    console.log("\nRe-run with --yes to remove these containers.");
    return;
  }

  if (!opts.json) console.log("");
  let removed = 0;
  const results: { id: string; removed: boolean; error?: string }[] = [];
  for (const sandbox of sandboxes) {
    try {
      await provider.removeSandbox(sandbox.id);
      if (!opts.json) console.log(`Removed ${sandbox.id.slice(0, 12)}`);
      results.push({ id: sandbox.id, removed: true });
      removed++;
    } catch (err: any) {
      if (!opts.json) console.error(`Failed to remove ${sandbox.id.slice(0, 12)}: ${err.message}`);
      results.push({ id: sandbox.id, removed: false, error: err.message });
    }
  }

  if (opts.json) {
    console.log(JSON.stringify({
      found: sandboxes.length,
      removed,
      containers: results,
    }));
  } else {
    console.log("\nNext: agr bench  |  agr list");
  }
}

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
export async function cleanupCommand(opts: { yes?: boolean }) {
  const provider = new DockerSandboxProvider();
  const sandboxes = await provider.listSandboxes();

  if (sandboxes.length === 0) {
    console.log("No leftover sandbox containers found.");
    return;
  }

  console.log(`Found ${sandboxes.length} sandbox container(s):\n`);
  for (const sandbox of sandboxes) {
    const age = sandbox.createdAt
      ? `${Math.round((Date.now() - sandbox.createdAt) / 60000)}m old`
      : "age unknown";
    console.log(`  ${sandbox.id.slice(0, 12)}  ${sandbox.image.padEnd(20)} ${sandbox.status} (${age})`);
  }

  if (!opts.yes) {
    console.log("\nRe-run with --yes to remove these containers.");
    return;
  }

  console.log("");
  for (const sandbox of sandboxes) {
    try {
      await provider.removeSandbox(sandbox.id);
      console.log(`Removed ${sandbox.id.slice(0, 12)}`);
    } catch (err: any) {
      console.error(`Failed to remove ${sandbox.id.slice(0, 12)}: ${err.message}`);
    }
  }
}

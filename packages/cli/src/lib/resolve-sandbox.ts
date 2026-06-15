import type { SandboxProvider } from "@agentgrader/core";
import { DockerSandboxProvider } from "@agentgrader/sandbox-docker";
import { E2bSandboxProvider } from "@agentgrader/sandbox-e2b";

export function resolveSandbox(name = "docker"): SandboxProvider {
  switch (name) {
    case "docker":
      return new DockerSandboxProvider();
    case "e2b":
      return new E2bSandboxProvider();
    default:
      throw new Error(`Unknown sandbox provider "${name}". Supported: docker, e2b.`);
  }
}

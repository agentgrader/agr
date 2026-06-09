import type { AgentConfig } from "../schema/agent-config";
import type { StepEvent } from "../schema/trace";
import type { SandboxHandle } from "./sandbox-provider";

export interface AgentResult {
  finished: boolean;       // did it call submit(), or did it hit maxSteps?
  finalDiff: string;       // git diff of everything it touched
}

export interface AgentAdapter {
  readonly name: string;

  /**
   * run the agent against a problem in a prepared sandbox.
   * the adapter doesn't know about scoring — it just solves and emits
   * step events. the framework measures everything from the outside.
   */
  solve(input: {
    prompt: string;
    sandbox: SandboxHandle;
    config: AgentConfig;
    onStep: (step: StepEvent) => void; // called on every tool call, message, token count
  }): Promise<AgentResult>;
}

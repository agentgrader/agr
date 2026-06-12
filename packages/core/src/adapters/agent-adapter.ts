import type { AgentConfig } from "../schema/agent-config";
import type { StepEvent } from "../schema/trace";
import type { SandboxHandle } from "./sandbox-provider";

export interface AgentResult {
  finished: boolean;       // did it call submit(), or did it hit maxSteps?
  finalDiff: string;       // git diff of everything it touched
  /**
   * set when the agent loop itself errored or was aborted (e.g. a
   * `step_timeout_ms` timeout) before reaching `submit`. Distinguishes
   * "the agent tried and its solution failed scoring" from "the agent
   * never got a chance to produce a solution" - both look like
   * `finished: false` otherwise.
   */
  error?: string;
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

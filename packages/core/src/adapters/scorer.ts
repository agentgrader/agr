import type { TestCase } from "../schema/test-case";
import type { AgentResult } from "./agent-adapter";
import type { Trace } from "../schema/trace";
import type { SandboxHandle } from "./sandbox-provider";

export interface ScorerResult {
  passed: boolean;
  detail: string;
  score?: number;
}

export interface Scorer {
  readonly name: string;
  score(input: {
    testCase: TestCase;
    result: AgentResult;
    trace: Trace;
    sandbox: SandboxHandle;
  }): Promise<ScorerResult>;
}

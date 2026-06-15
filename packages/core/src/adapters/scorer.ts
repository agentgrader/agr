import type { TestCase } from "../schema/test-case";
import type { AgentResult } from "./agent-adapter";
import type { Trace } from "../schema/trace";
import type { SandboxHandle } from "./sandbox-provider";

export interface ScorerResult {
  passed: boolean;
  detail: string;
  score?: number;

  /**
   * non-functional code-quality signals. populated by additive scorers
   * (e.g. staticqualityscorer, llmjudgescorer) that annotate a run without
   * affecting `passed`/`score`. all fields optional - a scorer only fills
   * in what it actually measured.
   */
  quality?: {
    /** total +/- lines in the agent's diff */
    diffLines?: number;
    /** number of files touched by the agent's diff */
    filesModified?: number;
    /** TODO/FIXME/HACK/XXX markers introduced by the diff */
    todosIntroduced?: number;
    /** linter (e.g. Biome) error+warning count on the changed files */
    linterViolations?: number;
    /** 0-1 holistic quality score from an LLM judge */
    llmJudgeScore?: number;
    /** prose rationale from an LLM judge */
    llmJudgeDetail?: string;
    rubrics?: Record<string, { score: number; normalizedScore: number; rationale: string }>;
  };
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

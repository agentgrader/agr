import type { Scorer, ScorerResult } from "../adapters/scorer";
import type { TestCase } from "../schema/test-case";
import type { Trace } from "../schema/trace";

export class AssertionScorer implements Scorer {
  readonly name = "AssertionScorer";

  async score(input: {
    testCase: TestCase;
    trace: Trace;
  }): Promise<ScorerResult> {
    // Count actual agent steps (messages/tool_calls)
    const steps = input.trace.steps.filter(
      (s) => s.kind === "tool_call" || s.kind === "message"
    ).length;

    // Calculate total cost
    let costUsd = 0;
    for (const step of input.trace.steps) {
      costUsd += step.costUsd || 0;
    }

    for (const criterion of input.testCase.success) {
      if ("assert" in criterion) {
        const expression = criterion.assert;
        try {
          // Replace common snake_case variables with camelCase or provide them directly
          const sanitizedExpr = expression
            .replace(/\bcost_usd\b/g, "costUsd")
            .replace(/\btimeout_seconds\b/g, "timeoutSeconds")
            .replace(/\bduration_ms\b/g, "durationMs");

          const fn = new Function(
            "steps",
            "costUsd",
            `try { return Boolean(${sanitizedExpr}); } catch(e) { return false; }`
          );

          const passed = fn(steps, costUsd);
          if (!passed) {
            return {
              passed: false,
              detail: `Assertion failed: "${expression}" (actual: steps=${steps}, cost_usd=$${costUsd.toFixed(4)})`,
            };
          }
        } catch (err: any) {
          return {
            passed: false,
            detail: `Error evaluating assertion "${expression}": ${err.message}`,
          };
        }
      }
    }

    return {
      passed: true,
      detail: "All assertion checks passed successfully.",
    };
  }
}

import type { Scorer, ScorerResult } from "../adapters/scorer";
import type { TestCase } from "../schema/test-case";
import type { SandboxHandle } from "../adapters/sandbox-provider";

export class CommandScorer implements Scorer {
  readonly name = "CommandScorer";

  async score(input: {
    testCase: TestCase;
    sandbox: SandboxHandle;
  }): Promise<ScorerResult> {
    for (const criterion of input.testCase.success) {
      if ("run" in criterion) {
        const cmd = criterion.run;
        const expectedExitCode = criterion.expect?.exit_code ?? 0;
        
        try {
          const res = await input.sandbox.exec(cmd);
          if (res.exitCode !== expectedExitCode) {
            return {
              passed: false,
              detail: `Command "${cmd}" exited with code ${res.exitCode}, expected ${expectedExitCode}.\nStdout: ${res.stdout}\nStderr: ${res.stderr}`,
            };
          }
        } catch (err: any) {
          return {
            passed: false,
            detail: `Failed to execute command "${cmd}": ${err.message}`,
          };
        }
      }
    }
    return {
      passed: true,
      detail: "All success run commands completed with expected exit codes.",
    };
  }
}

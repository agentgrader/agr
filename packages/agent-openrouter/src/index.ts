import { generateText, tool } from "ai";
import { createOpenAI } from "@ai-sdk/openai";
import type { AgentAdapter, AgentResult, StepEvent } from "@crucible-agr/core";
import { z } from "zod";

export class OpenRouterAgentAdapter implements AgentAdapter {
  readonly name = "openrouter";

  async solve(input: {
    prompt: string;
    sandbox: any;
    config: any;
    onStep: (step: StepEvent) => void;
  }): Promise<AgentResult> {
    const { prompt, sandbox, config, onStep } = input;
    
    // set up the openrouter client (or fall back to direct openai if no openrouter key)
    const apiKey = process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || "mock-key";
    const baseURL = process.env.OPENROUTER_API_KEY 
      ? "https://openrouter.ai/api/v1" 
      : undefined;

    const client = createOpenAI({
      baseURL,
      apiKey,
      headers: {
        "HTTP-Referer": "https://github.com/david/crucible",
        "X-Title": "Crucible",
      },
    });

    const modelName = config.model || "gpt-4o-mini";
    const model = client(modelName);

    let submitted = false;
    let stepIndex = 0;

    // tools the agent can call inside the sandbox
    const tools = {
      executeCommand: tool({
        description: "Execute a terminal bash command inside the sandbox container.",
        parameters: z.object({
          command: z.string(),
        }),
        execute: async ({ command }) => {
          const res = await sandbox.exec(command);
          return {
            stdout: res.stdout,
            stderr: res.stderr,
            exitCode: res.exitCode,
          };
        },
      }),
      readFile: tool({
        description: "Read the content of a file in the sandbox workspace.",
        parameters: z.object({
          path: z.string(),
        }),
        execute: async ({ path }) => {
          try {
            const content = await sandbox.readFile(path);
            return { content };
          } catch (err: any) {
            return { error: err.message };
          }
        },
      }),
      writeFile: tool({
        description: "Write content to a file in the sandbox workspace.",
        parameters: z.object({
          path: z.string(),
          content: z.string(),
        }),
        execute: async ({ path, content }) => {
          try {
            await sandbox.writeFile(path, content);
            return { success: true };
          } catch (err: any) {
            return { error: err.message };
          }
        },
      }),
      submit: tool({
        description: "Submit the solution when the task is fully completed and verified.",
        parameters: z.object({
          summary: z.string().describe("A summary of changes made."),
        }),
        execute: async ({ summary }) => {
          submitted = true;
          return { message: "Solution submitted successfully." };
        },
      }),
    };

    // rough pricing per model — good enough for cost tracking
    const getPricing = (model: string) => {
      const name = model.toLowerCase();
      if (name.includes("claude-3-5-sonnet")) {
        return { input: 3 / 1000000, output: 15 / 1000000 };
      }
      if (name.includes("gpt-4o")) {
        return { input: 5 / 1000000, output: 15 / 1000000 };
      }
      if (name.includes("mini") || name.includes("flash")) {
        return { input: 0.15 / 1000000, output: 0.6 / 1000000 };
      }
      // unknown model, use a conservative estimate
      return { input: 2 / 1000000, output: 10 / 1000000 };
    };

    const pricing = getPricing(modelName);

    try {
      await generateText({
        model,
        maxSteps: config.max_steps || 30,
        tools,
        system: config.system_prompt || "You are an expert software engineering agent. Solve the coding task in the sandbox. Use tools to inspect, modify, and run tests. Call 'submit' when done.",
        prompt,
        experimental_telemetry: { isEnabled: true },
        onStepFinish: ({ text, toolCalls, toolResults, usage }) => {
          const promptTokens = usage?.promptTokens || 0;
          const completionTokens = usage?.completionTokens || 0;
          const stepCost = promptTokens * pricing.input + completionTokens * pricing.output;

          // forward step events to whoever is listening (dashboard, db, etc)
          if (text) {
            onStep({
              index: stepIndex++,
              kind: "message",
              tokensIn: promptTokens,
              tokensOut: completionTokens,
              costUsd: stepCost,
              timestamp: Date.now(),
              content: text,
            });
          }

          for (const tc of toolCalls) {
            onStep({
              index: stepIndex++,
              kind: "tool_call",
              tool: tc.toolName,
              tokensIn: 0,
              tokensOut: 0,
              costUsd: 0,
              timestamp: Date.now(),
              content: JSON.stringify(tc.args),
            });
          }

          for (const tr of toolResults) {
            onStep({
              index: stepIndex++,
              kind: "tool_result",
              tool: tr.toolName,
              tokensIn: 0,
              tokensOut: 0,
              costUsd: 0,
              timestamp: Date.now(),
              content: JSON.stringify(tr.result),
            });
          }
        },
      });
    } catch (err: any) {
      console.error(`Error in generateText agent loop: ${err.message}`);
    }

    const finalDiff = await sandbox.gitDiff();

    return {
      finished: submitted,
      finalDiff,
    };
  }
}

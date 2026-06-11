import { experimental_createMCPClient, generateText, tool } from "ai";
import { Experimental_StdioMCPTransport } from "ai/mcp-stdio";
import { createOpenAI } from "@ai-sdk/openai";
import { createAnthropic } from "@ai-sdk/anthropic";
import type { AgentAdapter, AgentResult, McpServerConfig, StepEvent } from "@agentgrader/core";
import { z } from "zod";

/** a connected mcp client, narrowed to the bits we use (so we can close it again). */
interface McpClientHandle {
  tools(): Promise<Record<string, unknown>>;
  close(): Promise<void>;
}

export class AiSdkAgentAdapter implements AgentAdapter {
  readonly name = "ai-sdk";

  async solve(input: {
    prompt: string;
    sandbox: any;
    config: any;
    onStep: (step: StepEvent) => void;
  }): Promise<AgentResult> {
    const { prompt, sandbox, config, onStep } = input;

    const provider = config.provider || "openrouter";
    const modelName = config.model || "gpt-4o-mini";
    let model: any;

    if (provider === "anthropic") {
      const anthropic = createAnthropic({
        apiKey: process.env.ANTHROPIC_API_KEY || "mock-key",
      });
      model = anthropic(modelName);
    } else if (provider === "openai") {
      const openai = createOpenAI({
        apiKey: process.env.OPENAI_API_KEY || "mock-key",
      });
      model = openai(modelName);
    } else {
      // Default to openrouter
      const openrouter = createOpenAI({
        baseURL: "https://openrouter.ai/api/v1",
        apiKey: process.env.OPENROUTER_API_KEY || process.env.OPENAI_API_KEY || "mock-key",
        headers: {
          "HTTP-Referer": "https://github.com/agentgrader/agr",
          "X-Title": "Agentgrader",
        },
      });
      model = openrouter(modelName);
    }

    let submitted = false;
    let stepIndex = 0;

    // tools the agent can call inside the sandbox
    const localTools = {
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

    // connect to any configured MCP servers and merge their tools in,
    // namespaced by server name to avoid collisions with local tools or
    // tools from other servers
    const mcpClients: McpClientHandle[] = [];
    const mcpTools: Record<string, unknown> = {};
    const mcpServers = (config.mcp_servers ?? {}) as Record<string, McpServerConfig>;

    for (const [serverName, serverConfig] of Object.entries(mcpServers)) {
      try {
        const transport =
          "command" in serverConfig
            ? new Experimental_StdioMCPTransport({
              command: serverConfig.command,
              args: serverConfig.args,
              env: serverConfig.env,
            })
            : // note: the installed AI SDK version only supports "sse" as a
            // remote transport type, regardless of the configured `type`
            { type: "sse" as const, url: serverConfig.url, headers: serverConfig.headers };

        const client = (await experimental_createMCPClient({ transport })) as McpClientHandle;
        mcpClients.push(client);

        const serverTools = await client.tools();
        for (const [toolName, toolDef] of Object.entries(serverTools)) {
          mcpTools[`${serverName}_${toolName}`] = toolDef;
        }
      } catch (err: any) {
        console.error(`Failed to connect to MCP server "${serverName}": ${err.message}`);
      }
    }

    const tools = { ...localTools, ...mcpTools } as typeof localTools;

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
    } finally {
      for (const client of mcpClients) {
        try {
          await client.close();
        } catch (e) { }
      }
    }

    const finalDiff = await sandbox.gitDiff();

    return {
      finished: submitted,
      finalDiff,
    };
  }
}

export { AiSdkAgentAdapter as OpenRouterAgentAdapter };

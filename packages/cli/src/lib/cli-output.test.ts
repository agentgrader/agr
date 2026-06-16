import { describe, expect, test } from "bun:test";
import {
  formatDoctorOutput,
  formatDoctorSummary,
  formatMissingApiKeyBlock,
  formatNoAgentConfigError,
  formatRunContext,
  formatRunStartLine,
} from "./cli-output";

describe("formatMissingApiKeyBlock", () => {
  test("includes task context and doctor hint", () => {
    const out = formatMissingApiKeyBlock({
      envVar: "ANTHROPIC_API_KEY",
      testCaseName: "hello-world",
      configPath: "/Users/david/projects/omegadogfeeding/agent.yaml",
      model: "claude-haiku-4-5-20251001",
      colors: false,
    });

    expect(out).toContain("agentgrader · run");
    expect(out).toContain("hello-world");
    expect(out).toContain("agent.yaml");
    expect(out).toContain("claude-haiku-4-5-20251001");
    expect(out).toContain("missing API key");
    expect(out).toContain("ANTHROPIC_API_KEY is not set");
    expect(out).toContain("agr doctor");
  });
});

describe("formatRunContext", () => {
  test("shows task, config, and model", () => {
    const out = formatRunContext({
      testCaseName: "hello-world",
      configPath: "/tmp/project/agent.yaml",
      model: "claude-haiku-4-5-20251001",
      colors: false,
    });

    expect(out).toContain("agentgrader · run");
    expect(out).toContain("hello-world");
    expect(out).toContain("agent.yaml");
    expect(out).toContain("claude-haiku-4-5-20251001");
  });
});

describe("formatRunStartLine", () => {
  test("shows starting line", () => {
    const out = formatRunStartLine({ colors: false });
    expect(out).toContain("starting");
  });
});

describe("formatNoAgentConfigError", () => {
  test("lists config options", () => {
    const out = formatNoAgentConfigError({ colors: false });

    expect(out).toContain("no agent config");
    expect(out).toContain("--config <path>");
    expect(out).toContain("agent_config: <path>");
  });
});

describe("formatDoctorOutput", () => {
  test("renders check statuses", () => {
    const out = formatDoctorOutput(
      [
        { label: "Docker daemon", status: "pass" },
        { label: "ANTHROPIC_API_KEY", status: "warn", detail: "not set" },
      ],
      { colors: false },
    );

    expect(out).toContain("agentgrader · doctor");
    expect(out).toContain("Docker daemon");
    expect(out).toContain("ANTHROPIC_API_KEY");
    expect(out).toContain("not set");
  });
});

describe("formatDoctorSummary", () => {
  test("reports all clear", () => {
    const out = formatDoctorSummary(0, 0, { colors: false });
    expect(out).toContain("all checks passed");
    expect(out).toContain("agr bench");
  });

  test("reports failures", () => {
    const out = formatDoctorSummary(2, 0, { colors: false });
    expect(out).toContain("2 check(s) failed");
    expect(out).toContain("agr doctor");
  });
});

import { describe, expect, test } from "bun:test";
import { formatInitOutput } from "./init-output";

describe("formatInitOutput", () => {
  test("lists scaffold files and first-run commands", () => {
    const out = formatInitOutput({
      root: "/Users/david/projects/omegadogfeeding",
      kind: "default",
      colors: false,
    });

    expect(out).toContain("agentgrader · init");
    expect(out).toContain("omegadogfeeding");
    expect(out).toContain("agent.yaml");
    expect(out).toContain("tasks/hello-world/agr.yaml");
    expect(out).toContain("agr run hello-world --verbose");
    expect(out).toContain("agr trace --last");
    expect(out).toContain("agr status");
    expect(out).not.toContain("Scaffolded a new");
  });

  test("blank scaffold mentions list-tests", () => {
    const out = formatInitOutput({
      root: "/tmp/blank-project",
      kind: "blank",
      colors: false,
    });

    expect(out).toContain("tasks/");
    expect(out).toContain("agr list-tests");
    expect(out).toContain("agr run <name>");
  });

  test("python scaffold adds pytest note", () => {
    const out = formatInitOutput({
      root: "/tmp/py-project",
      kind: "python",
      taskName: "hello-world-python",
      colors: false,
    });

    expect(out).toContain("hello-world-python");
    expect(out).toContain("pytest");
    expect(out).toContain("agr run hello-world-python --verbose");
  });

  test("ci scaffold lists workflow file", () => {
    const out = formatInitOutput({
      root: "/tmp/ci-project",
      kind: "default",
      ci: true,
      colors: false,
    });

    expect(out).toContain(".github/workflows/agr.yml");
    expect(out).toContain("GitHub Actions secret");
  });
});

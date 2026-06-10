import { readFileSync } from "node:fs";
import { dirname, isAbsolute, resolve } from "node:path";
import { type AgentConfig, AgentConfigSchema } from "@crucible-agr/core";
import { parse } from "yaml";

/**
 * Loads and parses an agent config YAML file.
 *
 * - Falls back to `name` for `id` if not set, mirroring `loadTestCase`.
 * - Resolves `toolkits` paths relative to the yaml file's directory, so
 *   downstream consumers (runSingle, sandbox providers) can use them
 *   directly as filesystem paths.
 */
export function loadAgentConfig(yamlPath: string): AgentConfig {
  const path = resolve(yamlPath);
  const fileContent = readFileSync(path, "utf-8");
  const raw = parse(fileContent);
  const dir = dirname(path);

  const config = AgentConfigSchema.parse(raw);
  config.id = config.id || config.name;

  if (config.toolkits) {
    config.toolkits = config.toolkits.map((toolkit) =>
      isAbsolute(toolkit) ? toolkit : resolve(dir, toolkit),
    );
  }

  return config;
}

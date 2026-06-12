import { readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { parse } from "yaml";
import { z } from "zod";
import { resolveAgentConfigPathList } from "./resolve-agent-config-paths";

const AgentsSchema = z
  .object({
    paths: z.array(z.string()).optional(),
    glob: z.union([z.string(), z.array(z.string())]).optional(),
  })
  .refine((data) => (data.paths?.length ?? 0) > 0 || data.glob !== undefined, {
    message: "agents must specify at least one of paths or glob",
  });

export const BenchManifestSchema = z.object({
  name: z.string().optional(),
  suite: z.string(),
  agents: AgentsSchema,
  concurrency: z.number().optional(),
});

export type BenchManifest = z.infer<typeof BenchManifestSchema>;

export function loadBenchManifest(yamlPath: string): BenchManifest {
  const path = resolve(yamlPath);
  const raw = parse(readFileSync(path, "utf-8"));
  return BenchManifestSchema.parse(raw);
}

export function resolveManifestAgentConfigPaths(
  manifest: BenchManifest,
  manifestPath: string,
): string[] {
  const manifestDir = dirname(resolve(manifestPath));
  const globs = manifest.agents.glob
    ? Array.isArray(manifest.agents.glob)
      ? manifest.agents.glob
      : [manifest.agents.glob]
    : undefined;

  return resolveAgentConfigPathList({
    explicitPaths: manifest.agents.paths,
    globs,
    relativeTo: manifestDir,
  });
}

export function resolveManifestSuiteDir(manifest: BenchManifest, manifestPath: string): string {
  return resolve(dirname(resolve(manifestPath)), manifest.suite);
}

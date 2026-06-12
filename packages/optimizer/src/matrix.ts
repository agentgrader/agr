import { z } from "zod";
import type { AgentConfig } from "@agentgrader/core";

/**
 * Shared config applied to every combination produced by `expandMatrix`,
 * before per-dimension overrides are layered on top.
 *
 * Set `provider` here when every expanded config should use the same API
 * gateway (e.g. `anthropic` with native `claude-*` model names, or `openai`
 * with `gpt-*` names). Per-combo overrides come from `dimensions.provider`.
 */
const MatrixBaseSchema = z.object({
  model: z.string().optional(),
  provider: z.string().optional(),
  max_steps: z.number().optional(),
  temperature: z.number().optional(),
  system_prompt: z.string().optional(),
  tools: z.array(z.string()).optional(),
  toolkits: z.array(z.string()).optional(),
});

/**
 * Each populated array becomes one axis of the cartesian product. Axes left
 * `undefined` are not varied - their value (if any) comes from `base`.
 *
 * `provider` varies the API gateway per combo (`openrouter`, `openai`,
 * `anthropic`). Pair native model names with the matching provider in `base`
 * or vary `model` and `provider` together only when the cartesian product is
 * intentional (e.g. a single provider value in `dimensions.provider`).
 */
export const MatrixDimensionsSchema = z
  .object({
    model: z.array(z.string()).optional(),
    provider: z.array(z.string()).optional(),
    temperature: z.array(z.number()).optional(),
    system_prompt: z.array(z.string()).optional(),
    max_steps: z.array(z.number()).optional(),
    toolkits: z.array(z.array(z.string())).optional(),
  })
  .refine((dims) => Object.values(dims).some((v) => Array.isArray(v) && v.length > 0), {
    message: "Matrix must define at least one non-empty dimension",
  });

export const MatrixSchema = z.object({
  /** used as the prefix for generated agent config ids/names */
  name: z.string(),
  base: MatrixBaseSchema.default({}),
  dimensions: MatrixDimensionsSchema,
});

export type Matrix = z.infer<typeof MatrixSchema>;
type MatrixDimensions = z.infer<typeof MatrixDimensionsSchema>;

const DEFAULT_MODEL = "anthropic/claude-sonnet-4-6";
const DEFAULT_MAX_STEPS = 30;

/**
 * Expands a `Matrix` into the cartesian product of its `dimensions`,
 * producing one `AgentConfig` per combination with `base` values as
 * defaults and a deterministic, slugified `id`/`name`.
 */
export function expandMatrix(matrix: Matrix): AgentConfig[] {
  const { name, base, dimensions } = matrix;

  const dimEntries = (Object.entries(dimensions) as [keyof MatrixDimensions, unknown[] | undefined][]).filter(
    (entry): entry is [keyof MatrixDimensions, unknown[]] => Array.isArray(entry[1]) && entry[1].length > 0,
  );

  if (dimEntries.length === 0) {
    throw new Error("Matrix must define at least one non-empty dimension");
  }

  let combinations: Record<string, unknown>[] = [{}];
  for (const [key, values] of dimEntries) {
    const next: Record<string, unknown>[] = [];
    for (const combo of combinations) {
      for (const value of values) {
        next.push({ ...combo, [key]: value });
      }
    }
    combinations = next;
  }

  return combinations.map((combo) => {
    const id = `${name}-${dimEntries.map(([key]) => slugifyValue(combo[key])).join("-")}`;

    const config: AgentConfig = {
      id,
      name: id,
      model: (combo.model as string | undefined) ?? base.model ?? DEFAULT_MODEL,
      max_steps: (combo.max_steps as number | undefined) ?? base.max_steps ?? DEFAULT_MAX_STEPS,
    };

    const temperature = (combo.temperature as number | undefined) ?? base.temperature;
    if (temperature !== undefined) config.temperature = temperature;

    const systemPrompt = (combo.system_prompt as string | undefined) ?? base.system_prompt;
    if (systemPrompt !== undefined) config.system_prompt = systemPrompt;

    const provider = (combo.provider as string | undefined) ?? base.provider;
    if (provider !== undefined) config.provider = provider;

    const toolkits = (combo.toolkits as string[] | undefined) ?? base.toolkits;
    if (toolkits !== undefined) config.toolkits = toolkits;

    if (base.tools !== undefined) config.tools = base.tools;

    return config;
  });
}

function slugifyValue(value: unknown): string {
  if (Array.isArray(value)) {
    return value.length > 0 ? value.map(slugifyValue).join("+") : "none";
  }
  return String(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

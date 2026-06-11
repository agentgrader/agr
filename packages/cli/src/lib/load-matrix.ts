import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { MatrixSchema, type Matrix } from "@agentgrader/optimizer";
import { parse } from "yaml";

/** Loads and validates an optimizer matrix YAML file (see `MatrixSchema`). */
export function loadMatrix(yamlPath: string): Matrix {
  const path = resolve(yamlPath);
  const fileContent = readFileSync(path, "utf-8");
  const raw = parse(fileContent);
  return MatrixSchema.parse(raw);
}

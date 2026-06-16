import { existsSync } from "node:fs";
import { resolve } from "node:path";
import { config as loadDotenv } from "dotenv";

export function findEnvFile(startDir = process.cwd()): string | undefined {
  let dir = resolve(startDir);
  for (let depth = 0; depth < 12; depth++) {
    const candidate = resolve(dir, ".env");
    if (existsSync(candidate)) return candidate;
    const parent = resolve(dir, "..");
    if (parent === dir) break;
    dir = parent;
  }
  return undefined;
}

export function loadProjectEnv(startDir = process.cwd()): string | undefined {
  const envPath = findEnvFile(startDir);
  if (!envPath) return undefined;
  loadDotenv({ path: envPath });
  return envPath;
}

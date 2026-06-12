import { readdirSync, statSync } from "node:fs";
import { basename, resolve } from "node:path";
import { loadAgentConfig } from "./load-agent-config";
import type { AgentConfig } from "@agentgrader/core";

function globToRegex(glob: string): RegExp {
  const escaped = glob.replace(/[.+^${}()|[\]\\]/g, "\\$&").replace(/\*/g, ".*");
  return new RegExp(`^${escaped}$`);
}

function collectYamlFilesRecursive(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir)) {
    if (entry.startsWith(".")) continue;
    const fullPath = resolve(dir, entry);
    const stat = statSync(fullPath);
    if (stat.isDirectory()) {
      files.push(...collectYamlFilesRecursive(fullPath));
    } else if (entry.endsWith(".yaml") || entry.endsWith(".yml")) {
      files.push(fullPath);
    }
  }
  return files;
}

export function findAgentConfigYamlFilesInDir(dir: string): string[] {
  const resolvedDir = resolve(dir);
  const files: string[] = [];
  for (const entry of readdirSync(resolvedDir)) {
    if (entry.startsWith(".")) continue;
    const fullPath = resolve(resolvedDir, entry);
    if (!statSync(fullPath).isFile()) continue;
    if (entry.endsWith(".yaml") || entry.endsWith(".yml")) {
      files.push(fullPath);
    }
  }
  return files.sort();
}

export function expandAgentConfigGlob(globPattern: string, baseDir: string): string[] {
  const base = resolve(baseDir);
  const normalized = globPattern.replace(/^\.\//, "");

  if (normalized.includes("**")) {
    const [prefix, suffixPart] = normalized.split("**");
    const searchRoot = prefix.replace(/\/$/, "") ? resolve(base, prefix.replace(/\/$/, "")) : base;
    const suffix = (suffixPart ?? "").replace(/^\//, "") || "*.yaml";
    const regex = globToRegex(suffix);
    return collectYamlFilesRecursive(searchRoot)
      .filter((filePath) => regex.test(basename(filePath)))
      .sort();
  }

  const slashIdx = normalized.lastIndexOf("/");
  const cwd = slashIdx === -1 ? base : resolve(base, normalized.slice(0, slashIdx));
  const fileGlob = slashIdx === -1 ? normalized : normalized.slice(slashIdx + 1);
  const regex = globToRegex(fileGlob);

  return readdirSync(cwd)
    .filter((entry) => {
      if (entry.startsWith(".")) return false;
      const fullPath = resolve(cwd, entry);
      return statSync(fullPath).isFile() && regex.test(entry);
    })
    .map((entry) => resolve(cwd, entry))
    .sort();
}

export function resolveAgentConfigPathList(input: {
  commaSeparated?: string;
  dir?: string;
  globs?: string[];
  explicitPaths?: string[];
  relativeTo?: string;
}): string[] {
  const paths = new Set<string>();

  if (input.commaSeparated) {
    for (const part of input.commaSeparated.split(",")) {
      const trimmed = part.trim();
      if (trimmed) paths.add(resolve(trimmed));
    }
  }

  if (input.dir) {
    for (const file of findAgentConfigYamlFilesInDir(input.dir)) {
      paths.add(file);
    }
  }

  const baseDir = input.relativeTo ? resolve(input.relativeTo) : process.cwd();

  if (input.explicitPaths) {
    for (const p of input.explicitPaths) {
      paths.add(resolve(baseDir, p));
    }
  }

  if (input.globs) {
    for (const pattern of input.globs) {
      for (const file of expandAgentConfigGlob(pattern, baseDir)) {
        paths.add(file);
      }
    }
  }

  const sorted = [...paths].sort();
  if (sorted.length === 0) {
    throw new Error("No agent config YAML files found.");
  }
  return sorted;
}

export function loadAgentConfigsFromPaths(paths: string[]): AgentConfig[] {
  return paths.map((p) => loadAgentConfig(p));
}

/**
 * Minimal glob matcher (no external dependency) supporting:
 *   - `*`  matches any sequence of characters except `/`
 *   - `**` matches any sequence of characters, including `/`
 *   - `?`  matches a single character except `/`
 *
 * Used for `forbid_modified` / `expected_files` patterns in test cases.
 */
export function matchGlob(pattern: string, filePath: string): boolean {
  const normalizedPattern = pattern.replace(/^\.\//, "");
  const normalizedPath = filePath.replace(/^\.\//, "");
  const regex = new RegExp(`^${globToRegExpSource(normalizedPattern)}$`);
  return regex.test(normalizedPath);
}

export function matchAnyGlob(patterns: string[], filePath: string): boolean {
  return patterns.some((pattern) => matchGlob(pattern, filePath));
}

function globToRegExpSource(pattern: string): string {
  let result = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "*") {
      if (pattern[i + 1] === "*") {
        result += ".*";
        i++; // consume second '*'
        if (pattern[i + 1] === "/") {
          i++; // consume trailing slash so '**/foo' also matches 'foo'
        }
      } else {
        result += "[^/]*";
      }
    } else if (c === "?") {
      result += "[^/]";
    } else if (/[.+^${}()|[\]\\]/.test(c)) {
      result += `\\${c}`;
    } else {
      result += c;
    }
  }
  return result;
}

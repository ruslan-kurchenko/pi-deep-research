/**
 * Build a YAML frontmatter block from a flat key→value map.
 * Values are emitted as plain YAML strings (no nested objects).
 */
export function buildFrontmatter(fields: Record<string, string>): string {
  const lines = Object.entries(fields)
    .filter(([, v]) => v !== undefined && v !== null)
    .map(([k, v]) => `${k}: ${yamlString(v)}`);
  return `---\n${lines.join("\n")}\n---`;
}

/**
 * Prepend YAML frontmatter to a markdown string.
 * If the string already starts with `---`, the existing frontmatter is replaced.
 */
export function prependFrontmatter(
  content: string,
  fields: Record<string, string>
): string {
  const header = buildFrontmatter(fields);
  // Strip existing frontmatter if present
  const stripped = content.replace(/^---\n[\s\S]*?\n---\n?/, "").trimStart();
  return `${header}\n\n${stripped}`;
}

/** Quote a YAML string value only if it contains special characters. */
function yamlString(value: string): string {
  if (/[:#\[\]{}*&!|>'"%@`,\n]/.test(value) || value.startsWith(" ") || value.endsWith(" ")) {
    return `"${value.replace(/"/g, '\\"')}"`;
  }
  return value;
}

type TemplateValue = string | number | string[];

export type TemplateVars = Record<string, TemplateValue | undefined>;

interface RenderOptions {
  /** Throw on unresolved placeholders instead of leaving them in place. */
  strict?: boolean;
}

/**
 * Simple `{{placeholder}}` template renderer. No conditionals or loops —
 * intentionally minimal to avoid pulling in Handlebars/EJS.
 */
export function renderTemplate(
  template: string,
  vars: TemplateVars,
  options: RenderOptions = {}
): string {
  if (options.strict) {
    const missing = validateTemplate(template, vars);
    if (missing.length > 0) {
      throw new Error(`Missing placeholder${missing.length > 1 ? "s" : ""}: ${missing.join(", ")}`);
    }
  }

  return template.replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
    const val = vars[key];
    if (val === undefined) return `{{${key}}}`;
    if (Array.isArray(val)) return val.join("\n");
    return String(val);
  });
}

/**
 * Returns the names of placeholders present in `template` that are not
 * satisfied by `vars`. Deduplicates.
 */
export function validateTemplate(template: string, vars: TemplateVars): string[] {
  const found = new Set<string>();
  for (const [, key] of template.matchAll(/\{\{(\w+)\}\}/g)) {
    if (key && !(key in vars)) found.add(key);
  }
  return [...found];
}

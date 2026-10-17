// Text mechanics that every service rewrites: placeholder substitution with the right escaping for the
// channel it is going out on, escaping for a SQL LIKE pattern, splitting a person's full name.
//
// No product vocabulary lives here — no channel enum, no header names, no field names. The caller says
// which escape mode it needs; the mapping from its own channel enum to a mode is the caller's policy.

/** Where the rendered value is about to land. Picking the wrong one is an injection, not a typo. */
export type EscapeMode = "none" | "url" | "html" | "markdownv2" | "plain";

/**
 * Escape a value for a SQL `LIKE` pattern: a user searching for "100%" must not match everything.
 *
 * The backslash goes first — escaping it after `%`/`_` would double-escape the escapes. Postgres needs
 * no `ESCAPE` clause with this, since backslash is the default.
 */
export function escapeLike(value: string): string {
  return value.replace(/\\/g, "\\\\").replace(/[%_]/g, "\\$&");
}

export function escapeHtml(str: string): string {
  return str
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Telegram MarkdownV2 reserves this whole set; one unescaped character fails the whole send. */
export function escapeMarkdownV2(str: string): string {
  return str.replace(/[\\_*[\]()~`>#+\-=|{}.!]/g, (m) => `\\${m}`);
}

export function escapeValue(str: string, mode: EscapeMode): string {
  switch (mode) {
    case "url":
      return encodeURIComponent(str);
    case "html":
      return escapeHtml(str);
    case "markdownv2":
      return escapeMarkdownV2(str);
    default:
      return str;
  }
}

/** Read `a.b.c` out of a plain object, returning undefined instead of throwing on a missing branch. */
export function resolvePath(context: Record<string, unknown>, path: string): unknown {
  let cur: unknown = context;
  for (const key of path.split(".")) {
    if (cur == null || typeof cur !== "object") return undefined;
    cur = (cur as Record<string, unknown>)[key];
  }
  return cur;
}

/**
 * Substitute `{{ path.to.value }}` placeholders, escaping each substituted value for the target.
 *
 * Escaping is per-VALUE, never over the finished string: the template itself is authored by us and may
 * legitimately contain markup, while the values come from data and may contain anything. A missing key
 * renders as an empty string rather than leaving the placeholder visible to a customer.
 */
export function renderTemplate(
  template: string,
  context: Record<string, unknown>,
  escape: boolean | EscapeMode = false,
): string {
  const mode: EscapeMode = escape === true ? "url" : escape === false ? "none" : escape;
  return template.replace(/\{\{\s*([\w.]+)\s*\}\}/g, (_match, path: string) => {
    const value = resolvePath(context, path);
    return escapeValue(value == null ? "" : String(value), mode);
  });
}

/**
 * Split a full name into first + rest. Deliberately naive: one word is a first name, everything after
 * the first space is the last name. Anything smarter guesses wrong on the half of the world that writes
 * the family name first.
 */
export function splitPersonName(full: string | undefined): { firstName?: string; lastName?: string } {
  const words = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (!words.length) return {};
  return { firstName: words[0], lastName: words.slice(1).join(" ") || undefined };
}

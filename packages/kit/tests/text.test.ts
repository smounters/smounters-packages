import { describe, expect, it } from "vitest";
import {
  escapeHtml,
  escapeLike,
  escapeMarkdownV2,
  renderTemplate,
  resolvePath,
  splitPersonName,
} from "../src/text/index.js";

describe("escapeLike", () => {
  it("keeps a wildcard typed by a user from matching everything", () => {
    expect(escapeLike("100%")).toBe("100\\%");
    expect(escapeLike("a_b")).toBe("a\\_b");
  });

  it("escapes the backslash first, or the escapes get escaped twice", () => {
    expect(escapeLike("a\\%")).toBe("a\\\\\\%");
  });
});

describe("renderTemplate", () => {
  it("substitutes nested paths and drops unknown ones", () => {
    expect(renderTemplate("Привет, {{ user.name }}!", { user: { name: "Ана" } })).toBe("Привет, Ана!");
    expect(renderTemplate("[{{ missing.key }}]", {})).toBe("[]");
  });

  it("escapes the VALUE for the target, not the template", () => {
    // The template is ours and may carry markup; the value is data and may carry anything.
    expect(renderTemplate("<b>{{ x }}</b>", { x: "<script>" }, "html")).toBe("<b>&lt;script&gt;</b>");
    expect(renderTemplate("{{ x }}", { x: "a b" }, "url")).toBe("a%20b");
    expect(renderTemplate("{{ x }}", { x: "1.5" }, "markdownv2")).toBe("1\\.5");
  });

  it("treats `true` as url escaping for the old boolean call form", () => {
    expect(renderTemplate("{{ x }}", { x: "a b" }, true)).toBe("a%20b");
    expect(renderTemplate("{{ x }}", { x: "a b" }, false)).toBe("a b");
  });
});

describe("escaping helpers", () => {
  it("covers every character Telegram MarkdownV2 reserves", () => {
    expect(escapeMarkdownV2("a_b*c[d]e(f)")).toBe("a\\_b\\*c\\[d\\]e\\(f\\)");
  });

  it("escapes quotes as well as tags, for attribute context", () => {
    expect(escapeHtml(`<a href="x">'&`)).toBe("&lt;a href=&quot;x&quot;&gt;&#39;&amp;");
  });
});

describe("resolvePath", () => {
  it("returns undefined instead of throwing on a missing branch", () => {
    expect(resolvePath({ a: { b: 1 } }, "a.b")).toBe(1);
    expect(resolvePath({ a: null }, "a.b.c")).toBeUndefined();
  });
});

describe("splitPersonName", () => {
  it("splits on the first space and keeps the rest together", () => {
    expect(splitPersonName("Ана Мария Лопес")).toEqual({ firstName: "Ана", lastName: "Мария Лопес" });
    expect(splitPersonName("Ана")).toEqual({ firstName: "Ана", lastName: undefined });
    expect(splitPersonName("   ")).toEqual({});
    expect(splitPersonName(undefined)).toEqual({});
  });
});

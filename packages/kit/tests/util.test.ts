import { describe, expect, it } from "vitest";
import { redactSecrets, ulid } from "../src/util/index.js";

describe("ulid", () => {
  it("is 26 chars of Crockford base32", () => {
    expect(ulid()).toMatch(/^[0-9A-HJKMNP-TV-Z]{26}$/);
  });

  it("sorts in time order", () => {
    const early = ulid(1_700_000_000_000);
    const later = ulid(1_700_000_001_000);
    expect(early < later).toBe(true);
  });

  it("does not repeat within one millisecond", () => {
    const ms = 1_700_000_000_000;
    const ids = new Set(Array.from({ length: 200 }, () => ulid(ms)));
    expect(ids.size).toBe(200);
  });
});

describe("redactSecrets", () => {
  it("hides token-like query params inside a string", () => {
    expect(redactSecrets("https://x.dev/verify?token=abc123&lang=ru")).toBe(
      "https://x.dev/verify?token=[redacted]&lang=ru",
    );
  });

  it("hides values under credential-named keys", () => {
    expect(redactSecrets({ Authorization: "Bearer x", apiKey: "k", note: "keep" })).toEqual({
      Authorization: "[redacted]",
      apiKey: "[redacted]",
      note: "keep",
    });
  });

  it("keeps the structure so a stored payload can still be re-sent", () => {
    const input = { headers: [{ token: "t" }, { "x-trace": "ok" }], body: { url: "https://x.dev?secret=s" } };
    expect(redactSecrets(input)).toEqual({
      headers: [{ token: "[redacted]" }, { "x-trace": "ok" }],
      body: { url: "https://x.dev?secret=[redacted]" },
    });
  });

  it("leaves the input untouched", () => {
    const input = { token: "t" };
    redactSecrets(input);
    expect(input.token).toBe("t");
  });
});

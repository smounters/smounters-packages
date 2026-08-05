import { describe, expect, it } from "vitest";
import {
  buildAuthorizeUrl,
  codeChallenge,
  describeProvider,
  FACEBOOK,
  GOOGLE,
  OAuthError,
  randomToken,
} from "../src/oauth/index.js";

describe("описания провайдеров", () => {
  it("Facebook НЕ считается подтверждающим почту", () => {
    // Не косметика: на этом флаге висит право автопривязки к существующему аккаунту по почте.
    // Разрешить его Facebook значит отдать чужой аккаунт тому, кто зарегистрирует там этот адрес.
    expect(FACEBOOK.verifiesEmail).toBe(false);
    expect(GOOGLE.verifiesEmail).toBe(true);
  });

  it("неизвестный провайдер — ошибка настройки, а не падение", () => {
    expect(() => describeProvider("myspace")).toThrow(OAuthError);
  });
});

describe("адрес авторизации", () => {
  it("несёт PKCE, state и nonce", async () => {
    const verifier = randomToken();
    const url = new URL(
      await buildAuthorizeUrl({
        descriptor: { ...GOOGLE, discoveryUrl: undefined, authorizeUrl: "https://provider.test/auth" },
        config: { clientId: "cid", clientSecret: "s", redirectUri: "https://api.test/cb" },
        state: "st-1",
        nonce: "nc-1",
        codeChallenge: await codeChallenge(verifier),
      }),
    );
    expect(url.origin + url.pathname).toBe("https://provider.test/auth");
    expect(url.searchParams.get("response_type")).toBe("code");
    expect(url.searchParams.get("state")).toBe("st-1");
    expect(url.searchParams.get("nonce")).toBe("nc-1");
    expect(url.searchParams.get("code_challenge_method")).toBe("S256");
    expect(url.searchParams.get("code_challenge")).toHaveLength(43);
    expect(url.searchParams.get("prompt")).toBe("select_account");
    expect(url.searchParams.get("scope")).toBe("openid email profile");
  });

  it("настройка перекрывает области видимости провайдера", async () => {
    const url = new URL(
      await buildAuthorizeUrl({
        descriptor: { ...GOOGLE, discoveryUrl: undefined, authorizeUrl: "https://provider.test/auth" },
        config: {
          clientId: "cid",
          clientSecret: "s",
          redirectUri: "https://api.test/cb",
          scopes: ["openid", "email"],
        },
        state: "st",
      }),
    );
    expect(url.searchParams.get("scope")).toBe("openid email");
  });

  it("без endpoint'ов и без discovery — ошибка настройки", async () => {
    await expect(
      buildAuthorizeUrl({
        descriptor: { ...GOOGLE, discoveryUrl: undefined, authorizeUrl: undefined },
        config: { clientId: "c", clientSecret: "s", redirectUri: "https://api.test/cb" },
        state: "st",
      }),
    ).rejects.toThrow(OAuthError);
  });
});

describe("PKCE", () => {
  it("challenge воспроизводим и url-safe", async () => {
    const a = await codeChallenge("verifier-123");
    expect(a).toBe(await codeChallenge("verifier-123"));
    expect(a).not.toMatch(/[+/=]/);
  });

  it("случайные значения не повторяются", () => {
    expect(new Set(Array.from({ length: 50 }, () => randomToken())).size).toBe(50);
  });
});

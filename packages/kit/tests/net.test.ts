import { describe, expect, it } from "vitest";
import { assertPublicUrl, isPrivateIp } from "../src/net/index.js";

describe("isPrivateIp", () => {
  it("blocks the ranges an SSRF attempt aims at", () => {
    for (const ip of [
      "127.0.0.1", // loopback
      "10.1.2.3", // private
      "172.16.0.1", // private
      "192.168.14.20", // private
      "169.254.169.254", // cloud metadata — the classic target
      "100.64.0.1", // CGNAT
      "0.0.0.0",
      "::1",
      "fd00::1", // ULA
      "fe80::1", // link-local
      "::ffff:10.0.0.1", // IPv4-mapped private
    ]) {
      expect(isPrivateIp(ip), ip).toBe(true);
    }
  });

  it("allows public addresses", () => {
    for (const ip of ["8.8.8.8", "1.1.1.1", "148.251.14.25", "2606:4700:4700::1111"]) {
      expect(isPrivateIp(ip), ip).toBe(false);
    }
  });

  it("treats a malformed literal as unsafe", () => {
    // Fail closed: an address we cannot parse must not be assumed public.
    expect(isPrivateIp("10.0.0")).toBe(false); // not an IP at all → not an IP literal
    expect(isPrivateIp("999.1.1.1")).toBe(false);
  });
});

describe("assertPublicUrl", () => {
  it("refuses a non-http scheme", async () => {
    await expect(assertPublicUrl("file:///etc/passwd")).rejects.toThrow(/scheme/);
    await expect(assertPublicUrl("gopher://example.com")).rejects.toThrow(/scheme/);
  });

  it("refuses an internal hostname", async () => {
    await expect(assertPublicUrl("http://localhost:8000/x")).rejects.toThrow(/internal host/);
    await expect(assertPublicUrl("http://api.svc.local/x")).rejects.toThrow(/internal host/);
  });

  it("refuses a private IP literal", async () => {
    await expect(assertPublicUrl("http://169.254.169.254/latest/meta-data/")).rejects.toThrow(/private address/);
    await expect(assertPublicUrl("http://192.168.14.20/health")).rejects.toThrow(/private address/);
  });

  it("refuses garbage", async () => {
    await expect(assertPublicUrl("not a url")).rejects.toThrow(/invalid URL/);
  });

  it("accepts a public IP literal without touching DNS", async () => {
    await expect(assertPublicUrl("https://1.1.1.1/")).resolves.toBeUndefined();
  });
});

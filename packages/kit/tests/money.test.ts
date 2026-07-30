import { describe, expect, it } from "vitest";
import {
  applyDelta,
  isBalanced,
  MONEY_SCALE,
  quantizeToDecimals,
  ROUND_UP,
  sumAmounts,
  toMoneyAmount,
} from "../src/money/index.js";

describe("money scale", () => {
  it("normalizes to the money scale", () => {
    expect(toMoneyAmount("10")).toBe("10.0000");
    expect(toMoneyAmount("10.5")).toBe("10.5000");
    expect(toMoneyAmount("")).toBe("0.0000");
  });

  it("REFUSES an amount with more precision than the ledger stores", () => {
    // Rounding here would desync the stored row from the balance math — the caller must reject instead.
    expect(toMoneyAmount("10.00001")).toBeNull();
    expect(MONEY_SCALE).toBe(4);
  });

  it("adds without floating-point drift", () => {
    // 0.1 + 0.2 is the canonical double failure; a ledger cannot afford it.
    expect(applyDelta("0.1", "0.2")).toBe("0.3000");
    expect(sumAmounts(["0.1", "0.2", "-0.3"]).isZero()).toBe(true);
  });
});

describe("quantizeToDecimals", () => {
  it("cuts to the decimals of the asset", () => {
    // A 6-decimal token cannot move a value with 8 — an expected amount must be reachable on chain.
    expect(quantizeToDecimals("1.23456789", 6)).toBe("1.234567");
    expect(quantizeToDecimals("1.23456789", 6, ROUND_UP)).toBe("1.234568");
  });

  it("pads when the value is shorter than the asset's decimals", () => {
    expect(quantizeToDecimals("2.5", 6)).toBe("2.500000");
  });
});

describe("isBalanced", () => {
  it("accepts a posting whose signed amounts sum to exactly zero", () => {
    expect(isBalanced([{ amount: "100.0000" }, { amount: "-100.0000" }])).toBe(true);
    expect(isBalanced([{ amount: "100.0000" }, { amount: "-40.0000" }, { amount: "-60.0000" }])).toBe(true);
  });

  it("rejects a single-line posting", () => {
    expect(isBalanced([{ amount: "100.0000" }])).toBe(false);
  });

  it("rejects a zero-amount line", () => {
    // A zero line balances arithmetically but records nothing — it is a bug, not a posting.
    expect(isBalanced([{ amount: "0" }, { amount: "100" }, { amount: "-100" }])).toBe(false);
  });

  it("rejects an unbalanced posting", () => {
    expect(isBalanced([{ amount: "100.0000" }, { amount: "-99.9999" }])).toBe(false);
  });
});

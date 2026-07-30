import { Decimal } from "decimal.js";

// Money arithmetic. Pure, no infrastructure.
//
// Nothing here may use a JS number: a double cannot represent 0.1 exactly, and a ledger that cannot
// represent its own amounts stops balancing within a day. Amounts travel as decimal STRINGS end to end
// (numeric in the database, string on the wire) and are only turned into Decimal for the arithmetic.

// Precision must exceed the widest intermediate we produce (a 20-digit amount divided by an 18-dp rate).
Decimal.set({ precision: 50, toExpNeg: -50, toExpPos: 50 });

/** Money scale: `numeric(20,4)`. Four decimal places cover fiat and keep every posting exact. */
export const MONEY_SCALE = 4;
/** Ratio scale: `numeric(20,8)` — returns, coverage, shares of a fee. */
export const RATE_SCALE = 8;

export const ZERO_MONEY = "0.0000";

/**
 * Rounding is never "whatever the library defaults to" — every quantization must round in the direction
 * that protects the party who did NOT initiate the action. Pick explicitly at each call site; these are
 * re-exported so a caller never has to import decimal.js just for a constant.
 */
export const ROUND_DOWN = Decimal.ROUND_DOWN;
export const ROUND_UP = Decimal.ROUND_UP;
export const ROUND_HALF_UP = Decimal.ROUND_HALF_UP;

/** Parse a possibly empty/absent amount as Decimal; "" and undefined mean zero. */
export function toDecimal(amount: string | undefined | null): Decimal {
  return new Decimal(amount != null && amount.length > 0 ? amount : "0");
}

/**
 * Normalize to money scale, or return null when the input carries MORE precision than the ledger can
 * store. The caller must reject rather than persist: the column would round silently, desyncing the
 * stored row from the scale-4 balance math and potentially un-balancing a posting.
 */
export function toMoneyAmount(amount: string): string | null {
  const d = toDecimal(amount);
  if (d.decimalPlaces() > MONEY_SCALE) return null;
  return d.toFixed(MONEY_SCALE);
}

/**
 * Quantize to the decimals of a specific ASSET rather than to the ledger scale.
 *
 * Needed whenever an amount has to be reachable on the other side: a token with 6 decimals cannot
 * transfer a value with 8, so an expected amount quantized to the ledger scale can be impossible to pay
 * exactly — and a strict comparison then reports an underpayment that the payer could not have avoided.
 * `rounding` decides who absorbs the residue: ROUND_UP for what someone must pay (they overpay by dust),
 * ROUND_DOWN for what we pay out.
 */
export function quantizeToDecimals(amount: string, decimals: number, rounding: Decimal.Rounding = ROUND_DOWN): string {
  return toDecimal(amount).toFixed(decimals, rounding);
}

export function sumAmounts(amounts: readonly string[]): Decimal {
  return amounts.reduce((acc, a) => acc.plus(toDecimal(a)), new Decimal(0));
}

/** Apply a signed delta to a balance, at money scale. */
export function applyDelta(balance: string, amount: string): string {
  return toDecimal(balance).plus(toDecimal(amount)).toFixed(MONEY_SCALE);
}

export interface PostingLine {
  /** Signed decimal string: debit > 0, credit < 0. */
  amount: string;
}

/**
 * Is this a valid double-entry posting? At least two lines, no zero-amount line, and the signed amounts
 * sum to EXACTLY zero. This is the invariant that makes a ledger auditable, so it is checked in code
 * rather than trusted: a posting that does not balance must never reach the database.
 */
export function isBalanced(lines: readonly PostingLine[]): boolean {
  if (lines.length < 2) return false;
  if (lines.some((l) => toDecimal(l.amount).isZero())) return false;
  return sumAmounts(lines.map((l) => l.amount)).isZero();
}

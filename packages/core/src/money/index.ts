import { Decimal } from "decimal.js";

// Money arithmetic. Pure, no infrastructure.
//
// Nothing here may use a JS number: a double cannot represent 0.1 exactly, and a ledger that cannot
// represent its own amounts stops balancing within a day. Amounts travel as decimal STRINGS end to end
// (numeric in the database, string on the wire) and are only turned into Decimal for the arithmetic.

// Precision must exceed the widest intermediate we produce. The widest column a consumer stores is
// numeric(40,20) — 40 significant digits — and two of those can meet in one multiplication, so the
// library must carry twice that before it starts rounding. decimal.js defaults to 20 SIGNIFICANT
// digits and rounds even a plain addition down to them, silently: at 18 decimal places that loses
// the tail of every sum. Importing this module is what fixes it for the whole process.
Decimal.set({ precision: 80, toExpNeg: -80, toExpPos: 80 });

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

export interface MoneyOptions {
  /** Decimal places the storage column keeps. Anything more precise is rejected, never rounded away. */
  scale: number;
  /**
   * Pad results to `scale` (`"100"` → `"100.0000"`). Off by default: a wide column (scale 20) would
   * otherwise hand every caller a string of trailing zeros, and `"0.00000000000000000000" !== "0"`
   * breaks every naive comparison downstream.
   */
  pad?: boolean;
}

export interface MoneyOps {
  readonly scale: number;
  readonly zero: string;
  fits(amount: string): boolean;
  toAmount(amount: string): string | null;
  applyDelta(balance: string, amount: string): string;
  quantize(amount: string, rounding?: Decimal.Rounding): string;
}

/**
 * Money arithmetic bound to one storage scale.
 *
 * The scale is POLICY — a fiat-only ledger settles at 4 decimals, one that also holds tokens needs 18
 * or more — so it belongs to the application, not to this package. The module-level `MONEY_SCALE`
 * helpers remain as the scale-4 default for callers that never had to choose.
 */
export function createMoney({ scale, pad = false }: MoneyOptions): MoneyOps {
  if (!Number.isInteger(scale) || scale < 0 || scale > 40) {
    throw new RangeError(`Money scale must be an integer in 0..40, got ${scale}`);
  }
  const render = (d: Decimal): string => (pad ? d.toFixed(scale) : d.toFixed());
  return {
    scale,
    zero: render(new Decimal(0)),
    fits: (amount) => toDecimal(amount).decimalPlaces() <= scale,
    toAmount: (amount) => {
      const d = toDecimal(amount);
      return d.decimalPlaces() > scale ? null : render(d);
    },
    applyDelta: (balance, amount) => render(toDecimal(balance).plus(toDecimal(amount))),
    quantize: (amount, rounding = ROUND_HALF_UP) => toDecimal(amount).toFixed(scale, rounding),
  };
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

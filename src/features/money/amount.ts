// Exact money math. Amounts are bigint in the asset's smallest unit (10^decimals).
// Never use Number()/parseFloat on an amount or price, not even for display:
// floats lose digits on 18-decimal amounts and accept junk like "1e5".

export const AMOUNT_RE = /^(0|[1-9]\d*)(?:\.(\d+))?$/;

export type ParseError = "format" | "too_many_decimals";
export type ParseResult = { ok: true; value: bigint } | { ok: false; error: ParseError };

/** Parses an API-format decimal string ("0.5", "12") into minor units. */
export function parseAmount(input: string, decimals: number): ParseResult {
  const match = AMOUNT_RE.exec(input);
  if (!match) return { ok: false, error: "format" };
  const [, whole, fraction = ""] = match;
  if (fraction.length > decimals) return { ok: false, error: "too_many_decimals" };
  const value = BigInt(whole + fraction.padEnd(decimals, "0"));
  return { ok: true, value };
}

/** Like parseAmount, but throws. For API data that the schema already checked. */
export function toMinor(input: string, decimals: number): bigint {
  const result = parseAmount(input, decimals);
  if (!result.ok) throw new Error(`Invalid amount "${input}": ${result.error}`);
  return result.value;
}

/** Formats minor units back into a decimal string, exactly. */
export function formatAmount(
  value: bigint,
  decimals: number,
  opts: { trim?: boolean } = {},
): string {
  const negative = value < 0n;
  const digits = (negative ? -value : value).toString().padStart(decimals + 1, "0");
  const whole = digits.slice(0, digits.length - decimals);
  let fraction = decimals > 0 ? digits.slice(digits.length - decimals) : "";
  if (opts.trim) fraction = fraction.replace(/0+$/, "");
  return `${negative ? "-" : ""}${whole}${fraction ? `.${fraction}` : ""}`;
}

export type ClaimAmountError =
  | ParseError
  | "zero"
  | "below_min"
  | "above_available"
  | "not_above_fee";

export type ClaimRules = { decimals: number; min: bigint; fee: bigint; available: bigint };

export type ClaimAmountResult =
  | { ok: true; amount: bigint; receive: bigint }
  | { ok: false; error: ClaimAmountError };

/**
 * Checks a typed amount against the API rules. Order is fixed so the same input always
 * reports the same error: format → too_many_decimals → zero → below_min → above_available
 * → not_above_fee.
 */
export function validateClaimAmount(input: string, rules: ClaimRules): ClaimAmountResult {
  const parsed = parseAmount(input, rules.decimals);
  if (!parsed.ok) return parsed;
  const amount = parsed.value;
  if (amount === 0n) return { ok: false, error: "zero" };
  if (amount < rules.min) return { ok: false, error: "below_min" };
  if (amount > rules.available) return { ok: false, error: "above_available" };
  if (amount <= rules.fee) return { ok: false, error: "not_above_fee" };
  return { ok: true, amount, receive: amount - rules.fee };
}

type Scaled = { value: bigint; scale: number };

function parsePrice(price: string): Scaled {
  const match = AMOUNT_RE.exec(price);
  if (!match) throw new Error(`Invalid price "${price}"`);
  const fraction = match[2] ?? "";
  return { value: BigInt(match[1] + fraction), scale: fraction.length };
}

/** Exact USD value of an amount, as an integer scaled by 10^scale. */
function usdExact(amount: bigint, decimals: number, usdPrice: string): Scaled {
  const price = parsePrice(usdPrice);
  return { value: amount * price.value, scale: decimals + price.scale };
}

function toCentsDown({ value, scale }: Scaled): bigint {
  // Scale is at least 0; cents need scale 2. Integer division truncates toward zero,
  // which is "down" for the non-negative values we show.
  if (scale >= 2) return value / 10n ** BigInt(scale - 2);
  return value * 10n ** BigInt(2 - scale);
}

/** USD value in cents, rounded down so a balance never shows more than it is. */
export function usdCents(amount: bigint, decimals: number, usdPrice: string): bigint {
  return toCentsDown(usdExact(amount, decimals, usdPrice));
}

export type UsdItem = { amount: bigint; decimals: number; usdPrice: string };

/** Sums exact USD values at a common scale and rounds down once. */
export function totalUsdCents(items: UsdItem[]): bigint {
  const exact = items.map((item) => usdExact(item.amount, item.decimals, item.usdPrice));
  const scale = Math.max(2, ...exact.map((e) => e.scale));
  const sum = exact.reduce((acc, e) => acc + e.value * 10n ** BigInt(scale - e.scale), 0n);
  return toCentsDown({ value: sum, scale });
}

/** Formats cents as USD without converting to a float. */
export function formatUsd(cents: bigint, locale?: string): string {
  const negative = cents < 0n;
  const abs = negative ? -cents : cents;
  const dollars = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(abs / 100n);
  const decimalSep =
    new Intl.NumberFormat(locale).formatToParts(1.5).find((p) => p.type === "decimal")?.value ??
    ".";
  const centsPart = (abs % 100n).toString().padStart(2, "0");
  // Insert the cents right after the last digit of the integer part.
  const withCents = dollars.replace(/(\d)(?!.*\d)/, `$1${decimalSep}${centsPart}`);
  return negative ? `-${withCents}` : withCents;
}

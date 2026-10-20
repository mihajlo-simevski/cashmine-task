import {
  formatAmount,
  formatAmountShort,
  parseSignedAmount,
  formatUsd,
  parseAmount,
  totalUsdCents,
  usdCents,
  validateClaimAmount,
} from "@/features/money/amount";

describe("parseAmount", () => {
  it("parses valid decimal strings into minor units", () => {
    expect(parseAmount("0.5", 18)).toEqual({ ok: true, value: 500000000000000000n });
    expect(parseAmount("12", 6)).toEqual({ ok: true, value: 12000000n });
    expect(parseAmount("0", 8)).toEqual({ ok: true, value: 0n });
    expect(parseAmount("0.000001", 6)).toEqual({ ok: true, value: 1n });
  });

  it.each([".5", "1.", "05", "1e-3", "", " 1", "-1", "1,5", "0x10", "NaN", "Infinity", "1.2.3"])(
    "rejects %p as a format error",
    (input) => {
      expect(parseAmount(input, 6)).toEqual({ ok: false, error: "format" });
    },
  );

  it("rejects more decimals than the asset allows", () => {
    expect(parseAmount("0.1234567", 6)).toEqual({ ok: false, error: "too_many_decimals" });
  });

  it("keeps precision beyond Number.MAX_SAFE_INTEGER", () => {
    expect(parseAmount("123456789012.123456789012345678", 18)).toEqual({
      ok: true,
      value: 123456789012123456789012345678n,
    });
  });
});

describe("formatAmount", () => {
  it("formats exactly, optionally trimming trailing zeros", () => {
    expect(formatAmount(1234500n, 6)).toBe("1.234500");
    expect(formatAmount(1234500n, 6, { trim: true })).toBe("1.2345");
    expect(formatAmount(0n, 6, { trim: true })).toBe("0");
    expect(formatAmount(12000000n, 6, { trim: true })).toBe("12");
    expect(formatAmount(5n, 0)).toBe("5");
  });

  it("keeps the sign for negative values", () => {
    expect(formatAmount(-500000n, 6, { trim: true })).toBe("-0.5");
  });

  it("round-trips with parseAmount", () => {
    const value = 123456789012123456789012345678n;
    expect(formatAmount(value, 18)).toBe("123456789012.123456789012345678");
  });
});

describe("validateClaimAmount", () => {
  // ETH: 18 decimals, min 0.01, fee 0.0012, available 1.
  const rules = {
    decimals: 18,
    min: 10000000000000000n,
    fee: 1200000000000000n,
    available: 1000000000000000000n,
  };

  it("returns amount and receive = amount - fee", () => {
    const result = validateClaimAmount("0.5", rules);
    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(formatAmount(result.receive, 18, { trim: true })).toBe("0.4988");
  });

  it.each([
    ["abc", "format"],
    ["0.1234567890123456789", "too_many_decimals"],
    ["0", "zero"],
    ["0.001", "below_min"],
    ["1.5", "above_available"],
  ])("rejects %p with %p", (input, error) => {
    expect(validateClaimAmount(input, rules)).toEqual({ ok: false, error });
  });

  it("checks zero before the minimum", () => {
    expect(validateClaimAmount("0.0", rules)).toEqual({ ok: false, error: "zero" });
  });

  it("rejects an amount that leaves nothing to receive", () => {
    expect(validateClaimAmount("0.0012", { ...rules, min: 0n })).toEqual({
      ok: false,
      error: "not_above_fee",
    });
  });

  it("accepts exactly the available amount", () => {
    expect(validateClaimAmount("1", rules).ok).toBe(true);
  });
});

describe("usd math", () => {
  it("rounds each value down to cents", () => {
    expect(usdCents(820413207n, 6, "1.0002")).toBe(82057n); // 820.5772896…
    expect(usdCents(1n, 6, "0.004")).toBe(0n);
    expect(usdCents(999999n, 6, "1")).toBe(99n);
    expect(usdCents(500000000000000000n, 18, "2500.5")).toBe(125025n);
  });

  it("sums exact values and rounds the total down once", () => {
    // Two values of $0.005 each: rounding first would give $0.00, the exact sum is $0.01.
    const items = [
      { amount: 5000n, decimals: 6, usdPrice: "1" },
      { amount: 5000n, decimals: 6, usdPrice: "1" },
    ];
    expect(totalUsdCents(items)).toBe(1n);
  });

  it("throws on an invalid price instead of guessing", () => {
    expect(() => usdCents(1n, 6, "1e3")).toThrow();
  });

  it("formats cents without floats", () => {
    expect(formatUsd(82057n, "en-US")).toBe("$820.57");
    expect(formatUsd(5n, "en-US")).toBe("$0.05");
    expect(formatUsd(123456789012345678n, "en-US")).toBe("$1,234,567,890,123,456.78");
  });
});

describe("formatAmountShort", () => {
  it("cuts long fractions without rounding up and flags it", () => {
    const value = 12345678901234591676n; // 12.345678901234591676 with 18 decimals
    expect(formatAmountShort(value, 18)).toEqual({ text: "12.345678", truncated: true });
    expect(formatAmountShort(19999999n, 6, 2)).toEqual({ text: "19.99", truncated: true });
  });

  it("leaves short amounts alone", () => {
    expect(formatAmountShort(820413207n, 6)).toEqual({ text: "820.413207", truncated: false });
    expect(formatAmountShort(12000000n, 6)).toEqual({ text: "12", truncated: false });
  });

  it("drops trailing zeros after cutting", () => {
    expect(formatAmountShort(1000000000000001n, 18)).toEqual({ text: "0.001", truncated: true });
  });
});

describe("parseSignedAmount", () => {
  it("parses signed activity amounts exactly", () => {
    expect(parseSignedAmount("-0.5", 18)).toEqual({ ok: true, value: -(5n * 10n ** 17n) });
    expect(parseSignedAmount("9.81", 6)).toEqual({ ok: true, value: 9810000n });
  });

  it.each(["--1", "-", "+1", "- 1", "-.5"])("rejects %p", (input) => {
    expect(parseSignedAmount(input, 6)).toEqual({ ok: false, error: "format" });
  });
});

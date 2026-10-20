import type { Balances } from "@/features/api/schemas";
import type { LocalClaim } from "@/features/claims/local-claims";
import { applyOverlay } from "@/features/claims/overlay";

const snapshot: Balances = {
  asOf: "2026-10-20T19:00:00.000Z",
  items: [
    { asset: "ETH", decimals: 18, available: "1", pending: "0", claiming: "0", usdPrice: "2500" },
    { asset: "USDT", decimals: 6, available: "10", pending: "1", claiming: "0", usdPrice: "1" },
  ],
};

const claim = (overrides: Partial<LocalClaim>): LocalClaim => ({
  id: "clm_1",
  asset: "ETH",
  amount: "0.25",
  createdAt: "2026-10-20T19:00:05Z", // no milliseconds: compared as time, not text
  status: "pending",
  ...overrides,
});

const eth = (claims: LocalClaim[]) => applyOverlay(snapshot, claims)[0];
const ETH = 10n ** 18n;

describe("applyOverlay", () => {
  it("moves a pending claim newer than the snapshot from available to claiming once", () => {
    const b = eth([claim({})]);
    expect(b.available).toBe(ETH - ETH / 4n);
    expect(b.claiming).toBe(ETH / 4n);
    expect(b.adjustedBy).toBe(ETH / 4n);
  });

  it("ignores claims the snapshot already includes, including the exact boundary", () => {
    expect(eth([claim({ createdAt: "2026-10-20T18:59:59.999Z" })]).available).toBe(ETH);
    expect(eth([claim({ createdAt: "2026-10-20T19:00:00Z" })]).available).toBe(ETH);
  });

  it("does not count a completed claim as still being claimed", () => {
    const b = eth([claim({ status: "completed" })]);
    expect(b.available).toBe(ETH - ETH / 4n);
    expect(b.claiming).toBe(0n);
  });

  it("ignores failed claims", () => {
    const b = eth([claim({ status: "failed" })]);
    expect(b.available).toBe(ETH);
    expect(b.claiming).toBe(0n);
  });

  it("sums several claims and leaves other assets alone", () => {
    const [ethB, usdt] = applyOverlay(snapshot, [claim({}), claim({ id: "clm_2", amount: "0.5" })]);
    expect(ethB.available).toBe(ETH / 4n);
    expect(usdt.available).toBe(10_000_000n);
  });
});

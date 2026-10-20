import type { Balances } from "@/features/api/schemas";
import type { LocalClaim } from "@/features/claims/local-claims";
import { toMinor } from "@/features/money/amount";

export type AdjustedBalance = {
  asset: string;
  decimals: number;
  available: bigint;
  pending: bigint;
  claiming: bigint;
  usdPrice: string;
  /** How much of `available` this browser's recent claims removed (0n if none). */
  adjustedBy: bigint;
};

/**
 * Applies claims the snapshot doesn't include yet (created after `asOf`):
 * pending → leaves available and counts as claiming; completed → leaves available only;
 * failed → no effect. Older claims are already in the snapshot, so they're ignored.
 */
export function applyOverlay(snapshot: Balances, claims: LocalClaim[]): AdjustedBalance[] {
  const asOfMs = Date.parse(snapshot.asOf);
  return snapshot.items.map((item) => {
    let available = toMinor(item.available, item.decimals);
    let claiming = toMinor(item.claiming, item.decimals);
    let adjustedBy = 0n;
    for (const claim of claims) {
      if (claim.asset !== item.asset || Date.parse(claim.createdAt) <= asOfMs) continue;
      if (claim.status === "failed") continue;
      const amount = toMinor(claim.amount, item.decimals);
      available -= amount;
      adjustedBy += amount;
      if (claim.status === "pending") claiming += amount;
    }
    return {
      asset: item.asset,
      decimals: item.decimals,
      available: available < 0n ? 0n : available,
      pending: toMinor(item.pending, item.decimals),
      claiming,
      usdPrice: item.usdPrice,
      adjustedBy,
    };
  });
}

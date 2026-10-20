import { useQuery } from "@tanstack/react-query";
import { useEffect, useMemo } from "react";

import { BalancesSchema } from "@/features/api/schemas";
import { pruneLocalClaims, useLocalClaims } from "@/features/claims/local-claims";
import { applyOverlay } from "@/features/claims/overlay";
import { totalUsdCents } from "@/features/money/amount";
import { tokenKey } from "@/features/token/token-store";
import { api } from "@/lib/api";

export const SNAPSHOT_INTERVAL_MS = 15_000;

export const balancesKey = (token: string) => ["balances", tokenKey(token)] as const;

export function useBalances(token: string) {
  const query = useQuery({
    queryKey: balancesKey(token),
    queryFn: ({ signal }) => api(BalancesSchema, "balances", { token, signal }),
    refetchInterval: SNAPSHOT_INTERVAL_MS,
  });
  const claims = useLocalClaims(token);
  const asOf = query.data?.asOf;

  // Claims created before this snapshot are already in it.
  useEffect(() => {
    if (asOf) pruneLocalClaims(token, asOf);
  }, [token, asOf]);

  const adjusted = useMemo(
    () => (query.data ? applyOverlay(query.data, claims) : undefined),
    [query.data, claims],
  );
  const totalCents = useMemo(
    () =>
      adjusted
        ? totalUsdCents(
            adjusted.map((b) => ({
              amount: b.available + b.pending,
              decimals: b.decimals,
              usdPrice: b.usdPrice,
            })),
          )
        : undefined,
    [adjusted],
  );

  return { query, adjusted, totalCents };
}

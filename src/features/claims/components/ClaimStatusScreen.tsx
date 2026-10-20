import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Link } from "expo-router";
import CircleCheck from "lucide-react-native/icons/circle-check";
import CircleX from "lucide-react-native/icons/circle-x";
import Loader from "lucide-react-native/icons/loader";
import ShieldCheck from "lucide-react-native/icons/shield-check";
import Head from "expo-router/head";
import { useEffect } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import ErrorState from "@/components/layout/ErrorState";
import AppHeader from "@/components/layout/AppHeader";
import Screen from "@/components/layout/Screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ClaimSchema } from "@/features/api/schemas";
import { balancesKey } from "@/features/balances/useBalances";
import { upsertLocalClaim } from "@/features/claims/local-claims";
import { tokenKey } from "@/features/token/token-store";
import { api } from "@/lib/api";

export const CLAIM_POLL_MS = 2000;

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-2">
      <Text variant="muted">{label}</Text>
      <Text className="min-w-0 flex-1 text-right" selectable>
        {value}
      </Text>
    </View>
  );
}

type Props = { token: string; id: string; replayed?: boolean };

export default function ClaimStatusScreen({ token, id, replayed }: Props) {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const query = useQuery({
    queryKey: ["claim", tokenKey(token), id],
    queryFn: ({ signal }) =>
      api(ClaimSchema, `claims/${encodeURIComponent(id)}`, { token, signal }),
    // Keep polling until the claim settles.
    refetchInterval: (q) =>
      q.state.data && q.state.data.status !== "pending" ? false : CLAIM_POLL_MS,
  });
  const claim = query.data;

  useEffect(() => {
    if (!claim) return;
    upsertLocalClaim(token, {
      id: claim.id,
      asset: claim.asset,
      amount: claim.amount,
      createdAt: claim.createdAt,
      status: claim.status,
    });
    if (claim.status !== "pending") {
      void queryClient.invalidateQueries({ queryKey: balancesKey(token) });
    }
  }, [claim, queryClient, token]);

  return (
    <Screen>
      <Head>
        <title>{t("status.title")}</title>
      </Head>
      <AppHeader title={t("status.title")} />
      {replayed ? (
        <View className="flex-row items-center gap-2 rounded-xl border border-success bg-card px-3 py-2.5">
          <Icon as={ShieldCheck} className="size-4 text-success" />
          <Text className="min-w-0 flex-1 text-sm font-medium text-success">
            {t("status.replayed")}
          </Text>
        </View>
      ) : null}

      {query.isPending ? (
        <Skeleton className="h-56 w-full" />
      ) : !claim ? (
        <ErrorState
          title={t("status.loadError")}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="gap-4 pt-6">
            <View className="flex-row items-center gap-3">
              <View
                className={
                  claim.status === "completed"
                    ? "size-11 items-center justify-center rounded-full bg-success"
                    : claim.status === "failed"
                      ? "size-11 items-center justify-center rounded-full bg-destructive"
                      : "size-11 items-center justify-center rounded-full bg-accent"
                }
              >
                <Icon
                  as={
                    claim.status === "completed"
                      ? CircleCheck
                      : claim.status === "failed"
                        ? CircleX
                        : Loader
                  }
                  className={
                    claim.status === "pending"
                      ? "size-5 text-accent-foreground"
                      : "size-5 text-success-foreground"
                  }
                />
              </View>
              <View className="min-w-0 flex-1 gap-1">
                <Badge
                  className={
                    claim.status === "completed"
                      ? "self-start border-transparent bg-success"
                      : claim.status === "failed"
                        ? "self-start"
                        : "self-start border-transparent bg-accent"
                  }
                  variant={claim.status === "failed" ? "destructive" : "default"}
                >
                  <Text
                    className={
                      claim.status === "completed"
                        ? "text-success-foreground"
                        : claim.status === "pending"
                          ? "text-accent-foreground"
                          : undefined
                    }
                  >
                    {t(`status.${claim.status}`)}
                  </Text>
                </Badge>
                <Text variant="muted" className="text-sm">
                  {claim.status === "pending"
                    ? t("status.pendingHint")
                    : claim.status === "completed"
                      ? t("status.completedHint", {
                          amount: claim.receiveAmount,
                          asset: claim.asset,
                        })
                      : t("status.failedHint", { amount: claim.amount, asset: claim.asset })}
                </Text>
              </View>
            </View>
            <View className="gap-2.5 rounded-xl bg-muted p-3.5">
              <Row label={t("status.amount")} value={`${claim.amount} ${claim.asset}`} />
              <Row label={t("claim.fee")} value={`${claim.fee} ${claim.asset}`} />
              <View className="h-px bg-border" />
              <View className="flex-row items-baseline justify-between gap-2">
                <Text variant="muted">{t("claim.receive")}</Text>
                <Text className="min-w-0 flex-1 text-right text-xl font-bold" selectable>
                  {claim.receiveAmount} {claim.asset}
                </Text>
              </View>
            </View>
            {claim.failureReason ? (
              <Row label={t("status.reason")} value={claim.failureReason} />
            ) : null}
          </CardContent>
        </Card>
      )}

      <Link href="/" asChild>
        <Button variant="outline" size="lg">
          <Text>{t("status.done")}</Text>
        </Button>
      </Link>
    </Screen>
  );
}

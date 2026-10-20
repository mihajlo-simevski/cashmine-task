import { Link } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import ErrorState from "@/components/layout/ErrorState";
import AppHeader from "@/components/layout/AppHeader";
import Screen from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import BalanceCard from "@/features/balances/components/BalanceCard";
import { useBalances } from "@/features/balances/useBalances";
import PendingClaimBanner from "@/features/claims/components/PendingClaimBanner";
import { formatUsd } from "@/features/money/amount";

const STALE_AFTER_MS = 60_000;

function useNow(intervalMs: number): number {
  const [now, setNow] = useState(0);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

function Freshness({ asOf, now }: { asOf: string; now: number }) {
  const { t } = useTranslation();
  const asOfMs = Date.parse(asOf);
  const ageS = Math.max(0, Math.round((now - asOfMs) / 1000));
  const age =
    ageS < 60
      ? t("home.secondsAgo", { count: ageS })
      : t("home.minutesAgo", { count: Math.floor(ageS / 60) });
  const stale = now - asOfMs > STALE_AFTER_MS;
  return (
    <View>
      <Text variant="small" className="text-muted-foreground">
        {t("home.updatedAt", { time: new Date(asOfMs).toLocaleTimeString(), age })}
      </Text>
      {stale ? <Text className="text-destructive text-sm">{t("home.stale")}</Text> : null}
    </View>
  );
}

export default function HomeScreen({ token }: { token: string }) {
  const { t } = useTranslation();
  const { query, adjusted, totalCents } = useBalances(token);
  // A ticking clock, so data that stops refreshing (e.g. the API is down) shows its real age.
  const now = Math.max(useNow(5000), query.dataUpdatedAt);

  return (
    <Screen>
      <Head>
        <title>{t("home.title")}</title>
      </Head>
      <AppHeader
        title={t("home.title")}
        right={
          <Link href="/token" asChild>
            <Button size="sm" variant="ghost">
              <Text>{t("token.change")}</Text>
            </Button>
          </Link>
        }
      />

      <PendingClaimBanner token={token} />

      {query.isPending ? (
        <View className="gap-4" accessibilityLabel={t("common.loading")}>
          <Skeleton className="h-28 w-full" />
          <Skeleton className="h-36 w-full" />
          <Skeleton className="h-36 w-full" />
        </View>
      ) : query.isError && !query.data ? (
        <ErrorState
          title={t("home.loadError")}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : adjusted && totalCents !== undefined && query.data ? (
        <>
          <Card className="rounded-2xl">
            <CardContent className="gap-1 pt-6">
              <Text variant="muted">{t("home.total")}</Text>
              <Text className="text-4xl font-bold tracking-tight">{formatUsd(totalCents)}</Text>
              <Text variant="small" className="text-muted-foreground">
                {t("home.totalHint")}
              </Text>
              <View className="mb-1.5 mt-2.5 h-px bg-muted" />
              <View className="flex-row items-center justify-between gap-2">
                <View className="min-w-0 flex-1 flex-row items-center gap-1.5">
                  <View className="size-2 rounded-full bg-primary" />
                  <View className="min-w-0 flex-1">
                    <Freshness asOf={query.data.asOf} now={now} />
                  </View>
                </View>
                <Button
                  size="sm"
                  variant="secondary"
                  className="rounded-full"
                  disabled={query.isFetching}
                  onPress={() => void query.refetch()}
                >
                  <Text>{query.isFetching ? t("home.refreshing") : t("home.refresh")}</Text>
                </Button>
              </View>
            </CardContent>
          </Card>

          {query.isError ? (
            <ErrorState
              title={t("home.loadError")}
              error={query.error}
              onRetry={() => void query.refetch()}
            />
          ) : null}

          {adjusted.length === 0 ? <Text variant="muted">{t("home.empty")}</Text> : null}
          {adjusted.map((balance) => (
            <BalanceCard key={balance.asset} balance={balance} />
          ))}
        </>
      ) : null}
    </Screen>
  );
}

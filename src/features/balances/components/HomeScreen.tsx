import { Link } from "expo-router";
import Head from "expo-router/head";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import ErrorState from "@/components/layout/ErrorState";
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
  // Re-rendered on every refetch, so the age is current whenever new data arrives.
  const now = query.dataUpdatedAt;

  return (
    <Screen>
      <Head>
        <title>{t("home.title")}</title>
      </Head>
      <View className="flex-row items-center justify-between">
        <Text variant="h3">{t("home.title")}</Text>
        <Link href="/token" asChild>
          <Button size="sm" variant="ghost">
            <Text>{t("token.change")}</Text>
          </Button>
        </Link>
      </View>

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
          <Card>
            <CardContent className="gap-1 pt-6">
              <Text variant="muted">{t("home.total")}</Text>
              <Text variant="h2" className="border-0 pb-0">
                {formatUsd(totalCents)}
              </Text>
              <Text variant="small" className="text-muted-foreground">
                {t("home.totalHint")}
              </Text>
            </CardContent>
          </Card>

          <View className="flex-row items-center justify-between gap-2">
            <View className="min-w-0 flex-1">
              <Freshness asOf={query.data.asOf} now={now} />
            </View>
            <Button
              size="sm"
              variant="outline"
              disabled={query.isFetching}
              onPress={() => void query.refetch()}
            >
              <Text>{query.isFetching ? t("home.refreshing") : t("home.refresh")}</Text>
            </Button>
          </View>

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

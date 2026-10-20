import { useInfiniteQuery } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import Head from "expo-router/head";
import { useTranslation } from "react-i18next";
import { Pressable, View } from "react-native";

import AppHeader from "@/components/layout/AppHeader";
import ErrorState from "@/components/layout/ErrorState";
import Screen from "@/components/layout/Screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { type ActivityItem, ActivityPageSchema } from "@/features/api/schemas";
import { nextActivityCursor } from "@/features/activity/paging";
import { useBalances } from "@/features/balances/useBalances";
import { parseSignedAmount } from "@/features/money/amount";
import Amount from "@/features/money/components/Amount";
import { tokenKey } from "@/features/token/token-store";
import { api } from "@/lib/api";

const PAGE_SIZE = 20;
const KNOWN_TYPES = new Set(["accrual", "reversal", "claim"]);
const KNOWN_STATUSES = new Set(["pending", "confirmed", "completed", "failed"]);

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

function Row({ item, decimals }: { item: ActivityItem; decimals?: number }) {
  const { t } = useTranslation();
  const parsed = decimals === undefined ? undefined : parseSignedAmount(item.amount, decimals);
  const type = KNOWN_TYPES.has(item.type)
    ? t(`activity.types.${item.type as "accrual" | "reversal" | "claim"}`)
    : item.type;
  const status = KNOWN_STATUSES.has(item.status)
    ? t(`activity.statuses.${item.status as "pending" | "confirmed" | "completed" | "failed"}`)
    : item.status;
  const positive = !item.amount.startsWith("-");

  const content = (
    <View className="flex-row items-start justify-between gap-3 py-3">
      <View className="min-w-0 flex-1 gap-0.5">
        <Text className="font-semibold">{type}</Text>
        <Text className="text-muted-foreground text-xs">
          {[item.exchange, new Date(Date.parse(item.createdAt)).toLocaleString()]
            .filter(Boolean)
            .join(" · ")}
        </Text>
      </View>
      <View className="items-end gap-1">
        {parsed?.ok && decimals !== undefined ? (
          <Amount
            value={parsed.value}
            decimals={decimals}
            suffix={item.asset}
            className={positive ? "font-semibold text-success" : "font-semibold"}
          />
        ) : (
          <Text className="font-semibold">
            {item.amount} {item.asset}
          </Text>
        )}
        <Badge
          variant={item.status === "failed" ? "destructive" : "secondary"}
          className="self-end"
        >
          <Text>{status}</Text>
        </Badge>
      </View>
    </View>
  );

  if (item.type === "claim" && item.relatedId) {
    return (
      <Link href={{ pathname: "/claims/[id]", params: { id: item.relatedId } }} asChild>
        <Pressable accessibilityRole="link" accessibilityHint={t("activity.viewClaim")}>
          {content}
        </Pressable>
      </Link>
    );
  }
  return content;
}

export default function ActivityScreen({ token }: { token: string }) {
  const { t } = useTranslation();
  const { adjusted } = useBalances(token);
  const decimalsFor = (asset: string) => adjusted?.find((b) => b.asset === asset)?.decimals;

  const query = useInfiniteQuery({
    queryKey: ["activity", tokenKey(token)],
    initialPageParam: null as string | null,
    queryFn: ({ pageParam, signal }) =>
      api(
        ActivityPageSchema,
        `activity?limit=${PAGE_SIZE}${pageParam ? `&cursor=${encodeURIComponent(pageParam)}` : ""}`,
        { token, signal },
      ),
    getNextPageParam: (page, _all, lastCursor) => nextActivityCursor(page, lastCursor),
  });

  const items = query.data?.pages.flatMap((p) => p.items) ?? [];

  return (
    <Screen>
      <Head>
        <title>{t("activity.title")}</title>
      </Head>
      <AppHeader
        title={t("activity.title")}
        right={
          <Button size="sm" variant="ghost" onPress={goBack}>
            <Text className="text-accent-foreground">{t("common.back")}</Text>
          </Button>
        }
      />

      {query.isPending ? (
        <View className="gap-3" accessibilityLabel={t("common.loading")}>
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
          <Skeleton className="h-16 w-full" />
        </View>
      ) : query.isError && items.length === 0 ? (
        <ErrorState
          title={t("activity.loadError")}
          error={query.error}
          onRetry={() => void query.refetch()}
        />
      ) : items.length === 0 ? (
        <Text variant="muted">{t("activity.empty")}</Text>
      ) : (
        <Card className="rounded-2xl">
          <CardContent className="pt-2">
            {items.map((item, index) => (
              <View key={item.id} className={index > 0 ? "border-t border-border" : undefined}>
                <Row item={item} decimals={decimalsFor(item.asset)} />
              </View>
            ))}
          </CardContent>
        </Card>
      )}

      {query.isFetchNextPageError ? (
        <ErrorState
          title={t("activity.loadError")}
          error={query.error}
          onRetry={() => void query.fetchNextPage()}
        />
      ) : null}

      {query.hasNextPage ? (
        <Button
          variant="outline"
          disabled={query.isFetchingNextPage}
          onPress={() => void query.fetchNextPage()}
        >
          <Text>
            {query.isFetchingNextPage ? t("activity.loadingMore") : t("activity.loadMore")}
          </Text>
        </Button>
      ) : null}
    </Screen>
  );
}

import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import type { AdjustedBalance } from "@/features/claims/overlay";
import { formatAmount, formatUsd, usdCents } from "@/features/money/amount";

function Tile({ label, value }: { label: string; value: string }) {
  return (
    <View className="min-w-0 flex-1 rounded-xl bg-muted px-3 py-2.5">
      <Text className="text-muted-foreground text-xs font-medium">{label}</Text>
      <Text className="text-sm font-semibold" selectable>
        {value}
      </Text>
    </View>
  );
}

export default function BalanceCard({ balance }: { balance: AdjustedBalance }) {
  const { t } = useTranslation();
  const { asset, decimals } = balance;
  const fmt = (v: bigint) => formatAmount(v, decimals, { trim: true });

  return (
    <Card className="rounded-2xl">
      <CardContent className="gap-3 pt-6">
        <View className="flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1">
            <Text className="text-muted-foreground text-sm font-semibold">
              {asset} · {t("home.available")}
            </Text>
            <Text className="text-2xl font-bold tracking-tight" selectable>
              {fmt(balance.available)}
            </Text>
            <Text variant="small" className="text-muted-foreground">
              {t("home.usdValue", {
                value: formatUsd(usdCents(balance.available, decimals, balance.usdPrice)),
              })}
            </Text>
          </View>
          <Link href={{ pathname: "/claim", params: { asset } }} asChild>
            <Button className="rounded-full px-5" disabled={balance.available === 0n}>
              <Text>{t("home.claim")}</Text>
            </Button>
          </Link>
        </View>
        <View className="flex-row gap-2">
          <Tile label={t("home.pending")} value={fmt(balance.pending)} />
          <Tile label={t("home.claiming")} value={fmt(balance.claiming)} />
        </View>
        {balance.adjustedBy > 0n ? (
          <View className="rounded-xl bg-accent px-3 py-2.5">
            <Text className="text-accent-foreground text-xs">
              {t("home.adjusted", { amount: fmt(balance.adjustedBy), asset })}
            </Text>
          </View>
        ) : null}
      </CardContent>
    </Card>
  );
}

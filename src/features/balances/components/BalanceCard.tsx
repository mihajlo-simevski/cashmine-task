import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Text } from "@/components/ui/text";
import type { AdjustedBalance } from "@/features/claims/overlay";
import { formatAmount, formatUsd, usdCents } from "@/features/money/amount";

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View className="flex-row justify-between gap-2">
      <Text variant="muted" className="text-sm">
        {label}
      </Text>
      <Text className="min-w-0 flex-1 text-right text-sm" selectable>
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
    <Card>
      <CardContent className="gap-3 pt-6">
        <View className="flex-row items-start justify-between gap-2">
          <View className="min-w-0 flex-1">
            <Text variant="large">{asset}</Text>
            <Text variant="muted" className="text-sm">
              {t("home.available")}
            </Text>
            <Text variant="h4" selectable>
              {fmt(balance.available)} {asset}
            </Text>
            <Text variant="small" className="text-muted-foreground">
              {t("home.usdValue", {
                value: formatUsd(usdCents(balance.available, decimals, balance.usdPrice)),
              })}
            </Text>
          </View>
          <Link href={{ pathname: "/claim", params: { asset } }} asChild>
            <Button size="sm" disabled={balance.available === 0n}>
              <Text>{t("home.claim")}</Text>
            </Button>
          </Link>
        </View>
        <Row label={t("home.pending")} value={`${fmt(balance.pending)} ${asset}`} />
        <Row label={t("home.claiming")} value={`${fmt(balance.claiming)} ${asset}`} />
        {balance.adjustedBy > 0n ? (
          <Text variant="small" className="text-muted-foreground">
            {t("home.adjusted", { amount: fmt(balance.adjustedBy), asset })}
          </Text>
        ) : null}
      </CardContent>
    </Card>
  );
}

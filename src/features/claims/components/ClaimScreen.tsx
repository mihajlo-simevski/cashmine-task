import { useQuery } from "@tanstack/react-query";
import { Link, router } from "expo-router";
import Head from "expo-router/head";
import { useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import ErrorState, { useErrorMessage } from "@/components/layout/ErrorState";
import AppHeader from "@/components/layout/AppHeader";
import Screen from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { ClaimOptionsSchema } from "@/features/api/schemas";
import { useBalances } from "@/features/balances/useBalances";
import { usePendingSubmission } from "@/features/claims/submission";
import { useSubmitClaim } from "@/features/claims/useSubmitClaim";
import {
  type ClaimAmountError,
  formatAmount,
  toMinor,
  validateClaimAmount,
} from "@/features/money/amount";
import { tokenKey } from "@/features/token/token-store";
import { api } from "@/lib/api";

function Row({ label, value, strong }: { label: string; value: string; strong?: boolean }) {
  return (
    <View className="flex-row justify-between gap-2">
      <Text variant="muted">{label}</Text>
      <Text
        className={strong ? "min-w-0 flex-1 text-right font-semibold" : "min-w-0 flex-1 text-right"}
      >
        {value}
      </Text>
    </View>
  );
}

function goBack() {
  if (router.canGoBack()) router.back();
  else router.replace("/");
}

export default function ClaimScreen({
  token,
  initialAsset,
}: {
  token: string;
  initialAsset?: string;
}) {
  const { t } = useTranslation();
  const errorMessage = useErrorMessage();
  const pending = usePendingSubmission(token);
  const { phase, confirm, resume, reset } = useSubmitClaim(token);
  const { query: balancesQuery, adjusted } = useBalances(token);

  const [asset, setAsset] = useState(initialAsset);
  const [amount, setAmount] = useState("");
  const [destinationId, setDestinationId] = useState<string>();
  const [step, setStep] = useState<"form" | "confirm">("form");
  const [touched, setTouched] = useState(false);

  const selectedAsset = asset ?? adjusted?.[0]?.asset;
  const balance = adjusted?.find((b) => b.asset === selectedAsset);

  const options = useQuery({
    queryKey: ["claim-options", tokenKey(token), selectedAsset],
    queryFn: ({ signal }) =>
      api(ClaimOptionsSchema, `claim-options?asset=${encodeURIComponent(selectedAsset ?? "")}`, {
        token,
        signal,
      }),
    enabled: !!selectedAsset && !pending,
  });

  const destinations = options.data?.destinations ?? [];
  const destination = destinations.find((d) => d.id === destinationId) ?? destinations[0];

  const rules = useMemo(() => {
    if (!balance || !options.data || options.data.asset !== balance.asset) return undefined;
    return {
      decimals: balance.decimals,
      min: toMinor(options.data.minAmount, balance.decimals),
      fee: toMinor(options.data.fee, balance.decimals),
      available: balance.available,
    };
  }, [balance, options.data]);

  const result = rules ? validateClaimAmount(amount, rules) : undefined;

  // Resume a saved claim once when the screen opens (e.g. after a reload).
  const resumed = useRef(false);
  useEffect(() => {
    if (pending && !resumed.current) {
      resumed.current = true;
      void resume();
    }
  }, [pending, resume]);

  const validationText = (error: ClaimAmountError) => {
    if (!balance || !rules) return "";
    const fmt = (v: bigint) => formatAmount(v, balance.decimals, { trim: true });
    return t(`claim.validation.${error}`, {
      asset: balance.asset,
      decimals: balance.decimals,
      min: fmt(rules.min),
      available: fmt(rules.available),
      fee: fmt(rules.fee),
    });
  };

  const header = (
    <>
      <Head>
        <title>{t("claim.title")}</title>
      </Head>
      <AppHeader
        title={t("claim.title")}
        right={
          <Button size="sm" variant="ghost" onPress={goBack}>
            <Text className="text-accent-foreground">{t("common.back")}</Text>
          </Button>
        }
      />
    </>
  );

  // A saved claim takes over the screen until a response settles it.
  if (pending) {
    const paused = phase.kind === "paused" ? phase.error : undefined;
    return (
      <Screen>
        {header}
        <Card className="rounded-2xl">
          <CardContent className="gap-3 pt-6">
            <Text variant="large">
              {paused?.status === 409 ? t("claim.conflictTitle") : t("claim.unknownTitle")}
            </Text>
            <Text variant="muted">
              {t("claim.unknownBody", { amount: pending.body.amount, asset: pending.body.asset })}
            </Text>
            {paused ? (
              <Text className="text-destructive text-sm">
                {paused.status === 401 ? t("claim.unauthorizedPaused") : errorMessage(paused)}
              </Text>
            ) : null}
            {paused?.status === 401 ? (
              <Link href="/token" asChild>
                <Button>
                  <Text>{t("token.change")}</Text>
                </Button>
              </Link>
            ) : (
              <Button disabled={phase.kind === "submitting"} onPress={() => void resume()}>
                <Text>
                  {phase.kind === "submitting" ? t("claim.checking") : t("claim.checkAgain")}
                </Text>
              </Button>
            )}
          </CardContent>
        </Card>
      </Screen>
    );
  }

  if (balancesQuery.isPending) {
    return (
      <Screen>
        {header}
        <Skeleton className="h-64 w-full" />
      </Screen>
    );
  }

  if (!adjusted || !balance || !selectedAsset) {
    return (
      <Screen>
        {header}
        <ErrorState
          title={t("home.loadError")}
          error={balancesQuery.error}
          onRetry={() => void balancesQuery.refetch()}
        />
      </Screen>
    );
  }

  const fmt = (v: bigint) => formatAmount(v, balance.decimals, { trim: true });
  const phaseError =
    phase.kind === "rejected"
      ? errorMessage(phase.error)
      : phase.kind === "blocked"
        ? t("claim.blockedByPending")
        : phase.kind === "storage"
          ? t("claim.storageRequired")
          : null;

  return (
    <Screen>
      {header}

      <View className="gap-2">
        <Label>{t("claim.asset")}</Label>
        <View className="flex-row flex-wrap gap-2">
          {adjusted.map((b) => (
            <Button
              key={b.asset}
              size="sm"
              className="rounded-full px-4"
              variant={b.asset === selectedAsset ? "default" : "outline"}
              disabled={step === "confirm"}
              onPress={() => {
                setAsset(b.asset);
                setAmount("");
                setTouched(false);
                setDestinationId(undefined);
                reset();
              }}
            >
              <Text>{b.asset}</Text>
            </Button>
          ))}
        </View>
      </View>

      {options.isPending ? (
        <Skeleton className="h-48 w-full" />
      ) : options.isError ? (
        <ErrorState
          title={t("claim.optionsError", { asset: selectedAsset })}
          error={options.error}
          onRetry={() => void options.refetch()}
        />
      ) : destinations.length === 0 ? (
        <Text variant="muted">{t("claim.noDestinations", { asset: selectedAsset })}</Text>
      ) : balance.available === 0n ? (
        <Text variant="muted">{t("claim.nothingAvailable", { asset: selectedAsset })}</Text>
      ) : rules && step === "form" ? (
        <Card className="rounded-2xl">
          <CardContent className="gap-3 pt-6">
            <Label nativeID="amount-label">{t("claim.amount")}</Label>
            <View className="flex-row gap-2">
              <Input
                aria-labelledby="amount-label"
                className="flex-1"
                value={amount}
                onChangeText={(text) => {
                  setAmount(text.trim());
                  setTouched(true);
                  reset();
                }}
                inputMode="decimal"
                placeholder="0.0"
                autoCorrect={false}
              />
              <Button
                variant="outline"
                onPress={() => {
                  setAmount(formatAmount(rules.available, balance.decimals, { trim: true }));
                  setTouched(true);
                }}
              >
                <Text>{t("claim.max")}</Text>
              </Button>
            </View>
            <Text variant="small" className="text-muted-foreground">
              {t("claim.availableHint", { amount: fmt(rules.available), asset: balance.asset })} ·{" "}
              {t("claim.minHint", { amount: fmt(rules.min), asset: balance.asset })}
            </Text>
            {touched && result && !result.ok ? (
              <Text className="text-destructive text-sm">{validationText(result.error)}</Text>
            ) : null}

            {destinations.length > 1 ? (
              <View className="gap-2">
                <Label>{t("claim.destination")}</Label>
                {destinations.map((d) => (
                  <Button
                    key={d.id}
                    size="sm"
                    variant={d.id === destination?.id ? "default" : "outline"}
                    onPress={() => setDestinationId(d.id)}
                  >
                    <Text>{d.label}</Text>
                  </Button>
                ))}
              </View>
            ) : null}

            <View className="gap-2 rounded-xl bg-muted p-3.5">
              <Row label={t("claim.fee")} value={`${fmt(rules.fee)} ${balance.asset}`} />
              <Row
                label={t("claim.receive")}
                value={result?.ok ? `${fmt(result.receive)} ${balance.asset}` : "—"}
                strong
              />
            </View>
            <Button
              size="lg"
              disabled={!result?.ok || !destination}
              onPress={() => setStep("confirm")}
            >
              <Text>{t("claim.continue")}</Text>
            </Button>
          </CardContent>
        </Card>
      ) : rules && result?.ok && destination ? (
        <Card className="rounded-2xl">
          <CardContent className="gap-3 pt-6">
            <Text variant="large">{t("claim.confirmTitle")}</Text>
            <Row label={t("claim.amount")} value={`${fmt(result.amount)} ${balance.asset}`} />
            <Row label={t("claim.fee")} value={`${fmt(rules.fee)} ${balance.asset}`} />
            <Row
              label={t("claim.receive")}
              value={`${fmt(result.receive)} ${balance.asset}`}
              strong
            />
            <Row label={t("claim.destination")} value={destination.label} />
            <Button
              size="lg"
              disabled={phase.kind === "submitting"}
              onPress={() => {
                // Re-check against the latest balance and options at the moment of confirming.
                const fresh = validateClaimAmount(amount, rules);
                if (!fresh.ok) {
                  setStep("form");
                  return;
                }
                void confirm({
                  asset: balance.asset,
                  amount: formatAmount(fresh.amount, balance.decimals, { trim: true }),
                  destinationId: destination.id,
                });
              }}
            >
              <Text>
                {phase.kind === "submitting" ? t("claim.submitting") : t("claim.confirm")}
              </Text>
            </Button>
            <Button
              variant="ghost"
              disabled={phase.kind === "submitting"}
              onPress={() => setStep("form")}
            >
              <Text>{t("claim.edit")}</Text>
            </Button>
          </CardContent>
        </Card>
      ) : null}

      {phaseError ? <Text className="text-destructive text-sm">{phaseError}</Text> : null}
    </Screen>
  );
}

import { useQueryClient } from "@tanstack/react-query";
import { router } from "expo-router";
import Head from "expo-router/head";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import AppHeader from "@/components/layout/AppHeader";
import Screen from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Text } from "@/components/ui/text";
import { getToken, maskToken, setToken, useToken } from "@/features/token/token-store";
import { storage } from "@/lib/storage";

export default function TokenScreen() {
  const { t } = useTranslation();
  const queryClient = useQueryClient();
  const token = useToken();
  const [value, setValue] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [storageBlocked, setStorageBlocked] = useState(false);

  const save = () => {
    const trimmed = value.trim();
    if (!trimmed) {
      setError(t("token.required"));
      return;
    }
    const changed = trimmed !== getToken();
    setToken(trimmed);
    if (changed) queryClient.clear();
    if (!storage.get("cashmine.token")) {
      setStorageBlocked(true);
      return;
    }
    router.replace("/");
  };

  return (
    <Screen>
      <Head>
        <title>{t("token.title")}</title>
      </Head>
      <AppHeader title={t("token.title")} />
      <Text variant="muted">{t("token.description")}</Text>
      {token ? (
        <Text variant="small" className="text-muted-foreground">
          {t("token.current", { masked: maskToken(token) })}
        </Text>
      ) : null}
      <View className="gap-2">
        <Label nativeID="token-label">{t("token.label")}</Label>
        <Input
          aria-labelledby="token-label"
          value={value}
          onChangeText={(text) => {
            setValue(text);
            setError(null);
          }}
          placeholder={t("token.placeholder")}
          autoCapitalize="none"
          autoCorrect={false}
          autoComplete="off"
          secureTextEntry
          onSubmitEditing={save}
        />
        {error ? <Text className="text-destructive text-sm">{error}</Text> : null}
      </View>
      {storageBlocked ? (
        <Text variant="small" className="text-muted-foreground">
          {t("token.storageWarning")}
        </Text>
      ) : null}
      <Button size="lg" onPress={storageBlocked ? () => router.replace("/") : save}>
        <Text>{storageBlocked ? t("common.goHome") : t("token.save")}</Text>
      </Button>
      {token && !storageBlocked ? (
        <Button variant="ghost" onPress={() => router.replace("/")}>
          <Text>{t("common.cancel")}</Text>
        </Button>
      ) : null}
    </Screen>
  );
}

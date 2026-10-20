import "@/global.css";
import "@/i18n";

import { PortalHost } from "@rn-primitives/portal";
import { QueryClientProvider } from "@tanstack/react-query";
import { Stack, ThemeProvider } from "expo-router";
import Head from "expo-router/head";
import { StatusBar } from "expo-status-bar";
import { useTranslation } from "react-i18next";

import { queryClient } from "@/lib/query-client";
import { NAV_THEME } from "@/lib/theme";

export default function RootLayout() {
  const { t } = useTranslation();

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider value={NAV_THEME}>
        <StatusBar style="auto" />
        {/* Default page title. Screens can set their own with <Head>. */}
        <Head>
          <title>{t("common.appName")}</title>
        </Head>
        <Stack screenOptions={{ headerShown: false }} />
        <PortalHost />
      </ThemeProvider>
    </QueryClientProvider>
  );
}

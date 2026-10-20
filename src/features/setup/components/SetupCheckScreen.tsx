import { useQuery } from "@tanstack/react-query";
import RefreshCw from "lucide-react-native/icons/refresh-cw";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { z } from "zod";

import Screen from "@/components/layout/Screen";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Icon } from "@/components/ui/icon";
import { Skeleton } from "@/components/ui/skeleton";
import { Text } from "@/components/ui/text";
import { request } from "@/lib/api";

// Temporary screen that proves styling, the server API route and the proxy env
// vars all work. Replace it with the brief's first screen.

const HealthSchema = z.object({
  ok: z.boolean(),
  proxyConfigured: z.boolean(),
  time: z.string(),
});

type Status = "ok" | "missing" | "failed" | "pending";

const BADGE_VARIANT = {
  ok: "default",
  missing: "secondary",
  failed: "destructive",
} as const;

function StatusRow({ label, status }: { label: string; status: Status }) {
  const { t } = useTranslation();

  return (
    <View className="min-h-8 flex-row items-center justify-between gap-3">
      <Text className="min-w-0 flex-1">{label}</Text>
      {status === "pending" ? (
        // Same footprint as the badge, so nothing shifts when it resolves.
        <Skeleton className="h-6 w-16 rounded-full" />
      ) : (
        <Badge variant={BADGE_VARIANT[status]}>
          <Text>{t(`setup.${status}`)}</Text>
        </Badge>
      )}
    </View>
  );
}

export default function SetupCheckScreen() {
  const { t } = useTranslation();
  const health = useQuery({
    queryKey: ["health"],
    queryFn: () => request(HealthSchema, "/api/health"),
  });

  const apiStatus: Status = health.isPending ? "pending" : health.isError ? "failed" : "ok";
  const proxyStatus: Status = health.isPending
    ? "pending"
    : health.data?.proxyConfigured
      ? "ok"
      : "missing";

  return (
    <Screen className="justify-center">
      <Card>
        <CardHeader>
          <CardTitle>{t("setup.title")}</CardTitle>
          <CardDescription>{t("setup.description")}</CardDescription>
        </CardHeader>
        <CardContent className="gap-2">
          <StatusRow label={t("setup.styling")} status="ok" />
          <StatusRow label={t("setup.apiRoute")} status={apiStatus} />
          <StatusRow label={t("setup.proxy")} status={proxyStatus} />
        </CardContent>
        <CardFooter>
          <Button
            variant="outline"
            className="w-full"
            disabled={health.isFetching}
            onPress={() => health.refetch()}
          >
            <Icon as={RefreshCw} />
            <Text>{t("setup.recheck")}</Text>
          </Button>
        </CardFooter>
      </Card>
    </Screen>
  );
}

import AlertCircle from "lucide-react-native/icons/circle-alert";
import { Link } from "expo-router";
import { useTranslation } from "react-i18next";
import { View } from "react-native";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { ApiError } from "@/lib/api";

type ErrorStateProps = { title: string; error: unknown; onRetry?: () => void };

/** Our own message per error code; the API's message is never shown as markup. */
export function useErrorMessage() {
  const { t } = useTranslation();
  return (error: unknown) => {
    if (!(error instanceof ApiError)) return t("errors.UNKNOWN");
    if (error.code === "VALIDATION")
      return t("errors.VALIDATION", { message: error.details.apiMessage ?? "" });
    return t(`errors.${error.code}`);
  };
}

export default function ErrorState({ title, error, onRetry }: ErrorStateProps) {
  const { t } = useTranslation();
  const message = useErrorMessage()(error);
  const unauthorized = error instanceof ApiError && error.code === "UNAUTHORIZED";

  return (
    <Alert icon={AlertCircle} variant="destructive">
      <AlertTitle>{title}</AlertTitle>
      <AlertDescription>{message}</AlertDescription>
      <View className="mt-3 flex-row gap-2">
        {unauthorized ? (
          <Link href="/token" asChild>
            <Button size="sm">
              <Text>{t("token.change")}</Text>
            </Button>
          </Link>
        ) : onRetry ? (
          <Button size="sm" variant="outline" onPress={onRetry}>
            <Text>{t("common.retry")}</Text>
          </Button>
        ) : null}
      </View>
    </Alert>
  );
}

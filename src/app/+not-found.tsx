import { Link } from "expo-router";
import { useTranslation } from "react-i18next";

import Screen from "@/components/layout/Screen";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";

export default function NotFoundScreen() {
  const { t } = useTranslation();

  return (
    <Screen className="items-center justify-center">
      <Text variant="muted">{t("common.notFound")}</Text>
      <Link href="/" asChild>
        <Button>
          <Text>{t("common.goHome")}</Text>
        </Button>
      </Link>
    </Screen>
  );
}

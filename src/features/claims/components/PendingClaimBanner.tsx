import { Link } from "expo-router";
import CircleAlert from "lucide-react-native/icons/circle-alert";
import { useTranslation } from "react-i18next";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Text } from "@/components/ui/text";
import { usePendingSubmission } from "@/features/claims/submission";

// Shown on Home while a claim is still being confirmed, so it can't be forgotten.
export default function PendingClaimBanner({ token }: { token: string }) {
  const { t } = useTranslation();
  const pending = usePendingSubmission(token);
  if (!pending) return null;

  return (
    <Alert icon={CircleAlert}>
      <AlertTitle>{t("home.resumeBanner")}</AlertTitle>
      <AlertDescription>
        {pending.body.amount} {pending.body.asset}
      </AlertDescription>
      <Link href={{ pathname: "/claim", params: { asset: pending.body.asset } }} asChild>
        <Button size="sm" className="mt-3 self-start">
          <Text>{t("home.resume")}</Text>
        </Button>
      </Link>
    </Alert>
  );
}

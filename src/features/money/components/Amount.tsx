import { useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable } from "react-native";

import { Text } from "@/components/ui/text";
import { formatAmount, formatAmountShort } from "@/features/money/amount";
import { cn } from "@/lib/utils";

type AmountProps = {
  value: bigint;
  decimals: number;
  className?: string;
  suffix?: string;
};

// Long amounts show up to 6 decimals (cut down, never rounded up) with "…";
// tapping shows the exact full amount.
export default function Amount({ value, decimals, className, suffix }: AmountProps) {
  const { t } = useTranslation();
  const [expanded, setExpanded] = useState(false);
  const short = formatAmountShort(value, decimals);
  const full = formatAmount(value, decimals, { trim: true });
  const text =
    (expanded || !short.truncated ? full : `${short.text}…`) + (suffix ? ` ${suffix}` : "");

  if (!short.truncated) {
    return (
      <Text className={className} selectable>
        {text}
      </Text>
    );
  }

  return (
    <Pressable
      onPress={() => setExpanded((v) => !v)}
      accessibilityRole="button"
      accessibilityLabel={t(expanded ? "common.showLess" : "common.showFull", { amount: full })}
    >
      <Text className={cn(className, "break-all")} selectable>
        {text}
      </Text>
    </Pressable>
  );
}

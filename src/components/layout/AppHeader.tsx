import type { ReactNode } from "react";
import { Image, View } from "react-native";

import { Text } from "@/components/ui/text";

// CashMine's mark, used with permission of the brief ("build a slice of our app").
const mark = require("../../../assets/images/cashmine-mark.png") as number;

type AppHeaderProps = { title: string; right?: ReactNode };

export default function AppHeader({ title, right }: AppHeaderProps) {
  return (
    <View className="flex-row items-center justify-between gap-2">
      <View className="min-w-0 flex-1 flex-row items-center gap-2.5">
        <Image
          source={mark}
          // Fixed size: className sizing isn't applied to Image on web.
          style={{ width: 32, height: 32 }}
          resizeMode="contain"
          accessibilityLabel="CashMine"
        />
        <Text className="min-w-0 flex-1 text-xl font-bold tracking-tight" role="heading">
          {title}
        </Text>
      </View>
      {right}
    </View>
  );
}

import type { ReactNode } from "react";
import { ScrollView, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { cn } from "@/lib/utils";

type ScreenProps = {
  children: ReactNode;
  className?: string;
};

// Mobile-first page shell: scrolls, respects notches/home indicator, and keeps
// a phone-width column centred on larger screens.
export default function Screen({ children, className }: ScreenProps) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView
      className="flex-1 bg-background"
      contentContainerClassName="grow"
      contentContainerStyle={{ paddingTop: insets.top, paddingBottom: insets.bottom }}
      keyboardShouldPersistTaps="handled"
    >
      <View className={cn("mx-auto w-full max-w-md flex-1 gap-4 px-4 py-6", className)}>
        {children}
      </View>
    </ScrollView>
  );
}

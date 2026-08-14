import type { ReactNode } from 'react';
import { ScrollView, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

// The shared body wrapper every screen (home, scan, review, ...) sits
// inside. Scrollable by default since screen content tends to grow
// (e.g. a library list), and bottom padding respects the safe-area
// inset so content isn't hidden behind the home indicator on iOS.
export function Screen({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();

  return (
    <ScrollView className="flex-1 bg-slate-50" contentContainerStyle={{ paddingBottom: insets.bottom + 20 }}>
      <View className="gap-4 p-5">{children}</View>
    </ScrollView>
  );
}

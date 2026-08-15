import { Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HeaderProps {
  title: string;
  subtitle?: string;
  onBack?: () => void;
}

// paddingTop uses the safe-area inset (not just a fixed number) so the
// title never sits under the phone's notch/status bar/camera cutout --
// that inset is different per device, which is why it can't be a
// hardcoded className like pt-4.
export function Header({ title, subtitle, onBack }: HeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="bg-slate-900 px-5 pb-5" style={{ paddingTop: insets.top + 12 }}>
      {onBack && (
        <Pressable onPress={onBack} hitSlop={8} className="mb-2 self-start">
          <Text className="text-sm font-medium text-slate-300">‹ Back</Text>
        </Pressable>
      )}
      <Text className="text-2xl font-bold text-white">{title}</Text>
      {subtitle ? <Text className="mt-1 text-sm text-slate-300">{subtitle}</Text> : null}
    </View>
  );
}

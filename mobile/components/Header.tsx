import { Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

interface HeaderProps {
  title: string;
  subtitle?: string;
}

// paddingTop uses the safe-area inset (not just a fixed number) so the
// title never sits under the phone's notch/status bar/camera cutout --
// that inset is different per device, which is why it can't be a
// hardcoded className like pt-4.
export function Header({ title, subtitle }: HeaderProps) {
  const insets = useSafeAreaInsets();

  return (
    <View className="bg-blue-600 px-5 pb-4" style={{ paddingTop: insets.top + 12 }}>
      <Text className="text-2xl font-bold text-white">{title}</Text>
      {subtitle ? <Text className="mt-1 text-sm text-blue-100">{subtitle}</Text> : null}
    </View>
  );
}

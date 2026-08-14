import { Stack } from 'expo-router';
import type { ErrorBoundaryProps } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import '../global.css';

// App-wide fallback so a render crash shows a recoverable screen
// instead of a blank/white screen.
export function ErrorBoundary({ error, retry }: ErrorBoundaryProps) {
  return (
    <View className="flex-1 items-center justify-center p-6">
      <Text className="mb-2 font-semibold">Well, this can't be good.</Text>
      <Text className="mb-4">{error.message}</Text>
      <Text className="text-blue-600" onPress={retry}>
        Try again
      </Text>
    </View>
  );
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <Stack screenOptions={{ headerShown: false }} />
    </SafeAreaProvider>
  );
}

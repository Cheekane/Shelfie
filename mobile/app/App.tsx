import { StatusBar } from 'expo-status-bar';
import { Pressable, Text, View } from 'react-native';

import '../global.css';

export default function App() {
  return (
    <View className="flex-1 items-center justify-center gap-4 bg-slate-100 px-6">
      <View className="w-full max-w-sm gap-2 rounded-2xl bg-white p-6 shadow-md">
        <Text className="text-2xl font-bold text-slate-900">Shelfie</Text>
        <Text className="text-base text-slate-500">
          NativeWind
        </Text>
        <Pressable className="mt-2 items-center rounded-lg bg-blue-600 px-4 py-3 active:bg-blue-700">
          <Text className="font-semibold text-white">Looks good</Text>
        </Pressable>
      </View>
      <StatusBar style="auto" />
    </View>
  );
}

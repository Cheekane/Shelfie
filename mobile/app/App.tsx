import { StatusBar } from 'expo-status-bar';
import { Text, View } from 'react-native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import '../global.css';

export default function App() {
  return (
    <SafeAreaProvider>
      <View className="flex-1 bg-slate-50">
        <Header title="Shelfie" subtitle="Your bookshelf, catalogued" />
        <Screen>
          <Text className="text-slate-500">Your library will show up here.</Text>
        </Screen>
        <StatusBar style="light" />
      </View>
    </SafeAreaProvider>
  );
}

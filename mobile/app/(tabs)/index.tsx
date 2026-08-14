import { Text, View } from 'react-native';

import { Header } from '../../components/Header';
import { Screen } from '../../components/Screen';

export default function LibraryScreen() {
    return (
        <View className="flex-1 bg-slate-50">
            <Header title="Library" subtitle="Your confirmed books" />
            <Screen>
                <Text className="text-slate-500">Library screen</Text>
            </Screen>
        </View>
    );
}

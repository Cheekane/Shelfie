import { Text, View, Image } from 'react-native';
import { useLocalSearchParams } from 'expo-router';

export default function ScanScreen() {
    const { uri } = useLocalSearchParams<{ uri: string }>();

    return (
        <View className="flex-1 items-center justify-center gap-4 bg-slate-50 p-6">
            {uri && <Image source={{ uri }} className="h-80 w-full rounded-2xl border border-slate-200" resizeMode="cover" />}
            <Text className="text-slate-500">Preview -- upload/scan comes next.</Text>
        </View>
    );
}

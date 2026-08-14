import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import {
    requestMediaLibraryPermissionsAsync,
    requestCameraPermissionsAsync,
    launchImageLibraryAsync,
    launchCameraAsync,
} from 'expo-image-picker';

import { Header } from '../../components/Header';

export default function ScanScreen() {
    const [imageUri, setImageUri] = useState<string | null>(null);
    const insets = useSafeAreaInsets();

    async function pickPhoto(source: 'camera' | 'library') {
        const permission = source === 'camera'
            ? await requestCameraPermissionsAsync()
            : await requestMediaLibraryPermissionsAsync();

        if (!permission.granted) {
            return;
        }

        const result = source === 'camera'
            ? await launchCameraAsync({ mediaTypes: ['images'], quality: 0.8 })
            : await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 0.8 });

        if (!result.canceled) {
            setImageUri(result.assets[0].uri);
        }
    }

    return (
        <View className="flex-1 bg-slate-50">
            <Header title="Shelfie" subtitle="Photograph a bookshelf" />

            <View className="flex-1 p-5">
                {imageUri ? (
                    <Image source={{ uri: imageUri }} className="h-full w-full rounded-2xl border border-slate-200" resizeMode="cover" />
                ) : (
                    <View className="h-full w-full items-center justify-center rounded-2xl border-2 border-dashed border-slate-300 bg-white">
                        <Text className="text-slate-400">No photo yet</Text>
                    </View>
                )}
            </View>

            <View className="flex-row gap-3 px-5" style={{ paddingBottom: insets.bottom + 16 }}>
                <Pressable onPress={() => pickPhoto('camera')} className="flex-1 items-center rounded-lg bg-slate-900 py-4 active:bg-slate-800">
                    <Text className="text-base font-semibold text-white">Take a Shelfie</Text>
                </Pressable>
                <Pressable onPress={() => pickPhoto('library')} className="flex-1 items-center rounded-lg bg-slate-100 py-4 active:bg-slate-200">
                    <Text className="text-base font-semibold text-slate-900">Choose a Shelfie</Text>
                </Pressable>
            </View>
        </View>
    );
}

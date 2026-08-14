import { useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import {
    requestMediaLibraryPermissionsAsync,
    requestCameraPermissionsAsync,
    launchImageLibraryAsync,
    launchCameraAsync,
} from 'expo-image-picker';

import { Header } from '../../components/Header';
import { Screen } from '../../components/Screen';

export default function ScanScreen() {
    const [imageUri, setImageUri] = useState<string | null>(null);

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
            <Header title="Scan" subtitle="Photograph a bookshelf" />
            <Screen>
                {imageUri && (
                    <Image source={{ uri: imageUri }} className="h-80 w-full rounded-2xl border border-slate-200" resizeMode="cover" />
                )}
                <Pressable onPress={() => pickPhoto('camera')} className="w-full items-center rounded-lg bg-blue-600 py-3 active:bg-blue-700">
                    <Text className="font-semibold text-white">Take a Photo</Text>
                </Pressable>
                <Pressable onPress={() => pickPhoto('library')} className="w-full items-center rounded-lg bg-slate-100 py-3 active:bg-slate-200">
                    <Text className="font-semibold text-slate-900">Choose a Photo</Text>
                </Pressable>
            </Screen>
        </View>
    );
}

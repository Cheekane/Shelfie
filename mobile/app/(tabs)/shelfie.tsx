import { useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
    requestMediaLibraryPermissionsAsync,
    requestCameraPermissionsAsync,
    launchImageLibraryAsync,
    launchCameraAsync,
} from 'expo-image-picker';

import { Header } from '../../components/Header';
import { ApiError, scanPhoto } from '../../lib/api';

export default function ScanScreen() {
    const [imageUri, setImageUri] = useState<string | null>(null);
    const [scanning, setScanning] = useState<boolean>(false);
    const insets = useSafeAreaInsets();

    async function pickPhoto(source: 'camera' | 'library'): Promise<void> {
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

    async function runScan(): Promise<void> {
        if (!imageUri) return;
        setScanning(true);
        try {
            await scanPhoto(imageUri);
            setImageUri(null);
            // Scan results land as PendingDetection rows on the backend
            // go straight to reviewing them instead of the Library summary.
            router.push('/review');
        } catch (err) {
            Alert.alert('Scan failed', err instanceof ApiError ? err.message : 'Something went wrong scanning this photo.');
        } finally {
            setScanning(false);
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

            {imageUri && (
                <View className="px-5 pb-3">
                    <Pressable
                        onPress={runScan}
                        disabled={scanning}
                        className="flex-row items-center justify-center gap-2 rounded-lg bg-slate-900 py-4 active:bg-slate-800 disabled:opacity-60"
                    >
                        {scanning && <ActivityIndicator color="white" />}
                        <Text className="text-base font-semibold text-white">
                            {scanning ? 'Detecting spines, reading titles...' : 'Scan This Shelf'}
                        </Text>
                    </Pressable>
                </View>
            )}

            <View className="flex-row gap-3 px-5" style={{ paddingBottom: insets.bottom + 16 }}>
                <Pressable onPress={() => pickPhoto('camera')} disabled={scanning} className="flex-1 items-center rounded-lg bg-slate-900 py-4 active:bg-slate-800 disabled:opacity-60">
                    <Text className="text-base font-semibold text-white">Take a Shelfie</Text>
                </Pressable>
                <Pressable onPress={() => pickPhoto('library')} disabled={scanning} className="flex-1 items-center rounded-lg bg-slate-100 py-4 active:bg-slate-200 disabled:opacity-60">
                    <Text className="text-base font-semibold text-slate-900">Choose a Shelfie</Text>
                </Pressable>
            </View>
        </View>
    );
}

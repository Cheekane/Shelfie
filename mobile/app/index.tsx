import { Pressable, Text, View } from 'react-native';
import { Link, useRouter } from 'expo-router';
import {
    requestMediaLibraryPermissionsAsync,
    requestCameraPermissionsAsync,
    launchImageLibraryAsync,
    launchCameraAsync,
} from 'expo-image-picker';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';

export default function HomeScreen() {
    const router = useRouter();

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
            router.push({ pathname: '/scan', params: { uri: result.assets[0].uri } });
        }
    }

    return (
        <View className="flex-1 bg-slate-50">
            <Header title="Shelfie" subtitle="Your bookshelf, is now my bookshelf." />
            <Screen>
                <Section sectionName="Library">
                    <Link href="/library" asChild>
                        <Pressable className="w-full items-center rounded-lg bg-slate-100 py-3 active:bg-slate-200">
                            <Text className="font-semibold text-slate-900">View Library</Text>
                        </Pressable>
                    </Link>
                </Section>
                <Section sectionName="Catalog">
                    <Link href="/catalog" asChild>
                        <Pressable className="w-full items-center rounded-lg bg-slate-100 py-3 active:bg-slate-200">
                            <Text className="font-semibold text-slate-900">View Catalog</Text>
                        </Pressable>
                    </Link>
                </Section>
                <Section sectionName="Scan">
                    <Pressable onPress={() => pickPhoto('camera')} className="w-full items-center rounded-lg bg-blue-600 py-3 active:bg-blue-700">
                        <Text className="font-semibold text-white">Take a Photo</Text>
                    </Pressable>
                    <Pressable onPress={() => pickPhoto('library')} className="w-full items-center rounded-lg bg-slate-100 py-3 active:bg-slate-200">
                        <Text className="font-semibold text-slate-900">Choose a Photo</Text>
                    </Pressable>
                </Section>
            </Screen>
        </View>
    );
}

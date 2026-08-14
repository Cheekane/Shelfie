import {Pressable, Text, View} from 'react-native';

import {Header} from '../components/Header';
import {Screen} from '../components/Screen';
import {Section} from '../components/Section';
import {Link} from "expo-router";

export default function HomeScreen() {
    return (
        <View className="flex-1 bg-slate-50">
            <Header title="Shelfie" subtitle="Your bookshelf, is now my bookshelf."/>
            <Screen>
                <Section sectionName="Library">
                    <Link href="/library" asChild>
                        <Pressable className="w-24 h-16 border-2 bg-gray-800 border-gray-800">
                            <Text className="text-center font-semibold text-white">View Library</Text>
                        </Pressable>
                    </Link>
                </Section>
                <Section sectionName="Catalog">
                    <Link href="/catalog" asChild>
                        <Pressable className="w-24 h-16 border-2 bg-gray-800 border-gray-800">
                            <Text className="text-center font-semibold text-white">View Catalog</Text>
                        </Pressable>
                    </Link>
                </Section>
                <Section sectionName="Scan">
                    <Link href="/scan" asChild>
                        <Pressable className="w-24 h-16 border-2 bg-gray-800 border-gray-800">
                            <Text className="text-center font-semibold text-white">Scan a Bookshelf</Text>
                        </Pressable>
                    </Link>
                </Section>
            </Screen>
        </View>
    );
}

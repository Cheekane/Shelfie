import { View } from 'react-native';

import { Header } from '../components/Header';
import { Screen } from '../components/Screen';
import { Section } from '../components/Section';

export default function HomeScreen() {
    return (
        <View className="flex-1 bg-slate-50">
            <Header title="Shelfie" subtitle="Your bookshelf, is now my bookshelf."/>
            <Screen>
                <Section className="w-full h-96 border-2 border-gray-800 rounded-lg p-2" sectionName="Library"/>
                <Section sectionName="Catalog"/>
                <Section sectionName="Scan"/>
            </Screen>
        </View>
    );
}

import { Ionicons } from '@expo/vector-icons';
import { Tabs } from 'expo-router';

// A folder named in parens -- (tabs) -- is an Expo Router "group": it
// organizes these two screens under one shared layout (the bottom tab
// bar below) without adding "/tabs" to either screen's URL.
export default function TabsLayout() {
    return (
        <Tabs screenOptions={{ headerShown: false, tabBarActiveTintColor: '#0f172a', tabBarInactiveTintColor: '#94a3b8' }}>
            <Tabs.Screen
                name="index"
                options={{
                    title: 'Library',
                    tabBarIcon: ({ color, size }) => <Ionicons name="library-outline" color={color} size={size} />,
                }}
            />
            <Tabs.Screen
                name="shelfie"
                options={{
                    title: 'Shelfie',
                    tabBarIcon: ({ color, size }) => <Ionicons name="camera-outline" color={color} size={size} />,
                }}
            />
        </Tabs>
    );
}

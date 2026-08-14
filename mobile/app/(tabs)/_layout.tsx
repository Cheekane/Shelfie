import { Tabs } from 'expo-router';

// A folder named in parens -- (tabs) -- is an Expo Router "group": it
// organizes these two screens under one shared layout (the bottom tab
// bar below) without adding "/tabs" to either screen's URL.
export default function TabsLayout() {
    return (
        <Tabs screenOptions={{ headerShown: false }}>
            <Tabs.Screen name="index" options={{ title: 'Library' }} />
            <Tabs.Screen name="scan" options={{ title: 'Scan' }} />
        </Tabs>
    );
}

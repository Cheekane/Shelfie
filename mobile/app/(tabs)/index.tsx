import { useCallback, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { Header } from '../../components/Header';
import { ApiError, fetchLibrary, fetchPending } from '../../lib/api';

interface SummaryCardProps {
    title: string;
    subtitle: string;
    onPress: () => void;
}

function SummaryCard({ title, subtitle, onPress }: SummaryCardProps) {
    return (
        <Pressable
            onPress={onPress}
            className="w-full flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50"
        >
            <View>
                <Text className="text-lg font-semibold text-slate-900">{title}</Text>
                <Text className="mt-1 text-sm text-slate-500">{subtitle}</Text>
            </View>
            <Text className="text-2xl text-slate-300">{'›'}</Text>
        </Pressable>
    );
}

function librarySummary(count: number | null): string {
    if (count === null) return 'Loading...';
    if (count === 0) return 'No books yet, take a shelfie to get started';
    return `${count} confirmed book${count === 1 ? '' : 's'}`;
}

function reviewSummary(count: number | null): string {
    if (count === null) return 'Loading...';
    if (count === 0) return 'Nothing to review right now';
    return `${count} scanned book${count === 1 ? '' : 's'} waiting`;
}

export default function DashboardScreen() {
    const [libraryCount, setLibraryCount] = useState<number | null>(null);
    const [pendingCount, setPendingCount] = useState<number | null>(null);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (): Promise<void> => {
        try {
            setError(null);
            // page_size=1 -- this screen only needs the totals for each
            // summary card, not the actual book/pending lists.
            const [libraryRes, pendingRes] = await Promise.all([fetchLibrary(1, 1), fetchPending(1, 1)]);
            setLibraryCount(libraryRes.count);
            setPendingCount(pendingRes.count);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not load your library.');
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            load();
        }, [load])
    );

    async function onRefresh(): Promise<void> {
        setRefreshing(true);
        await load();
        setRefreshing(false);
    }

    return (
        <View className="flex-1 bg-slate-50">
            <Header title="Library" subtitle="Your books at a glance" />
            <ScrollView
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View className="gap-3 p-5">
                    {error && (
                        <View className="rounded-lg bg-red-50 p-3">
                            <Text className="text-red-800">{error}</Text>
                        </View>
                    )}

                    <SummaryCard title="Library" subtitle={librarySummary(libraryCount)} onPress={() => router.push('/library')} />
                    <SummaryCard title="Needs Review" subtitle={reviewSummary(pendingCount)} onPress={() => router.push('/review')} />
                </View>
            </ScrollView>
        </View>
    );
}

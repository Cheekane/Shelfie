import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '../../components/EmptyState';
import { Header } from '../../components/Header';
import { LibraryBookCard } from '../../components/LibraryBookCard';
import { Section } from '../../components/Section';
import { ApiError, fetchLibrary, fetchPending } from '../../lib/api';
import type { LibraryBook, PendingDetection } from '../../types/api';

function reviewSummary(pending: PendingDetection[] | null): string {
    if (pending === null) return 'Loading...';
    if (pending.length === 0) return 'Nothing to review right now';
    return `${pending.length} scanned book${pending.length === 1 ? '' : 's'} waiting`;
}

export default function LibraryScreen() {
    const [pending, setPending] = useState<PendingDetection[] | null>(null);
    const [books, setBooks] = useState<LibraryBook[] | null>(null);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (): Promise<void> => {
        try {
            setError(null);
            const [pendingRes, libraryRes] = await Promise.all([fetchPending(), fetchLibrary()]);
            setPending(pendingRes.detections);
            setBooks(libraryRes.books);
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
            <Header title="Library" subtitle="Your confirmed books" />
            <ScrollView
                className="flex-1"
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
            >
                <View className="gap-4 p-5">
                    {error && (
                        <View className="rounded-lg bg-red-50 p-3">
                            <Text className="text-red-800">{error}</Text>
                        </View>
                    )}

                    <Pressable
                        onPress={() => router.push('/review')}
                        className="w-full flex-row items-center justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm active:bg-slate-50"
                    >
                        <View>
                            <Text className="text-lg font-semibold text-slate-900">Needs Review</Text>
                            <Text className="mt-1 text-sm text-slate-500">{reviewSummary(pending)}</Text>
                        </View>
                        <Text className="text-2xl text-slate-300">{'›'}</Text>
                    </Pressable>

                    <Section sectionName="Library" className="gap-3">
                        {books === null ? (
                            <ActivityIndicator />
                        ) : books.length === 0 ? (
                            <EmptyState message="Your library is empty, scan a shelf to get started." />
                        ) : (
                            books.map((b) => <LibraryBookCard key={b.id} book={b} />)
                        )}
                    </Section>
                </View>
            </ScrollView>
        </View>
    );
}

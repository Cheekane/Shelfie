import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { EmptyState } from '../../components/EmptyState';
import { Header } from '../../components/Header';
import { LibraryBookCard } from '../../components/LibraryBookCard';
import { PendingBookCard } from '../../components/PendingBookCard';
import { Section } from '../../components/Section';
import { ApiError, fetchLibrary, fetchPending } from '../../lib/api';
import type { LibraryBook, PendingDetection } from '../../types/api';

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

    function handleConfirmed(id: number): void {
        setPending((prev) => prev?.filter((d) => d.id !== id) ?? null);
        load(); // the confirmed book now needs to show up in the library section too
    }

    function handleDiscarded(id: number): void {
        setPending((prev) => prev?.filter((d) => d.id !== id) ?? null);
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

                    <Section sectionName={pending ? `Needs Review (${pending.length})` : 'Needs Review'} className="gap-3">
                        {pending === null ? (
                            <ActivityIndicator />
                        ) : pending.length === 0 ? (
                            <EmptyState message="Nothing to review right now. Scan a shelf to add books here." />
                        ) : (
                            pending.map((d) => (
                                <PendingBookCard key={d.id} detection={d} onConfirmed={handleConfirmed} onDiscarded={handleDiscarded} />
                            ))
                        )}
                    </Section>

                    <Section sectionName="My Library" className="gap-3">
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

import { useCallback, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '../components/EmptyState';
import { Header } from '../components/Header';
import { PendingBookCard } from '../components/PendingBookCard';
import { ApiError, fetchPending } from '../lib/api';
import type { PendingDetection } from '../types/api';

export default function ReviewScreen() {
    const [pending, setPending] = useState<PendingDetection[] | null>(null);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const load = useCallback(async (): Promise<void> => {
        try {
            setError(null);
            const res = await fetchPending();
            setPending(res.detections);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not load pending books.');
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
    }

    function handleDiscarded(id: number): void {
        setPending((prev) => prev?.filter((d) => d.id !== id) ?? null);
    }

    return (
        <View className="flex-1 bg-slate-50">
            <Header title="Needs Review" subtitle="Confirm or discard scanned books" onBack={() => router.back()} />
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

                    {pending === null ? (
                        <ActivityIndicator />
                    ) : pending.length === 0 ? (
                        <EmptyState message="Nothing to review right now. Scan a shelf to add books here." />
                    ) : (
                        pending.map((d) => (
                            <PendingBookCard key={d.id} detection={d} onConfirmed={handleConfirmed} onDiscarded={handleDiscarded} />
                        ))
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

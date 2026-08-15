import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '../../components/EmptyState';
import { Header } from '../../components/Header';
import { PendingBookCard } from '../../components/PendingBookCard';
import { ApiError, fetchPending } from '../../lib/api';
import type { PendingDetection } from '../../types/api';

export default function ReviewScreen() {
    const [pending, setPending] = useState<PendingDetection[] | null>(null);
    const [page, setPage] = useState<number>(1);
    const [hasNext, setHasNext] = useState<boolean>(false);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    // Reset to page 1 -- pending items can change from other screens (a
    // fresh scan, a confirm/discard elsewhere), so a stale later page
    // isn't safe to keep showing.
    const loadFirstPage = useCallback(async (): Promise<void> => {
        try {
            setError(null);
            const res = await fetchPending(1);
            setPending(res.detections);
            setPage(1);
            setHasNext(res.has_next);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not load pending books.');
        }
    }, []);

    useFocusEffect(
        useCallback(() => {
            loadFirstPage();
        }, [loadFirstPage])
    );

    async function onRefresh(): Promise<void> {
        setRefreshing(true);
        await loadFirstPage();
        setRefreshing(false);
    }

    async function loadNextPage(): Promise<void> {
        if (!hasNext || loadingMore) return;
        setLoadingMore(true);
        try {
            const nextPage = page + 1;
            const res = await fetchPending(nextPage);
            setPending((prev) => (prev ?? []).concat(res.detections));
            setPage(nextPage);
            setHasNext(res.has_next);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not load more books.');
        } finally {
            setLoadingMore(false);
        }
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
            <FlatList
                className="flex-1"
                contentContainerStyle={{ padding: 20, gap: 12 }}
                data={pending ?? []}
                keyExtractor={(d) => String(d.id)}
                renderItem={({ item }) => (
                    <PendingBookCard detection={item} onConfirmed={handleConfirmed} onDiscarded={handleDiscarded} />
                )}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                onEndReached={loadNextPage}
                onEndReachedThreshold={0.5}
                // Off-screen cards don't need to stay mounted -- they're
                // form inputs, not cheap text rows, so this keeps memory
                // and render time bounded no matter how many are pending.
                windowSize={7}
                maxToRenderPerBatch={8}
                removeClippedSubviews
                ListHeaderComponent={
                    error ? (
                        <View className="rounded-lg bg-red-50 p-3">
                            <Text className="text-red-800">{error}</Text>
                        </View>
                    ) : null
                }
                ListFooterComponent={loadingMore ? <ActivityIndicator className="py-4" /> : null}
                ListEmptyComponent={
                    pending === null ? (
                        <ActivityIndicator />
                    ) : (
                        <EmptyState message="Nothing to review right now. Scan a shelf to add books here." />
                    )
                }
                keyboardShouldPersistTaps="handled"
            />
        </View>
    );
}

import { useCallback, useState } from 'react';
import { ActivityIndicator, FlatList, RefreshControl, Text, View } from 'react-native';
import { router, useFocusEffect } from 'expo-router';

import { EmptyState } from '../components/EmptyState';
import { Header } from '../components/Header';
import { LibraryBookCard } from '../components/LibraryBookCard';
import { ApiError, fetchLibrary } from '../lib/api';
import type { LibraryBook } from '../types/api';

export default function LibraryListScreen() {
    const [books, setBooks] = useState<LibraryBook[] | null>(null);
    const [page, setPage] = useState<number>(1);
    const [hasNext, setHasNext] = useState<boolean>(false);
    const [loadingMore, setLoadingMore] = useState<boolean>(false);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [error, setError] = useState<string | null>(null);

    const loadFirstPage = useCallback(async (): Promise<void> => {
        try {
            setError(null);
            const res = await fetchLibrary(1);
            setBooks(res.books);
            setPage(1);
            setHasNext(res.has_next);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not load your library.');
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
            const res = await fetchLibrary(nextPage);
            setBooks((prev) => (prev ?? []).concat(res.books));
            setPage(nextPage);
            setHasNext(res.has_next);
        } catch (err) {
            setError(err instanceof ApiError ? err.message : 'Could not load more books.');
        } finally {
            setLoadingMore(false);
        }
    }

    return (
        <View className="flex-1 bg-slate-50">
            <Header title="Library" subtitle="Your confirmed books" onBack={() => router.back()} />
            <FlatList
                className="flex-1"
                contentContainerStyle={{ padding: 20, gap: 12 }}
                data={books ?? []}
                keyExtractor={(b) => String(b.id)}
                renderItem={({ item }) => <LibraryBookCard book={item} />}
                refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} />}
                onEndReached={loadNextPage}
                onEndReachedThreshold={0.5}
                ListHeaderComponent={
                    error ? (
                        <View className="rounded-lg bg-red-50 p-3">
                            <Text className="text-red-800">{error}</Text>
                        </View>
                    ) : null
                }
                ListFooterComponent={loadingMore ? <ActivityIndicator className="py-4" /> : null}
                ListEmptyComponent={
                    books === null ? (
                        <ActivityIndicator />
                    ) : (
                        <EmptyState message="Your library is empty, take a shelfie to get started." />
                    )
                }
            />
        </View>
    );
}

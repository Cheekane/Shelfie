import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, Image, Pressable, RefreshControl, ScrollView, Text, TextInput, View } from 'react-native';
import { useFocusEffect } from 'expo-router';

import { Header } from '../../components/Header';
import { ApiError, confirmPending, discardPending, fetchLibrary, fetchPending } from '../../lib/api';
import type { LibraryBook, MatchStatusAtAdd, PendingDetection } from '../../types/api';

interface Badge {
    label: string;
    textClass: string;
    bgClass: string;
}

function badgeFor(detection: PendingDetection, corrected: boolean): Badge {
    if (detection.read_status === 'failed') {
        return { label: "Couldn't read this spine", textClass: 'text-slate-600', bgClass: 'bg-slate-200' };
    }
    if (corrected) {
        return { label: 'Corrected', textClass: 'text-blue-700', bgClass: 'bg-blue-100' };
    }
    switch (detection.match?.status) {
        case 'auto':
            return { label: 'Auto-matched', textClass: 'text-green-700', bgClass: 'bg-green-100' };
        case 'review':
            return { label: 'Needs review', textClass: 'text-amber-700', bgClass: 'bg-amber-100' };
        default:
            return { label: 'No match found', textClass: 'text-orange-700', bgClass: 'bg-orange-100' };
    }
}

function matchStatusAtAdd(detection: PendingDetection, corrected: boolean, catalogId: string | null): MatchStatusAtAdd {
    if (corrected) return 'reviewed_corrected';
    if (detection.match?.status === 'auto') return 'auto';
    if (catalogId) return 'reviewed_confirmed';
    return 'manual';
}

interface PendingCardProps {
    detection: PendingDetection;
    onConfirmed: (id: number) => void;
    onDiscarded: (id: number) => void;
}

function PendingCard({ detection, onConfirmed, onDiscarded }: PendingCardProps) {
    const topCandidate = detection.match?.candidates[0] ?? null;
    const [title, setTitle] = useState<string>(topCandidate?.title ?? detection.ocr_title);
    const [author, setAuthor] = useState<string>(topCandidate?.author ?? detection.ocr_author);
    const [catalogId, setCatalogId] = useState<string | null>(topCandidate?.catalog_id ?? null);
    const [confidence, setConfidence] = useState<number | null>(topCandidate?.confidence ?? null);
    const [corrected, setCorrected] = useState<boolean>(false);
    const [busy, setBusy] = useState<boolean>(false);

    const badge = badgeFor(detection, corrected);
    const candidates = detection.match?.candidates ?? [];

    function editTitle(value: string): void {
        setTitle(value);
        setCorrected(true);
    }

    function editAuthor(value: string): void {
        setAuthor(value);
        setCorrected(true);
    }

    function pickCandidate(candidateId: string): void {
        const candidate = candidates.find((c) => c.catalog_id === candidateId);
        if (!candidate) return;
        setTitle(candidate.title);
        setAuthor(candidate.author);
        setCatalogId(candidate.catalog_id);
        setConfidence(candidate.confidence);
        setCorrected(false);
    }

    async function handleKeep(): Promise<void> {
        setBusy(true);
        try {
            await confirmPending(detection.id, {
                title,
                author,
                catalog_id: catalogId,
                ocr_title: detection.ocr_title,
                ocr_author: detection.ocr_author,
                match_confidence: confidence,
                match_status_at_add: matchStatusAtAdd(detection, corrected, catalogId),
            });
            onConfirmed(detection.id);
        } catch (err) {
            Alert.alert('Could not save', err instanceof ApiError ? err.message : 'Something went wrong.');
        } finally {
            setBusy(false);
        }
    }

    async function handleDiscard(): Promise<void> {
        setBusy(true);
        try {
            await discardPending(detection.id);
            onDiscarded(detection.id);
        } catch (err) {
            Alert.alert('Could not discard', err instanceof ApiError ? err.message : 'Something went wrong.');
        } finally {
            setBusy(false);
        }
    }

    return (
        <View className="w-full gap-3 rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
            <View className="flex-row gap-3">
                <Image source={{ uri: detection.crop_image }} className="h-24 w-16 rounded-lg bg-slate-100" resizeMode="cover" />
                <View className="flex-1 gap-2">
                    <View className={`self-start rounded-full px-2 py-1 ${badge.bgClass}`}>
                        <Text className={`text-xs font-semibold ${badge.textClass}`}>{badge.label}</Text>
                    </View>
                    <TextInput value={title} onChangeText={editTitle} placeholder="Title" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                    <TextInput value={author} onChangeText={editAuthor} placeholder="Author" className="rounded-lg border border-slate-200 px-3 py-2 text-sm" />
                </View>
            </View>

            {candidates.length > 1 && (
                <View className="flex-row flex-wrap gap-2">
                    {candidates.map((c) => (
                        <Pressable key={c.catalog_id} onPress={() => pickCandidate(c.catalog_id)} className="rounded-full bg-slate-100 px-3 py-1">
                            <Text className="text-xs text-slate-700">{c.title} by {c.author}</Text>
                        </Pressable>
                    ))}
                </View>
            )}

            <View className="flex-row gap-2">
                <Pressable onPress={handleKeep} disabled={busy || !title.trim()} className="flex-1 items-center rounded-lg bg-slate-900 py-2 active:bg-slate-800 disabled:opacity-50">
                    {busy ? <ActivityIndicator color="white" /> : <Text className="font-semibold text-white">Keep</Text>}
                </Pressable>
                <Pressable onPress={handleDiscard} disabled={busy} className="flex-1 items-center rounded-lg bg-slate-100 py-2 active:bg-slate-200 disabled:opacity-50">
                    <Text className="font-semibold text-slate-900">Discard</Text>
                </Pressable>
            </View>
        </View>
    );
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

    function handleConfirmed(id: number): void {
        setPending((prev) => prev?.filter((d) => d.id !== id) ?? null);
        load(); // the confirmed book now needs to show up in the library section too
    }

    function handleDiscarded(id: number): void {
        setPending((prev) => prev?.filter((d) => d.id !== id) ?? null);
    }

    const showEmptyState = pending !== null && books !== null && pending.length === 0 && books.length === 0;

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

                    {showEmptyState && (
                        <View className="items-center py-16">
                            <Text className="text-slate-400">Your library is empty, scan a shelf to get started.</Text>
                        </View>
                    )}

                    {pending && pending.length > 0 && (
                        <>
                            <Text className="text-lg font-semibold text-slate-900">Needs Review ({pending.length})</Text>
                            {pending.map((d) => (
                                <PendingCard key={d.id} detection={d} onConfirmed={handleConfirmed} onDiscarded={handleDiscarded} />
                            ))}
                        </>
                    )}

                    {books && books.length > 0 && (
                        <>
                            <Text className="text-lg font-semibold text-slate-900">My Library</Text>
                            {books.map((b) => (
                                <View key={b.id} className="w-full rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
                                    <Text className="text-base font-semibold text-slate-900">{b.title}</Text>
                                    <Text className="text-sm text-slate-500">{b.author}</Text>
                                </View>
                            ))}
                        </>
                    )}
                </View>
            </ScrollView>
        </View>
    );
}

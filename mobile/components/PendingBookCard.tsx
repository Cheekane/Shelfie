import { useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    Image,
    Modal,
    Pressable,
    ScrollView,
    Text,
    TextInput,
    View,
    useWindowDimensions,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ApiError, confirmPending, discardPending } from '../lib/api';
import type { MatchStatusAtAdd, PendingDetection } from '../types/api';

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

interface PendingBookCardProps {
    detection: PendingDetection;
    onConfirmed: (id: number) => void;
    onDiscarded: (id: number) => void;
}

export function PendingBookCard({ detection, onConfirmed, onDiscarded }: PendingBookCardProps) {
    // "unmatched" still carries candidates (matching.py's best sub-threshold
    // guess), but they didn't clear the bar to actually match -- pre-filling
    // the form with one anyway would silently swap in a wrong catalog book's
    // title for something that's genuinely not in the catalog. Only "auto"
    // and "review" represent a real candidate worth defaulting to.
    const isActionableMatch = detection.match?.status === 'auto' || detection.match?.status === 'review';
    const topCandidate = isActionableMatch ? (detection.match?.candidates[0] ?? null) : null;
    const [title, setTitle] = useState<string>(topCandidate?.title ?? detection.ocr_title);
    const [author, setAuthor] = useState<string>(topCandidate?.author ?? detection.ocr_author);
    const [catalogId, setCatalogId] = useState<string | null>(topCandidate?.catalog_id ?? null);
    const [confidence, setConfidence] = useState<number | null>(topCandidate?.confidence ?? null);
    const [corrected, setCorrected] = useState<boolean>(false);
    const [busy, setBusy] = useState<boolean>(false);
    const [imageExpanded, setImageExpanded] = useState<boolean>(false);
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();
    const insets = useSafeAreaInsets();

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
                <Pressable onPress={() => setImageExpanded(true)}>
                    <Image source={{ uri: detection.crop_image }} className="h-32 w-20 rounded-lg bg-slate-100" resizeMode="cover" />
                </Pressable>
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

            <Modal visible={imageExpanded} transparent animationType="fade" onRequestClose={() => setImageExpanded(false)}>
                <Pressable
                    onPress={() => setImageExpanded(false)}
                    className="flex-1 items-center justify-center bg-black/90"
                >
                    {/* Pinch-to-zoom via ScrollView's native zoom (iOS); on
                        Android this still shows the crop full-size, just
                        without pinch, which is the honest platform limit. */}
                    <ScrollView
                        maximumZoomScale={4}
                        minimumZoomScale={1}
                        centerContent
                        style={{ width: screenWidth, height: screenHeight }}
                        contentContainerStyle={{ flexGrow: 1, alignItems: 'center', justifyContent: 'center' }}
                    >
                        <Image
                            source={{ uri: detection.crop_image }}
                            style={{ width: screenWidth - 32, height: screenHeight - insets.top - insets.bottom - 32 }}
                            resizeMode="contain"
                        />
                    </ScrollView>
                    <Pressable
                        onPress={() => setImageExpanded(false)}
                        className="absolute rounded-full bg-white/20 px-4 py-2"
                        style={{ top: insets.top + 12, right: 20 }}
                    >
                        <Text className="text-base font-semibold text-white">Close</Text>
                    </Pressable>
                </Pressable>
            </Modal>
        </View>
    );
}

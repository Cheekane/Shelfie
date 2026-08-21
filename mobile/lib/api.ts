import { Platform } from 'react-native';

import type {
    ConfirmPendingInput,
    LibraryBook,
    LibraryResponse,
    PendingResponse,
    ScanResponse,
} from '../types/api';

// Override with EXPO_PUBLIC_API_URL in .env for physical-device testing
// (localhost only resolves to the device itself, not your computer).
const API_BASE_URL: string = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

const SCAN_TIMEOUT_MS: number = 45_000; // batched VLM calls on a busy shelf can take a while
const DEFAULT_TIMEOUT_MS: number = 10_000;

export class ApiError extends Error {}

async function fetchWithTimeout(url: string, options: RequestInit, timeoutMs: number): Promise<Response> {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
    try {
        return await fetch(url, { ...options, signal: controller.signal });
    } catch (err) {
        if (err instanceof Error && err.name === 'AbortError') {
            throw new ApiError('The request took too long and was cancelled. Please try again.');
        }
        throw new ApiError('Could not reach the server. Is it running and reachable on your network?');
    } finally {
        clearTimeout(timeoutId);
    }
}

async function parseOrThrow<T>(response: Response): Promise<T> {
    if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new ApiError(body.error ?? `Request failed (${response.status})`);
    }
    if (response.status === 204) {
        return undefined as T;
    }
    return response.json();
}

export async function scanPhoto(imageUri: string): Promise<ScanResponse> {
    const formData = new FormData();

    if (Platform.OS === 'web') {
        // On web, imageUri is a blob:/data: URL from the browser's file
        // picker -- FormData needs a real Blob there, the {uri,name,type}
        // shape below is a React Native-only fetch polyfill trick a real
        // browser doesn't understand (it just coerces the object to a
        // string, so Django never sees actual image bytes).
        const blob = await (await fetch(imageUri)).blob();
        formData.append('image', blob, 'shelf.jpg');
    } else {
        // React Native's fetch polyfill special-cases this { uri, name, type }
        // shape in place of a real Blob/File -- do not set a Content-Type
        // header manually, fetch sets the multipart boundary itself.
        formData.append('image', {
            uri: imageUri,
            name: 'shelf.jpg',
            type: 'image/jpeg',
        } as unknown as Blob);
    }

    const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/scan/`,
        { method: 'POST', body: formData },
        SCAN_TIMEOUT_MS
    );
    return parseOrThrow<ScanResponse>(response);
}

export async function fetchPending(page: number = 1, pageSize?: number): Promise<PendingResponse> {
    const query = pageSize ? `page=${page}&page_size=${pageSize}` : `page=${page}`;
    const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/pending/?${query}`,
        { method: 'GET' },
        DEFAULT_TIMEOUT_MS
    );
    return parseOrThrow<PendingResponse>(response);
}

export async function confirmPending(pendingId: number, input: ConfirmPendingInput): Promise<LibraryBook> {
    const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/pending/${pendingId}/`,
        {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(input),
        },
        DEFAULT_TIMEOUT_MS
    );
    return parseOrThrow<LibraryBook>(response);
}

export async function discardPending(pendingId: number): Promise<void> {
    const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/pending/${pendingId}/`,
        { method: 'DELETE' },
        DEFAULT_TIMEOUT_MS
    );
    await parseOrThrow<void>(response);
}

export async function fetchLibrary(page: number = 1, pageSize?: number): Promise<LibraryResponse> {
    const query = pageSize ? `page=${page}&page_size=${pageSize}` : `page=${page}`;
    const response = await fetchWithTimeout(
        `${API_BASE_URL}/api/library/?${query}`,
        { method: 'GET' },
        DEFAULT_TIMEOUT_MS
    );
    return parseOrThrow<LibraryResponse>(response);
}

// Mirrors backend/library/serializers.py and views.py response shapes.

export interface MatchCandidate {
    catalog_id: string;
    title: string;
    author: string;
    confidence: number;
}

export interface MatchResult {
    status: 'auto' | 'review' | 'unmatched';
    catalog_id: string | null;
    confidence: number;
    candidates: MatchCandidate[];
}

export interface PendingDetection {
    id: number;
    crop_image: string; // absolute URL, served by Django's media storage
    read_status: 'ok' | 'failed';
    ocr_title: string;
    ocr_author: string;
    created_at: string;
    match: MatchResult | null; // null when read_status is "failed"
}

export interface ScanMeta {
    num_spines_detected: number;
    local_model_latency_ms: number;
    vlm_latency_ms: number;
    vlm_calls: number;
    estimated_cost_usd: number;
    warnings: string[];
}

export interface ScanResponse {
    detections: PendingDetection[];
    meta: ScanMeta;
}

export interface PendingResponse {
    detections: PendingDetection[];
}

export type MatchStatusAtAdd = 'auto' | 'reviewed_confirmed' | 'reviewed_corrected' | 'manual';

export interface LibraryBook {
    id: number;
    title: string;
    author: string;
    catalog_id: string | null;
    ocr_title: string;
    ocr_author: string;
    match_confidence: number | null;
    match_status_at_add: MatchStatusAtAdd;
    added_at: string;
}

export interface LibraryResponse {
    books: LibraryBook[];
}

export interface ConfirmPendingInput {
    title: string;
    author: string;
    catalog_id: string | null;
    ocr_title: string;
    ocr_author: string;
    match_confidence: number | null;
    match_status_at_add: MatchStatusAtAdd;
}

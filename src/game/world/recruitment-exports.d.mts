// UI 导出桩的类型声明
import type { Artist } from '../types';
export declare const SCOUT_TRACKS: Array<{ id: string; label: string; desc: string }>;
export declare const TRAIN_TIERS: Record<string, { costPerDayMinor: number; gain: number; label: string }>;
export declare const FATIGUE_LIMIT: number;
export declare const BOOSTS: Array<{ id: string; costMinor: number; add: number; label: string }>;
export declare const SIGNUP_FEE_MINOR: number;
export declare const EVIDENCE_KEYS: string[];
export declare const EVIDENCE_INFO: Record<string, { title: string; note: string }>;
export declare const INVEST_COST_MINOR: number;
export declare function bidScore(state: unknown, gig: unknown, artist: Artist, bribeMinor: number): number;
export declare const LEVELS: Record<string, { label: string; next: string | null }>;
export declare const LEVEL_UP_REQ: Record<string, { cashMinor: number; artists: number; sArtists?: number; reputation: number }>;

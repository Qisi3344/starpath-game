// 类型声明：与 src/game/types.ts 的契约形状对齐（运行时是 .mjs，UI 层从这里取类型）。
import type { Artist, Staff, Gig, PhoneMessage, CareerTrack } from '../types';

export declare const SCHEMA_VERSION: number;
export declare const MINOR_PER_WAN: number;
export declare const DAYS_PER_MONTH: number;
export declare const INITIAL_CASH_WAN: number;
export declare function wanToMinor(wan: number): number;
export declare function clockFromAbsolute(absoluteDay: number): { year: number; month: number; day: number; absoluteDay: number };
export declare const CHARACTER_IDS: Record<'zhixia' | 'lu' | 'yichen', string>;
export declare const LU_INITIAL_FANS: number;
export declare const SUMMER_GIG: {
  id: string; title: string; platform: string; category: string;
  grossMinor: number; platformFeeRate: number; artistShareRate: number;
  companyNetMinor: number; days: number;
};
export declare const PERIOD_OPERATING_COST_MINOR: number;

export type LedgerEntry = {
  id: string;
  absoluteDay: number;
  kind: 'income' | 'expense';
  category: string;
  amountMinor: number;
  note: string;
};

export type WorkRecord = {
  id: string; gigId: string; artistId: string;
  title: string; kind: string; role: string;
  finishedAbsoluteDay: number; note: string;
};

export type CalendarBooking = {
  id: string; assigneeId: string; role: 'artist' | 'staff';
  startAbsoluteDay: number; endAbsoluteDay: number;
  kind: 'training' | 'gig' | 'scouting' | 'rest';
  linkedId: string; status: 'planned' | 'active' | 'done' | 'cancelled';
};

export type WorldGig = {
  id: string; title: string; platform?: string;
  status: 'available' | 'booked' | 'shooting' | 'released';
  assignedArtistId: string | null;
  grossMinor: number; companyNetMinor: number;
};

export type WorldState = {
  schemaVersion: number;
  saveId: string;
  random: { seed: string; state: string };
  clock: { year: number; month: number; day: number; absoluteDay: number };
  company: { name: string; cashMinor: number; reputation: number; level: number };
  staff: Record<string, Staff>;
  artists: Record<string, Artist>;
  candidatePool: Record<string, unknown>;
  contracts: Record<string, unknown>;
  recruitment: Record<string, unknown>;
  schedules: Record<string, CalendarBooking>;
  gigs: Record<string, WorldGig>;
  works: Record<string, WorkRecord>;
  places: Record<string, { id: string; progress: string; unlocked: boolean }>;
  messages: Record<string, PhoneMessage & { absoluteDay: number }>;
  events: Record<string, { id: string; absoluteDay: number; type: string; [k: string]: unknown }>;
  story: { flags: Record<string, boolean | number | string>; seenNodes: string[] };
  ledger: LedgerEntry[];
  processedActionIds: string[];
  pendingBlocker: { title: string; [k: string]: unknown } | null;
};

export declare function newWorld(companyName?: string, seed?: string): WorldState;
export declare function ledgerEntryId(state: WorldState): string;
export declare function messageId(state: WorldState, key: string): string;
export declare function recordEvent(state: WorldState, eventId: string, payload: object): WorldState;
export declare function pushMessage(state: WorldState, msg: PhoneMessage & { id: string; absoluteDay: number }): WorldState;

export type WorldEvent =
  | { type: 'artistSigned'; artistId: string }
  | { type: 'trainingDecided'; trained: boolean }
  | { type: 'gigAccepted'; gigId: string }
  | { type: 'gigStarted'; gigId: string }
  | { type: 'gigReleased'; gigId: string }
  | { type: 'prDecided'; method: string }
  | { type: 'worldPulse' }
  | { type: 'monthlyClosed'; month: number; netMinor: number }
  | { type: 'dayAdvanced'; absoluteDay: number }
  | { type: 'weekSettled'; netMinor: number; fanDelta: number };

export type WorldCommand =
  | { type: 'RENAME_COMPANY'; commandId: string; name: string }
  | { type: 'SIGN_LU'; commandId: string }
  | { type: 'PROLOGUE_TRAIN'; commandId: string; train: boolean }
  | { type: 'ACCEPT_SUMMER_GIG'; commandId: string }
  | { type: 'PR_DECIDE'; commandId: string; method: 'lawyer' | 'statement' | 'cold' }
  | { type: 'ADVANCE_DAY'; commandId: string }
  | { type: 'SETTLE_FIRST_WEEK'; commandId: string }
  | { type: 'SET_STORY_FLAG'; commandId: string; key: string; value?: boolean | number | string };

export declare function dispatch(world: WorldState, command: WorldCommand): { world: WorldState; events: WorldEvent[] };

export type SaveMeta = {
  slot: number;
  schemaVersion: number;
  savedAtRealTime: string;
  absoluteDay: number;
  dateLabel: string;
  company: string;
  cashMinor: number;
};

export declare function saveWorld(world: WorldState, slot?: number, storage?: Storage): SaveMeta;
export declare function loadWorld(slot?: number, storage?: Storage): { world: WorldState; meta: SaveMeta };
export declare function describeSave(record: unknown, slot: number): SaveMeta;
export declare function hasSave(slot?: number, storage?: Storage): boolean;
export declare function deleteSave(slot?: number, storage?: Storage): void;

export declare function formatWan(minor: number): string;
export declare function formatWanSigned(minor: number): string;
export declare function formatDateLabel(clock: WorldState['clock']): string;

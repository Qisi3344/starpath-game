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
  startDay: number; days: number;
  kind: 'training' | 'gig' | 'scouting' | 'rest';
  linkedId: string; status: 'planned' | 'active' | 'done' | 'cancelled';
};

/** 公司等级（B0 存的是数字 1..4，advanceCompany 规范化为字符串） */
export type CompanyLevel = 1 | 2 | 3 | 4 | 'small' | 'mid' | 'big' | 'giant';

export type WorldGig = {
  id: string; title: string; platform?: string;
  kind?: 'webdrama' | 'variety' | 'endorsement' | 'show';
  grade?: 'D' | 'C' | 'B' | 'A';
  status: 'available' | 'booked' | 'shooting' | 'released' | 'expired' | 'failed';
  assignedArtistId: string | null;
  grossMinor: number; companyNetMinor?: number;
  days?: number; reqStat?: number; rival?: boolean;
  startDay?: number; score?: number; perf?: number;
  offerMonth?: number; deadlineDay?: number;
};

export type WorldState = {
  schemaVersion: number;
  saveId: string;
  random: { seed: string; state: string };
  clock: { year: number; month: number; day: number; absoluteDay: number };
  company: { name: string; cashMinor: number; reputation: number; level: CompanyLevel };
  staff: Record<string, Staff>;
  artists: Record<string, Artist>;
  candidatePool: Record<string, Candidate>;
  contracts: Record<string, unknown>;
  recruitment: Record<string, RecruitmentTask>;
  /** 长线字段（M2/M3） */
  ending: { id: string; title: string; body: string } | null;
  deficitMonths?: number;
  xinghuang?: { hostility: number; evidence: Record<string, boolean> };
  festival?: {
    status: 'idle' | 'signup' | 'running' | 'done';
    stage: number; artistId: string | null;
    boosts: number[]; boostAdd?: number;
    lastStageDay?: number; log: string[];
  };
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
  | { type: 'weekSettled'; netMinor: number; fanDelta: number }
  | { type: 'scoutStarted'; taskId: string }
  | { type: 'scoutReported'; taskId: string; count: number }
  | { type: 'candidateInterviewed'; candidateId: string }
  | { type: 'candidatePoached'; candidateId: string }
  | { type: 'candidateExpired'; candidateId: string }
  | { type: 'candidateRejected'; candidateId: string };

/** 候选人档案（B1 实现形状；types.ts 里的草案以此为准修订） */
export type Candidate = {
  id: string;
  name: string;
  track: 'idol' | 'actor' | 'variety';
  grade: 'A' | 'B' | 'C';
  stats: { performance: number; appearance: number; appeal: number };
  demand: { signBonusMinor: number; shareRate: number; months: number };
  risk: string;
  status: 'pending' | 'negotiating' | 'signed' | 'rejected' | 'expired' | 'poached';
  interviewed: boolean;
  reportDay: number;
  expiresDay: number;
  signedArtistId: string | null;
  origin: 'scout';
};

/** 寻访任务（占员工容量，随 ADVANCE_DAY 结算） */
export type RecruitmentTask = {
  id: string;
  kind: 'recruitment';
  title: string;
  ownerId: string;
  channel: 'scout';
  targetProfile: { track: string };
  budgetMinor: number;
  startedAt: number;
  dueDay: number;
  status: 'active' | 'done';
  result?: string[];
};

export type WorldCommand =
  | { type: 'RENAME_COMPANY'; commandId: string; name: string }
  | { type: 'SIGN_LU'; commandId: string }
  | { type: 'PROLOGUE_TRAIN'; commandId: string; train: boolean }
  | { type: 'ACCEPT_SUMMER_GIG'; commandId: string }
  | { type: 'PR_DECIDE'; commandId: string; method: 'lawyer' | 'statement' | 'cold' }
  | { type: 'ADVANCE_DAY'; commandId: string }
  | { type: 'SETTLE_FIRST_WEEK'; commandId: string }
  | { type: 'START_SCOUTING'; commandId: string; track: string }
  | { type: 'INTERVIEW_CANDIDATE'; commandId: string; candidateId: string }
  | { type: 'SIGN_CANDIDATE'; commandId: string; candidateId: string }
  | { type: 'REJECT_CANDIDATE'; commandId: string; candidateId: string }
  | { type: 'SET_STORY_FLAG'; commandId: string; key: string; value?: boolean | number | string };

export declare function dispatch(world: WorldState, command: WorldCommand): { world: WorldState; events: WorldEvent[] };
export declare function foldCommands(world: WorldState, actions: Array<{ type: string; [k: string]: unknown }>, baseId: string): { world: WorldState; events: WorldEvent[] };

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

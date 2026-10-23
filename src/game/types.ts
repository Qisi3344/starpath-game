/*
 * M1 数据契约 · 类型层（蓝图 P0 第 5 项）
 * 页面消费的统一形状；业务规则在 engine，不在组件。
 * 现有第一周 engine.mjs 的 GameState 保持不动，M1 系统按下列契约增量演进。
 */

/** 游戏内日期：第N年第N月第N日。全局唯一时钟，禁止另开计时器。 */
export type GameDate = { year: number; month: number; day: number };

/** 艺人职业方向（ADR-0003 招募意向共用此枚举） */
export type CareerTrack = 'idol' | 'actor' | 'variety' | 'unlimited';

/** 艺人忙碌状态：驱动列表/详情页的状态标签 */
export type ArtistAvailability = 'idle' | 'training' | 'onGig' | 'busy';

export type Artist = {
  id: string;
  name: string;
  track: CareerTrack;
  /** 等级沿用 V1.6.2：SS/S/A/B/C/D */
  grade: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D';
  /** 核心数值 0-100 */
  stats: { performance: number; appearance: number; appeal: number };
  fans: number;
  availability: ArtistAvailability;
  /** 履历由结算与事件追加，页面只读 */
  history: { date: GameDate; note: string }[];
  /** 培养方向：玩家可改，员工按此执行训练计划 */
  growthGoal: string;
  /** 疲劳 0-100：≥85 拒绝新工作（B2） */
  fatigue?: number;
  /** 月薪（minor）；月末统一发放 */
  salaryMinor?: number;
};

/** 员工（M1 仅林知夏可用；字段为员工系统预留） */
export type Staff = {
  id: string;
  name: string;
  role: 'executiveBroker' | 'scout' | 'publicist' | 'legal' | 'producer';
  /** 并行任务容量上限；任务创建必须检查 */
  capacity: { used: number; max: number };
};

/** 通用工作任务：训练、寻访、通告执行等一切占容量的事 */
export type WorkTask = {
  id: string;
  kind: 'training' | 'recruitment' | 'gigExecution' | 'prWatch';
  title: string;
  ownerId: string;          // Staff 或部门 id
  startedAt: GameDate;
  dueAt: GameDate;
  budgetUsed: number;
  status: 'running' | 'reporting' | 'done' | 'failed' | 'cancelled';
};

/** 招募任务（ADR-0003 核心对象） */
export type RecruitmentTask = {
  id: string;
  ownerId: string;
  channel: 'scout' | 'audition' | 'poach' | 'walkIn';
  targetProfile: { track: CareerTrack; note?: string };
  budget: number;
  startedAt: GameDate;
  dueAt: GameDate;
  status: 'running' | 'reporting' | 'done' | 'failed';
  seed: number;             // 固定种子：读档不得重抽结果
};

/** 候选人：仅在合同 SIGNED 后转为旗下艺人 */
export type Candidate = {
  id: string;
  identity: string;
  currentStatus: 'unknown' | 'contacted' | 'negotiating' | 'rejected' | 'signedElsewhere' | 'expired';
  profile: { track: CareerTrack; grade: 'SS' | 'S' | 'A' | 'B' | 'C' | 'D'; highlight: string; risk?: string };
  expectations: string;
  /** 时效：到期未处理则失联 */
  expiry: GameDate;
};

export type Offer = {
  id: string;
  candidateId: string;
  terms: string;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired';
};

/** 通告：市场列表与详情共用 */
export type Gig = {
  id: string;
  title: string;
  platform: string;
  category: string;
  gross: number;            // 总通告费
  platformFeeRate: number;  // 平台抽成
  artistShareRate: number;  // 艺人分成
  requirements: string;
  days: number;
  status: 'open' | 'accepted' | 'running' | 'done' | 'missed';
  assignedArtistId?: string;
};

/** 手机消息分级（ADR-0003）：仅 needsDecision 中断时间推进 */
export type PhoneMessage = {
  id: string;
  from: string;
  level: 'summary' | 'info' | 'needsDecision' | 'crisis';
  title: string;
  body: string;
  date: GameDate;
  read: boolean;
  /** 可选跳转：消息 → 相关业务实例（同数据，不复制） */
  linkTo?: { kind: 'candidate' | 'gig' | 'task' | 'story'; id: string };
};

/** 结算报告：结算模态全屏消费 */
export type SettlementReport = {
  id: string;
  period: { from: GameDate; to: GameDate };
  lines: { label: string; amount: number }[];
  netCash: number;
  fanDelta: number;
  reputationDelta: number;
};

/** 存读档元信息（落点恢复：读档后至少回到公司 Tab 工作室总览） */
export type SaveMeta = {
  slot: number;
  savedAt: string;          // 现实时间 ISO
  gameDate: GameDate;
  company: string;
  version: number;          // 旧版本存档提示升级/拒绝
};

/** 视图落点：读档恢复界面用；tab + 二级栈 + 全屏层 */
export type TabId = 'company' | 'artists' | 'map' | 'schedule' | 'gigs';
export type OverlayKind = 'none' | 'story' | 'phone' | 'profile' | 'settlement';
export type ViewLocation = {
  tab: TabId;
  /** 二级页栈，空数组即 Tab 首屏 */
  stack: string[];
  overlay: OverlayKind;
};

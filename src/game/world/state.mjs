// 唯一世界状态（B0）：工厂、常量与静态内容。
// 金额内部单位 minor = 1 元整数；旧演示的 `money: 200` 单位是万元，1 万 = 10000 minor。
// 布局对齐 docs/dev/m1-state-and-interaction-contract.md；类型声明见 state.d.mts。

import { createRandomState, serializeRandomState, freshSeed } from './random.mjs';

export const SCHEMA_VERSION = 1;
export const MINOR_PER_WAN = 10000;
export const DAYS_PER_MONTH = 30;
export const MONTHS_PER_YEAR = 12;
export const INITIAL_CASH_WAN = 200;

export function wanToMinor(wan) {
  return Math.round(wan * MINOR_PER_WAN);
}

export const GAME_CLOCK_START = { year: 1, month: 1, day: 1 };

/** 由 absoluteDay（开局为 1）换算年月日；每月固定 30 天 */
export function clockFromAbsolute(absoluteDay) {
  const rest = absoluteDay - 1;
  return {
    year: Math.floor(rest / (DAYS_PER_MONTH * MONTHS_PER_YEAR)) + 1,
    month: Math.floor(rest / DAYS_PER_MONTH) % MONTHS_PER_YEAR + 1,
    day: rest % DAYS_PER_MONTH + 1,
    absoluteDay,
  };
}

/** 静态内容：角色与初始通告（数值是原型调参，非最终平衡；ADR-0002） */
export const CHARACTER_IDS = {
  zhixia: 'zhixia',       // 林知夏 · 首席执行经纪
  lu: 'lu',               // 陆星遥 · 第一位签约艺人（剧情特殊上门，不进人才池）
  yichen: 'yichen',       // 沈亦辰 · 第 2 个月剧情加盟，勿提前入职
};
export const LU_INITIAL_FANS = 5000;
export const SUMMER_GIG = {
  id: 'gig_summer_next_door',
  title: '《夏日邻座》',
  platform: '青柠视频',
  category: '新人生活观察综艺',
  grossMinor: wanToMinor(25),
  platformFeeRate: 0.3,
  // 分成口径（2026-10-12 玩家确认，记入 M1 契约）：平台抽合同总额 30%；
  // 艺人分成基数 = 扣除平台费后的剩余收入，比例 30% → 25 − 7.5 = 17.5，17.5 × 30% = 5.25 万。
  artistShareRate: 0.3,
  artistShareBase: 'after_platform_fee',
  companyNetMinor: wanToMinor(12.25), // 首次竞标保底（V1.6.2 新手规则）
  days: 3,
};

/** 首月固定运营成本（第 7 天周结 / 第 30 天月结各记一次） */
export const PERIOD_OPERATING_COST_MINOR = wanToMinor(2.5);

/** 五城区初始解锁态（文案显示用 industry-districts.ts；此处只存可变进度） */
function initialPlaces() {
  const places = {};
  for (const id of ['north', 'east', 'west', 'south', 'newtown']) {
    places[id] = { id, progress: id === 'north' ? 'locked' : 'preview', unlocked: false };
  }
  return places;
}

/**
 * 新开一局：世界从命名前的序章就存在（公司名可后改），
 * 200 万启动资金随开局建立（V1.6.2：带着 200 万重新开始）。
 */
export function newWorld(companyName = '未命名工作室', seed = freshSeed()) {
  return {
    schemaVersion: SCHEMA_VERSION,
    saveId: 'save-' + seed,
    random: { seed, state: serializeRandomState(createRandomState(seed)) },
    clock: { ...GAME_CLOCK_START, absoluteDay: 1 },
    company: { name: companyName, cashMinor: wanToMinor(INITIAL_CASH_WAN), reputation: 45, level: 1 },
    staff: {
      [CHARACTER_IDS.zhixia]: {
        id: CHARACTER_IDS.zhixia,
        name: '林知夏',
        role: 'executiveBroker',
        capacity: { used: 0, max: 2 }, // 首月兼任寻访（ADR-0003），容量可配置
      },
    },
    artists: {},
    candidatePool: {},
    contracts: {},
    recruitment: {},
    schedules: {},
    gigs: {
      [SUMMER_GIG.id]: {
        id: SUMMER_GIG.id,
        title: SUMMER_GIG.title,
        status: 'available', // available → booked → shooting → released
        assignedArtistId: null,
        grossMinor: SUMMER_GIG.grossMinor,
        companyNetMinor: SUMMER_GIG.companyNetMinor,
      },
    },
    works: {},
    places: initialPlaces(),
    messages: {},
    events: {},
    story: { flags: {}, seenNodes: [] },
    ledger: [],
    processedActionIds: [],
    /** 待审批阻塞：存在时 ADVANCE_DAY 必须拒绝（契约第二节第 1 步） */
    pendingBlocker: null,
  };
}

export function ledgerEntryId(state) {
  return 'le-' + state.clock.absoluteDay + '-' + (state.ledger.length + 1);
}

export function messageId(state, key) {
  return 'msg-' + state.clock.absoluteDay + '-' + key;
}

export function recordEvent(state, eventId, payload) {
  if (state.events[eventId]) throw Error('事件 ' + eventId + ' 已发生过，不可重复触发');
  const next = { ...state, events: { ...state.events, [eventId]: { id: eventId, absoluteDay: state.clock.absoluteDay, ...payload } } };
  return next;
}

/** 向手机写入一条消息；同 id 幂等（读档重放不重写） */
export function pushMessage(state, msg) {
  if (state.messages[msg.id]) return state;
  return { ...state, messages: { ...state.messages, [msg.id]: { read: false, ...msg } } };
}

// 公司运营（M2）：等级晋升、月薪发放、星煌敌对与黑稿、破产缓冲。
// 等级表（V1.6.2 §4.1）：小型→中型（≥500万 / ≥6人 / 口碑≥60）→大型（≥3000万 / ≥15人 / S级≥1 / 口碑≥75）。
import { MINOR_PER_WAN, messageId, pushMessage, ledgerEntryId } from './state.mjs';
import { nextFloat, serializeRandomState } from './random.mjs';

const wan = n => Math.round(n * MINOR_PER_WAN);
const clampLvl = v => Math.max(1, Math.min(4, Math.round(v)));

export const LEVELS = {
  small: { label: '小型工作室', next: 'mid' },
  mid: { label: '中型经纪公司', next: 'big' },
  big: { label: '大型娱乐集团', next: 'giant' },
  giant: { label: '行业巨头', next: null },
};
export const LEVEL_UP_REQ = {
  small: { cashMinor: wan(500), artists: 6, reputation: 60 },
  mid: { cashMinor: wan(3000), artists: 15, sArtists: 1, reputation: 75 },
  big: { cashMinor: wan(20000), artists: 30, sArtists: 3, reputation: 90 },
};
export const OPERATING_BASE_MINOR = wan(2.5);

/** ADVANCE_DAY 钩子（每月最后一天调用）：月薪、运营成本、等级晋升、赤字缓冲 */
export function advanceCompany(state, events) {
  let next = state;
  // level 形态兼容：B0 初始存的是数字 1..4，这里统一规范化为 small/mid/big/giant
  const lvlNames = ['small', 'mid', 'big', 'giant'];
  if (typeof next.company.level === 'number') {
    next = { ...next, company: { ...next.company, level: lvlNames[clampLvl(next.company.level) - 1] } };
  }
  const monthPrefix = Math.floor((next.clock.absoluteDay - 1) / 30);
  const salaries = Object.values(next.artists).reduce((s, a) => s + (a.salaryMinor ?? 0), 0);
  const levelCost = { small: wan(2.5), mid: wan(8), big: wan(25), giant: wan(60) }[next.company.level] ?? wan(2.5);
  const total = salaries + levelCost;
  if (total > 0) {
    next = {
      ...next,
      company: { ...next.company, cashMinor: next.company.cashMinor - total },
      ledger: [...next.ledger,
        { id: ledgerEntryId(next) + '-sal', absoluteDay: next.clock.absoluteDay, kind: 'expense', category: 'salary', amountMinor: salaries, note: '艺人月薪' },
        { id: ledgerEntryId(next) + '-op', absoluteDay: next.clock.absoluteDay, kind: 'expense', category: 'operating', amountMinor: levelCost, note: '工作室运营' },
      ],
    };
    events.push({ type: 'monthlyCost', amountMinor: total });
  }
  // 赤字缓冲：连续 3 个月负现金流 → 破产结局（终章模块判定，这里记档）
  if (next.company.cashMinor < 0) next = { ...next, deficitMonths: (next.deficitMonths ?? 0) + 1 };
  else next = { ...next, deficitMonths: 0 };

  // 等级晋升（月末自动检查）
  const req = LEVEL_UP_REQ[next.company.level];
  if (req) {
    const nArtists = Object.keys(next.artists).length;
    const sCount = Object.values(next.artists).filter(a => a.grade === 'S').length;
    if (next.company.cashMinor >= req.cashMinor && nArtists >= (req.artists ?? 0)
      && next.company.reputation >= req.reputation && sCount >= (req.sArtists ?? 0)) {
      const to = LEVELS[next.company.level].next;
      next = { ...next, company: { ...next.company, level: to } };
      next = pushMessage(next, {
        id: messageId(next, 'levelup_' + to),
        from: '知夏 · 行政',
        level: 'summary',
        title: '公司升级 · ' + LEVELS[to].label,
        body: '条件全部达成，新办公室的钥匙拿到了。可接通告喀位上限提升，我的任务容量也 +1。',
        absoluteDay: next.clock.absoluteDay,
      });
      events.push({ type: 'companyLevelUp', to });
    }
  }
  return { world: next, events };
}

/** 星煌敌对档位 0-3（V1.6.2 敌对度机制）：≥2 时每月黑稿，可花钱公关 */
export function advanceHostility(state, events, rand) {
  let next = state;
  const hostility = next.xinghuang?.hostility ?? 0;
  if (hostility >= 2 && next.clock.day === 12) {
    next = { ...next, random: { ...next.random, state: serializeRandomState(rand.state) } };
    next = {
      ...next,
      company: { ...next.company, reputation: Math.max(0, next.company.reputation - 3) },
    };
    next = pushMessage(next, {
      id: messageId(next, 'smear_' + next.clock.month),
      from: '娱乐风闻',
      level: 'warn',
      title: '星煌的黑稿又来了',
      body: '#' + (next.company.name || '小作坊') + '榨艺人# 挂了一天热搜。口碑 −3。花 8 万让公关部压一压，或者随它去。',
      absoluteDay: next.clock.absoluteDay,
    });
    events.push({ type: 'smeared' });
  }
  return { world: next, events };
}

/** 花钱压黑稿（每月一次） */
export function suppressSmear(state, command) {
  if ((state.xinghuang?.hostility ?? 0) < 2) throw Error('现在没有需要压的热搜');
  const cost = wan(8);
  if (state.company.cashMinor < cost) throw Error('资金不足（公关压制 8 万）');
  let next = {
    ...state,
    company: {
      ...state.company,
      cashMinor: state.company.cashMinor - cost,
      reputation: state.company.reputation + 2,
    },
  };
  next = {
    ...next,
    ledger: [...next.ledger, { id: ledgerEntryId(next) + '-spr', absoluteDay: next.clock.absoluteDay, kind: 'expense', category: 'pr', amountMinor: cost, note: '黑稿公关压制' }],
  };
  next = pushMessage(next, {
    id: messageId(next, 'smear_off_' + next.clock.month),
    from: '公关部',
    level: 'summary',
    title: '热搜压下来了',
    body: '通稿撤了，风向转了。口碑 +2。',
    absoluteDay: next.clock.absoluteDay,
  });
  return { world: next, events: [{ type: 'smearSuppressed' }] };
}

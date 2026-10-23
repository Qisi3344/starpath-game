// 通用排期与艺人培养（B2 · 契约第四节）：训练 / 休息 / 通告执行共用同一张档期表。
// 数值对齐 V1.6.2：D 老师 1 万/天 +2、C 2 万/天 +3、B 5 万/天 +5；疲劳 +8/训练日、+10/录制日；休息 −15/天。
// 疲劳 > 85 拒绝新任务；同一艺人同一天只能有一个安排（档期冲突硬约束）。
import { MINOR_PER_WAN, messageId, pushMessage, ledgerEntryId } from './state.mjs';

const wan = n => Math.round(n * MINOR_PER_WAN);

export const TRAIN_TIERS = {
  D: { costPerDayMinor: wan(1), gain: 2, label: 'D 级老师' },
  C: { costPerDayMinor: wan(2), gain: 3, label: 'C 级教练' },
  B: { costPerDayMinor: wan(5), gain: 5, label: 'B 级导师' },
};
export const FATIGUE_LIMIT = 85;
export const BOND_COST_MINOR = wan(2);
export const BOND_GAIN = 8;
export const BOND_DECAY_PER_MONTH = 3;
export const BOND_BUFF_AT = 80;
export const BOND_TRUST_AT = 60;

/** 联络感情：占 1 天排期，好感 +8。好感 ≥80 解锁羁绊加成（通告收益 +10%）。 */
export function startBonding(state, command) {
  const artist = state.artists[command.artistId];
  if (!artist) throw Error('艺人不存在');
  if (artist.availability === 'onGig') throw Error(artist.name + ' 正在通告中');
  const days = 1;
  const busy = isBusy(state, artist.id, dayOf(state), days);
  if (busy) throw Error('档期冲突：' + artist.name + ' 今天已有安排');
  if (state.company.cashMinor < BOND_COST_MINOR) throw Error('资金不足（2 万）');
  if ((artist.bond ?? 0) >= 100) throw Error(artist.name + ' 的信任已经满溢，把机会留给别人吧');
  const id = 'sch_bond_' + dayOf(state) + '_' + artist.id + '_' + Object.keys(state.schedules).length;
  let next = {
    ...state,
    schedules: {
      ...state.schedules,
      [id]: { id, kind: 'bonding', assigneeId: artist.id, role: 'artist', startDay: dayOf(state), days, linkedId: '', status: 'planned' },
    },
    company: { ...state.company, cashMinor: state.company.cashMinor - BOND_COST_MINOR },
  };
  next = {
    ...next,
    ledger: [...next.ledger, {
      id: ledgerEntryId(next) + '-bond', absoluteDay: dayOf(next), kind: 'expense',
      category: 'bonding', amountMinor: BOND_COST_MINOR, note: '联络感情 · ' + artist.name,
    }],
  };
  return { world: next, events: [{ type: 'bondingScheduled', scheduleId: id, artistId: artist.id }] };
}
export const FATIGUE_TRAIN = 8;
export const FATIGUE_GIG = 10;
export const FATIGUE_REST = -15;

const PRIMARY_STAT = { idol: 'performance', actor: 'performance', variety: 'appeal', unlimited: 'appeal' };
export function primaryStatOf(artist) {
  return PRIMARY_STAT[artist.track] ?? 'performance';
}

function dayOf(state) { return state.clock.absoluteDay; }

/** 艺人某日起的排期占用 */
export function isBusy(state, artistId, startDay, days) {
  for (const s of Object.values(state.schedules)) {
    if (s.assigneeId !== artistId || s.status === 'cancelled') continue;
    if (startDay < s.startDay + s.days && s.startDay < startDay + days) return s;
  }
  return null;
}

export function scheduleStart(state, id, startDay, days) {
  return {
    id, kind: 'training', assigneeId: '', role: 'artist',
    startDay, days, linkedId: '', status: 'planned',
  };
}

/** 发起训练：整段排期立即占位，资金一次付清（预算可见，不日扣） */
export function startTraining(state, command) {
  const artist = state.artists[command.artistId];
  if (!artist) throw Error('艺人不存在');
  if (artist.availability === 'onGig') throw Error(artist.name + ' 正在通告中，抽不开身');
  const tier = TRAIN_TIERS[command.tier];
  if (!tier) throw Error('未知的训练档位');
  const days = Math.max(1, Math.min(14, command.days || 3));
  if (artist.fatigue >= FATIGUE_LIMIT) throw Error(artist.name + ' 已经累垮了（疲劳 ' + artist.fatigue + '），先休息');
  const busy = isBusy(state, artist.id, dayOf(state), days);
  if (busy) throw Error('档期冲突：' + artist.name + ' 在第 ' + busy.startDay + '–' + (busy.startDay + busy.days - 1) + ' 日已有安排');
  const cost = tier.costPerDayMinor * days;
  if (state.company.cashMinor < cost) throw Error('资金不足（' + tier.label + ' × ' + days + ' 天 = ' + cost / MINOR_PER_WAN + ' 万）');
  const id = 'sch_train_' + dayOf(state) + '_' + artist.id + '_' + Object.keys(state.schedules).length;
  let next = {
    ...state,
    schedules: {
      ...state.schedules,
      [id]: { id, kind: 'training', assigneeId: artist.id, role: 'artist', startDay: dayOf(state), days, linkedId: command.tier, status: 'planned' },
    },
    company: { ...state.company, cashMinor: state.company.cashMinor - cost },
  };
  next = {
    ...next,
    ledger: [...next.ledger, {
      id: ledgerEntryId(next) + '-train', absoluteDay: dayOf(next), kind: 'expense',
      category: 'training', amountMinor: cost, note: artist.name + ' · ' + tier.label + ' × ' + days + ' 天',
    }],
  };
  next = pushMessage(next, {
    id: messageId(next, 'train_' + id),
    from: '知夏 · 安排',
    level: 'info',
    title: '训练排上档了',
    body: artist.name + ' 从今天起跟' + tier.label + '特训 ' + days + ' 天，费用 ' + (cost / MINOR_PER_WAN) + ' 万已一次付清。',
    absoluteDay: dayOf(next),
  });
  return { world: next, events: [{ type: 'trainingScheduled', scheduleId: id, artistId: artist.id }] };
}

/** 休息：免费，即时排档 */
export function startRest(state, command) {
  const artist = state.artists[command.artistId];
  if (!artist) throw Error('艺人不存在');
  const days = Math.max(1, Math.min(7, command.days || 2));
  const busy = isBusy(state, artist.id, dayOf(state), days);
  if (busy) throw Error('档期冲突：' + artist.name + ' 已有安排');
  const id = 'sch_rest_' + dayOf(state) + '_' + artist.id + '_' + Object.keys(state.schedules).length;
  const next = {
    ...state,
    schedules: {
      ...state.schedules,
      [id]: { id, kind: 'rest', assigneeId: artist.id, role: 'artist', startDay: dayOf(state), days, linkedId: '', status: 'planned' },
    },
  };
  return { world: next, events: [{ type: 'restScheduled', scheduleId: id }] };
}

/** ADVANCE_DAY 钩子：推进所有到期的排期（训练成长 / 休息恢复 / 疲劳结算） */
export function advanceSchedules(state, events) {
  const day = dayOf(state);
  let next = state;
  for (const s of Object.values(next.schedules)) {
    if (s.status !== 'planned' && s.status !== 'active') continue;
    if (day < s.startDay || day >= s.startDay + s.days) {
      if (s.status === 'active' && day >= s.startDay + s.days) {
        next = { ...next, schedules: { ...next.schedules, [s.id]: { ...s, status: 'done' } } };
      }
      continue;
    }
    const artist = next.artists[s.assigneeId];
    if (!artist) continue;
    if (s.kind === 'training') {
      const tier = TRAIN_TIERS[s.linkedId] || TRAIN_TIERS.D;
      const stat = primaryStatOf(artist);
      const gain = Math.min(tier.gain, Math.max(0, 98 - artist.stats[stat]));
      next = {
        ...next,
        artists: { ...next.artists, [artist.id]: { ...artist, stats: { ...artist.stats, [stat]: artist.stats[stat] + gain }, fatigue: Math.min(100, (artist.fatigue ?? 0) + FATIGUE_TRAIN), availability: 'training' } },
        schedules: { ...next.schedules, [s.id]: { ...s, status: 'active' } },
      };
    } else if (s.kind === 'bonding') {
      const before = artist.bond ?? 0;
      const after = Math.min(100, before + BOND_GAIN);
      let patch = { bond: after, availability: 'idle' };
      next = {
        ...next,
        artists: { ...next.artists, [artist.id]: { ...artist, ...patch } },
        schedules: { ...next.schedules, [s.id]: { ...s, status: 'active' } },
      };
      // 羁绊里程碑（各一次性）：60 信任 → 表现 roll 加成；80 挚友 → 通告收益 +10%
      if (before < BOND_TRUST_AT && after >= BOND_TRUST_AT) {
        next = pushMessage(next, {
          id: messageId(next, 'bond_trust_' + artist.id),
          from: artist.name,
          level: 'report',
          title: '信任 · ' + artist.name,
          body: '「跟了你这段时间，我确定当初没赌错。」好感突破 60——舞台上的她会更放得开。',
          absoluteDay: day,
        });
        next = { ...next, events: { ...next.events, ['bond_trust_' + artist.id]: { id: 'bond_trust_' + artist.id, absoluteDay: day, type: 'bondMilestone' } } };
        events.push({ type: 'bondTrust', artistId: artist.id });
      }
      if (before < BOND_BUFF_AT && after >= BOND_BUFF_AT) {
        next = pushMessage(next, {
          id: messageId(next, 'bond_best_' + artist.id),
          from: '知夏 · 备注',
          level: 'summary',
          title: '挚友 · ' + artist.name,
          body: '好感 80。她已经把这里当家了——之后的通告，她愿意少拿一成报酬跟你一起拼（收益 +10%）。',
          absoluteDay: day,
        });
        next = { ...next, events: { ...next.events, ['bond_best_' + artist.id]: { id: 'bond_best_' + artist.id, absoluteDay: day, type: 'bondMilestone' } } };
        events.push({ type: 'bondBestFriend', artistId: artist.id });
      }
    } else if (s.kind === 'rest') {
      next = {
        ...next,
        artists: { ...next.artists, [artist.id]: { ...artist, fatigue: Math.max(0, (artist.fatigue ?? 0) + FATIGUE_REST), availability: 'idle' } },
        schedules: { ...next.schedules, [s.id]: { ...s, status: 'active' } },
      };
    }
  }
  // 通告录制期疲劳与收工恢复：由 gigs.advanceGigs 负责，这里只处理排期表收尾
  return { world: next, events };
}

/** 月末好感自然衰减（advanceCompany 之后调用） */
export function decayBond(state, events) {
  let next = state;
  for (const a of Object.values(next.artists)) {
    const b = a.bond ?? 0;
    if (b > 0) next = { ...next, artists: { ...next.artists, [a.id]: { ...a, bond: Math.max(0, b - BOND_DECAY_PER_MONTH) } } };
  }
  return { world: next, events };
}

/** 新艺人入场补充字段（疲劳/月薪），供招募与剧情签约共用 */
export function ensureCareerFields(artist, grade) {
  const salary = { D: wan(0.5), C: wan(2), B: wan(8), A: wan(20), S: wan(50) }[grade] ?? wan(0.5);
  return { ...artist, fatigue: artist.fatigue ?? 0, salaryMinor: artist.salaryMinor ?? salary, bond: artist.bond ?? 0, grade };
}

// 复仇线（M3）：三段证据、星煌敌对档位、终章抉择与多结局。
// 证据：旧账户流水 → 前经纪人证词 → 星煌内部邮件（须按序调查，30 万/次，7 天，70% 成）。
// 秘密调查失败才涨敌对（V1.6.2 敌对度口径：秘密行为仅暴露时提档）。
// 终章：三证集齐后任意月末挂 pendingBlocker → 事件卡抉择 → 结局判定。
import { MINOR_PER_WAN, messageId, pushMessage, ledgerEntryId } from './state.mjs';
import { nextFloat, serializeRandomState } from './random.mjs';

const wan = n => Math.round(n * MINOR_PER_WAN);

export const EVIDENCE_KEYS = ['flow', 'testimony', 'email'];
export const EVIDENCE_INFO = {
  flow: { title: '旧账户流水', note: '三年前那笔封口费的银行流水，指向星煌法务部的账户。' },
  testimony: { title: '前经纪人证词', note: '当年经手一切的人，愿意签字画押。' },
  email: { title: '星煌内部邮件', note: '策划那次绯闻的原始邮件，抄送名单上有总裁办。' },
};
export const INVEST_COST_MINOR = wan(30);
export const INVEST_DAYS = 7;

/** 发起秘密调查（占林知夏容量，走 recruitment 任务表，随 ADVANCE_DAY 结算） */
export function startInvestigation(state, command) {
  const done = EVIDENCE_KEYS.filter(k => state.xinghuang?.evidence?.[k]);
  if (done.length >= 3) throw Error('证据已经收集齐了');
  const target = EVIDENCE_KEYS[done.length];
  const staff = state.staff.zhixia;
  if (staff.capacity.used >= staff.capacity.max) throw Error('林知夏手上的任务排满了');
  if (state.company.cashMinor < INVEST_COST_MINOR) throw Error('资金不足（调查经费 30 万）');
  const day = state.clock.absoluteDay;
  const id = 'invest_' + target + '_' + day;
  let next = {
    ...state,
    recruitment: {
      ...state.recruitment,
      [id]: {
        id, kind: 'recruitment', title: '秘密调查 · ' + EVIDENCE_INFO[target].title,
        ownerId: 'zhixia', channel: 'scout', targetProfile: { track: 'invest' },
        budgetMinor: INVEST_COST_MINOR, startedAt: day, dueDay: day + INVEST_DAYS,
        status: 'active', isInvestigation: true, evidenceKey: target,
      },
    },
    staff: { ...state.staff, zhixia: { ...staff, capacity: { ...staff.capacity, used: staff.capacity.used + 1 } } },
    company: { ...state.company, cashMinor: state.company.cashMinor - INVEST_COST_MINOR },
  };
  next = {
    ...next,
    ledger: [...next.ledger, { id: ledgerEntryId(next) + '-inv', absoluteDay: day, kind: 'expense', category: 'investigation', amountMinor: INVEST_COST_MINOR, note: '秘密调查 · ' + EVIDENCE_INFO[target].title }],
  };
  next = pushMessage(next, {
    id: messageId(next, 'inv_go_' + id),
    from: '林知夏',
    level: 'warn',
    title: '这事很危险，但我会小心',
    body: '查「' + EVIDENCE_INFO[target].title + '」，' + INVEST_DAYS + ' 天。一旦被盯上，星煌会更凶——你确定要做，我就走。',
    absoluteDay: day,
  });
  return { world: next, events: [{ type: 'investigationStarted', taskId: id, key: target }] };
}

/** 招募结算钩子里识别调查任务（被 recruitment 的 advance 调用） */
export function settleInvestigation(state, task, events, rand) {
  let next = state;
  const r = nextFloat(next.random.state);
  next = { ...next, random: { ...next.random, state: serializeRandomState(r.state) } };
  const success = r.value < 0.7;
  const key = task.evidenceKey;
  const xh = next.xinghuang ?? { hostility: 0, evidence: {} };
  if (success) {
    const evidence = { ...xh.evidence, [key]: true };
    next = { ...next, xinghuang: { ...xh, evidence } };
    next = pushMessage(next, {
      id: messageId(next, 'inv_ok_' + key),
      from: '林知夏 · 密报',
      level: 'summary',
      title: '拿到了 · ' + EVIDENCE_INFO[key].title,
      body: EVIDENCE_INFO[key].note + ' ' + (EVIDENCE_KEYS.filter(k => evidence[k]).length) + '/3。够数的那天，就是我们上桌的那天。',
      absoluteDay: next.clock.absoluteDay,
    });
    events.push({ type: 'evidenceFound', key });
  } else {
    const hostility = Math.min(3, (xh.hostility ?? 0) + 1);
    next = { ...next, xinghuang: { ...xh, hostility } };
    next = pushMessage(next, {
      id: messageId(next, 'inv_fail_' + key),
      from: '林知夏 · 密报',
      level: 'warn',
      title: '被盯上了 · 调查失败',
      body: '行踪暴露，线索断了。星煌的敌对升到第 ' + hostility + ' 档——接下来会有黑稿，也可能更糟。',
      absoluteDay: next.clock.absoluteDay,
    });
    events.push({ type: 'investigationFailed', key, hostility });
  }
  return next;
}

/** ADVANCE_DAY 钩子：证据集齐后在月末挂终章阻塞（每月检查一次） */
export function checkFinale(state, events) {
  if (state.ending || state.pendingBlocker) return { world: state, events };
  const xh = state.xinghuang;
  const done = EVIDENCE_KEYS.filter(k => xh?.evidence?.[k]).length;
  if (done < 3) return { world: state, events };
  if (state.clock.day !== 30) return { world: state, events };
  const next = {
    ...state,
    pendingBlocker: {
      title: '最后的证据，都在你手里',
      kind: 'finale',
    },
  };
  events.push({ type: 'finaleReady' });
  pushMessage(next, {
    id: messageId(next, 'finale_ready'),
    from: '林知夏',
    level: 'warn',
    title: '三段证据，齐了。',
    body: '怎么用，由你决定。工作室的桌上有最后一道选择题。',
    absoluteDay: next.clock.absoluteDay,
  });
  return { world: next, events };
}

/** 终章抉择与结局判定（契约：选择直接改 WorldState） */
export function resolveFinale(state, command) {
  if (!state.pendingBlocker || state.pendingBlocker.kind !== 'finale') throw Error('终章尚未解锁');
  const choice = command.choice;
  const evidence = EVIDENCE_KEYS.filter(k => state.xinghuang?.evidence?.[k]).length;
  const rep = state.company.reputation;
  let next = state;
  let ending = null;

  if (choice === 'confront') {
    // 公开对峙：口碑 ≥70 且资金 ≥200 万 → 复仇之火；否则被反咬
    if (rep >= 70 && state.company.cashMinor >= wan(200)) {
      ending = {
        id: 'revenge_fire',
        title: '结局 · 复仇之火',
        body: '记者会上你把三段证据一字排开。星煌的股价当天跌去三成，总裁办的灯亮到天明。三年前她们推你下台，今天你站在了更高的地方——这一次，没有人能再把你的名字从灯牌上摘下来。',
      };
    } else {
      next = { ...next, xinghuang: { ...state.xinghuang, hostility: 3 }, company: { ...state.company, reputation: Math.max(0, rep - 8) } };
      next = pushMessage(next, {
        id: messageId(next, 'finale_fail'),
        from: '娱乐风闻',
        level: 'warn',
        title: '对峙失利 · 被反咬一口',
        body: '证据是真的，但你的声量不够。星煌反手一个「过气艺人碰瓷」的热搜。口碑 −8，敌对满档——路还没走完，别停下。',
        absoluteDay: next.clock.absoluteDay,
      });
      next = { ...next, pendingBlocker: null };
      return { world: next, events: [{ type: 'finaleFailed' }] };
    }
  } else if (choice === 'legal') {
    if (evidence >= 3) {
      ending = {
        id: 'dawn_of_law',
        title: '结局 · 清算之日',
        body: '律师把材料递进法院的那天，你只喝了一杯温水。三个月后判决下来：星煌公开道歉，赔偿三百万。没有热搜，没有眼泪，只有白纸黑字。你在朋友圈只发了四个字——「账，清了。」',
      };
      next = {
        ...next,
        company: { ...next.company, cashMinor: next.company.cashMinor + wan(300) },
        ledger: [...next.ledger, { id: ledgerEntryId(next) + '-dmg', absoluteDay: next.clock.absoluteDay, kind: 'income', category: 'settlement', amountMinor: wan(300), note: '星煌名誉侵权赔偿' }],
      };
    } else {
      throw Error('法律途径需要全部三段证据');
    }
  } else if (choice === 'wait') {
    next = { ...next, pendingBlocker: null };
    next = pushMessage(next, {
      id: messageId(next, 'finale_wait'),
      from: '林知夏',
      level: 'info',
      title: '再等等',
      body: '证据先收好。等我们更大、更亮、更稳的那天。',
      absoluteDay: next.clock.absoluteDay,
    });
    return { world: next, events: [{ type: 'finaleDeferred' }] };
  } else {
    throw Error('未知的终章选择');
  }

  next = { ...next, ending, pendingBlocker: null };
  next = recordEndingEvent(next, ending);
  return { world: next, events: [{ type: 'gameEnded', endingId: ending.id }] };
}

function recordEndingEvent(state, ending) {
  return {
    ...state,
    events: { ...state.events, ['ending_' + ending.id]: { id: 'ending_' + ending.id, absoluteDay: state.clock.absoluteDay, type: 'ending' } },
  };
}

/** 破产结局检查（advanceCompany 之后）：连续 3 个月资金为负 → Game Over */
export function checkBankruptcy(state, events) {
  if (state.ending) return { world: state, events };
  if ((state.deficitMonths ?? 0) >= 3) {
    const ending = {
      id: 'abyss',
      title: '结局 · 坠入深渊',
      body: '工作室的门被贴上封条的那天，天气很好。你还欠着艺人三个月的薪水。林知夏把最后一本账目交给你时说：「公司可以没，路不能没。」——但这一次，故事先到这里。',
    };
    const next = recordEndingEvent({ ...state, ending, pendingBlocker: null }, ending);
    return { world: next, events: [{ type: 'gameEnded', endingId: 'abyss' }] };
  }
  return { world: state, events };
}

// 老板委派招募（B1 · ADR-0003）：搜寻任务状态机 + 种子化候选生成 + 审批流。
// 原则：
//  - 一切随机走世界自带的可重放 PRNG（读档重放一致），禁止 Math.random；
//  - 任务占员工容量；到期随 ADVANCE_DAY 结算，0~2 名候选都是合法结果；
//  - 候选是持久化档案：有诉求、风险线索与对手截胡期限，签约必须由老板确认；
//  - 陆星遥（序章上门）与沈亦辰（第二个月剧情）不进人才池，id 前缀区分。

import { MINOR_PER_WAN, CHARACTER_IDS, messageId, pushMessage, ledgerEntryId } from './state.mjs';
import { nextFloat, serializeRandomState } from './random.mjs';

const wan = n => Math.round(n * MINOR_PER_WAN);

// ---- 搜寻方向（V1.6.2 职业枚举的 M1 子集；unlimited 交给林知夏判断） ----
export const SCOUT_TRACKS = [
  { id: 'idol', label: '偶像练习生', desc: '唱跳舞台型，吃粉丝运营' },
  { id: 'actor', label: '影视新人', desc: '剧组试镜渠道，成长慢上限高' },
  { id: 'variety', label: '综艺咖', desc: '效果型选手，来钱快口碑起伏' },
  { id: 'unlimited', label: '不限方向', desc: '听知夏的判断，来什么算什么' },
];

export const SCOUT_COST_MINOR = wan(3);     // 一次外勤寻访经费
export const SCOUT_DURATION = 3;            // 外勤天数
export const CANDIDATE_TTL = 4;             // 候选被对手截胡前的窗口（天）

// ---- 候选生成素材 ----
const SURNAMES = ['苏', '沈', '江', '顾', '白', '许', '温', '祁', '乔', '路', '闻', '池'];
const GIVEN = {
  idol: ['念安', '星野', '一诺', '可微', '亦扬', '初晴', '听澜', '知愿'],
  actor: ['衍', '砚辞', '叙白', '栖迟', '望舒', '既明', '晚吟', '行舟'],
  variety: ['多多', '阿乐', '小满', '笑棠', '闹闹', '乐乐', '圆圆', '皮蛋'],
  unlimited: ['知遥', '未晚', '南绪', '清让', '十一', '昭昭', '时安', '拾意'],
};
const RISKS = [
  '前公司合约还有尾巴，需要法务先过一遍。',
  '脾气不小，上一任经纪人是被她骂走的。',
  '家里人不赞成入行，动摇的时候需要人哄。',
  '网上有过一段被扒的黑历史，热度不高但存在。',
  '同期还有别家在接触，报价可能被抬高。',
  '缺乏舞台经验，前三场演出风险比较高。',
];
const NO_RISK = ['背景干净，试镜记录完整。', '性格稳，肯吃苦，好带。', '诉求简单，只想要一个机会。'];

function pick(rand, list) {
  return list[Math.floor(rand() * list.length) % list.length];
}

function rollGrade(rand) {
  const v = rand();
  if (v < 0.08) return 'A';
  if (v < 0.38) return 'B';
  return 'C';
}

const GRADE_BASE = { A: { performance: 72, appearance: 74, appeal: 70 }, B: { performance: 60, appearance: 62, appeal: 58 }, C: { performance: 46, appearance: 50, appeal: 45 } };

function makeCandidate(rand, id, track, reportDay) {
  const realTrack = track === 'unlimited' ? pick(rand, ['idol', 'actor', 'variety']) : track;
  const grade = rollGrade(rand);
  const base = GRADE_BASE[grade];
  const jitter = () => Math.round((rand() - 0.5) * 10);
  const hasRisk = rand() < 0.35;
  const bonusWan = { A: 8 + Math.round(rand() * 7), B: 4 + Math.round(rand() * 4), C: 1 + Math.round(rand() * 3) }[grade];
  return {
    id,
    name: pick(rand, SURNAMES) + pick(rand, GIVEN[realTrack] ?? GIVEN.unlimited),
    track: realTrack,
    grade,
    stats: {
      performance: Math.min(95, Math.max(20, base.performance + jitter())),
      appearance: Math.min(95, Math.max(20, base.appearance + jitter())),
      appeal: Math.min(95, Math.max(20, base.appeal + jitter())),
    },
    demand: {
      signBonusMinor: wan(bonusWan),
      shareRate: pick(rand, [0.2, 0.25, 0.3, 0.35]),
      months: pick(rand, [6, 12, 12, 18]),
    },
    risk: hasRisk ? pick(rand, RISKS) : pick(rand, NO_RISK),
    status: 'pending',            // pending → negotiating → signed / rejected / expired / poached
    interviewed: false,
    reportDay,
    expiresDay: reportDay + CANDIDATE_TTL,
    signedArtistId: null,
    origin: 'scout',
  };
}

/** 到期结算：生成 0~2 名候选（结果由世界随机数决定，可重放） */
function rollCandidateCount(rand) {
  const v = rand();
  if (v < 0.15) return 0;       // 白跑一趟也是真实结果（ADR-0003）
  if (v < 0.62) return 1;
  return 2;
}

/**
 * ADVANCE_DAY 钩子（在 commands.advanceDay 的过期/结算段调用）：
 *  1) 任务到期 → 结算容量、生成候选、写汇报消息；
 *  2) 候选过窗 → 对手截胡或冷却退出。
 * 返回 { world, events }；随机数一律写回 state.random。
 */
export function advanceRecruitment(state, events) {
  const day = state.clock.absoluteDay;
  let next = state;
  const rand = () => {
    const r = nextFloat(next.random.state);
    next = { ...next, random: { ...next.random, state: serializeRandomState(r.state) } };
    return r.value;
  };

  // 1) 到期任务结算
  for (const task of Object.values(next.recruitment)) {
    if (task.status !== 'active' || day < task.dueDay) continue;
    const count = rollCandidateCount(rand);
    const made = [];
    for (let i = 0; i < count; i++) {
      const id = 'cand_' + task.id + '_' + (i + 1);
      made.push(makeCandidate(rand, id, task.targetProfile.track, day));
    }
    const pool = { ...next.candidatePool };
    made.forEach(c => (pool[c.id] = c));
    const staff = next.staff[task.ownerId];
    next = {
      ...next,
      candidatePool: pool,
      recruitment: { ...next.recruitment, [task.id]: { ...task, status: 'done', result: made.map(c => c.id) } },
      staff: { ...next.staff, [task.ownerId]: { ...staff, capacity: { ...staff.capacity, used: Math.max(0, staff.capacity.used - 1) } } },
    };
    const trackLabel = (SCOUT_TRACKS.find(t => t.id === task.targetProfile.track) || SCOUT_TRACKS[3]).label;
    next = pushMessage(next, {
      id: messageId(next, 'scout_' + task.id),
      from: '知夏 · 外勤',
      level: made.length ? 'report' : 'info',
      title: made.length ? '寻访回来了：' + made.length + ' 份候选人档案' : '这一趟没有合适的人',
      body: made.length
        ? made.map(c => c.name + '（' + c.grade + ' 级，签约金 ' + (c.demand.signBonusMinor / MINOR_PER_WAN).toFixed(1) + ' 万）').join('；') +
          '。档案在工作台，' + CANDIDATE_TTL + ' 天内不定，就会被别家抢走。'
        : trackLabel + '这个方向问了一圈，这批人都不合适。经费花完了，下次换个方向或者再等等。',
      absoluteDay: day,
    });
    events.push({ type: 'scoutReported', taskId: task.id, count: made.length });
  }

  // 2) 候选过窗：约一半被对手签走，其余冷却退场（状态保留，审计可查）
  for (const cand of Object.values(next.candidatePool)) {
    if ((cand.status !== 'pending' && cand.status !== 'negotiating') || day < cand.expiresDay) continue;
    const poached = rand() < 0.5;
    const pool = { ...next.candidatePool, [cand.id]: { ...cand, status: poached ? 'poached' : 'expired' } };
    next = { ...next, candidatePool: pool };
    next = pushMessage(next, {
      id: messageId(next, 'cand_' + cand.id),
      from: poached ? '行业风声' : '知夏 · 跟进',
      level: poached ? 'warn' : 'info',
      title: poached ? cand.name + ' 被别家签走了' : cand.name + ' 的窗口期过了',
      body: poached
        ? '对手开的条件比我们的口径好。下一次要更快做决定。'
        : '她没有等到答复，暂时联系不上了。人才市场上机会永远比耐心多。',
      absoluteDay: day,
    });
    events.push({ type: poached ? 'candidatePoached' : 'candidateExpired', candidateId: cand.id });
  }
  return { world: next, events };
}

// ---- 命令实现（由 commands.mjs 的 dispatch 分发） ----

/** 发起寻访：只有老板能下单；占林知夏容量；经费立刻出账 */
export function startScouting(state, command) {
  if (!state.story.flags.firstWeekSettled) throw Error('序章还没结束，先把第一周走完');
  const track = SCOUT_TRACKS.find(t => t.id === command.track);
  if (!track) throw Error('未知的寻访方向：' + command.track);
  const staff = state.staff[CHARACTER_IDS.zhixia];
  if (!staff) throw Error('没有可委派的经纪人');
  if (staff.capacity.used >= staff.capacity.max) throw Error('林知夏手上的任务已经排满了');
  if (state.company.cashMinor < SCOUT_COST_MINOR) throw Error('资金不足（寻访经费 ' + SCOUT_COST_MINOR / MINOR_PER_WAN + ' 万）');
  const day = state.clock.absoluteDay;
  const id = 'scout_' + day + '_' + track.id + '_' + Object.keys(state.recruitment).length;
  const task = {
    id,
    kind: 'recruitment',
    title: '寻访 · ' + track.label,
    ownerId: CHARACTER_IDS.zhixia,
    channel: 'scout',
    targetProfile: { track: track.id },
    budgetMinor: SCOUT_COST_MINOR,
    startedAt: day,
    dueDay: day + SCOUT_DURATION,
    status: 'active',
  };
  let next = {
    ...state,
    recruitment: { ...state.recruitment, [id]: task },
    staff: { ...state.staff, [CHARACTER_IDS.zhixia]: { ...staff, capacity: { ...staff.capacity, used: staff.capacity.used + 1 } } },
    company: { ...state.company, cashMinor: state.company.cashMinor - SCOUT_COST_MINOR },
  };
  next = {
    ...next,
    ledger: [...next.ledger, {
      id: ledgerEntryId(next) + '-scout', absoluteDay: day, kind: 'expense',
      category: 'recruitment', amountMinor: SCOUT_COST_MINOR, note: '寻访经费 · ' + track.label,
    }],
  };
  next = pushMessage(next, {
    id: messageId(next, 'scout_go_' + id),
    from: '林知夏',
    level: 'info',
    title: '收到，我出门一趟',
    body: track.id === 'unlimited' ? '不设方向的话就按我的眼光来。' + SCOUT_DURATION + ' 天后带候选人档案回来。' : '去问问' + track.label + '的口子，' + SCOUT_DURATION + ' 天内给你消息。',
    absoluteDay: day,
  });
  return { world: next, events: [{ type: 'scoutStarted', taskId: id }] };
}

export function getCandidate(state, candidateId) {
  const cand = state.candidatePool[candidateId];
  if (!cand) throw Error('候选人档案不存在：' + candidateId);
  return cand;
}

function patchCandidate(state, id, patch) {
  const cur = getCandidate(state, id);
  return { ...state, candidatePool: { ...state.candidatePool, [id]: { ...cur, ...patch } } };
}

/** 约谈：免费，只加深了解（把风险线索从「听说」变成「已确认」） */
export function interviewCandidate(state, command) {
  const cand = getCandidate(state, command.candidateId);
  if (cand.status !== 'pending' && cand.status !== 'negotiating') throw Error('这份档案已经关闭了');
  let next = patchCandidate(state, command.candidateId, { status: 'negotiating', interviewed: true });
  next = pushMessage(next, {
    id: messageId(next, 'interview_' + command.candidateId),
    from: '知夏 · 跟进',
    level: 'info',
    title: '约谈完成 · ' + cand.name,
      body: '当面聊过了。' + (cand.risk.startsWith('背景') || cand.risk.startsWith('性格') || cand.risk.startsWith('诉求') ? cand.risk : '补充确认：' + cand.risk),
    absoluteDay: state.clock.absoluteDay,
  });
  return { world: next, events: [{ type: 'candidateInterviewed', candidateId: command.candidateId }] };
}

/** 老板批准签约：扣签约金、候选转正为艺人、写合同与账本 */
export function signCandidate(state, command) {
  const cand = getCandidate(state, command.candidateId);
  if (cand.status !== 'pending' && cand.status !== 'negotiating') throw Error('这份档案已经关闭了（' + cand.status + '）');
  const day = state.clock.absoluteDay;
  if (day >= cand.expiresDay) throw Error('这位候选人的窗口期已过，签不了了');
  if (state.company.cashMinor < cand.demand.signBonusMinor) throw Error('资金不足（签约金 ' + (cand.demand.signBonusMinor / MINOR_PER_WAN).toFixed(1) + ' 万）');
  const artistId = 'a' + cand.id.slice(4);          // cand_xxx → axxx
  const artist = {
    id: artistId,
    name: cand.name,
    track: cand.track,
    grade: cand.grade,
    stats: cand.stats,
    fans: { A: 8000, B: 3000, C: 800 }[cand.grade] ?? 500,
    availability: 'idle',
    history: [{ date: state.clock, note: '通过寻访签约入司' }],
    growthGoal: '',
  };
  const contractId = 'contract_' + artistId;
  let next = {
    ...state,
    artists: { ...state.artists, [artistId]: artist },
    contracts: {
      ...state.contracts,
      [contractId]: {
        id: contractId, artistId, kind: 'scout',
        signBonusMinor: cand.demand.signBonusMinor,
        shareRate: cand.demand.shareRate,
        months: cand.demand.months,
        startDay: day,
      },
    },
    company: { ...state.company, cashMinor: state.company.cashMinor - cand.demand.signBonusMinor },
  };
  next = {
    ...next,
    ledger: [...next.ledger, {
      id: ledgerEntryId(next) + '-sign', absoluteDay: day, kind: 'expense',
      category: 'signing', amountMinor: cand.demand.signBonusMinor, note: '签约金 · ' + cand.name,
    }],
  };
  next = patchCandidate(next, cand.id, { status: 'signed', signedArtistId: artistId });
  next = pushMessage(next, {
    id: messageId(next, 'sign_' + cand.id),
    from: '知夏 · 财务',
    level: 'summary',
    title: '签约完成 · ' + cand.name,
    body: '签约金 ' + (cand.demand.signBonusMinor / MINOR_PER_WAN).toFixed(1) + ' 万已出账，分成 ' + Math.round(cand.demand.shareRate * 100) + '%，合约 ' + cand.demand.months + ' 个月。欢迎新家人。',
    absoluteDay: day,
  });
  return { world: next, events: [{ type: 'artistSigned', artistId }] };
}

/** 拒绝候选：礼貌退档，不占窗口 */
export function rejectCandidate(state, command) {
  const cand = getCandidate(state, command.candidateId);
  if (cand.status !== 'pending' && cand.status !== 'negotiating') throw Error('这份档案已经关闭了');
  let next = patchCandidate(state, command.candidateId, { status: 'rejected' });
  next = pushMessage(next, {
    id: messageId(next, 'reject_' + cand.id),
    from: '知夏 · 跟进',
    level: 'info',
    title: '已婉拒 · ' + cand.name,
    body: '档案退回人才库了，双方保持联系。机会不合适就不勉强。',
    absoluteDay: state.clock.absoluteDay,
  });
  return { world: next, events: [{ type: 'candidateRejected', candidateId: cand.id }] };
}

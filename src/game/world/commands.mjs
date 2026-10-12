// 唯一世界状态的命令处理（B0）：纯函数 dispatch(world, command) → { world, events }。
// 不变量（契约）：
//  - 幂等：同 commandId 重复提交直接返回原状态，不二次扣款/结算/抽卡。
//  - 单一 ADVANCE_DAY 推进日期；待审批阻塞存在时拒绝推进。
//  - 账本入账与现金变化一一对应，重复打开结算页不再发钱。
// 序章第一周的规则语义与旧 engine.mjs 保持一致（W01/W02 数值不变）。

import {
  SCHEMA_VERSION, MINOR_PER_WAN, DAYS_PER_MONTH,
  CHARACTER_IDS, LU_INITIAL_FANS, SUMMER_GIG, PERIOD_OPERATING_COST_MINOR,
  clockFromAbsolute, ledgerEntryId, messageId, recordEvent, pushMessage,
} from './state.mjs';
import { nextFloat, serializeRandomState } from './random.mjs';

const wan = n => Math.round(n * MINOR_PER_WAN);

function apply(state, change) {
  return { ...state, ...change };
}

function patchArtist(state, id, patch) {
  const cur = state.artists[id];
  if (!cur) throw Error('艺人不存在：' + id);
  return { ...state, artists: { ...state.artists, [id]: { ...cur, ...patch } } };
}

function patchGig(state, id, patch) {
  const cur = state.gigs[id];
  if (!cur) throw Error('通告不存在：' + id);
  return { ...state, gigs: { ...state.gigs, [id]: { ...cur, ...patch } } };
}

function withFlag(state, key, value) {
  return { ...state, story: { ...state.story, flags: { ...state.story.flags, [key]: value } } };
}

function addLedger(state, entries) {
  return { ...state, ledger: [...state.ledger, ...entries] };
}

function ledgerLine(state, kind, category, amountMinor, note) {
  return { id: ledgerEntryId(state) + '-' + category, absoluteDay: state.clock.absoluteDay, kind, category, amountMinor, note };
}

function changeCash(state, deltaMinor) {
  return { ...state, company: { ...state.company, cashMinor: state.company.cashMinor + deltaMinor } };
}

function requireDay(state, absoluteDay, what) {
  if (state.clock.absoluteDay !== absoluteDay) throw Error(what + ' 只能在第 ' + absoluteDay + ' 天进行');
}

/** 统一入口：所有世界状态变更必须经过这里 */
export function dispatch(world, command) {
  if (!world || world.schemaVersion !== SCHEMA_VERSION) throw Error('世界状态版本不匹配，无法执行命令');
  if (!command || typeof command.commandId !== 'string' || command.commandId.length === 0) {
    throw Error('命令缺少 commandId，无法安全执行');
  }
  if (world.processedActionIds.includes(command.commandId)) {
    return { world, events: [] }; // 幂等重放：读档/双击/重试不产生第二次效果
  }
  const result = runCommand(world, command);
  const withId = {
    ...result.world,
    processedActionIds: [...result.world.processedActionIds, command.commandId],
  };
  return { world: withId, events: result.events };
}

/**
 * UI 操作层辅助（审查必修 2）：把一次交互产生的命令按序折叠进世界状态。
 * 同一交互共享 baseId（子命令 -0/-1…），整组重放幂等；调用方必须"成功才提交"——
 * 折叠中途抛错时丢弃返回值，调用方世界保持原引用，不产生半更新。
 */
export function foldCommands(world, actions, baseId) {
  if (!Array.isArray(actions) || actions.length === 0) return { world, events: [] };
  let s = world;
  const events = [];
  actions.forEach((a, i) => {
    const r = dispatch(s, { ...a, commandId: baseId + '-' + i });
    s = r.world;
    events.push(...r.events);
  });
  return { world: s, events };
}

function runCommand(state, command) {
  switch (command.type) {
    case 'RENAME_COMPANY': return renameCompany(state, command);
    case 'SIGN_LU': return signLu(state);
    case 'PROLOGUE_TRAIN': return prologueTrain(state, command);
    case 'ACCEPT_SUMMER_GIG': return acceptSummerGig(state);
    case 'PR_DECIDE': return prDecide(state, command);
    case 'ADVANCE_DAY': return advanceDay(state);
    case 'SETTLE_FIRST_WEEK': return settleFirstWeek(state);
    case 'SET_STORY_FLAG': {
      // 剧情标记（如序章心境 mood）：进存档，读档后剧情文案可复现
      if (typeof command.key !== 'string' || command.key.length === 0) throw Error('缺少剧情标记名');
      return { world: withFlag(state, command.key, command.value ?? true), events: [] };
    }
    default: throw Error('未知命令类型：' + command.type);
  }
}

// ---- 序章命令（第一周脚本语义，ADR-0002；通用化在 B1/B2） ----

function renameCompany(state, command) {
  const name = String(command.name ?? '').trim().slice(0, 20) || '星芒事务所';
  return { world: { ...state, company: { ...state.company, name } }, events: [] };
}

/** Day1 陆星遥剧情上门：唯一特殊签约入口，不进人才池（ADR-0003） */
function signLu(state) {
  requireDay(state, 1, '陆星遥的签约');
  if (state.artists[CHARACTER_IDS.lu]) throw Error('陆星遥已经在旗下');
  const lu = {
    id: CHARACTER_IDS.lu,
    name: '陆星遥',
    track: 'idol',
    grade: 'D',
    stats: { performance: 55, appearance: 82, appeal: 45 },
    fans: LU_INITIAL_FANS,
    availability: 'idle',
    history: [],
    growthGoal: '全能偶像',
  };
  let next = { ...state, artists: { ...state.artists, [CHARACTER_IDS.lu]: lu } };
  next = withFlag(next, 'luSigned', true);
  next = recordEvent(next, 'sign_lu', { type: 'signing', note: '陆星遥零底薪加入' });
  return { world: next, events: [{ type: 'artistSigned', artistId: CHARACTER_IDS.lu }] };
}

/** Day2 二选一：练基本功（-1 万，唱跳 +3）或先找通告。B0 即时生效，通用排期在 B2。 */
function prologueTrain(state, command) {
  requireDay(state, 2, '序章训练决策');
  if (state.story.flags.prologueTrainDone) throw Error('今天的安排已经定下了');
  const train = command.train === true;
  let next = withFlag(state, 'prologueTrainDone', true);
  if (train) {
    if (state.company.cashMinor < wan(1)) throw Error('资金不足');
    next = changeCash(next, -wan(1));
    next = addLedger(next, [ledgerLine(next, 'expense', 'training', wan(1), '唱跳特训')]);
    next = patchArtist(next, CHARACTER_IDS.lu, { stats: { ...state.artists[CHARACTER_IDS.lu].stats, performance: 58 } });
    next = withFlag(next, 'trained', true);
  }
  return { world: next, events: [{ type: 'trainingDecided', trained: train }] };
}

/** Day3 接下《夏日邻座》（首次竞标保底，V1.6.2 新手规则） */
function acceptSummerGig(state) {
  requireDay(state, 3, '《夏日邻座》的承接');
  const gig = state.gigs[SUMMER_GIG.id];
  if (!gig || gig.status !== 'available') throw Error('该通告已不在可接状态');
  if (!state.artists[CHARACTER_IDS.lu]) throw Error('没有可指派的艺人');
  let next = patchGig(state, SUMMER_GIG.id, { status: 'booked', assignedArtistId: CHARACTER_IDS.lu });
  next = withFlag(next, 'summerGigAccepted', true);
  next = recordEvent(next, 'accept_summer_gig', { type: 'gigAccepted', gigId: SUMMER_GIG.id });
  return { world: next, events: [{ type: 'gigAccepted', gigId: SUMMER_GIG.id }] };
}

/** Day5 舆情三选一（序章剧情决策，只生效一次） */
function prDecide(state, command) {
  requireDay(state, 5, '公关决策');
  if (state.story.flags.prChoice) throw Error('这次舆情已经处理过了');
  const options = {
    lawyer: { cost: wan(20), rep: 5, label: '委托律师' },
    statement: { cost: 0, rep: 2, label: '公开说明' },
    cold: { cost: 0, rep: -5, label: '冷处理' },
  };
  const choice = options[command.method];
  if (!choice) throw Error('无效的公关选项');
  if (state.company.cashMinor < choice.cost) throw Error('资金不足');
  let next = withFlag(state, 'prChoice', command.method);
  if (choice.cost > 0) {
    next = changeCash(next, -choice.cost);
    next = addLedger(next, [ledgerLine(next, 'expense', 'pr', choice.cost, choice.label)]);
  }
  next = { ...next, company: { ...next.company, reputation: next.company.reputation + choice.rep } };
  next = recordEvent(next, 'pr_' + command.method, { type: 'prDecision', method: command.method });
  return { world: next, events: [{ type: 'prDecided', method: command.method }] };
}

// ---- 日推进（契约第二节；B0 覆盖序章 7 天 + 自由推进到月末） ----

/**
 * 第一周主线门禁：推离某天前必须完成的关键节点（ADR-0002 序章节奏）。
 * 未过门禁拒绝 ADVANCE_DAY，防止裸推日跳过剧情导致周结死局（审查必修 3）。
 */
const FIRST_WEEK_GATES = {
  1: w => w.story.flags.luSigned === true || '陆星遥的签约还没有完成',
  2: w => w.story.flags.prologueTrainDone === true || '今天的训练安排还没有决定',
  3: w => w.story.flags.summerGigAccepted === true || '《夏日邻座》还没有回复对方',
  5: w => w.story.flags.prChoice != null || '热搜危机还没有处理',
  7: w => w.story.flags.firstWeekSettled === true || '第一周还没有结算',
};

function advanceDay(state) {
  if (state.pendingBlocker) {
    throw Error('有待处理的重要事件：' + state.pendingBlocker.title);
  }
  const gate = FIRST_WEEK_GATES[state.clock.absoluteDay];
  if (gate) {
    const verdict = gate(state);
    if (verdict !== true) throw Error('今天还不能结束：' + verdict);
  }
  const events = [];
  const day = state.clock.absoluteDay;
  let next = state;
  let gig = next.gigs[SUMMER_GIG.id];

  // 2-3. 今日已安排的工作：通告从第 4 天起进入录制，第 6 天收工并写入作品履历
  if (gig && gig.status === 'booked' && day >= 4) {
    next = patchGig(next, SUMMER_GIG.id, { status: 'shooting' });
    next = patchArtist(next, CHARACTER_IDS.lu, { availability: 'onGig' });
    gig = next.gigs[SUMMER_GIG.id];
    events.push({ type: 'gigStarted', gigId: SUMMER_GIG.id });
  }
  if (gig && gig.status === 'shooting' && day >= 6) {
    next = patchGig(next, SUMMER_GIG.id, { status: 'released' });
    const workId = 'work_' + SUMMER_GIG.id;
    next = { ...next, works: { ...next.works, [workId]: {
      id: workId, gigId: SUMMER_GIG.id, artistId: CHARACTER_IDS.lu,
      title: SUMMER_GIG.title, kind: 'variety', role: '嘉宾',
      finishedAbsoluteDay: day,
      note: '新人首档综艺，完成度' + (next.story.flags.trained ? '良好，节奏感被导演点名。' : '生涩但真诚。'),
    } } };
    next = patchArtist(next, CHARACTER_IDS.lu, {
      availability: 'idle',
      history: [...next.artists[CHARACTER_IDS.lu].history, { absoluteDay: day, note: '完成《夏日邻座》录制' }],
    });
    events.push({ type: 'gigReleased', gigId: SUMMER_GIG.id });
  }

  // 4. 机会过期处理：B0 阶段无候选/外部机会；B1 在此处按截止日统一裁决
  // 5. 持久化随机数驱动的世界脉搏（每次推进恰好消耗 1 个随机数，保证读档重放一致）
  const roll = nextFloat(next.random.state);
  next = { ...next, random: { ...next.random, state: serializeRandomState(roll.state) } };
  if (day >= 8 && roll.value < 0.12) {
    next = pushMessage(next, {
      id: messageId(next, 'rumor'),
      from: '娱乐风闻',
      level: 'info',
      title: '圈内动态',
      body: '有同行在打听你们工作室的近况。林知夏说：先不用理，做好手上的事。',
      absoluteDay: day,
    });
    events.push({ type: 'worldPulse' });
  }

  // 6. 月末（每 30 天）总结：只汇总账本，不重复发钱
  if (day % DAYS_PER_MONTH === 0) {
    const monthNet = monthlyNetMinor(next);
    next = pushMessage(next, {
      id: messageId(next, 'month-close'),
      from: '知夏 · 财务',
      level: 'summary',
      title: '第 ' + next.clock.month + ' 月 · 月度小结',
      body: '本月账面净变化 ' + (monthNet >= 0 ? '+' : '') + (monthNet / MINOR_PER_WAN).toFixed(2) + ' 万，明细都在账本里。',
      absoluteDay: day,
    });
    const closed = recordEvent(next, 'month_close_' + next.clock.year + '_' + next.clock.month, { type: 'monthlyClose', netMinor: monthNet });
    next = closed;
    events.push({ type: 'monthlyClosed', month: next.clock.month, netMinor: monthNet });
  }

  // 6. 全部变更校验成功后才推进时钟
  const absoluteDay = day + 1;
  next = { ...next, clock: clockFromAbsolute(absoluteDay) };
  events.push({ type: 'dayAdvanced', absoluteDay });
  return { world: next, events };
}

function monthlyNetMinor(state) {
  const monthPrefix = Math.floor((state.clock.absoluteDay - 1) / DAYS_PER_MONTH);
  return state.ledger
    .filter(e => Math.floor((e.absoluteDay - 1) / DAYS_PER_MONTH) === monthPrefix)
    .reduce((sum, e) => sum + (e.kind === 'expense' ? -e.amountMinor : e.amountMinor), 0);
}

// ---- 结算 ----

/** Day7 周结：收入拆分明细入账，重复结算不发钱（W09） */
function settleFirstWeek(state) {
  requireDay(state, 7, '第一周结算');
  if (state.story.flags.firstWeekSettled) throw Error('第一周已经结算过了');
  const gig = state.gigs[SUMMER_GIG.id];
  if (!gig || gig.status !== 'released') throw Error('第一周的通告尚未完成，不能结算');
  const gross = SUMMER_GIG.grossMinor;
  const platformFee = Math.round(gross * SUMMER_GIG.platformFeeRate);
  // 分成基数 = 扣除平台费后的剩余收入（玩家确认口径）：(25 − 7.5) × 30% = 5.25 万
  const artistShare = Math.round((gross - platformFee) * SUMMER_GIG.artistShareRate);
  const net = gross - platformFee - artistShare;
  if (net !== SUMMER_GIG.companyNetMinor) throw Error('分成计算与预期不符，拒绝入账');

  let next = state;
  next = changeCash(next, net - PERIOD_OPERATING_COST_MINOR); // 净流入 = 12.25 − 运营 2.5 = 9.75（与旧引擎一致）
  next = addLedger(next, [
    ledgerLine(next, 'income', 'gig', gross, '《夏日邻座》总通告费'),
    ledgerLine(next, 'expense', 'platform_fee', platformFee, '平台抽成 30%'),
    ledgerLine(next, 'expense', 'artist_share', artistShare, '艺人分成 30%'),
    ledgerLine(next, 'expense', 'operating', PERIOD_OPERATING_COST_MINOR, '工作室运营支出'),
  ]);
  const trained = state.story.flags.trained === true;
  const fanDelta = trained ? 3600 : 2400;
  next = patchArtist(next, CHARACTER_IDS.lu, { fans: next.artists[CHARACTER_IDS.lu].fans + fanDelta });
  next = withFlag(next, 'firstWeekSettled', true);
  next = pushMessage(next, {
    id: 'msg-settle-week-1',
    from: '知夏 · 财务',
    level: 'summary',
    title: '第一周 · 结算完成',
    body: '通告净收入 ' + (net / MINOR_PER_WAN).toFixed(2) + ' 万已入账。明细可在个人档案的账本里查看。',
    absoluteDay: state.clock.absoluteDay,
  });
  const settled = recordEvent(next, 'settle_week_1', { type: 'weeklySettle', netMinor: net, fanDelta });
  return { world: settled, events: [{ type: 'weekSettled', netMinor: net, fanDelta }] };
}

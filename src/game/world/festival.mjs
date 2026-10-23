// 选秀赛事「青柠新星季」（M3 · V1.6.2 第六章简化版）：第 4/8 月开启报名，三阶段推进。
// score = 主能力×0.5 + 人气/1500×0.3 + 打榜投入×0.2 + roll×20；达线晋级。
import { MINOR_PER_WAN, messageId, pushMessage, ledgerEntryId } from './state.mjs';
import { nextFloat, serializeRandomState } from './random.mjs';
import { primaryStatOf } from './career.mjs';

const wan = n => Math.round(n * MINOR_PER_WAN);
export const SIGNUP_FEE_MINOR = wan(5);
export const BOOSTS = [
  { id: 'low', costMinor: wan(2), add: 6, label: '打榜 2 万' },
  { id: 'mid', costMinor: wan(5), add: 12, label: '打榜 5 万' },
  { id: 'high', costMinor: wan(10), add: 20, label: '打榜 10 万' },
];
export const SIGNUP_MONTHS = [4, 8];

/** ADVANCE_DAY 钩子：报名窗口开启 / 阶段推进 / 结算 */
export function advanceFestival(state, events, rand) {
  let next = state;
  const day = next.clock.absoluteDay;
  const fest = next.festival;

  // 报名窗口：4 月 / 8 月的 1–3 日
  if (!fest || fest.status === 'idle' || fest.status === 'done') {
    if (SIGNUP_MONTHS.includes(next.clock.month) && next.clock.day <= 3 && Object.keys(next.artists).length) {
      next = { ...next, festival: { status: 'signup', stage: 0, artistId: null, boosts: [], log: [] } };
      next = pushMessage(next, {
        id: messageId(next, 'fest_open'),
        from: '青柠视频 · 节目组',
        level: 'report',
        title: '「青柠新星季」报名开启',
        body: '报名费 5 万，三阶段角逐：初选 → 公演 → 决赛。冠军奖金 10 万，人气口碑双收。3 日内报名。',
        absoluteDay: day,
      });
      events.push({ type: 'festivalSignupOpen' });
    }
    return { world: next, events };
  }

  if (fest.status === 'signup' && next.clock.day > 3) {
    // 没报名就流局
    next = { ...next, festival: { status: 'done', stage: 0, artistId: null, boosts: [], log: [] } };
    return { world: next, events };
  }

  if (fest.status === 'running') {
    // 每隔 2 天推进一阶段
    if (day - fest.lastStageDay < 2) return { world: next, events };
    return runStage(next, events, rand);
  }
  return { world: next, events };
}

/** 报名 */
export function signupFestival(state, command) {
  const fest = state.festival;
  if (!fest || fest.status !== 'signup') throw Error('现在不在报名期');
  const artist = state.artists[command.artistId];
  if (!artist) throw Error('先选一位参赛艺人');
  if (artist.availability === 'onGig') throw Error(artist.name + ' 在录制中，赶不过来');
  if (state.company.cashMinor < SIGNUP_FEE_MINOR) throw Error('资金不足（报名费 5 万）');
  let next = {
    ...state,
    company: { ...state.company, cashMinor: state.company.cashMinor - SIGNUP_FEE_MINOR },
    festival: { status: 'running', stage: 1, artistId: artist.id, boosts: [], lastStageDay: state.clock.absoluteDay, log: ['报名成功'] },
  };
  next = {
    ...next,
    ledger: [...next.ledger, { id: ledgerEntryId(next) + '-fest', absoluteDay: next.clock.absoluteDay, kind: 'expense', category: 'festival', amountMinor: SIGNUP_FEE_MINOR, note: '新星季报名费 · ' + artist.name }],
  };
  next = pushMessage(next, {
    id: messageId(next, 'fest_in'),
    from: '青柠视频 · 节目组',
    level: 'info',
    title: '参赛确认 · ' + artist.name,
    body: '初选两天后开播。每阶段都可以打榜助威，越投入走得越远。',
    absoluteDay: next.clock.absoluteDay,
  });
  return { world: next, events: [{ type: 'festivalEntered', artistId: artist.id }] };
}

/** 阶段打榜（每阶段一次） */
export function boostFestival(state, command) {
  const fest = state.festival;
  if (!fest || fest.status !== 'running') throw Error('赛事未在进行中');
  const boost = BOOSTS.find(b => b.id === command.boostId);
  if (!boost) throw Error('未知的打榜档位');
  if (fest.boosts.includes(fest.stage)) throw Error('这一阶段的打榜已经用过了');
  if (state.company.cashMinor < boost.costMinor) throw Error('资金不足');
  let next = {
    ...state,
    company: { ...state.company, cashMinor: state.company.cashMinor - boost.costMinor },
    festival: { ...fest, boosts: [...fest.boosts, fest.stage], boostAdd: (fest.boostAdd ?? 0) + boost.add },
  };
  next = {
    ...next,
    ledger: [...next.ledger, { id: ledgerEntryId(next) + '-boost', absoluteDay: next.clock.absoluteDay, kind: 'expense', category: 'festival', amountMinor: boost.costMinor, note: '打榜 · ' + boost.label }],
  };
  return { world: next, events: [{ type: 'festivalBoosted', stage: fest.stage }] };
}

function scoreOf(state, artist, boostAdd, rand) {
  const stat = artist.stats[primaryStatOf(artist)];
  return Math.round(stat * 0.5 + (artist.fans / 1500) * 0.3 * 10 + (boostAdd ?? 0) + rand() * 20);
}
const STAGE_LINES = [40, 55, 70];

function runStage(state, events, rand) {
  let next = state;
  const fest = next.festival;
  const artist = next.artists[fest.artistId];
  if (!artist) return { world: { ...next, festival: { status: 'done', stage: 0, artistId: null, boosts: [], log: [] } }, events };
  const r1 = nextFloat(next.random.state);
  next = { ...next, random: { ...next.random, state: serializeRandomState(r1.state) } };
  const score = scoreOf(next, artist, fest.boostAdd, rand);
  const line = STAGE_LINES[fest.stage - 1];
  const names = ['初选', '公演', '总决赛'];
  const stageName = names[fest.stage - 1];
  let log = [...fest.log, stageName + ' 得分 ' + score + '（晋级线 ' + line + '）'];
  if (score < line) {
    next = pushMessage(next, {
      id: messageId(next, 'fest_out_' + fest.stage),
      from: '青柠视频 · 节目组',
      level: 'warn',
      title: stageName + '止步 · ' + artist.name,
      body: '得分 ' + score + '，差 ' + (line - score) + ' 分。舞台就是这样，回去养好状态再来。',
      absoluteDay: next.clock.absoluteDay,
    });
    next = { ...next, festival: { status: 'done', stage: 0, artistId: null, boosts: [], log } };
    events.push({ type: 'festivalEliminated', stage: fest.stage, score });
    return { world: next, events };
  }
  if (fest.stage < 3) {
    next = {
      ...next,
      festival: { ...fest, stage: fest.stage + 1, boostAdd: 0, lastStageDay: next.clock.absoluteDay, log },
    };
    next = pushMessage(next, {
      id: messageId(next, 'fest_pass_' + fest.stage),
      from: '青柠视频 · 节目组',
      level: 'report',
      title: stageName + '晋级 · ' + artist.name,
      body: '得分 ' + score + '。下一阶段两天后，记得打榜。',
      absoluteDay: next.clock.absoluteDay,
    });
    events.push({ type: 'festivalStagePassed', stage: fest.stage, score });
    return { world: next, events };
  }
  // 冠军
  const bonus = wan(10);
  next = {
    ...next,
    artists: { ...next.artists, [artist.id]: { ...artist, fans: artist.fans + 30000 } },
    company: {
      ...next.company,
      cashMinor: next.company.cashMinor + bonus,
      reputation: Math.min(100, next.company.reputation + 8),
    },
    festival: { status: 'done', stage: 0, artistId: null, boosts: [], log: [...log, '冠军出道'] },
  };
  next = {
    ...next,
    ledger: [...next.ledger, { id: ledgerEntryId(next) + '-champ', absoluteDay: next.clock.absoluteDay, kind: 'income', category: 'festival', amountMinor: bonus, note: '新星季冠军奖金' }],
  };
  next = pushMessage(next, {
    id: messageId(next, 'fest_champ'),
    from: '青柠视频 · 节目组',
    level: 'summary',
    title: '冠军 · ' + artist.name + '！！',
    body: '总决赛得分 ' + score + '，成团夜 C 位出道！人气 +30000，口碑 +8，奖金 10 万已入账。',
    absoluteDay: next.clock.absoluteDay,
  });
  events.push({ type: 'festivalChampion', score });
  return { world: next, events };
}

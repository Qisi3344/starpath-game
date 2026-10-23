// 通告市场（B2 · V1.6.2 §3.2–3.5）：按月刷新的通告流、竞标、录制周期、作品履历与收益结算。
// 成功率 = 匹配度×0.5 + 公司口碑×0.2 + 公关投入×0.2 + 喀位×0.1 − 竞争加成（0-100 分制代入）。
// 分成：公司 D 级 7:3 → C 6:4 → B 5:5（艺人份额按扣平台费后收入计）。
import { MINOR_PER_WAN, DAYS_PER_MONTH, messageId, pushMessage, ledgerEntryId } from './state.mjs';
import { nextFloat, serializeRandomState } from './random.mjs';
import { primaryStatOf, FATIGUE_GIG, FATIGUE_LIMIT } from './career.mjs';

const wan = n => Math.round(n * MINOR_PER_WAN);

export const GIG_TYPES = {
  webdrama: { label: '网剧', platform: ['青柠视频', '红果剧场', '蓝莓影视'] },
  variety: { label: '综艺', platform: ['青柠视频', '星潮卫视'] },
  endorsement: { label: '代言', platform: ['轻奢品牌', '快消大牌', '国潮新品'] },
  show: { label: '商演', platform: ['城市音乐节', '商场开业', '品牌快闪'] },
};
const TITLE_A = ['夏日邻座', '深夜食堂传说', '雾里看花', '光之来处', '她的秘密频道', '青空旅拍', '周末厨房', '午夜电台', '双城故事', '薄荷之夏'];
const TITLE_B = ['特辑', '第 2 季', '春季篇', '线下场', '代言周', '联动场'];

/** 公司艺人最高喀位 → 本月可刷的通告喀位集合 */
function gradePoolFor(artists, companyLevel) {
  const order = ['D', 'C', 'B', 'A'];
  let top = 'D';
  for (const a of artists) if (order.indexOf(a.grade) > order.indexOf(top)) top = a.grade;
  const cap = { small: 'B', mid: 'A', big: 'A', giant: 'A' }[companyLevel] ?? 'B';
  const topIdx = Math.min(order.indexOf(top) + 1, order.indexOf(cap));
  return order.slice(0, topIdx + 1);
}

const PAY = {   // 总报酬范围（万）按喀位×类型，V1.6.2 §3.4 简化
  D: { webdrama: [5, 10], variety: [20, 30], endorsement: [10, 20], show: [3, 5] },
  C: { webdrama: [15, 30], variety: [50, 80], endorsement: [30, 50], show: [8, 15] },
  B: { webdrama: [50, 120], variety: [150, 200], endorsement: [100, 280], show: [20, 50] },
  A: { webdrama: [200, 500], variety: [300, 500], endorsement: [300, 700], show: [80, 150] },
};
const STAT_REQ = { D: 55, C: 65, B: 75, A: 88 };
const GRADE_SCORE = { D: 20, C: 40, B: 60, A: 80 };

/** 每月 1 日刷新市场（ADVANCE_DAY 钩子）；旧通告逾期作废 */
export function refreshMarket(state, events, rand) {
  const day = state.clock.absoluteDay;
  let next = state;
  // 过期：AVAILABLE 跨月即 EXPIRED
  for (const g of Object.values(next.gigs)) {
    if (g.status === 'available' && g.offerMonth != null && g.offerMonth !== next.clock.month) {
      next = { ...next, gigs: { ...next.gigs, [g.id]: { ...g, status: 'expired' } } };
    }
  }
  // 新通告：公司艺人最高喀位决定池子
  const artists = Object.values(next.artists);
  if (!artists.length) return { world: next, events };
  const grades = gradePoolFor(artists, next.company.level);
  const count = 2 + (rand() < 0.5 ? 1 : 0);
  for (let i = 0; i < count; i++) {
    const grade = grades[Math.floor(rand() * grades.length)];
    const types = Object.keys(GIG_TYPES);
    const type = types[Math.floor(rand() * types.length)];
    const [lo, hi] = PAY[grade][type];
    const grossWan = lo + rand() * (hi - lo);
    const days = 2 + Math.floor(rand() * 4);
    const reqStat = STAT_REQ[grade] - 5 + Math.floor(rand() * 10);
    const id = 'gig_' + next.clock.year + '_' + next.clock.month + '_' + i;
    const t = GIG_TYPES[type];
    next = {
      ...next,
      gigs: {
        ...next.gigs,
        [id]: {
          id, title: t.platform[Math.floor(rand() * t.platform.length)] + '《' + TITLE_A[Math.floor(rand() * TITLE_A.length)] + '》' + TITLE_B[Math.floor(rand() * TITLE_B.length)],
          kind: type, platform: t.platform[0], grade,
          status: 'available', assignedArtistId: null,
          grossMinor: wan(grossWan), days, reqStat,
          offerMonth: next.clock.month, deadlineDay: DAYS_PER_MONTH - 2,
          rival: rand() < 0.4,
        },
      },
    };
  }
  events.push({ type: 'marketRefreshed', month: next.clock.month });
  pushMessage(next, {
    id: messageId(next, 'market'),
    from: '知夏 · 商务',
    level: 'report',
    title: '本月通告清单到了',
    body: count + ' 个新机会，喀位 ' + grades.join('/') + '。看准了就接，拖到月底就凉。',
    absoluteDay: day,
  });
  return { world: next, events };
}

/** 成功率（0-100）：匹配×0.5 + 口碑×0.2 + 公关投入×0.2 + 喀位×0.1 − 竞争 */
export function bidScore(state, gig, artist, bribeMinor) {
  const stat = artist.stats[primaryStatOf(artist)];
  const match = clampPct((stat / gig.reqStat) * 70);
  const bribe = clampPct(bribeMinor / wan(20) * 100);           // 20 万拉满
  const gradeScore = GRADE_SCORE[gig.grade] ?? 20;
  const rival = gig.rival ? 12 : 0;
  return clampPct(Math.round(match * 0.5 + state.company.reputation * 0.2 + bribe * 0.2 + gradeScore * 0.1 - rival));
}
function clampPct(v) { return Math.max(0, Math.min(100, Math.round(v))); }

/** 竞标：成功率判成才占档；「砸钱公关」计入成本，成败都花 */
export function bidGig(state, command) {
  const gig = state.gigs[command.gigId];
  if (!gig || gig.status !== 'available') throw Error('这份通告已经不在市场上');
  const artist = state.artists[command.artistId];
  if (!artist) throw Error('先选一位艺人');
  if (artist.fatigue >= FATIGUE_LIMIT) throw Error(artist.name + ' 疲劳过高（' + artist.fatigue + '），先休息');
  if (artist.availability === 'onGig') throw Error(artist.name + ' 正在录制中');
  const bribe = Math.max(0, Math.min(wan(20), command.bribeMinor || 0));
  if (state.company.cashMinor < bribe) throw Error('资金不足以支付公关投入');
  const score = bidScore(state, gig, artist, bribe);
  const r = nextFloat(state.random.state);
  const success = r.value * 100 < score;
  const day = state.clock.absoluteDay;
  let next = { ...state, random: { ...state.random, state: serializeRandomState(r.state) } };
  if (bribe > 0) {
    next = {
      ...next,
      company: { ...next.company, cashMinor: next.company.cashMinor - bribe },
      ledger: [...next.ledger, { id: ledgerEntryId(next) + '-bribe', absoluteDay: day, kind: 'expense', category: 'pr', amountMinor: bribe, note: '公关竞价 · ' + gig.title }],
    };
  }
  if (!success) {
    next = pushMessage(next, {
      id: messageId(next, 'bid_' + gig.id),
      from: '知夏 · 商务',
      level: 'warn',
      title: '竞标失败 · ' + gig.title,
      body: '成功率 ' + score + '%，这次差了一点。' + (bribe > 0 ? '公关投入打了水漂。' : '要不要试试砸点资源？'),
      absoluteDay: day,
    });
    return { world: next, events: [{ type: 'bidFailed', gigId: gig.id, score }] };
  }
  next = {
    ...next,
    gigs: { ...next.gigs, [gig.id]: { ...gig, status: 'booked', assignedArtistId: artist.id, startDay: day, score } },
  };
  next = pushMessage(next, {
    id: messageId(next, 'bid_' + gig.id),
    from: '知夏 · 商务',
    level: 'summary',
    title: '拿下 · ' + gig.title,
    body: artist.name + ' 确定出演，总报酬 ' + (gig.grossMinor / MINOR_PER_WAN).toFixed(1) + ' 万，录制 ' + gig.days + ' 天。明天进组。',
    absoluteDay: day,
  });
  return { world: next, events: [{ type: 'gigBooked', gigId: gig.id, artistId: artist.id }] };
}

/** ADVANCE_DAY 钩子：录制推进 → 收工写履历 → 结算入账（幂等：入账只在 released 当天一次） */
export function advanceGigs(state, events) {
  const day = state.clock.absoluteDay;
  let next = state;
  for (const gig of Object.values(next.gigs)) {
    // 序章《夏日邻座》由第一周结算流程（SETTLE_FIRST_WEEK）单独处理，不进通用排期
    if (gig.startDay == null) continue;
    if (gig.status === 'booked' && day >= (gig.startDay ?? 0) + 1) {
      next = {
        ...next,
        gigs: { ...next.gigs, [gig.id]: { ...gig, status: 'shooting' } },
        artists: gig.assignedArtistId && next.artists[gig.assignedArtistId]
          ? { ...next.artists, [gig.assignedArtistId]: { ...next.artists[gig.assignedArtistId], availability: 'onGig' } }
          : next.artists,
      };
      events.push({ type: 'gigStarted', gigId: gig.id });
    }
    if (gig.status !== 'shooting' || !gig.assignedArtistId) continue;
    const artist = next.artists[gig.assignedArtistId];
    if (!artist) continue;
    // 录制中日复一日的疲劳
    next = {
      ...next,
      artists: { ...next.artists, [artist.id]: { ...artist, fatigue: Math.min(100, artist.fatigue + FATIGUE_GIG) } },
    };
    if (day < (gig.startDay ?? 0) + gig.days) continue;
    // 收工：表现 roll → 作品履历 + 人气 + 结算
    const r = nextFloat(next.random.state);
    next = { ...next, random: { ...next.random, state: serializeRandomState(r.state) } };
    const stat = artist.stats[primaryStatOf(artist)];
    const perf = clampPct(Math.round(stat * 0.7 + r.value * 40));   // 0-100 表现
    const fanGain = Math.round(perf * (gig.grade === 'A' ? 260 : gig.grade === 'B' ? 150 : gig.grade === 'C' ? 70 : 30));
    const repGain = perf >= 80 ? 3 : perf >= 60 ? 2 : 1;
    const workId = 'work_' + gig.id;
    const history = [...artist.history, { date: next.clock, note: '完成《' + gig.title + '》，表现 ' + perf + ' 分' }];
    next = {
      ...next,
      artists: { ...next.artists, [artist.id]: { ...artist, fans: artist.fans + fanGain, fatigue: Math.min(100, artist.fatigue), availability: 'idle', history } },
      works: {
        ...next.works,
        [workId]: {
          id: workId, gigId: gig.id, artistId: artist.id,
          title: gig.title, kind: (GIG_TYPES[gig.kind] ?? GIG_TYPES.variety).label, role: gig.grade,
          finishedAbsoluteDay: day, perf, note: '表现评分 ' + perf,
        },
      },
      gigs: { ...next.gigs, [gig.id]: { ...gig, status: 'released', perf } },
      company: { ...next.company, reputation: clampPct(next.company.reputation + repGain) },
    };
    // 结算：gross − 平台 30% − 艺人分成（D 7:3 / C 6:4 / B 5:5 → 艺人 30/40/50%）
    const gross = gig.grossMinor;
    const platformFee = Math.round(gross * 0.3);
    const shareRate = { D: 0.3, C: 0.4, B: 0.5, A: 0.6 }[gig.grade] ?? 0.3;
    const artistShare = Math.round((gross - platformFee) * shareRate);
    const net = gross - platformFee - artistShare;
    next = {
      ...next,
      company: { ...next.company, cashMinor: next.company.cashMinor + net },
      ledger: [...next.ledger,
        { id: ledgerEntryId(next) + '-gin', absoluteDay: day, kind: 'income', category: 'gig', amountMinor: gross, note: gig.title + ' · 总报酬' },
        { id: ledgerEntryId(next) + '-gpf', absoluteDay: day, kind: 'expense', category: 'platform_fee', amountMinor: platformFee, note: '平台抽成 30%' },
        { id: ledgerEntryId(next) + '-gsh', absoluteDay: day, kind: 'expense', category: 'artist_share', amountMinor: artistShare, note: '艺人分成 ' + Math.round(shareRate * 100) + '%' },
      ],
    };
    next = pushMessage(next, {
      id: messageId(next, 'rel_' + gig.id),
      from: '知夏 · 财务',
      level: 'summary',
      title: '收工结算 · ' + gig.title,
      body: artist.name + ' 表现 ' + perf + ' 分，人气 +' + fanGain.toLocaleString() + '。净入账 ' + (net / MINOR_PER_WAN).toFixed(1) + ' 万。',
      absoluteDay: day,
    });
    events.push({ type: 'gigReleased', gigId: gig.id, perf, netMinor: net });
  }
  return { world: next, events };
}

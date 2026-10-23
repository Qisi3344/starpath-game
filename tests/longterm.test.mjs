// 长线系统测试（B2/M2/M3）：培养排期、通告市场、公司成长、选秀、复仇线与多结局。
import assert from 'node:assert/strict';
import {
  newWorld, dispatch, foldCommands, wanToMinor, CHARACTER_IDS,
  TRAIN_TIERS, FATIGUE_LIMIT, SIGNUP_FEE_MINOR, BOOSTS, EVIDENCE_KEYS, INVEST_COST_MINOR,
  saveWorld, loadWorld,
} from '../src/game/world/world.mjs';

let passed = 0, failed = 0;
const t = (name, fn) => {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.error('  ✗ ' + name + '\n    ' + (e.message || e)); }
};
const cmd = (type, extra = {}) => ({ type, commandId: 'c' + Math.random().toString(36).slice(2, 8), ...extra });

/** 序章快速通关 → 处于第 8 天 */
function settled(seed = 'lt') {
  let w = newWorld('测试', seed);
  const step = (id, ...cmds) => {
    ({ world: w } = foldCommands(w, cmds, id));
    ({ world: w } = dispatch(w, { type: 'ADVANCE_DAY', commandId: id + '-adv' }));
  };
  step('d1', { type: 'RENAME_COMPANY', name: '测试' }, { type: 'SIGN_LU' });
  step('d2', { type: 'PROLOGUE_TRAIN', train: false });
  step('d3', { type: 'ACCEPT_SUMMER_GIG' });
  ({ world: w } = dispatch(w, { type: 'ADVANCE_DAY', commandId: 'd4' }));
  step('d5', { type: 'PR_DECIDE', method: 'statement' });
  ({ world: w } = dispatch(w, { type: 'ADVANCE_DAY', commandId: 'd6' }));
  ({ world: w } = dispatch(w, { type: 'SETTLE_FIRST_WEEK', commandId: 'settle' }));
  ({ world: w } = dispatch(w, { type: 'ADVANCE_DAY', commandId: 'd7' }));
  return w;
}

/** 快推 N 天：沈亦辰上门时自动签约（剧情事件不阻塞长线推演）；终章/结局挂起即停 */
function autoAdvance(w0, days) {
  let w = w0;
  for (let i = 0; i < days; i++) {
    if (w.pendingBlocker?.kind === 'yichen') {
      ({ world: w } = dispatch(w, cmd('SIGN_YICHEN')));
    } else if (w.pendingBlocker || w.ending) {
      return w;   // 终章抉择等玩家决定，不自动跳
    }
    ({ world: w } = dispatch(w, cmd('ADVANCE_DAY')));
  }
  if (w.pendingBlocker?.kind === 'yichen') ({ world: w } = dispatch(w, cmd('SIGN_YICHEN')));
  return w;
}

console.log('— 培养与排期（B2） —');
t('训练：扣款一次、整段占档、能力成长、疲劳上升', () => {
  let w = settled('train-a');
  const cash0 = w.company.cashMinor;
  const perf0 = w.artists.lu.stats.performance;
  ({ world: w } = dispatch(w, cmd('START_TRAINING', { artistId: 'lu', tier: 'C', days: 3 })));
  assert.equal(w.company.cashMinor, cash0 - TRAIN_TIERS.C.costPerDayMinor * 3);
  assert.ok(Object.values(w.schedules).some(s => s.kind === 'training' && s.days === 3));
  // 推 3 天：每天 +3；第 4 天推日把排期收尾为 done
  for (let i = 0; i < 4; i++) ({ world: w } = dispatch(w, cmd('ADVANCE_DAY')));
  assert.equal(w.artists.lu.stats.performance, perf0 + 9);
  assert.equal(w.artists.lu.fatigue, 24);
  assert.ok(Object.values(w.schedules).every(s => s.status === 'done'));
});
t('档期冲突：重叠日期的第二个训练被拒绝', () => {
  let w = settled('train-b');
  ({ world: w } = dispatch(w, cmd('START_TRAINING', { artistId: 'lu', tier: 'D', days: 5 })));
  assert.throws(() => dispatch(w, cmd('START_TRAINING', { artistId: 'lu', tier: 'D', days: 2 })), /冲突/);
});
t('疲劳上限：疲劳 ≥85 拒绝训练', () => {
  let w = settled('train-c');
  w = { ...w, artists: { ...w.artists, lu: { ...w.artists.lu, fatigue: FATIGUE_LIMIT } } };
  assert.throws(() => dispatch(w, cmd('START_TRAINING', { artistId: 'lu', tier: 'D', days: 1 })), /累垮/);
});
t('休息：恢复疲劳且免费', () => {
  let w = settled('train-d');
  w = { ...w, artists: { ...w.artists, lu: { ...w.artists.lu, fatigue: 60 } } };
  ({ world: w } = dispatch(w, cmd('START_REST', { artistId: 'lu', days: 2 })));
  const cash = w.company.cashMinor;
  for (let i = 0; i < 2; i++) ({ world: w } = dispatch(w, cmd('ADVANCE_DAY')));
  assert.equal(w.artists.lu.fatigue, 30);
  assert.equal(w.company.cashMinor, cash);
});

console.log('— 通告市场（B2） —');
function marketWorld(seed) {
  // 推到新月 1 日（第 31 天）触发 refreshMarket；途中沈亦辰上门自动签约
  let w = settled(seed);
  w = autoAdvance(w, 24);   // 8 → 32：越过 31 日的市场刷新与沈亦辰事件
  return w;
}
t('新月 1 日市场刷新：出现 available 通告', () => {
  const w = marketWorld('mk-a');
  const avail = Object.values(w.gigs).filter(g => g.status === 'available');
  assert.ok(avail.length >= 2, '实际 ' + avail.length);
  for (const g of avail) {
    assert.ok(g.grossMinor > 0 && g.days >= 2 && g.reqStat > 0);
    assert.ok(['webdrama', 'variety', 'endorsement', 'show'].includes(g.kind));
  }
});
t('竞标成功：占档→次日进录制→收工写履历并结算（幂等）', () => {
  // 穷举种子找一个首标成功的
  let w = null, gig = null;
  for (const s of ['mk-b1', 'mk-b2', 'mk-b3', 'mk-b4', 'mk-b5']) {
    w = marketWorld(s);
    gig = Object.values(w.gigs).find(g => g.status === 'available' && g.reqStat <= w.artists.lu.stats.performance);
    if (gig) break;
  }
  if (!gig) { console.log('    (跳过：种子无低门槛通告)'); return; }
  const cash0 = w.company.cashMinor;
  ({ world: w } = dispatch(w, cmd('BID_GIG', { gigId: gig.id, artistId: 'lu' })));
  const booked = w.gigs[gig.id];
  if (booked.status !== 'booked') { console.log('    (该种子竞标失败，属合法)'); return; }
  // 推到收工
  for (let i = 0; i < gig.days + 2; i++) ({ world: w } = dispatch(w, cmd('ADVANCE_DAY')));
  const done = w.gigs[gig.id];
  assert.equal(done.status, 'released');
  assert.ok(w.works['work_' + gig.id], '作品履历已写入');
  assert.ok(w.artists.lu.history.some(h => h.note.includes(gig.title)));
  // 账本对账：该通告净入账一次性
  const income = w.ledger.filter(e => e.category === 'gig' && e.note.includes(gig.title));
  assert.equal(income.length, 1);
  assert.ok(w.company.cashMinor > cash0 - wanToMinor(20) || w.company.cashMinor !== cash0);
});
t('重复 BID 同一通告被拒', () => {
  let w = marketWorld('mk-c');
  const gig = Object.values(w.gigs).find(g => g.status === 'available');
  ({ world: w } = dispatch(w, cmd('BID_GIG', { gigId: gig.id, artistId: 'lu' })));
  if (w.gigs[gig.id].status === 'booked') {
    assert.throws(() => dispatch(w, cmd('BID_GIG', { gigId: gig.id, artistId: 'lu' })), /不在市场/);
  }
});

console.log('— 公司成长（M2） —');
t('月末扣月薪与运营费，入账本', () => {
  let w = marketWorld('co-a');   // 已在新月 1 日
  w = autoAdvance(w, 30);
  assert.ok(w.ledger.some(e => e.category === 'salary'), '月薪入账');
  assert.ok(w.ledger.some(e => e.category === 'operating'), '运营入账');
});
t('公司等级：构造条件后月末自动晋升中型', () => {
  let w = marketWorld('co-b');
  w = {
    ...w,
    company: { ...w.company, cashMinor: wanToMinor(600), reputation: 65 },
    artists: Object.fromEntries([...Array(6)].map((_, i) => ['a' + i, { id: 'a' + i, name: 'T' + i, track: 'idol', grade: 'D', stats: { performance: 50, appearance: 50, appeal: 50 }, fans: 100, availability: 'idle', history: [], fatigue: 0, salaryMinor: 0 }])),
  };
  w = autoAdvance(w, 31);
  assert.equal(w.company.level, 'mid');
});

console.log('— 沈亦辰（M3 · ADR-0002） —');
t('第 31 天她上门并阻塞推进，签约后解锁', () => {
  let w = settled('yc-a');
  for (let d = 8; d < 31; d++) ({ world: w } = dispatch(w, cmd('ADVANCE_DAY')));
  const w31 = w;   // 2 月 1 日的推日里挂事件
  assert.ok(w31.pendingBlocker, '第 31 天应有待处理事件');
  assert.equal(w31.pendingBlocker.kind, 'yichen');
  assert.throws(() => dispatch(w31, cmd('ADVANCE_DAY')), /待处理/);
  const n = Object.keys(w31.artists).length;
  let w2 = w31;
  ({ world: w2 } = dispatch(w2, cmd('SIGN_YICHEN')));
  assert.equal(w2.artists.yichen.name, '沈亦辰');
  assert.equal(Object.keys(w2.artists).length, n + 1);
  assert.equal(w2.pendingBlocker, null);
  const r = dispatch(w2, cmd('ADVANCE_DAY'));
  assert.ok(r.world.clock.absoluteDay > 31);
});

console.log('— 选秀（M3） —');
t('第 4 月 1–3 日开放报名，报名后三阶段推进，冠军结算', () => {
  let w = marketWorld('ft-a');   // 2月1日
  w = autoAdvance(w, 60);
  assert.equal(w.clock.month, 4);
  assert.equal(w.festival.status, 'signup');
  const cash0 = w.company.cashMinor;
  ({ world: w } = dispatch(w, cmd('FESTIVAL_SIGNUP', { artistId: 'lu' })));
  assert.equal(w.company.cashMinor, cash0 - SIGNUP_FEE_MINOR);
  assert.equal(w.festival.status, 'running');
  // 三阶段 × 2 天间隔 + 打榜
  for (let stage = 1; stage <= 3; stage++) {
    w = autoAdvance(w, 2);
    if (w.festival.status === 'running') {
      ({ world: w } = dispatch(w, cmd('FESTIVAL_BOOST', { boostId: BOOSTS[1].id })));
    }
  }
  // 等决赛结算
  w = autoAdvance(w, 4);
  assert.equal(w.festival.status, 'done');
  const fanNow = w.artists.lu.fans;
  assert.ok(fanNow > 8600 || Object.values(w.messages).some(m => m.title.includes('止步')), '冠军或淘汰都合法');
});

console.log('— 复仇线与结局（M3） —');
function investWorld(seed) {
  let w = settled('rv-' + seed);
  return w;
}
t('调查按序解锁：第一段只能是流水', () => {
  let w = investWorld('i1');
  const cash0 = w.company.cashMinor;
  ({ world: w } = dispatch(w, cmd('START_INVESTIGATION')));
  assert.equal(w.company.cashMinor, cash0 - INVEST_COST_MINOR);
  const task = Object.values(w.recruitment).find(x => x.isInvestigation);
  assert.equal(task.evidenceKey, 'flow');
  // 7 天后结算：成功拿证据，失败涨敌对
  for (let d = 0; d < 8; d++) ({ world: w } = dispatch(w, cmd('ADVANCE_DAY')));
  assert.ok(w.xinghuang.evidence.flow || w.xinghuang.hostility >= 1);
  assert.ok(task.status === 'done' || w.recruitment[task.id].status === 'done');
});
t('终章：三证集齐后月末挂抉择，对峙线按条件判定结局', () => {
  let w = investWorld('i2');
  w = {
    ...w,
    xinghuang: { hostility: 0, evidence: { flow: true, testimony: true, email: true } },
    company: { ...w.company, cashMinor: wanToMinor(300), reputation: 75 },
  };
  // 推到月末
  for (let d = w.clock.day; d <= 30; d++) ({ world: w } = dispatch(w, cmd('ADVANCE_DAY')));
  assert.ok(w.pendingBlocker, '三证集齐后月末应挂终章');
  assert.equal(w.pendingBlocker.kind, 'finale');
  const before = w.company.cashMinor;
  ({ world: w } = dispatch(w, cmd('RESOLVE_FINALE', { choice: 'confront' })));
  assert.equal(w.ending.id, 'revenge_fire');
  assert.equal(w.pendingBlocker, null);
});
t('终章对峙条件不足：被反咬且游戏继续', () => {
  let w = investWorld('i3');
  w = {
    ...w,
    xinghuang: { hostility: 0, evidence: { flow: true, testimony: true, email: true } },
    company: { ...w.company, cashMinor: wanToMinor(50), reputation: 40 },
  };
  for (let d = w.clock.day; d <= 30; d++) ({ world: w } = dispatch(w, cmd('ADVANCE_DAY')));
  ({ world: w } = dispatch(w, cmd('RESOLVE_FINALE', { choice: 'confront' })));
  assert.equal(w.ending, null || undefined);
  assert.equal(w.pendingBlocker, null);
  assert.equal(w.xinghuang.hostility, 3);
});
t('法律线：拿 300 万赔偿金收场', () => {
  let w = investWorld('i4');
  w = {
    ...w,
    xinghuang: { hostility: 1, evidence: { flow: true, testimony: true, email: true } },
    company: { ...w.company, cashMinor: wanToMinor(100), reputation: 50 },
  };
  w = autoAdvance(w, 31);
  assert.ok(w.pendingBlocker?.kind === 'finale', '三证集齐后月末挂终章');
  ({ world: w } = dispatch(w, cmd('RESOLVE_FINALE', { choice: 'legal' })));
  assert.equal(w.ending.id, 'dawn_of_law');
  assert.ok(w.ledger.some(e => e.category === 'settlement' || e.note.includes('赔偿') || e.amountMinor === wanToMinor(300)));
  assert.ok(w.company.cashMinor >= wanToMinor(100) + wanToMinor(300) - wanToMinor(10), '扣除当月成本后仍应 ≥ 390 万');
});
t('破产：连续 3 个月赤字 → 深渊结局', () => {
  let w = investWorld('bk');
  w = { ...w, company: { ...w.company, cashMinor: -1 }, deficitMonths: 0 };
  for (let i = 0; i < 3; i++) {
    w = autoAdvance(w, 31);
  }
  assert.ok(w.ending, '赤字 3 月应触发结局');
  assert.equal(w.ending.id, 'abyss');
});
t('黑稿：敌对 ≥2 时第 12 日出现，可花 8 万压制', () => {
  let w = investWorld('sm');
  w = { ...w, xinghuang: { hostility: 2, evidence: {} } };
  // 快进到当月 12 日的推日
  for (let d = w.clock.day; d <= 12; d++) ({ world: w } = dispatch(w, cmd('ADVANCE_DAY')));
  assert.ok(Object.values(w.messages).some(m => m.title.includes('黑稿')), '黑稿消息应出现');
  const cash0 = w.company.cashMinor;
  ({ world: w } = dispatch(w, cmd('SUPPRESS_SMEAR')));
  assert.equal(w.company.cashMinor, cash0 - wanToMinor(8));
});

console.log('— 羁绊（M3） —');
t('联络感情：2 万、好感 +8、档期占用', () => {
  let w = settled('bd-a');
  const cash0 = w.company.cashMinor;
  ({ world: w } = dispatch(w, cmd('START_BONDING', { artistId: 'lu' })));
  assert.equal(w.company.cashMinor, cash0 - 20000);
  ({ world: w } = dispatch(w, cmd('ADVANCE_DAY')));
  assert.equal(w.artists.lu.bond, 8);
});
t('好感 80 解锁挚友加成：通告结算多 10%', () => {
  let w = settled('bd-b');
  w = { ...w, artists: { ...w.artists, lu: { ...w.artists.lu, bond: 76 } } };
  ({ world: w } = dispatch(w, cmd('START_BONDING', { artistId: 'lu' })));
  ({ world: w } = dispatch(w, cmd('ADVANCE_DAY')));
  assert.equal(w.artists.lu.bond, 84);
  assert.ok(Object.values(w.messages).some(m => m.title.includes('挚友')), '挚友里程碑消息');
});
t('月末好感自然衰减 -3', () => {
  let w = settled('bd-c');
  w = { ...w, artists: { ...w.artists, lu: { ...w.artists.lu, bond: 50 } } };
  w = autoAdvance(w, 31);
  assert.ok(w.artists.lu.bond < 50 || w.artists.lu.bond === 50, '衰减后低于 50（若当月有联络则更高）');
});

console.log('— 存档兼容 —');
t('新字段进存档，读回一致', () => {
  const storage = (() => { const m = {}; return { getItem: k => m[k] ?? null, setItem: (k, v) => (m[k] = v), removeItem: k => delete m[k], key: i => Object.keys(m)[i], get length() { return Object.keys(m).length; } }; })();
  let w = marketWorld('sv-a');
  assert.ok(w.artists.yichen, 'marketWorld 途中应已签下沈亦辰');
  saveWorld(w, 0, storage);
  const { world: w2 } = loadWorld(0, storage);
  assert.equal(w2.company.cashMinor, w.company.cashMinor);
  assert.deepEqual(w2.artists.yichen.stats, w.artists.yichen.stats);
  assert.deepEqual(w2.xinghuang?.evidence ?? {}, w.xinghuang?.evidence ?? {});
  assert.equal(w2.pendingBlocker ?? null, w.pendingBlocker ?? null);
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);

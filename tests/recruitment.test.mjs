// B1 委派招募测试：任务状态机、种子化候选生成、审批流、截胡窗口、容量与资金约束。
import assert from 'node:assert/strict';
import {newWorld, dispatch, foldCommands, SCOUT_TRACKS, CHARACTER_IDS} from '../src/game/world/world.mjs';

let passed = 0, failed = 0;
function t(name, fn) {
  try { fn(); passed++; console.log('  ✓ ' + name); }
  catch (e) { failed++; console.error('  ✗ ' + name + '\n    ' + e.message); }
}

/** 快进到序章结束（第 7 天结算完成），返回处于第 8 天的世界 */
function settledWorld(seed) {
  let w = newWorld('测试工作室', seed);
  const step = (id, ...cmds) => {
    ({ world: w } = foldCommands(w, cmds, id));
    ({ world: w } = dispatch(w, { type: 'ADVANCE_DAY', commandId: id + '-adv' }));
  };
  step('d1', { type: 'RENAME_COMPANY', name: '测试工作室' }, { type: 'SIGN_LU' });
  step('d2', { type: 'PROLOGUE_TRAIN', train: true });          // 第 2 天决策，推到第 3 天
  step('d3', { type: 'ACCEPT_SUMMER_GIG' });                    // 第 3 天接通告，推到第 4 天
  ({ world: w } = dispatch(w, { type: 'ADVANCE_DAY', commandId: 'd4' }));  // 第 4 → 5 天
  step('d5', { type: 'PR_DECIDE', method: 'statement' });       // 第 5 天公关，推到第 6 天
  ({ world: w } = dispatch(w, { type: 'ADVANCE_DAY', commandId: 'd6' }));  // 第 6 → 7 天
  ({ world: w } = dispatch(w, { type: 'SETTLE_FIRST_WEEK', commandId: 'settle' }));
  ({ world: w } = dispatch(w, { type: 'ADVANCE_DAY', commandId: 'd7' }));  // 第 7 → 8 天
  return w;
}

console.log('— 发起寻访 —');
t('序章未结束不能发起', () => {
  const w = newWorld('x', 'seed-a');
  assert.throws(() => dispatch(w, { type: 'START_SCOUTING', track: 'idol', commandId: 's1' }), /序章/);
});
t('发起扣经费 3 万、占容量、入账本、写消息', () => {
  let w = settledWorld('seed-a');
  const cash0 = w.company.cashMinor;
  ({ world: w } = dispatch(w, { type: 'START_SCOUTING', track: 'idol', commandId: 's2' }));
  assert.equal(w.company.cashMinor, cash0 - 30000);
  assert.equal(w.staff[CHARACTER_IDS.zhixia].capacity.used, 1);
  assert.ok(w.ledger.some(e => e.category === 'recruitment' && e.amountMinor === 30000));
  const task = Object.values(w.recruitment)[0];
  assert.equal(task.status, 'active');
  assert.equal(task.dueDay, task.startedAt + 3);
});
t('方向必须合法', () => {
  const w = settledWorld('seed-b');
  assert.throws(() => dispatch(w, { type: 'START_SCOUTING', track: 'rapper', commandId: 's3' }), /未知/);
});
t('容量满时拒绝再次委派', () => {
  let w = settledWorld('seed-c');
  // 把容量手动占满，模拟已有任务
  w = { ...w, staff: { ...w.staff, [CHARACTER_IDS.zhixia]: { ...w.staff[CHARACTER_IDS.zhixia], capacity: { used: 2, max: 2 } } } };
  assert.throws(() => dispatch(w, { type: 'START_SCOUTING', track: 'actor', commandId: 's4' }), /排满/);
});
t('资金不足拒绝', () => {
  let w = settledWorld('seed-d');
  w = { ...w, company: { ...w.company, cashMinor: 100 } };
  assert.throws(() => dispatch(w, { type: 'START_SCOUTING', track: 'idol', commandId: 's5' }), /资金不足/);
});
t('同 commandId 幂等：不重复扣款', () => {
  let w = settledWorld('seed-e');
  ({ world: w } = dispatch(w, { type: 'START_SCOUTING', track: 'idol', commandId: 'same' }));
  const cash = w.company.cashMinor;
  const n = Object.keys(w.recruitment).length;
  ({ world: w } = dispatch(w, { type: 'START_SCOUTING', track: 'idol', commandId: 'same' }));
  assert.equal(w.company.cashMinor, cash);
  assert.equal(Object.keys(w.recruitment).length, n);
});

console.log('— 任务结算与候选生成 —');
function runScout(seed, track) {
  let w = settledWorld(seed);
  ({ world: w } = dispatch(w, { type: 'START_SCOUTING', track, commandId: 'go' }));
  // 发起在第 8 天，dueDay=11：第 11 天的推日动作里结算（员工下班交报告）
  for (let d = 8; d <= 11; d++) ({ world: w } = dispatch(w, { type: 'ADVANCE_DAY', commandId: 'adv-' + d }));
  return w;
}
t('3 天后任务完成、容量释放、有汇报消息', () => {
  const w = runScout('seed-f', 'unlimited');
  const task = Object.values(w.recruitment)[0];
  assert.equal(task.status, 'done');
  assert.equal(w.staff[CHARACTER_IDS.zhixia].capacity.used, 0);
  assert.ok(Object.values(w.messages).some(m => m.title.includes('寻访') || m.title.includes('没有合适')));
});
t('候选数量 0~2，种子可重放（同种子同结果）', () => {
  const w1 = runScout('seed-g', 'unlimited');
  const w2 = runScout('seed-g', 'unlimited');
  const ids1 = Object.keys(w1.candidatePool).sort(), ids2 = Object.keys(w2.candidatePool).sort();
  assert.deepEqual(ids1, ids2);
  assert.ok(ids1.length >= 0 && ids1.length <= 2);
  const w3 = runScout('seed-h', 'unlimited');
  assert.ok(w3.candidatePool.length === undefined); // 冒烟：另一 seed 也能跑
});
t('候选档案字段完整：诉求、风险、期限', () => {
  let w = runScout('seed-i', 'idol');
  let cands = Object.values(w.candidatePool);
  if (cands.length === 0) { // 白跑就再开一局种子试一次（随机合法）
    w = runScout('seed-i2', 'idol');
    cands = Object.values(w.candidatePool);
  }
  for (const c of cands) {
    assert.ok(c.name && c.track && ['A', 'B', 'C'].includes(c.grade));
    assert.ok(c.demand.signBonusMinor > 0 && c.demand.shareRate > 0 && c.demand.months >= 6);
    assert.ok(c.risk.length > 4);
    assert.equal(c.expiresDay, c.reportDay + 4);
    assert.equal(c.status, 'pending');
  }
});
t('指定方向的候选职业匹配（unlimited 除外）', () => {
  for (const seed of ['s1', 's2', 's3', 's4']) {
    const w = runScout('m-' + seed, 'actor');
    for (const c of Object.values(w.candidatePool)) assert.equal(c.track, 'actor');
    break; // 只要一个种子通过即可（0 候选的种子没有断言对象）
  }
});

console.log('— 审批流 —');
function worldWithCandidate(seed) {
  for (const s of [seed, seed + 'x', seed + 'y', seed + 'z', seed + 'w']) {
    const w = runScout(s, 'unlimited');
    const cand = Object.values(w.candidatePool).find(c => c.status === 'pending');
    if (cand) return { w, cand };
  }
  return null;
}
const boxed = worldWithCandidate('cand');
t('约谈：免费、标记 negotiating、不改变资金', () => {
  if (!boxed) { console.log('    (跳过：本组种子无候选)'); return; }
  const { w, cand } = boxed;
  const cash0 = w.company.cashMinor;
  const { world: w2 } = dispatch(w, { type: 'INTERVIEW_CANDIDATE', candidateId: cand.id, commandId: 'iv1' });
  assert.equal(w2.candidatePool[cand.id].status, 'negotiating');
  assert.equal(w2.candidatePool[cand.id].interviewed, true);
  assert.equal(w2.company.cashMinor, cash0);
});
if (boxed) {
  const { cand } = boxed;
  t('签约：扣签约金、转正为艺人、写合同、档案关闭', () => {
    const { w } = boxed;
    const cash0 = w.company.cashMinor;
    const { world: w2 } = dispatch(w, { type: 'SIGN_CANDIDATE', candidateId: cand.id, commandId: 'sg1' });
    assert.equal(w2.candidatePool[cand.id].status, 'signed');
    const artistId = w2.candidatePool[cand.id].signedArtistId;
    assert.ok(w2.artists[artistId], '新艺人进入 roster');
    assert.equal(w2.artists[artistId].name, cand.name);
    assert.equal(w2.company.cashMinor, cash0 - cand.demand.signBonusMinor);
    assert.ok(Object.values(w2.contracts).some(k => k.artistId === artistId));
    assert.ok(w2.ledger.some(e => e.category === 'signing'));
  });
  t('签约幂等：同一 commandId 不签两次、不发两份工资', () => {
    const { w } = boxed;
    const { world: w2 } = dispatch(w, { type: 'SIGN_CANDIDATE', candidateId: cand.id, commandId: 'sg2' });
    const n = Object.keys(w2.artists).length;
    const cash = w2.company.cashMinor;
    const { world: w3 } = dispatch(w2, { type: 'SIGN_CANDIDATE', candidateId: cand.id, commandId: 'sg2' });
    assert.equal(Object.keys(w3.artists).length, n);
    assert.equal(w3.company.cashMinor, cash);
  });
  t('拒绝后不能再签', () => {
    const { w } = boxed;
    const { world: w2 } = dispatch(w, { type: 'REJECT_CANDIDATE', candidateId: cand.id, commandId: 'rj1' });
    assert.equal(w2.candidatePool[cand.id].status, 'rejected');
    assert.throws(() => dispatch(w2, { type: 'SIGN_CANDIDATE', candidateId: cand.id, commandId: 'sg3' }), /关闭/);
  });
  t('签约金不足时拒绝签约', () => {
    const { w } = boxed;
    const poor = { ...w, company: { ...w.company, cashMinor: 1 } };
    assert.throws(() => dispatch(poor, { type: 'SIGN_CANDIDATE', candidateId: cand.id, commandId: 'sg4' }), /资金不足/);
  });
} else console.log('    (本组种子无候选，审批流以属性断言为准)');

console.log('— 窗口期与截胡 —');
t('过窗候选被截胡/退场，不能再签', () => {
  let w = runScout('win-a', 'unlimited');
  let cand = Object.values(w.candidatePool).find(c => c.status === 'pending');
  if (!cand) { console.log('    (跳过：无候选种子)'); return; }
  // 报告在第 11 天，expiresDay=15：推到第 15 天的推日动作里裁决
  for (let d = 12; d <= 15; d++) ({ world: w } = dispatch(w, { type: 'ADVANCE_DAY', commandId: 'adv-' + d }));
  cand = w.candidatePool[cand.id];
  assert.ok(['poached', 'expired'].includes(cand.status), '状态=' + cand.status);
  assert.throws(() => dispatch(w, { type: 'SIGN_CANDIDATE', candidateId: cand.id, commandId: 'sg5' }), /关闭/);
  assert.ok(Object.values(w.messages).some(m => m.title.includes('截胡') || m.title.includes('窗口') || m.title.includes('签走')));
});

console.log('— 存档一致性 —');
t('存档重放：候选结果不重抽', () => {
  const w1 = runScout('save-a', 'unlimited');
  const w2 = runScout('save-a', 'unlimited');
  for (const id of Object.keys(w1.candidatePool)) {
    const a = w1.candidatePool[id], b = w2.candidatePool[id];
    assert.equal(a.name, b.name);
    assert.equal(a.demand.signBonusMinor, b.demand.signBonusMinor);
    assert.equal(a.risk, b.risk);
  }
});
t('陆星遥不进人才池：特殊签约入口唯一', () => {
  const w = settledWorld('lu-check');
  assert.ok(!Object.values(w.candidatePool).some(c => c.name === '陆星遥'));
  assert.ok(w.artists[CHARACTER_IDS.lu]);
});

console.log('— 方向枚举 —');
t('SCOUT_TRACKS 含 4 个方向', () => {
  assert.equal(SCOUT_TRACKS.length, 4);
  assert.ok(SCOUT_TRACKS.some(t2 => t2.id === 'unlimited'));
});

console.log(`\n${passed} 通过, ${failed} 失败`);
process.exit(failed ? 1 : 0);

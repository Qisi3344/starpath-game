// B0 验收测试（Issue #5 / 契约第七节）：W01 签约、W02 资金、W03 冲突、W09 结算、W10 读档。
import test from 'node:test';
import assert from 'node:assert/strict';
import { newWorld, wanToMinor, CHARACTER_IDS } from '../src/game/world/state.mjs';
import { dispatch } from '../src/game/world/commands.mjs';
import { createRandomState, serializeRandomState, nextFloat, parseRandomState } from '../src/game/world/random.mjs';
import { saveWorld, loadWorld, hasSave, deleteSave } from '../src/game/world/save.mjs';
import { formatWan } from '../src/game/world/format.mjs';

let cmdSeq = 0;
const cmd = (type, extra = {}) => ({ type, commandId: 'test-' + (++cmdSeq), ...extra });

/** 按序章脚本走完第一周（train=true, statement 路径）；命令 id 稳定为 fw-1..fw-12 */
function playFirstWeek({ train = true, method = 'statement' } = {}) {
  let w = newWorld('星芒事务所', 'seed-fixed');
  let n = 0;
  const step = (type, extra = {}) => { const r = dispatch(w, { type, commandId: 'fw-' + (++n), ...extra }); w = r.world; return r; };
  step('RENAME_COMPANY', { name: '星芒事务所' });
  step('SIGN_LU');
  step('ADVANCE_DAY');
  step('PROLOGUE_TRAIN', { train });
  step('ADVANCE_DAY');
  step('ACCEPT_SUMMER_GIG');
  step('ADVANCE_DAY'); // day3→4：录制开始
  step('ADVANCE_DAY'); // day4→5
  step('PR_DECIDE', { method });
  step('ADVANCE_DAY'); // day5→6
  step('ADVANCE_DAY'); // day6→7：收工 + 作品履历
  step('SETTLE_FIRST_WEEK');
  return w;
}
const SETTLE_ID = 'fw-12';

test('W01 签约：第 1 天签陆星遥入 roster，重复确认不签两次', () => {
  let w = newWorld('测试工作室');
  const r1 = dispatch(w, { type: 'SIGN_LU', commandId: 'w01-sign' });
  w = r1.world;
  assert.equal(Object.keys(w.artists).length, 1);
  assert.equal(w.artists[CHARACTER_IDS.lu].name, '陆星遥');
  assert.equal(w.artists[CHARACTER_IDS.lu].fans, 5000);
  // 相同 commandId 重放 → 幂等，无变化
  const again = dispatch(w, { type: 'SIGN_LU', commandId: 'w01-sign' });
  assert.equal(again.world, w);
  assert.equal(again.events.length, 0);
  // 不同 commandId 重复签约 → 拒绝
  assert.throws(() => dispatch(w, { type: 'SIGN_LU', commandId: 'w01-sign-2' }), /已经在旗下/);
});

test('W01 签约只能在第 1 天（剧情特殊入口不进人才池）', () => {
  let w = newWorld();
  w = dispatch(w, cmd('ADVANCE_DAY')).world;
  assert.throws(() => dispatch(w, cmd('SIGN_LU')), /只能在第 1 天/);
  assert.equal(w.candidatePool && Object.keys(w.candidatePool).length, 0);
});

test('W02 资金：200 万初始化，训练/律师费扣一次，通告净额对账', () => {
  assert.equal(newWorld().company.cashMinor, wanToMinor(200));
  const w = playFirstWeek({ train: true, method: 'statement' });
  // 200 - 1(训练) + 25 - 7.5 - 5.25 - 2.5(运营) = 208.75 万（与旧引擎测试同值）
  assert.equal(w.company.cashMinor, wanToMinor(208.75));
  assert.equal(w.company.reputation, 47);
  assert.equal(w.artists[CHARACTER_IDS.lu].fans, 8600);
  // 账本对账：每笔明细合计 = 期初 → 现金变化
  const net = w.ledger.reduce((s, e) => s + (e.kind === 'expense' ? -e.amountMinor : e.amountMinor), 0);
  assert.equal(wanToMinor(200) + net, w.company.cashMinor);
  // 训练只扣了一次
  assert.equal(w.ledger.filter(e => e.category === 'training').length, 1);
});

test('W03 冲突：训练安排后同日重复安排不可成功，资金不二次扣除', () => {
  let w = newWorld();
  w = dispatch(w, cmd('SIGN_LU')).world;
  w = dispatch(w, cmd('ADVANCE_DAY')).world; // day2
  const before = w.company.cashMinor;
  w = dispatch(w, cmd('PROLOGUE_TRAIN', { train: true })).world;
  assert.equal(w.company.cashMinor, before - wanToMinor(1));
  assert.throws(() => dispatch(w, cmd('PROLOGUE_TRAIN', { train: true })), /已经定下/);
  assert.equal(w.company.cashMinor, before - wanToMinor(1)); // 资金未二次扣除
});

test('ADVANCE_DAY：Day1 可以一路推进到 Day31（30 天/月），月结只发一次汇总', () => {
  let w = playFirstWeek();
  let monthly = 0;
  for (let d = 7; d < 31; d++) {
    const r = dispatch(w, cmd('ADVANCE_DAY'));
    w = r.world;
    monthly += r.events.filter(e => e.type === 'monthlyClosed').length;
  }
  assert.equal(w.clock.absoluteDay, 31);
  assert.equal(w.clock.month, 2);
  assert.equal(w.clock.day, 1);
  assert.equal(monthly, 1);
  // 月结消息存在且只有一条
  const closeMsgs = Object.values(w.messages).filter(m => m.title.includes('月度小结'));
  assert.equal(closeMsgs.length, 1);
  // 读档重放后月结不重复
});

test('W09 结算：重复打开不发钱（同 commandId 幂等，不同 commandId 拒绝）', () => {
  const w = playFirstWeek();
  const cash = w.company.cashMinor;
  const again = dispatch(w, { type: 'SETTLE_FIRST_WEEK', commandId: SETTLE_ID });
  assert.equal(again.world, w); // 同 commandId → 幂等重放
  assert.throws(() => dispatch(w, { type: 'SETTLE_FIRST_WEEK', commandId: 'fw-12-x' }), /已经结算过/);
  assert.equal(w.company.cashMinor, cash);
});

test('W10 读档：保存后推进/修改，读回后与保存瞬间完全一致', () => {
  const storage = (() => { const m = new Map(); return {
    getItem: k => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => m.set(k, v),
    removeItem: k => m.delete(k),
  }; })();
  const saved = playFirstWeek();
  const meta = saveWorld(saved, 0, storage);
  assert.equal(meta.absoluteDay, 7);
  assert.equal(hasSave(0, storage), true);
  // 存档后世界继续变化
  let live = dispatch(saved, cmd('ADVANCE_DAY')).world;
  live = dispatch(live, cmd('ADVANCE_DAY')).world;
  assert.equal(live.clock.absoluteDay, 9);
  // 读回 → 精确回到保存瞬间
  const loaded = loadWorld(0, storage).world;
  assert.deepEqual(loaded, saved);
  assert.equal(loaded.clock.absoluteDay, 7);
  assert.equal(loaded.company.cashMinor, saved.company.cashMinor);
  // 读档后重放已执行命令 → 幂等，不重复扣款
  const r = dispatch(loaded, { type: 'SETTLE_FIRST_WEEK', commandId: SETTLE_ID });
  assert.equal(r.world, loaded);
  deleteSave(0, storage);
  assert.equal(hasSave(0, storage), false);
});

test('W10 坏档反馈：版本不符与结构损坏给出可读错误，不静默清档', () => {
  const storage = (() => { const m = new Map(); return {
    getItem: k => m.has(k) ? m.get(k) : null,
    setItem: (k, v) => m.set(k, v),
    removeItem: k => m.delete(k),
  }; })();
  storage.setItem('starpath.save.v1.slot0', JSON.stringify({ schemaVersion: 99, world: {} }));
  assert.throws(() => loadWorld(0, storage), /版本.*不兼容/);
  storage.setItem('starpath.save.v1.slot0', '{broken json');
  assert.throws(() => loadWorld(0, storage), /损坏/);
  storage.setItem('starpath.save.v1.slot0', JSON.stringify({ schemaVersion: 1, world: { ...newWorld(), random: { seed: 'x', state: 'zz' } } }));
  assert.throws(() => loadWorld(0, storage), /随机数状态损坏/);
});

test('随机数：同种子同序列结果一致，读档后不重抽', () => {
  const a = createRandomState('star');
  const b = createRandomState('star');
  let sa = a, sb = b;
  const seqA = [], seqB = [];
  for (let i = 0; i < 20; i++) {
    const ra = nextFloat(sa); sa = ra.state; seqA.push(ra.value);
    const rb = nextFloat(sb); sb = rb.state; seqB.push(rb.value);
  }
  assert.deepEqual(seqA, seqB);
  assert.equal(serializeRandomState(a), serializeRandomState(b));
  // 序列化 → 反序列化 → 继续推进，序列与未序列化时一致
  const mid = parseRandomState(serializeRandomState(sa));
  const afterLoop = nextFloat(sb);
  const afterRestore = nextFloat(mid);
  assert.equal(afterLoop.value, afterRestore.value);
  // 两个世界同种子推 40 天：随机状态与消息集合一致
  const worldA = playFirstWeek(), worldB = playFirstWeek();
  assert.equal(worldA.random.state, worldB.random.state);
});

test('推进阻塞：存在待审批事件时拒绝推进', () => {
  const w = playFirstWeek();
  const blocked = { ...w, pendingBlocker: { title: '一份待签的合同' } };
  assert.throws(() => dispatch(blocked, cmd('ADVANCE_DAY')), /待处理/);
});

test('序章 day5 公关决策只生效一次；跳过训练的路径资金正确', () => {
  const w = playFirstWeek({ train: false, method: 'lawyer' });
  assert.equal(w.company.cashMinor, wanToMinor(200 - 0 + 9.75 - 20));
  assert.equal(w.company.reputation, 50);
  assert.equal(w.artists[CHARACTER_IDS.lu].stats.performance, 55); // 未训练不加成
  assert.equal(w.story.flags.trained, undefined);
});

test('金额显示：minor → 万字符串', () => {
  assert.equal(formatWan(wanToMinor(208.75)), '208.75 万');
  assert.equal(formatWan(wanToMinor(25)), '25 万');
  assert.equal(formatWan(wanToMinor(9.75)), '9.75 万');
});

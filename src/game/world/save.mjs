// 存读档 adapter（B0）：localStorage 持久化 + schemaVersion 校验。
// 存储层与游戏规则分离；测试可注入内存 storage。读档失败给出可读原因，绝不静默清档。

import { SCHEMA_VERSION } from './state.mjs';
import { parseRandomState } from './random.mjs';

const KEY_PREFIX = 'starpath.save.v1.slot';

function defaultStorage() {
  if (typeof localStorage === 'undefined') throw Error('当前环境没有持久化存储');
  return localStorage;
}

function slotKey(slot) { return KEY_PREFIX + slot; }

/** 保存：覆盖写同一槽位；返回存档元信息 */
export function saveWorld(world, slot = 0, storage = defaultStorage()) {
  if (!world || world.schemaVersion !== SCHEMA_VERSION) throw Error('世界状态版本异常，拒绝保存');
  const record = {
    schemaVersion: SCHEMA_VERSION,
    savedAtRealTime: new Date().toISOString(),
    world,
  };
  storage.setItem(slotKey(slot), JSON.stringify(record));
  return describeSave(record, slot);
}

/** 读取：版本不符/结构损坏抛可读错误；调用方负责把错误展示给玩家 */
export function loadWorld(slot = 0, storage = defaultStorage()) {
  const raw = storage.getItem(slotKey(slot));
  if (raw === null) throw Error('这个存档槽位还是空的');
  let record;
  try { record = JSON.parse(raw); } catch { throw Error('存档数据损坏，无法读取'); }
  if (!record || typeof record !== 'object') throw Error('存档数据损坏，无法读取');
  if (record.schemaVersion !== SCHEMA_VERSION) {
    throw Error('存档版本（v' + record.schemaVersion + '）与当前游戏（v' + SCHEMA_VERSION + '）不兼容');
  }
  const world = record.world;
  const required = ['clock', 'company', 'random', 'story', 'ledger', 'processedActionIds'];
  for (const key of required) {
    if (world[key] === undefined) throw Error('存档缺少 ' + key + ' 数据，无法读取');
  }
  parseRandomState(world.random.state); // 随机状态损坏尽早暴露
  return { world, meta: describeSave(record, slot) };
}

export function describeSave(record, slot) {
  return {
    slot,
    schemaVersion: record.schemaVersion,
    savedAtRealTime: record.savedAtRealTime,
    absoluteDay: record.world.clock.absoluteDay,
    dateLabel: '第' + record.world.clock.year + '年' + record.world.clock.month + '月' + record.world.clock.day + '日',
    company: record.world.company.name,
    cashMinor: record.world.company.cashMinor,
  };
}

export function hasSave(slot = 0, storage = defaultStorage()) {
  return storage.getItem(slotKey(slot)) !== null;
}

export function deleteSave(slot = 0, storage = defaultStorage()) {
  storage.removeItem(slotKey(slot));
}

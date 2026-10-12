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

/** 深层结构校验：坏档统一可读报错，绝不静默清档，也绝不把坏状态推给界面（审查必修 4） */
function validateWorld(world) {
  if (typeof world !== 'object' || world === null || Array.isArray(world)) {
    throw Error('存档的世界数据缺失或损坏');
  }
  const clock = world.clock;
  if (typeof clock !== 'object' || clock === null
    || !Number.isInteger(clock.absoluteDay) || clock.absoluteDay < 1
    || !Number.isInteger(clock.year) || !Number.isInteger(clock.month) || !Number.isInteger(clock.day)) {
    throw Error('存档的日期数据损坏，无法读取');
  }
  const company = world.company;
  if (typeof company !== 'object' || company === null
    || typeof company.name !== 'string'
    || !Number.isInteger(company.cashMinor) || company.cashMinor < 0
    || !Number.isInteger(company.reputation)) {
    throw Error('存档的公司/资金数据损坏，无法读取');
  }
  for (const key of ['staff', 'artists', 'gigs', 'messages', 'events', 'places', 'works']) {
    if (typeof world[key] !== 'object' || world[key] === null || Array.isArray(world[key])) {
      throw Error('存档的 ' + key + ' 数据损坏，无法读取');
    }
  }
  if (typeof world.story !== 'object' || world.story === null
    || typeof world.story.flags !== 'object' || world.story.flags === null
    || !Array.isArray(world.story.seenNodes)) {
    throw Error('存档的剧情进度损坏，无法读取');
  }
  if (!Array.isArray(world.ledger) || !Array.isArray(world.processedActionIds)) {
    throw Error('存档的账本数据损坏，无法读取');
  }
  if (typeof world.random !== 'object' || world.random === null || typeof world.random.seed !== 'string') {
    throw Error('存档的随机种子损坏，无法读取');
  }
  parseRandomState(world.random.state); // 随机状态损坏尽早暴露
}

/** 读取：版本不符/结构损坏抛可读错误；调用方负责把错误展示给玩家 */
export function loadWorld(slot = 0, storage = defaultStorage()) {
  const raw = storage.getItem(slotKey(slot));
  if (raw === null) throw Error('这个存档槽位还是空的');
  let record;
  try { record = JSON.parse(raw); } catch { throw Error('存档数据损坏，无法读取'); }
  if (!record || typeof record !== 'object' || record.world === undefined) {
    throw Error('存档数据损坏，无法读取');
  }
  if (record.schemaVersion !== SCHEMA_VERSION) {
    throw Error('存档版本（v' + record.schemaVersion + '）与当前游戏（v' + SCHEMA_VERSION + '）不兼容');
  }
  validateWorld(record.world);
  return { world: record.world, meta: describeSave(record, slot) };
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

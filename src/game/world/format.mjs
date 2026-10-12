// 金额显示格式化：内部 minor（=1 元）→ 玩家可读的「万」。UI 不得直接读 cashMinor 拼字符串。

import { MINOR_PER_WAN } from './state.mjs';

/** 2087500 → "208.75 万"；整万不带小数（"25 万"） */
export function formatWan(minor) {
  const wanValue = minor / MINOR_PER_WAN;
  const rounded = Math.round(wanValue * 100) / 100;
  return (Number.isInteger(rounded) ? rounded.toFixed(0) : rounded.toFixed(2)) + ' 万';
}

/** 带符号版本：+9.75 万 / -1 万 */
export function formatWanSigned(minor) {
  return (minor > 0 ? '+' : '') + formatWan(minor);
}

export function formatDateLabel(clock) {
  return '第' + clock.year + '年 · ' + clock.month + '月' + clock.day + '日';
}

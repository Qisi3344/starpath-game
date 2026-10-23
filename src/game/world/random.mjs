// 可重放 PRNG（sfc32）：种子 → 确定性序列，状态可序列化进存档。
// 同一 random.state 推进必然得到同一结果，读档后不得"重新抽取"。

function sfc32Step(a, b, c, d) {
  a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
  let t = (a + b) | 0;
  a = b ^ (b >>> 9);
  b = (c + (c << 3)) | 0;
  c = (c << 21) | (c >>> 11);
  d = (d + 1) | 0;
  t = (t + d) | 0;
  c = (c + t) | 0;
  return { a: a >>> 0, b: b >>> 0, c: c >>> 0, d: d >>> 0, value: (t >>> 0) / 4294967296 };
}

function mixSeed(seed) {
  // FNV-1a 四路独立滚动：四个初始字各自演化，避免同源异或的强相关
  // （旧版同一 h 异或四个常数，弱种子会带出相关初始态，热身也压不住）
  const text = String(seed);
  const words = [2166136261, 2166136261, 2166136261, 2166136261];
  const salts = [0x9e3779b9, 0x85ebca6b, 0xc2b2ae35, 0x27d4eb2f];
  for (let i = 0; i < text.length; i++) {
    const ch = text.charCodeAt(i);
    for (let w = 0; w < 4; w++) {
      words[w] = Math.imul(words[w] ^ (ch + i + w * 0x9e37), 16777619) >>> 0;
    }
  }
  return {
    a: (words[0] ^ salts[0]) >>> 0,
    b: (words[1] ^ salts[1]) >>> 0,
    c: (words[2] ^ salts[2]) >>> 0,
    d: (words[3] ^ salts[3] ^ text.length) >>> 0,
  };
}

/** 由种子创建初始可序列化状态（已热身，避免弱种子共振） */
export function createRandomState(seed) {
  let s = mixSeed(seed);
  for (let i = 0; i < 32; i++) s = sfc32Step(s.a, s.b, s.c, s.d);
  return { a: s.a, b: s.b, c: s.c, d: s.d };
}

/** 推进一次：返回 { state, value }，value ∈ [0,1)。state 必须写回 WorldState。
 *  接受对象或序列化字符串（WorldState.random.state 存的是字符串）——
 *  传错形态曾让 sfc32 从全零走步、value 恒 ≈ 2.3e-10（B0 的隐性 bug，2026-10-23 修复）。 */
export function nextFloat(state) {
  const s0 = typeof state === 'string' ? parseRandomState(state) : state;
  if (!s0 || typeof s0.a !== 'number') throw Error('随机数状态形态错误，无法推进');
  const s = sfc32Step(s0.a, s0.b, s0.c, s0.d);
  return { state: { a: s.a, b: s.b, c: s.c, d: s.d }, value: s.value };
}

/** 批量推进：只取最后一个值，常用于"消耗 n 个随机数"的场景 */
export function nextFloatAfter(state, skips) {
  let cur = state;
  for (let i = 0; i < skips; i++) cur = nextFloat(cur).state;
  return nextFloat(cur);
}

const hex8 = x => (x >>> 0).toString(16).padStart(8, '0');

export function serializeRandomState(state) {
  return hex8(state.a) + hex8(state.b) + hex8(state.c) + hex8(state.d);
}

export function parseRandomState(text) {
  if (typeof text !== 'string' || !/^[0-9a-f]{32}$/.test(text)) {
    throw Error('随机数状态损坏，存档无法使用');
  }
  const num = i => parseInt(text.slice(i * 8, i * 8 + 8), 16) >>> 0;
  return { a: num(0), b: num(1), c: num(2), d: num(3) };
}

/** 新存档种子：现实随机性只在此处进入一次，之后全部可重放 */
export function freshSeed() {
  return Date.now().toString(36) + '-' + Math.floor(Math.random() * 0xffffffff).toString(36);
}

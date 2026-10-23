// UI 层的统一导出桩：从各 world 模块收集页面需要的常量与纯函数（避免 import 路径散落）。
export { SCOUT_TRACKS } from './recruitment.mjs';
export { TRAIN_TIERS, FATIGUE_LIMIT } from './career.mjs';
export { BOOSTS, SIGNUP_FEE_MINOR } from './festival.mjs';
export { EVIDENCE_KEYS, EVIDENCE_INFO, INVEST_COST_MINOR } from './revenge.mjs';
export { bidScore } from './gigs.mjs';
export { LEVELS, LEVEL_UP_REQ } from './company.mjs';

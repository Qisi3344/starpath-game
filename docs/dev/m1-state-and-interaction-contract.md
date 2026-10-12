# Alpha M1 · 世界状态、日程、委派、招募和页面联动开发契约

> 2026-10-12 · **建议实现契约（供 GLM 落地/测试）**。不自行推翻已确认的 V1.6.2 规则；这里未锁定的费用、概率和时间统一放配置层。文件用于收敛实现方案；如果 GLM 有更稳妥的数据结构，可在 PR 说明变更理由并保持以下不变量。

## 一、单一数据源：禁止“剧情一套、经营一套、地图一套”

```ts
type WorldState = {
  schemaVersion: number;
  saveId: string;
  random: { seed: string; state: string }; // 可重放、可持久化
  clock: { year: number; month: number; day: number; absoluteDay: number };
  company: { name: string; cashMinor: number; reputation: number; level: number };
  staff: Record<string, Staff>;  // 如 zhixia；容量/正在执行的任务
  artists: Record<string, Artist>; // 签约后的艺人，不包含仅候选者
  candidatePool: Record<string, Candidate>;
  contracts: Record<string, Contract>;
  recruitment: Record<string, RecruitmentTask>;
  schedules: Record<string, CalendarBooking>;
  gigs: Record<string, Gig>;
  works: Record<string, WorkRecord>;
  places: Record<string, WorldPlace>;
  messages: Record<string, PhoneMessage>;
  events: Record<string, EventRecord>;
  story: { flags: Record<string, boolean | number | string>; seenNodes: string[] };
  ledger: LedgerEntry[];
  processedActionIds: string[]; // 防止读档/重试导致重复执行
};
```

- 上述是**建议形状，不要求文件名与字段照抄**；如已有类型可直接演进。所有 UI 页面只拿同一个真实 WorldState 的 selector，**不得**静态生成第二个同名候选、通告、财务金额或日期。
- `cashMinor` 表示整数最小货币单位，展示成万/元由 UI 格式化；原演示 `money: 200` 单位**万元**，迁移时明确转换（不能直接当成 200 元）。
- `absoluteDay` 从开局 1 开始，游戏具体年月日与它一一对应。单一时钟、一次统一的 `ADVANCE_DAY`，不能靠浏览器计时器悄悄改变游戏日。
- `artistId` / `candidateId` / `taskId` / `gigId` / `placeId` 全局稳定，可存档，剧情和通知只用 ID 关联记录。
- C 视觉/剪影占位采用 `characterId` 资源注册表；它是展示层的 ID，不得因为替换美术改掉业务主键。

## 二、游戏日推进语义（最需要测试）

1. 读取当前待审批严重事件：如有阻塞，**不推进日期、不扣任务成本、不触发新抽取**。
2. 验证今日已经安排的艺人/员工工作与预算；对已安排任务一次性计费/占用，不重复执行。
3. 对正在进行的培训、录制、外派累积进度并产生回执；遇到结束条件写入作品/报告/消息。
4. 对即将过期机会做明确顺序处理，保证“当天到期是否还能签”有唯一规则（推荐**截止日当天可决策，推进到下一日才过期**）。
5. 由持久化随机数状态和事件池生成有限的新机会及舆情；关键事件打断后续推进等待玩家审批。
6. 写入账本与不可重复的 `EventRecord`；只在全部变更校验成功后，`absoluteDay += 1`。
7. 触发月底总结时以 ledger 统计或有对账依据的快照计算，不把“打开页面”当成再次发钱的结算行为。

建议将上述步骤作为 reducer / command processor 的纯函数实现（输出 `{nextState, emittedEvents}`），UI/网络不直接修改游戏状态。报错要显示合理原因，不使世界状态半更新。

## 三、委派与招募状态机（首月重点）

```text
CREATED（老板指定方向/预算）
  → SEARCHING（负责人执行：占容量/计时）
  → REPORT_READY（持久候选 + 一条真实通知）
  → REVIEWING（老板筛选候选）
  → NEGOTIATING（委派谈条件；可以失败/拒绝/被抢/过期）
  → AWAITING_APPROVAL（报价接受，等待老板最终签合同）
  → SIGNED / DECLINED / EXPIRED / COMPETITOR_SIGNED / FAILED
```

- 一次任务 `taskId` 只能有**一份**实际候选报告；重复查看手机/工作室不重抽结果。
- 初期林知夏可以兼任星探，但她有工作容量，不能无限同时做三份完整外派又实时安排所有活动。容量数量/工期/成本可配置。
- 候选人出现 != 已签约；**只有收到玩家 `APPROVE_CONTRACT` 且合约有效时**才出现在 `artists`。
- 人才池要有不同方向/性格/潜力/风险/期望，第一版不必模拟真实自然语言谈判；可用结构化回合、报价阈值与事件结果。
- 候选人数量常规 2–4、等待 3–7 游戏日只是原型建议，可能出现 0 人；不要内置“每次必出 SSR”的结果。
- 第一位陆星遥走 Day 1 剧情直接签约，不通过委派池；沈亦辰是第 2 个月的既定剧情入口（不要开局就上班发工资）。
- UI 的 `recruitment` 页面和消息通知必须指向同一个 `taskId`，不重复创建/消费信息。

## 四、日程与通告

```ts
type CalendarBooking = {
  id: string; assigneeId: string; role: 'artist' | 'staff';
  startAbsoluteDay: number; endAbsoluteDay: number;
  kind: 'training' | 'gig' | 'scouting' | 'rest';
  linkedId: string; status: 'planned' | 'active' | 'done' | 'cancelled';
};
```

- 训练和通告占据真实游戏日，一个角色同一时段不能同时执行冲突日程。被派出的员工在容量冲突时应提示调整，不可无限分身。
- 通告必须具备机会状态：`AVAILABLE / NEGOTIATING / BOOKED / SHOOTING / RELEASED / FAILED / EXPIRED`（命名可调）；从通告页直接浏览不要求每次先去地图。
- 至少做出一个作品履历 `WorkRecord`，有类型/角色/实际评价和增益，且能影响下一次机会判定或角色能力。
- 收入=合同总额−平台抽成−艺人分成−其它已确认成本。每项用明确整数货币记录进入 `ledger`，重复打开结算页**不会再次入账**。
- 新手保护：前 6 个月星煌不做实质资源封锁、初次通告保底等遵循 V1.6.2；第 5 天的嘴炮不等同实质打压。

## 五、地图 / 手机 / 剧情

- 首月保留已有五城区 ID，不随便更名；每个地区至少能进入详情并返回。
- 从地图获取行业线索后，经纪人外派的工作任务必须落入 **WorldState 的任务表**；日程显示占用，手机收到同一 ID 的汇报，通告市场显示解锁后的机会。
- 地图的 `locked` 不意味着不能查看介绍，但必须**阻止尚未解锁的经营行动**并说明解锁条件；不能标签标锁却执行成功。
- 消息 `PhoneMessage` 明确类型：普通建议、重要报告、待审批、危机；阅读可改变已读状态，但不会自动执行高额合同/重大公关选择。
- 人物剧情通过 `story.flags` 和世界状态条件触发。普通对话可点按/自动/回看；重大选择只更新实际数据**一次**，退出剧情回发起页面。

## 六、存档

- 至少提供一个手动保存/读取入口（个人档案），以及可选自动保存；有 `schemaVersion` 和读档校验，旧版坏档要给清晰提示而非静默清空。
- 存档覆盖：日期、公司、艺人、员工任务、候选报告、洽谈、合同、地点解锁、通知、随机种子、剧情 flags、账本、已执行 ID。
- 读档后的真实业务结果必须与存档前一致（候选不能刷新，资金不重复变，任务期限不重置）。
- 不把浏览器页面滚动、弹窗开关等暂态 UI 写成随机事件源；导航返回位置可选持久化，但必须恢复到合法一级页面。

## 七、最小验收矩阵（写自动化测试 + 手动截图）

| 测试 | 必须看到的事实 |
| --- | --- |
| W01 签约 | 首次第 1 天签陆星遥后 roster 新增 1，重复确认不签两次 |
| W02 资金 | 200 万初始化，训练/律师费扣一次，通告收入净额对账 |
| W03 日程冲突 | 安排培训后同日重复安排不可成功，资金不二次扣除 |
| W04 委派 | 指定方向/预算后可见林知夏任务，推进前报告不存在 |
| W05 报告 | 到期消息与报告对应同一 taskId，读档后不重抽 |
| W06 招募 | 报价失败/拒绝/被截胡均不进入 artists；仅审批后入 roster |
| W07 地图 | 从地点派人→推进→手机消息→通告解锁→安排真实日程 |
| W08 剧情 | 从艺人/地图详情触发剧情后关闭回原页面，选择仅生效一次 |
| W09 结算 | 第一个月完成，收入/支出可查，重复打开总结不发钱 |
| W10 读档 | 保存后推进/修改/读回，日期、资金、员工任务、候选、消息、剧情一致 |
| W11 决议 | 底部按工作室/艺人/娱乐圈/日程/通告；顶部独立手机/个人档案；C 单主题 |
| W12 设备 | 360/390/430 手机宽与 PC 居中竖屏不遮挡，所有页面可返回 |

## 八、不属于本轮直接实现的系统

四种结局、三份复仇证据的完整链、老情人/羁绊长线、选秀60事件、星煌反向挖角、艺人复出玩法、所有公司部门/长期融资、市值/SS 门槛的完整年限平衡。应保留数据接口/标记，不可以“没做”就从 V1.6.2 方案里删掉。

源文件主要是设计素材，不应直接拿原始 Markdown 当编译好的运行时事件库；逐项结构化接入即可。

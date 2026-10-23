/*
 * 序章剧情脚本 · 从已获认可的 V0.2 原型逐字移植（ADR-0002 序章节奏 = 开发基线）。
 * 决策点映射 WorldState 命令（src/game/world/commands.mjs）：动作与推日显式分离，
 * 每个决策 resolve = [业务命令, ADVANCE_DAY]；文案、分支、步序与 V0.2 完全一致。
 */

export type WorldAction = {type: string; method?: string; train?: boolean; name?: string; key?: string; value?: string};

export type StoryChoice = {text: string; value: string; desc?: string};

export type SceneId = 'rain' | 'stage' | 'night' | 'crisis' | 'ending';

/** 播放器渲染台词时可用的一周世界状态快照（从 WorldState 派生） */
export type StoryContext = {
  company: string;
  mood: string | null;
  trained: boolean;
  pr: string | null;
};

export type StoryStep = {
  scene: SceneId;
  actor: '' | 'zhixia' | 'lu';
  who: string;
  text: string | ((ctx: StoryContext) => string);
  /** 决策步：隐藏"继续"，展示 choices 或命名输入框 */
  decision?: 'mood' | 'name' | 'sign' | 'train' | 'job' | 'pr' | 'end';
  choices?: StoryChoice[];
  /** 进入该步时按序执行的世界命令（转场推日） */
  enter?: WorldAction[];
  /** 决策结果 → 剧情跳转 + 世界命令 */
  resolve?: Record<string, {next: number; engine?: WorldAction[]; curtain?: 'resume' | 'contract' | 'settlement'}>;
};

export const PROLOGUE: StoryStep[] = [
  {scene: 'rain', actor: '', who: '旁白', text: '三年前，一则被精心设计的绯闻，将你从聚光灯下推了出去。\n今晚，你重新推开了一扇门。'},
  {scene: 'rain', actor: 'zhixia', who: '林知夏', text: '我和房东谈过了。租金比报价低两成，合同也看过，没什么大问题。'},
  {scene: 'rain', actor: 'zhixia', who: '林知夏', text: '……你还是这样。明明可以找间气派的写字楼，偏偏选了这间旧工作室。'},
  {scene: 'rain', actor: 'zhixia', who: '林知夏', text: '三年了。你终于决定回来。\n这一次，你打算先做什么？', decision: 'mood',
    choices: [{text: '先把公司经营起来。', value: 'calm'}, {text: '星煌欠我的，我会拿回来。', value: 'revenge'}, {text: '我想再试一次。', value: 'hope'}],
    resolve: {
      calm: {next: 4, engine: [{type: 'SET_STORY_FLAG', key: 'mood', value: 'calm'}]},
      revenge: {next: 4, engine: [{type: 'SET_STORY_FLAG', key: 'mood', value: 'revenge'}]},
      hope: {next: 4, engine: [{type: 'SET_STORY_FLAG', key: 'mood', value: 'hope'}]},
    }},
  {scene: 'rain', actor: 'zhixia', who: '林知夏',
    text: ctx => ctx.mood === 'revenge' ? '「我知道。」她顿了一下，「但这次，我们得比他们更有耐心。」' :
      ctx.mood === 'hope' ? '「那就再试一次。」她笑了，「这次，不会只有你一个人。」' :
      '「好。」她翻开文件夹，「先活下来，然后才有资格谈未来。」'},
  {scene: 'rain', actor: '', who: '旁白', text: '桌上放着一块尚未刻字的门牌。\n这是重新开始的第一件事。', decision: 'name'},
  {scene: 'rain', actor: 'zhixia', who: '林知夏', text: ctx => `「${ctx.company}……」\n她轻声念了一遍，然后把名牌靠在门边。\n「以后，这里就是我们的地方。」`},
  {scene: 'rain', actor: '', who: '旁白', text: '门铃忽然响了。一个年轻女孩站在雨里，怀中抱着一份被小心保护的简历。'},
  {scene: 'rain', actor: 'lu', who: '陆星遥', text: '你、你好！我是陆星遥。你可能不记得我了……三年前，我是你的后援会会长。'},
  {scene: 'rain', actor: 'lu', who: '陆星遥', text: '我现在还没有什么名气，唱跳也不是特别好。\n但如果你愿意，我想成为这里的第一个艺人。', decision: 'sign',
    choices: [{text: '「欢迎加入，陆星遥。」', value: 'sign'}, {text: '「先给我看看你的简历。」', value: 'inspect'}],
    resolve: {
      sign: {next: 10, engine: [{type: 'SIGN_LU'}, {type: 'ADVANCE_DAY'}]},
      inspect: {next: 9, curtain: 'resume'},
    }},
  {scene: 'stage', actor: 'lu', who: '旁白', text: '第二天。陆星遥开始了签约后的第一份行程。\n她的唱跳能力目前只有 55，但面前已经出现了一个小小的机会。', decision: 'train',
    choices: [{text: '「先把基本功练扎实。」', value: 'train', desc: '唱跳 +3 · 资金 -1万'}, {text: '「先试试镜头前的感觉。」', value: 'skip', desc: '不额外花费'}],
    resolve: {
      train: {next: 11, engine: [{type: 'PROLOGUE_TRAIN', train: true}, {type: 'ADVANCE_DAY'}]},
      skip: {next: 11, engine: [{type: 'PROLOGUE_TRAIN', train: false}, {type: 'ADVANCE_DAY'}]},
    }},
  {scene: 'stage', actor: 'lu', who: '陆星遥', text: ctx => ctx.trained ? '「老师说我节奏感不错，只是太紧张了。」\n她笑得有些不好意思，「我会好好练的！」' : '「我知道这是一场冒险。」\n她攥着袖口，小声说：「但我会努力跟上节奏的。」'},
  {scene: 'stage', actor: 'zhixia', who: '林知夏', text: '青柠视频正在筹备《夏日邻座》，新人生活观察综艺。\n这是沈亦辰帮忙介绍的资源。我觉得值得试试。'},
  {scene: 'stage', actor: 'zhixia', who: '林知夏', text: '总通告费25万，扣去平台与艺人分成，公司预计可以拿到12.25万。第一次竞标，我们有把握。', decision: 'job',
    choices: [{text: '「这个机会，我们接。」', value: 'accept', desc: '预计公司收入 +12.25万'}, {text: '「我想先看看具体条款。」', value: 'details'}],
    resolve: {
      accept: {next: 14, engine: [{type: 'ACCEPT_SUMMER_GIG'}, {type: 'ADVANCE_DAY'}]},
      details: {next: 13, curtain: 'contract'},
    }},
  {scene: 'stage', actor: 'lu', who: '陆星遥', text: '真的吗？我被选中了？！\n……我会在镜头面前好好表现的。绝对不会给你丢脸！'},
  {scene: 'crisis', actor: '', who: '旁白', enter: [{type: 'ADVANCE_DAY'}], text: '第五天，节目录制进行得很顺利。\n直到一条关于你的热搜突然冲上首页。\n#过气艺人另起炉灶#'},
  {scene: 'crisis', actor: 'zhixia', who: '林知夏', text: '星煌官方发文暗讽你。他们想试探我们。\n我倾向于暂时冷处理，但决定权在你。', decision: 'pr',
    choices: [{text: '「联系律师，把证据留好。」', value: 'lawyer', desc: '资金 -20万 · 口碑 +5'}, {text: '「这一次，我自己来说清楚。」', value: 'statement', desc: '资金不变 · 口碑 +2'}, {text: '「暂时不要回应。」', value: 'cold', desc: '资金不变 · 口碑 -5'}],
    resolve: {
      lawyer: {next: 17, engine: [{type: 'PR_DECIDE', method: 'lawyer'}, {type: 'ADVANCE_DAY'}]},
      statement: {next: 17, engine: [{type: 'PR_DECIDE', method: 'statement'}, {type: 'ADVANCE_DAY'}]},
      cold: {next: 17, engine: [{type: 'PR_DECIDE', method: 'cold'}, {type: 'ADVANCE_DAY'}]},
    }},
  {scene: 'night', actor: 'zhixia', who: '林知夏', text: ctx => ctx.pr === 'lawyer' ? '律师已经发函，相关营销号撤下部分旧闻。她放下电话：「这笔钱花得不便宜，但至少有个交代。」' :
    ctx.pr === 'statement' ? '公开说明发出后，有几家媒体开始核对时间线。她说：「这次，至少有人愿意听你把话讲完。」' :
    '热搜慢慢降下去了，但质疑声还没有消失。她关上屏幕：「我会继续盯着，别让它影响星遥。」'},
  {scene: 'ending', actor: 'lu', who: '陆星遥', enter: [{type: 'ADVANCE_DAY'}], text: '节目播出了。\n「我看到自己了！虽然只有几分钟，但是……」\n她眼睛亮了起来，「我们真的开始了，对吗？」', decision: 'end',
    choices: [{text: '查看第一周结算 ✧', value: 'settle'}],
    resolve: {settle: {next: 18, engine: [{type: 'SETTLE_FIRST_WEEK'}], curtain: 'settlement'}}},
];

/** 场景日期标注（V0.2 同款） */
export function sceneLabel(scene: SceneId): string {
  if (scene === 'crisis') return '第1年 · 1月5日 / 舆情危机';
  if (scene === 'stage') return '第1年 · 1月3日 / 第一个通告';
  if (scene === 'ending') return '第1年 · 1月7日 / 第一束聚光灯';
  return '序章 / 雨后重逢';
}

export const CHAPTER_LABEL = 'CHAPTER 00 / THE RETURN';

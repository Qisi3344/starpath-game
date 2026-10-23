import {useReducer, useRef, useState} from 'react';
import {newWorld, foldCommands} from './game/world/world.mjs';
import type {WorldState, SaveMeta} from './game/world/world.d.mts';
import {formatWan, formatDateLabel} from './game/world/format.mjs';
import {saveWorld, loadWorld, hasSave} from './game/world/save.mjs';
import {initialNav, reduceNav} from './ui/navigation';
import {GameShell} from './ui/GameShell';
import {StoryPlayer, type StoryView} from './story/StoryPlayer';
import {PROLOGUE, type StoryContext} from './story/script';
import {MapPage, DistrictPage, SchedulePage, CompanyPage, ArtistsPage, GigsPage, ProfilePage, PhonePage} from './pages/shell-pages';
import {PageHeader} from './ui/components';
import type {DistrictId} from './game/industry-districts';

/*
 * App 接线：唯一 WorldState + 剧情进度 + 导航。
 * 页面组件只消费 WorldState 的 selector；一切业务规则经 dispatch 落在 world 模块。
 */

function storyCtx(world: WorldState, mood: string | null): StoryContext {
  return {
    company: world.company.name,
    mood: mood ?? (typeof world.story.flags.mood === 'string' ? world.story.flags.mood : null),
    trained: world.story.flags.trained === true,
    pr: typeof world.story.flags.prChoice === 'string' ? world.story.flags.prChoice : null,
  };
}

function stepText(idx: number, world: WorldState, mood: string | null): string {
  const step = PROLOGUE[idx];
  const ctx = storyCtx(world, mood);
  return typeof step.text === 'function' ? step.text(ctx) : step.text;
}

/** 读档/刷新后从 WorldState 派生序章位置：回到下一个待决策点（找不到则已完成序章） */
export function prologueIndexFromWorld(world: WorldState): number | null {
  const f = world.story.flags;
  const day = world.clock.absoluteDay;
  if (!f.luSigned) return world.company.name === '未命名工作室' ? 0 : 3;
  if (day <= 2 && !f.prologueTrainDone) return 10;
  if (day <= 3 && !f.summerGigAccepted) return 13;
  if (day <= 4) return 14;
  if (day <= 5 && !f.prChoice) return 16;
  if (day <= 6) return 17;
  if (day <= 7 && !f.firstWeekSettled) return 18;
  return null; // 序章已完成：剧情层不再自动打开
}

const freshStory = (world: WorldState): StoryView => {
  const idx = prologueIndexFromWorld(world) ?? 0;
  return {idx, mood: null, curtain: 'none', backlog: [{who: PROLOGUE[idx].who, text: stepText(idx, world, null)}]};
};

let commandCounter = 0;
function commandId(): string {
  commandCounter += 1;
  return 'ui-' + Date.now().toString(36) + '-' + commandCounter;
}

export default function App() {
  const [world, setWorld] = useState<WorldState>(() => newWorld('未命名工作室'));
  const [story, setStory] = useState<StoryView>(() => freshStory(newWorld('未命名工作室')));
  const [nav, dispatchNav] = useReducer(reduceNav, undefined, () => ({...initialNav(), overlay: 'story' as const, returnTo: {tab: 'company' as const, stack: []}}));
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');
  const [saveInfo, setSaveInfo] = useState<SaveMeta | null>(null);
  const [saveNote, setSaveNote] = useState('');
  const storyRef = useRef(story);
  storyRef.current = story;
  // 同步引用：连续点击永远基于最新世界（防 React 批处理的丢失更新）；连点推日=有意连续推进多天
  const worldRef = useRef(world);

  /** 执行一组世界命令：成功才提交（失败丢弃中间结果，无半更新）；每次交互一个 baseId，整组幂等可重放 */
  const exec = (actions: {type: string; [k: string]: unknown}[]): WorldState => {
    const base = commandId();
    const {world: w2} = foldCommands(worldRef.current, actions, base);
    worldRef.current = w2;
    setWorld(w2);
    return w2;
  };

  const applyEnter = (idx: number): WorldState => {
    const enter = PROLOGUE[idx].enter;
    return enter ? exec(enter) : worldRef.current;
  };

  const storyNext = () => {
    if (PROLOGUE[story.idx].decision) return;
    const next = Math.min(story.idx + 1, PROLOGUE.length - 1);
    if (next === story.idx) return;
    try {
      const w2 = applyEnter(next);
      setStory({...story, idx: next, curtain: 'none', backlog: [...story.backlog, {who: PROLOGUE[next].who, text: stepText(next, w2, story.mood)}]});
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : '推进失败'); }
  };

  const storyChoice = (value: string) => {
    const step = PROLOGUE[story.idx];
    const res = step.resolve?.[value];
    if (!res) return;
    setError('');
    if (res.curtain === 'resume' || res.curtain === 'contract') { setStory({...story, curtain: res.curtain}); return; }
    let w2 = world;
    try {
      w2 = res.engine ? exec(res.engine) : world;
    } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); return; }
    const mood = step.decision === 'mood' ? value : story.mood;
    if (res.curtain === 'settlement') { setStory({...story, mood, curtain: 'settlement'}); return; }
    setStory({...story, idx: res.next, mood, curtain: 'none', backlog: [...story.backlog, {who: PROLOGUE[res.next].who, text: stepText(res.next, w2, mood)}]});
  };

  const storySkip = () => {
    let idx = story.idx;
    try {
      while (!PROLOGUE[idx].decision && idx < PROLOGUE.length - 1) {
        idx += 1;
        applyEnter(idx);
      }
    } catch (e) { setError(e instanceof Error ? e.message : '跳转失败'); return; }
    setStory({...story, idx, curtain: 'none', backlog: [...story.backlog, {who: PROLOGUE[idx].who, text: stepText(idx, worldRef.current, story.mood)}]});
  };

  // 命名确认 → 挂上新名牌（世界从开局就存在，这里只是命名）→ 进入"念名字"一步
  const storyName = (name: string) => {
    try {
      const w2 = exec([{type: 'RENAME_COMPANY', name}]);
      setUnread(1);
      setStory(prev => ({...prev, idx: 6, curtain: 'none', backlog: [...prev.backlog, {who: PROLOGUE[6].who, text: stepText(6, w2, prev.mood)}]}));
    } catch (e) { setError(e instanceof Error ? e.message : '命名失败'); }
  };

  const storyRestart = () => {
    const w2 = newWorld('未命名工作室');
    worldRef.current = w2;
    setWorld(w2);
    setError('');
    setSaveNote('');
    setStory(freshStory(w2));
    dispatchNav({type: 'RESET', openStory: true});
  };

  // ---- 存读档（Issue #5）：档案浮层内的手动槽位 ----
  const onSave = () => {
    try {
      const meta = saveWorld(worldRef.current, 0);
      setSaveInfo(meta);
      setSaveNote('已保存：' + meta.dateLabel + ' · ' + meta.company);
    } catch (e) { setSaveNote(e instanceof Error ? e.message : '保存失败'); }
  };
  const onLoad = () => {
    try {
      const {world: w2, meta} = loadWorld(0);
      worldRef.current = w2;
      setWorld(w2);
      setSaveInfo(meta);
      setSaveNote('已读取：' + meta.dateLabel);
      setError('');
      // 恢复到合法一级页面（契约第六节）：剧情完成后落工作室总览，序章未完回剧情
      const idx = prologueIndexFromWorld(w2);
      if (idx === null) {
        setStory({...storyRef.current, curtain: 'none'});
        dispatchNav({type: 'RESET'});
      } else {
        setStory({idx, mood: null, curtain: 'none', backlog: [{who: PROLOGUE[idx].who, text: stepText(idx, w2, null)}]});
        dispatchNav({type: 'RESET', openStory: true});
      }
    } catch (e) { setSaveNote(e instanceof Error ? e.message : '读取失败'); }
  };
  const saveExists = hasSave(0);

  /** 自由期推日（第一周结算后）：契约第二节的统一推日入口 */
  const advanceDay = () => {
    try {
      exec([{type: 'ADVANCE_DAY'}]);
      setError('');
    } catch (e) { setError(e instanceof Error ? e.message : '推进失败'); }
  };

  // ---- 委派招募（B1 · Issue #2）：发起寻访与候选审批都走唯一命令通道 ----
  const onStartScout = (track: string) => {
    try {
      exec([{type: 'START_SCOUTING', track}]);
      setError('');
      setUnread(1);
    } catch (e) { setError(e instanceof Error ? e.message : '寻访发起失败'); }
  };
  const onCandidate = (type: 'INTERVIEW_CANDIDATE' | 'SIGN_CANDIDATE' | 'REJECT_CANDIDATE') => (candidateId: string) => {
    try {
      exec([{type, candidateId}]);
      setError('');
      setUnread(1);
    } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); }
  };
  // ---- B2 / M2 / M3：培养排期、通告竞标、公司运营、选秀与复仇线 ----
  const run = (actions: {type: string; [k: string]: unknown}[], note: string) => {
    try {
      exec(actions);
      setError('');
      setUnread(1);
    } catch (e) { setError(e instanceof Error ? e.message : note); }
  };
  const onTrain = (artistId: string, tier: string, days: number) => run([{type: 'START_TRAINING', artistId, tier, days}], '排期失败');
  const onRest = (artistId: string, days: number) => run([{type: 'START_REST', artistId, days}], '排期失败');
  const onBond = (artistId: string) => run([{type: 'START_BONDING', artistId}], '排期失败');
  const onBid = (gigId: string, artistId: string, bribeMinor: number) => run([{type: 'BID_GIG', gigId, artistId, bribeMinor}], '竞标失败');
  const onSignYichen = () => run([{type: 'SIGN_YICHEN'}], '签约失败');
  const onSuppress = () => run([{type: 'SUPPRESS_SMEAR'}], '压制失败');
  const onFestSignup = (artistId: string) => run([{type: 'FESTIVAL_SIGNUP', artistId}], '报名失败');
  const onFestBoost = (boostId: string) => run([{type: 'FESTIVAL_BOOST', boostId}], '打榜失败');
  const onInvest = () => run([{type: 'START_INVESTIGATION'}], '调查发起失败');
  const onFinale = (choice: string) => run([{type: 'RESOLVE_FINALE', choice}], '抉择失败');

  const overlay = nav.overlay === 'story'
    ? <StoryPlayer story={story} world={world}
        onName={storyName} onNext={storyNext} onChoice={storyChoice} onSkip={storySkip}
        onExit={() => dispatchNav({type: 'CLOSE_OVERLAY'})}
        onRestart={storyRestart}
        onDismissCurtain={() => setStory(s => ({...s, curtain: 'none'}))}
        onConfirmSettlement={() => {setStory(s => ({...s, curtain: 'none'})); dispatchNav({type: 'CLOSE_OVERLAY'});}}/>
    : nav.overlay === 'phone'
      ? <PhonePage world={world} onClose={() => dispatchNav({type: 'CLOSE_OVERLAY'})}/>
    : nav.overlay === 'profile'
      ? <div className="profile-sheet" role="dialog" aria-label="老板个人档案">
          <button className="pale-btn profile-close" onClick={() => dispatchNav({type: 'CLOSE_OVERLAY'})}>返回 ×</button>
          <ProfilePage world={world} onRestart={storyRestart}
            onSave={onSave} onLoad={onLoad} saveExists={saveExists}
            saveInfo={saveInfo} saveNote={saveNote}/>
        </div>
      : undefined;

  const renderTab = () => {
    // 二级页栈 M1 暂无实体页；有栈时渲染通用占位并保留返回链，防止困死
    if (nav.stack.length > 0) {
      const pageId = nav.stack[nav.stack.length - 1];
      if (nav.tab === 'map' && pageId.startsWith('district:'))
        return <DistrictPage districtId={pageId.slice(9) as DistrictId}
          onBack={() => dispatchNav({type: 'BACK'})}/>;
      return <div className="page">
        <PageHeader title="建设中" subtitle={pageId} onBack={() => dispatchNav({type: 'BACK'})}/>
        <p className="page-note">该页面在 M1 后续步骤接入。</p>
      </div>;
    }
    switch (nav.tab) {
      case 'map': return <MapPage onOpenDistrict={id => dispatchNav({type: 'PUSH', page: 'district:' + id})}/>;
      case 'company': return <CompanyPage world={world} error={error} onContinueStory={() => dispatchNav({type: 'OPEN_OVERLAY', kind: 'story'})} onRestart={storyRestart} onAdvanceDay={advanceDay}
        onStartScout={onStartScout} onInterview={onCandidate('INTERVIEW_CANDIDATE')} onSign={onCandidate('SIGN_CANDIDATE')} onReject={onCandidate('REJECT_CANDIDATE')}
        onSignYichen={onSignYichen} onInvest={onInvest} onSuppress={onSuppress} onFinale={onFinale}/>;
      case 'artists': return <ArtistsPage world={world}/>;
      case 'schedule': return <SchedulePage world={world} onTrain={onTrain} onRest={onRest} onBond={onBond} onFestSignup={onFestSignup} error={error}/>;
      case 'gigs': return <GigsPage world={world} onBid={onBid} error={error} onFestBoost={onFestBoost}/>;
    }
  };

  const ending = world.ending;
  const endingOverlay = ending
    ? <div className="ending-sheet" role="dialog" aria-label={ending.title}>
        <div className="ending-box">
          <small>CHAPTER FIN</small>
          <h1>{ending.title}</h1>
          <p>{ending.body}</p>
          <p className="ending-meta">{formatDateLabel(world.clock)} · 深度 {Object.keys(world.works).length} 部作品 · {world.company.name}</p>
          <button className="btn-primary" onClick={storyRestart}>重 走 星 途</button>
        </div>
      </div>
    : undefined;

  return <GameShell
    resource={{dateLabel: formatDateLabel(world.clock), money: formatWan(world.company.cashMinor), reputation: world.company.reputation}}
    phoneUnread={unread}
    onOpenPhone={() => {setUnread(0); dispatchNav({type: 'OPEN_OVERLAY', kind: 'phone'});}}
    onOpenProfile={() => dispatchNav({type: 'OPEN_OVERLAY', kind: 'profile'})}
    activeTab={nav.tab}
    onSwitchTab={tab => dispatchNav({type: 'SWITCH_TAB', tab})}
    chromeHidden={nav.overlay === 'story' || !!ending}
    overlay={<>{endingOverlay}{overlay}</>}>
    {renderTab()}
  </GameShell>;
}

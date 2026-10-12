import {useReducer, useState} from 'react';
import {start, reduceGame, type GameState} from './game/engine.mjs';
import {initialNav, reduceNav} from './ui/navigation';
import {GameShell} from './ui/GameShell';
import {StoryPlayer, type StoryView} from './story/StoryPlayer';
import {PROLOGUE} from './story/script';
import {MapPage, DistrictPage, SchedulePage, CompanyPage, ArtistsPage, GigsPage, ProfilePage, PhonePage} from './pages/shell-pages';
import {PageHeader} from './ui/components';
import type {DistrictId} from './game/industry-districts';

/*
 * App 接线：世界状态（engine）+ 剧情进度 + 导航三个状态源。
 * 页面组件只消费状态；资金分成、随机等业务规则全部留在 engine（蓝图第六节）。
 */

function stepText(idx: number, mood: string | null, g: GameState | null): string {
  const step = PROLOGUE[idx];
  const ctx = {company: g?.company ?? '星芒工作室', mood, trained: g?.trained ?? false, pr: g?.pr ?? null};
  return typeof step.text === 'function' ? step.text(ctx) : step.text;
}

/** 进入某步时按序执行其转场引擎动作，返回新世界状态 */
function withEnter(idx: number, g: GameState | null): GameState | null {
  const enter = PROLOGUE[idx].enter;
  if (!enter || !g) return g;
  let s = g;
  for (const a of enter) s = reduceGame(s, a);
  return s;
}

const freshStory = (): StoryView => ({idx: 0, mood: null, curtain: 'none', backlog: [
  {who: PROLOGUE[0].who, text: stepText(0, null, null)},
]});

export default function App() {
  const [game, setGame] = useState<GameState | null>(null);
  const [story, setStory] = useState<StoryView>(freshStory);
  const [nav, dispatchNav] = useReducer(reduceNav, undefined, () => ({...initialNav(), overlay: 'story' as const, returnTo: {tab: 'company' as const, stack: []}}));
  const [unread, setUnread] = useState(0);
  const [error, setError] = useState('');

  const storyNext = () => {
    if (PROLOGUE[story.idx].decision) return;
    const next = Math.min(story.idx + 1, PROLOGUE.length - 1);
    if (next === story.idx) return;
    try {
      const g2 = withEnter(next, game);
      if (g2 !== game) setGame(g2);
      setStory({...story, idx: next, curtain: 'none', backlog: [...story.backlog, {who: PROLOGUE[next].who, text: stepText(next, story.mood, g2)}]});
    } catch (e) { setError(e instanceof Error ? e.message : '推进失败'); }
  };

  const storyChoice = (value: string) => {
    const step = PROLOGUE[story.idx];
    const res = step.resolve?.[value];
    if (!res) return;
    setError('');
    if (res.curtain === 'resume' || res.curtain === 'contract') { setStory({...story, curtain: res.curtain}); return; }
    let g2 = game;
    try {
      if (res.engine && g2) {
        let s = g2;
        for (const a of res.engine) s = reduceGame(s, a);
        g2 = s;
      }
    } catch (e) { setError(e instanceof Error ? e.message : '操作失败'); return; }
    if (res.engine && g2 !== game) setGame(g2);
    const mood = step.decision === 'mood' ? value : story.mood;
    if (res.curtain === 'settlement') { setStory({...story, mood, curtain: 'settlement'}); return; }
    setStory({...story, idx: res.next, mood, curtain: 'none', backlog: [...story.backlog, {who: PROLOGUE[res.next].who, text: stepText(res.next, mood, g2)}]});
  };

  const storySkip = () => {
    let idx = story.idx;
    let g2 = game;
    try {
      while (!PROLOGUE[idx].decision && idx < PROLOGUE.length - 1) {
        idx += 1;
        const g3 = withEnter(idx, g2);
        if (g3 !== g2) g2 = g3;
      }
    } catch (e) { setError(e instanceof Error ? e.message : '跳转失败'); return; }
    if (g2 !== game) setGame(g2);
    setStory({...story, idx, curtain: 'none', backlog: [...story.backlog, {who: PROLOGUE[idx].who, text: stepText(idx, story.mood, g2)}]});
  };

  // 命名确认 → 公司成立（day 1）→ 进入"念名字"一步（V0.2 同款步序）
  const storyName = (name: string) => {
    const g2 = start(name);
    setGame(g2);
    setUnread(1);
    setStory(prev => ({...prev, idx: 6, curtain: 'none', backlog: [...prev.backlog, {who: PROLOGUE[6].who, text: stepText(6, prev.mood, g2)}]}));
  };

  const storyRestart = () => {
    setGame(null);
    setError('');
    setStory(freshStory());
    dispatchNav({type: 'RESET', openStory: true});
  };

  const overlay = nav.overlay === 'story'
    ? <StoryPlayer story={story} game={game}
        onName={storyName} onNext={storyNext} onChoice={storyChoice} onSkip={storySkip}
        onExit={() => dispatchNav({type: 'CLOSE_OVERLAY'})}
        onRestart={storyRestart}
        onDismissCurtain={() => setStory(s => ({...s, curtain: 'none'}))}
        onConfirmSettlement={() => {setStory(s => ({...s, curtain: 'none'})); dispatchNav({type: 'CLOSE_OVERLAY'});}}/>
    : nav.overlay === 'phone'
      ? <PhonePage game={game} onClose={() => dispatchNav({type: 'CLOSE_OVERLAY'})}/>
    : nav.overlay === 'profile'
      ? <div className="profile-sheet" role="dialog" aria-label="老板个人档案">
          <button className="pale-btn profile-close" onClick={() => dispatchNav({type: 'CLOSE_OVERLAY'})}>返回 ×</button>
          <ProfilePage game={game} onRestart={storyRestart}/>
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
      case 'company': return <CompanyPage game={game} error={error} onContinueStory={() => dispatchNav({type: 'OPEN_OVERLAY', kind: 'story'})} onRestart={storyRestart}/>;
      case 'artists': return <ArtistsPage game={game}/>;
      case 'schedule': return <SchedulePage game={game} onContinueStory={() => dispatchNav({type: 'OPEN_OVERLAY', kind: 'story'})}/>;
      case 'gigs': return <GigsPage game={game}/>;
    }
  };

  return <GameShell
    resource={game ? {dateLabel: `第1年 · 1月${game.day}日`, money: `${game.money.toFixed(2)}万`, reputation: game.reputation} : null}
    phoneUnread={unread}
    onOpenPhone={() => {setUnread(0); dispatchNav({type: 'OPEN_OVERLAY', kind: 'phone'});}}
    onOpenProfile={() => dispatchNav({type: 'OPEN_OVERLAY', kind: 'profile'})}
    activeTab={nav.tab}
    onSwitchTab={tab => dispatchNav({type: 'SWITCH_TAB', tab})}
    chromeHidden={nav.overlay === 'story'}
    overlay={overlay}>
    {renderTab()}
  </GameShell>;
}

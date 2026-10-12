import {useEffect, useRef, useState} from 'react';
import {PROLOGUE, CHAPTER_LABEL, sceneLabel, type StoryContext} from './script';
import {SceneBackdrop, CharacterArt} from './artwork';
import type {GameState} from '../game/engine.mjs';

/*
 * 剧情播放器（全屏层）：展示与交互上抛，推进与引擎调用集中在 App。
 * 交互范式为通用的 Galgame 展示（ADR-0001）：点按推进、关键节点出选项、回看/自动/跳过已读。
 */

export type BacklogEntry = {who: string; text: string};

export type StoryView = {
  idx: number;
  mood: string | null;
  backlog: BacklogEntry[];
  /** 决策旁的资料卡：简历/合同条款；settlement 为结算确认层 */
  curtain: 'none' | 'resume' | 'contract' | 'settlement';
};

export function StoryPlayer({story, game, onName, onNext, onChoice, onSkip, onExit, onRestart, onDismissCurtain, onConfirmSettlement}: {
  story: StoryView;
  game: GameState | null;
  onName: (name: string) => void;
  onNext: () => void;
  onChoice: (value: string) => void;
  onSkip: () => void;
  onExit: () => void;
  onRestart: () => void;
  onDismissCurtain: () => void;
  onConfirmSettlement: () => void;
}) {
  const step = PROLOGUE[Math.min(story.idx, PROLOGUE.length - 1)];
  const ctx: StoryContext = {
    company: game?.company ?? '星芒工作室',
    mood: story.mood,
    trained: game?.trained ?? false,
    pr: game?.pr ?? null,
  };
  const [auto, setAuto] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [nameDraft, setNameDraft] = useState('星芒工作室');
  const autoRef = useRef(false);
  autoRef.current = auto;

  useEffect(() => {
    if (!auto || step.decision) return;
    const t = setTimeout(() => {if (autoRef.current) onNext();}, 2700);
    return () => clearTimeout(t);
  }, [auto, story.idx, step.decision, onNext]);

  const text = typeof step.text === 'function' ? step.text(ctx) : step.text;

  return <div className={`story-layer scene-${step.scene}`} onClick={e => {
    const el = e.target as HTMLElement;
    if (step.decision || story.curtain !== 'none' || el.closest('button') || el.closest('input') || el.closest('.log-panel')) return;
    setAuto(false);
    onNext();
  }}>
    <SceneBackdrop/>
    <CharacterArt key={step.actor} id={step.actor}/>

    <div className="story-head">
      <div className="chapter">{CHAPTER_LABEL}</div>
      <div className="tools">
        <button className="micro" onClick={() => {setAuto(false); setLogOpen(true);}}>回看</button>
        <button className="micro" onClick={() => setAuto(a => !a)}>{auto ? '暂停' : '自动'}</button>
        <button className="micro" onClick={() => setMenuOpen(m => !m)}>···</button>
      </div>
    </div>
    {menuOpen && <div className="overlay-menu" onClick={e => e.stopPropagation()}>
      <button onClick={() => {setMenuOpen(false); onExit();}}>返回工作室</button>
      <button onClick={() => {setMenuOpen(false); setAuto(false); onSkip();}}>跳至下一选择</button>
      <button onClick={() => {setMenuOpen(false); onRestart();}}>重新开始</button>
    </div>}
    <div className="script-hint">{sceneLabel(step.scene)}</div>

    <div className={`speech${step.who === '旁白' ? ' narration' : ''}`}>
      <div className="nametag">{step.who}</div>
      <div className="text">{text}</div>
      <div className="bottomrow">
        <span className="hint">{step.decision ? '请选择下一步' : '点击对白或右侧箭头继续'}</span>
        {!step.decision && <button className="next" onClick={e => {e.stopPropagation(); setAuto(false); onNext();}}>继续 <b>›</b></button>}
      </div>
    </div>

    {step.decision === 'name'
      ? <div className="inputbox" onClick={e => e.stopPropagation()}>
          <label htmlFor="companyName">为你的经纪工作室命名</label>
          <input id="companyName" maxLength={14} value={nameDraft} placeholder="输入工作室名称"
            onChange={e => setNameDraft(e.target.value)}
            onKeyDown={e => {if (e.key === 'Enter') onName(nameDraft.trim().slice(0, 14) || '星芒工作室');}}/>
          <button onClick={() => onName(nameDraft.trim().slice(0, 14) || '星芒工作室')}>挂上新的名牌　✦</button>
          <small>名字可在完整游戏的公司设置中修改</small>
        </div>
      : step.choices && <div className="choices" onClick={e => e.stopPropagation()}>
          <span className="tip">YOUR CHOICE　✧</span>
          {step.choices.map(c => <button key={c.value} className="choice" onClick={() => {setAuto(false); onChoice(c.value);}}>
            <span className="choice-text">{c.text}</span>
            {c.desc && <span className="choice-desc">{c.desc}</span>}
          </button>)}
        </div>}

    {logOpen && <div className="log-panel" onClick={e => e.stopPropagation()}>
      <button className="pale-btn" style={{float: 'right'}} onClick={() => setLogOpen(false)}>关闭</button>
      <h3>剧情回看</h3>
      {story.backlog.map((h, i) => <div key={i} className="log-item"><b>{h.who}</b><div>{h.text}</div></div>)}
    </div>}

    {story.curtain === 'resume' && <div className="curtain active" onClick={e => e.stopPropagation()}>
      <button className="curtain-close" onClick={onDismissCurtain}>×</button>
      <h2>陆星遥 · 个人简历</h2>
      <div className="receipt">
        <h3>前核心后援会会长</h3>
        <p style={{fontSize: '12px', lineHeight: 1.85, color: '#8a7780', margin: '8px 0'}}>唱跳 55 · 颜值 82 · 路人缘 45<br/>等级 D · 初始人气 5,000<br/>主动零底薪加入工作室，对玩家有极强的信任。</p>
      </div>
      <button className="pale-btn" style={{display: 'block', margin: '12px auto'}} onClick={onDismissCurtain}>返回签约对话</button>
    </div>}

    {story.curtain === 'contract' && <div className="curtain active" onClick={e => e.stopPropagation()}>
      <button className="curtain-close" onClick={onDismissCurtain}>×</button>
      <h2>《夏日邻座》</h2>
      <div className="receipt">
        <span className="pill">青柠视频 · 新人综艺</span>
        <h3 style={{margin: '10px 0 4px'}}>第一次通告</h3>
        <p style={{fontSize: '12px', lineHeight: 1.85, color: '#8a7780', margin: '8px 0'}}>三天录制。通告总报酬 25 万，平台抽成 30%，艺人分成 30%，公司预计收入 12.25 万。新手期首次竞标保底成功。</p>
      </div>
      <button className="pale-btn" style={{display: 'block', margin: '12px auto'}} onClick={onDismissCurtain}>返回通告决策</button>
    </div>}

    {story.curtain === 'settlement' && game && <div className="curtain active" onClick={e => e.stopPropagation()}>
      <div style={{textAlign: 'center', fontSize: '10px', letterSpacing: '.24em', color: '#a98694', margin: '20px 0'}}>CHAPTER 00 · FINISHED</div>
      <h2 style={{textAlign: 'center'}}>第一束聚光灯</h2>
      <div className="receipt">
        <h3>第一周 · 工作室结算</h3>
        <div className="statline"><span>《夏日邻座》总通告费</span><b>+25万</b></div>
        <div className="statline"><span>平台抽成</span><b>-7.5万</b></div>
        <div className="statline"><span>艺人分成</span><b>-5.25万</b></div>
        <div className="statline"><span>运营支出</span><b>-2.5万</b></div>
        <div className="statline"><span>唱跳训练</span><b>{game.trained ? '-1万' : '未安排'}</b></div>
        <div className="statline"><span>公关支出</span><b>{game.pr === 'lawyer' ? '-20万' : '0万'}</b></div>
        <div className="statline total"><span>公司当前资金</span><b>{game.money.toFixed(2)}万</b></div>
        <div className="statline"><span>陆星遥人气</span><b>{(5000 + (game.settled ? (game.trained ? 3600 : 2400) : 0)).toLocaleString()}</b></div>
        <div className="statline"><span>公司口碑</span><b>{game.reputation}</b></div>
      </div>
      <p style={{fontSize: '12px', lineHeight: 1.9, color: '#85727b'}}>第一周完成。星煌的阴影还在，但你的工作室终于拥有了第一束属于自己的光。</p>
      <button className="btn-primary" onClick={onConfirmSettlement}>返回工作室</button>
    </div>}
  </div>;
}

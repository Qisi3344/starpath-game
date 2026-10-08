import {useState} from 'react';
import {getFans, reduceGame, start} from './game/engine.mjs';

type GameState={day:number;company:string;money:number;reputation:number;artistSigned:boolean;trained:boolean;jobAccepted:boolean;pr:string|null;settled:boolean;history:string[]};
type Action={type:string;method?:string};
const WELCOME='三年前，星煌娱乐夺走了你的舞台。如今，你用两百万和一间小小的工作室，重新开始。';
function Dialog({speaker,children}:{speaker:string;children:React.ReactNode}){return <div className="dialog"><div className="speaker">{speaker}</div><div>{children}</div></div>}
export default function App(){
  const [name,setName]=useState('星芒事务所');
  const [game,setGame]=useState<GameState|null>(null);
  const [error,setError]=useState('');
  const act=(action:Action)=>{if(!game)return;try{setGame(reduceGame(game,action) as GameState);setError('')}catch(e){setError(e instanceof Error?e.message:'操作失败')}};
  const actions = (items:{label:string;type:string;method?:string}[])=>items.map(a=><button key={a.label} className="action" onClick={()=>act(a)}>{a.label}<span>›</span></button>);
  const restart=()=>{setGame(null);setError('')};
  return <div className="layout"><aside className="side"><div className="eyebrow">ENTERTAINMENT MANAGEMENT × VISUAL NOVEL</div><h1>星途计划<span>✦</span></h1><p>那些被夺走的星光，终有一天会再度亮起。</p><div className="line"/><p>Alpha 0.1 · 开发骨架</p><a href="/prototypes/galgame-v0.2.html" target="_blank" rel="noreferrer">查看完整 V0.2 视觉试玩 ↗</a></aside>
    <main className="phone"><header><span>STARPATH / CHAPTER 00</span><span>✧</span></header><div className="sky"><div className="glow"/><div className="window"><div className="windowbar"/><div className="city"/></div><div className="desk"/></div>
      <div className="topbar"><span>{game?`第1年 · 1月${game.day}日`:'序章 · 重新启程'}</span><span>{game?.company??'未命名工作室'}</span></div>
      {game && <div className="resources"><span>资金 <b>{game.money.toFixed(2)}万</b></span><span>口碑 <b>{game.reputation}</b></span><span>人气 <b>{getFans(game).toLocaleString()}</b></span></div>}
      <div className="stage-content">{!game?<><Dialog speaker="旁白">{WELCOME}</Dialog><div className="panel"><label htmlFor="company">给公司取个名字</label><input id="company" maxLength={20} value={name} onChange={e=>setName(e.target.value)}/><button className="action" onClick={()=>setGame(start(name) as GameState)}>正式开业 <span>›</span></button></div></>:
      <><Dialog speaker={game.day===1?'林知夏':game.day===5?'林知夏':game.day===7?'旁白':'陆星遥'}>
        {game.day===1?'「我回来了。文件放桌上了，至于第一次签约的人选……她刚刚来过电话。」':game.day===2?'「我会努力的！今天是去练习，还是先找通告？」':game.day===3?'「《夏日邻座》正在招新人，真的可以让我去试试吗？」':game.day===4?'拍摄进行中。导演认可了这位认真又有些生涩的新人。':game.day===5?'「星煌又发声了。你打算让律师出面，还是自己回应？」':game.day===6?'「我把公关反馈收齐了。明天就是通告结算日。」':game.settled?'第一周结束。舞台很远，但你们走出了第一步。':'第一周的账目已经送达。'}</Dialog>
      <div className="panel">{game.day===1?actions([{label:'签约陆星遥',type:'SIGN'}]):game.day===2?actions([{label:'训练唱跳 · -1万',type:'TRAIN'},{label:'优先寻找通告',type:'SKIP_TRAIN'}]):game.day===3?actions([{label:'接下《夏日邻座》',type:'ACCEPT_JOB'}]):game.day===4?actions([{label:'前往下一事件',type:'ADVANCE'}]):game.day===5?actions([{label:'委托律师 · -20万，口碑+5',type:'PR',method:'lawyer'},{label:'公开说明 · 口碑+2',type:'PR',method:'statement'},{label:'冷处理 · 口碑-5',type:'PR',method:'cold'}]):game.day===6?actions([{label:'前往周结算',type:'TO_SETTLEMENT'}]):!game.settled?actions([{label:'确认第一周结算',type:'SETTLE'}]):<button className="action" onClick={restart}>重新体验 <span>↻</span></button>}{error&&<div role="alert" className="error">{error}</div>}</div></>}
      </div><footer><span>STARPATH · ALPHA SHELL</span><span>{game?`${game.day}/7`:'00/07'}</span></footer>
    </main><aside className="side right"><div className="eyebrow">DEVELOPMENT NOTE</div><h2>一间小小的公司，<br/>一个不肯认输的你。</h2><p>本页面是正式 React 架构的交互骨架，用于验证状态变更和业务引擎；剧情视觉、立绘和完整交互请参看 V0.2 原型。</p><div className="line"/><p>下一里程碑：完成第一个游戏月的可玩经营循环。</p></aside></div>
}

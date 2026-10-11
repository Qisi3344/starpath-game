import {PageHeader, SoftCard, StatusTag, EmptyState, StatLine, PrimaryButton, GhostButton} from '../ui/components';
import type {GameState} from '../game/engine.mjs';

/*
 * M1 页面壳：占位页明确"建设中"而非假装可点（蓝图第六节）；
 * 有真实状态的部分接 engine（工作室总览 / 艺人 / 通告 / 手机）。
 */

export function MapPage() {
  return <div className="page">
    <PageHeader title="大地图" subtitle="CITY MAP · 规划中"/>
    <SoftCard title="娱乐圈尚未铺开">
      <p>区域分布、竞争公司与资源点将在后续版本成为独立探索页。M1 阶段，你的重心在工作室里。</p>
    </SoftCard>
    <EmptyState icon="✧" title="城市还在天亮之前" note="第一目标是一个游戏月的经营闭环，不是完整地图。"/>
  </div>;
}

function todoFor(game: GameState): {title: string; note: string} {
  if (game.settled) return {title: '第一周，顺利结束', note: '第一位艺人的首个通告已完成。新的章节即将开始。'};
  if (!game.artistSigned) return {title: '一份还没签字的合同', note: '陆星遥正在等待你的答复。别让第一份信任等太久。'};
  if (game.day === 2) return {title: '安排明天的行程', note: '训练还是先找通告？把刚刚起步的公司一点点做起来。'};
  if (game.day === 3) return {title: '第一个通告机会', note: '《夏日邻座》正在招新人，决定要不要接下它。'};
  if (game.day === 4) return {title: '通告执行中', note: '星遥正在录制现场。等待她的第一份工作汇报。'};
  if (game.day === 5) return {title: '热搜危机待决策', note: '星煌发声试探。公关路线需要你来定。'};
  return {title: '结算日到了', note: '公关反馈收齐了。确认第一周的账目。'};
}

export function CompanyPage({game, error, onContinueStory, onRestart}: {
  game: GameState | null;
  error: string;
  onContinueStory: () => void;
  onRestart: () => void;
}) {
  if (!game) return <div className="page">
    <PageHeader title="公司" subtitle="MY LITTLE COMPANY"/>
    <EmptyState icon="⌂" title="公司还没有名字" note="完成序章剧情并命名后，这里会成为你的工作室总览。"/>
    <PrimaryButton onClick={onContinueStory}>回到序章剧情　→</PrimaryButton>
  </div>;
  const todo = todoFor(game);
  return <div className="page">
    <PageHeader title="工作室" subtitle={`${game.company} · 老板总览`}/>
    <div className="home-hero">
      <small>MY LITTLE COMPANY · CHAPTER 00</small>
      <h3>{game.company}<br/>从这里，重返星途。</h3>
    </div>
    <SoftCard tag="待办事项" title={todo.title}>
      <p>{todo.note}</p>
      <footer><PrimaryButton onClick={onContinueStory}>{game.settled ? '回看序章与结算' : '进入剧情 / 推进'}　→</PrimaryButton></footer>
    </SoftCard>
    <SoftCard tag="员工汇报" title="林知夏">
      <p>{game.settled ? '「第一周的报表我整理好了。资金和口碑的变化都在结算单上。」' :
        game.day >= 5 ? '「星煌的动向我在盯着，有变化第一时间告诉你。」' :
        '「合同和通告都在资料夹里。别忘了按时吃饭。」'}</p>
      <footer><StatusTag tone="ok">执行经纪 · 在岗</StatusTag></footer>
    </SoftCard>
    {error && <div role="alert" className="error">{error}</div>}
    {game.settled && <SoftCard title="想再走一遍？">
      <p>重玩序章可以尝试另一种对话与公关选择。</p>
      <footer><GhostButton onClick={onRestart}>重开序章 ↻</GhostButton></footer>
    </SoftCard>}
  </div>;
}

export function ArtistsPage({game}: {game: GameState | null}) {
  const signed = game?.artistSigned ?? false;
  return <div className="page">
    <PageHeader title="艺人" subtitle="TALENT ROSTER"/>
    {signed
      ? <SoftCard tag="D 级偶像 · 第一位签约艺人" title="陆星遥">
          <div className="artist-row">
            <div className="artist-avatar" aria-hidden>✧</div>
            <div>
              <p>前核心后援会会长 · 初始人气 5,000</p>
              <StatusTag tone={game?.day === 4 ? 'warn' : 'ok'}>{game?.day === 4 ? '通告中' : '空档'}</StatusTag>
            </div>
          </div>
          <StatLine label="唱跳能力" value="55 / 100"/>
          <StatLine label="颜值" value="82 / 100"/>
          <StatLine label="路人缘" value="45 / 100"/>
          <p className="quote">「这一次，我也想陪你站到光里。」</p>
        </SoftCard>
      : <EmptyState icon="♧" title="等待新成员" note="你的工作室尚未签约艺人。故事第一天，陆星遥会带着简历出现。"/>}
  </div>;
}

export function GigsPage({game}: {game: GameState | null}) {
  const job = game?.jobAccepted ?? false;
  return <div className="page">
    <PageHeader title="通告" subtitle="GIG MARKET"/>
    {job
      ? <SoftCard tag="青柠视频 · 新人综艺" title="《夏日邻座》">
          <p>三日录制，新人生活观察类轻综艺。{game?.settled ? '已结算完毕。' : '通告已经接受，等待后续安排。'}</p>
          <StatLine label="通告报酬" value="25 万"/>
          <StatLine label="预计公司收入" value="12.25 万"/>
          <StatLine label="状态" value={game?.settled ? '已结算' : '进行中'}/>
        </SoftCard>
      : <EmptyState icon="✦" title="市场暂时安静" note="正式的通告市场与竞标流程将在 M1 后续步骤接入。第一个机会会从剧情中到来。"/>}
  </div>;
}

export function ProfilePage({game, onRestart}: {game: GameState | null; onRestart: () => void}) {
  return <div className="page">
    <PageHeader title="我的" subtitle="FORMER SUPERSTAR"/>
    <SoftCard title="个人身份">
      <p>过去：顶流艺人<br/>现在：经纪公司创始人{game ? <><br/>工作室：{game.company}</> : null}</p>
      <footer><StatusTag tone="muted">复仇证据 · 0 / 3</StatusTag></footer>
    </SoftCard>
    <SoftCard title="存读档">
      <p>存读档系统在 M1 月末结算步骤接入；当前刷新页面后将回到工作室总览。</p>
      <footer><StatusTag tone="muted">建设中</StatusTag></footer>
    </SoftCard>
    <SoftCard title="重新开始">
      <p>可以重玩第一周，尝试不同的对话与公关选择。</p>
      <footer><GhostButton onClick={onRestart}>重开序章 ↻</GhostButton></footer>
    </SoftCard>
  </div>;
}

export function PhonePage({game, onClose}: {game: GameState | null; onClose: () => void}) {
  const signed = game?.artistSigned ?? false;
  const settled = game?.settled ?? false;
  return <div className="phone-sheet">
    <PageHeader title="手机" subtitle="MESSAGES & TRENDING"/>
    <button className="pale-btn sheet-close" onClick={onClose}>收起 ×</button>
    <div className="notifications">
      <div className="note"><b>知夏 · 置顶</b><br/>合同和通告都在资料夹里。别忘了按时吃饭。</div>
      <div className="note"><b>陆星遥</b><br/>{settled ? '节目播了！我妈妈把截图发到亲戚群里了！' : signed ? '我会加油的！今天还要练习吗？' : '听说你准备重新开公司了……可以聊聊吗？'}</div>
      <div className="note"><b>娱乐热搜 · 今日头条</b><br/>{game?.pr ? '#过气艺人另起炉灶# · 舆情已更新' : '#春季选秀新面孔# · 热门话题'}</div>
    </div>
    <SoftCard title="审批提醒">
      <p>{game?.pr ? '公关决策已执行，暂无待审批事项。' : '老板委派与合同审批流在 M1 后续步骤接入。'}</p>
      <footer><StatusTag tone="muted">建设中</StatusTag></footer>
    </SoftCard>
  </div>;
}

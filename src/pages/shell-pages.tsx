import {CharacterPlaceholder} from '../story/CharacterPlaceholder';
import {PageHeader, SoftCard, StatusTag, EmptyState, StatLine, PrimaryButton, GhostButton} from '../ui/components';
import type {WorldState, SaveMeta, Candidate, RecruitmentTask} from '../game/world/world.d.mts';
import {formatWan} from '../game/world/format.mjs';
import {SCOUT_TRACKS} from '../game/world/recruitment.mjs';
import {INDUSTRY_DISTRICTS, type DistrictId} from '../game/industry-districts';

/*
 * M1 页面壳：全部从唯一 WorldState 读数据（契约第一节：禁止第二状态源）；
 * 占位页明确"建设中"而非假装可点。
 */

export function MapPage({onOpenDistrict}: {onOpenDistrict: (id: DistrictId) => void}) {
  return <div className="page">
    <PageHeader title="娱乐圈" subtitle="INDUSTRY WORLD · 城市版图"/>
    <div className="world-map" aria-label="娱乐圈五大城区">
      <div className="map-halo" aria-hidden="true">✧</div>
      {INDUSTRY_DISTRICTS.map((district, i) =>
        <button type="button" key={district.id} className={`district-point district-${district.id}`}
          onClick={() => onOpenDistrict(district.id)}
          aria-label={`查看${district.title}，${district.group}`}>
          <span className="district-dot" aria-hidden="true">{i + 1}</span>
          <strong>{district.title}</strong>
          <small>{district.group}</small>
        </button>)}
    </div>
    <SoftCard tag="世界地图 · 初期可探索" title="从这里认识整个娱乐圈">
      <p>查看每个城区的行业资源与可能出现的故事。今后可以向指定地区派遣经纪人或星探，发现通告和人才线索。</p>
      <footer><StatusTag tone="muted">地图地点可查看 · 派遣功能待开发</StatusTag></footer>
    </SoftCard>
  </div>;
}

export function DistrictPage({districtId, onBack}: {districtId: DistrictId; onBack: () => void}) {
  const district = INDUSTRY_DISTRICTS.find(item => item.id === districtId);
  if (!district) return <div className="page"><PageHeader title="未知地区" onBack={onBack}/></div>;
  return <div className="page">
    <PageHeader title={district.title} subtitle={district.group} onBack={onBack}/>
    <div className="district-hero"><span>INDUSTRY AREA / {district.title}</span><h3>{district.group}</h3></div>
    <SoftCard tag="区域介绍" title="在这里会遇到什么？">
      <p>{district.desc}</p>
      <StatLine label="预计资源类型" value={district.opportunities}/>
    </SoftCard>
    <SoftCard title="经纪人外派">
      <p>未来在这里选择员工、目标、预算和天数，完成任务后通过手机收到进展报告。</p>
      <footer><StatusTag tone="muted">尚未开放：不扣资金、不推进游戏日</StatusTag></footer>
    </SoftCard>
    <GhostButton onClick={onBack}>〈 返回娱乐圈地图</GhostButton>
  </div>;
}

export function SchedulePage({world, onContinueStory}: {world: WorldState; onContinueStory: () => void}) {
  const day = world.clock.absoluteDay;
  const f = world.story.flags;
  const inFirstWeek = day <= 7;
  const schedule = f.firstWeekSettled ? '第一周已结算。第二个月的日程安排将在委派与通告系统接入后开放。'
    : !f.luSigned ? '等待陆星遥签约。'
    : day === 2 ? '陆星遥今日可安排唱跳培训，决策仍在序章剧情中进行。'
    : day === 3 ? '《夏日邻座》正在等待你的通告决定。'
    : day >= 4 && day <= 6 ? '陆星遥正在参与综艺录制。'
    : day === 5 ? '星煌舆情事件，等待老板选择公关方案。'
    : '经纪人正在整理本周通告和财务资料。';
  return <div className="page">
    <PageHeader title="日程" subtitle="SCHEDULE · 艺人培养与员工委派"/>
    <SoftCard tag="第1年 · 第1月" title={`第 ${world.clock.day} 日的安排`}>
      <div className="week-strip" aria-label="第一周游戏日">
        {[1,2,3,4,5,6,7].map(n =>
          <span key={n} className={`week-day${inFirstWeek && world.clock.day === n ? ' is-current' : ''}${f.firstWeekSettled || world.clock.day > n ? ' is-past' : ''}`}>{n}日</span>)}
      </div>
      <p>{schedule}</p>
      {inFirstWeek && !f.firstWeekSettled && <footer><PrimaryButton onClick={onContinueStory}>回到剧情处理当前任务 →</PrimaryButton></footer>}
    </SoftCard>
    <SoftCard tag="助理与星探" title="委派任务">
      <p>正式版中你可以安排林知夏执行新人寻访和商务接洽；当前没有已运行的派遣任务。</p>
      <footer><StatusTag tone="muted">委派引擎接入 M1 后续阶段（B1）</StatusTag></footer>
    </SoftCard>
    <SoftCard tag="档期" title="跨艺人排期">
      <p>未来可在这里查看、调整通告、培养与外派的时间冲突。现在不伪造空档或完成结果。</p>
    </SoftCard>
  </div>;
}

function todoFor(world: WorldState): {title: string; note: string} {
  const f = world.story.flags;
  const day = world.clock.absoluteDay;
  const waiting = Object.values(world.candidatePool).filter(c => c.status === 'pending' || c.status === 'negotiating').length;
  if (waiting > 0) return {title: '候选人档案在等你', note: '林知夏带回了' + waiting + '份档案。窗口期内不定，人就是别家的了。'};
  if (f.firstWeekSettled) return {title: '第一周，顺利结束', note: '第一位艺人的首个通告已完成。新的章节即将开始。'};
  if (!f.luSigned) return {title: '一份还没签字的合同', note: '陆星遥正在等待你的答复。别让第一份信任等太久。'};
  if (day === 2) return {title: '安排今天的行程', note: '训练还是先找通告？把刚刚起步的公司一点点做起来。'};
  if (day === 3) return {title: '第一个通告机会', note: '《夏日邻座》正在招新人，决定要不要接下它。'};
  if (day >= 4 && day <= 6) return {title: '通告执行中', note: '星遥正在录制现场。等待她的第一份工作汇报。'};
  if (day === 5) return {title: '热搜危机待决策', note: '星煌发声试探。公关路线需要你来定。'};
  return {title: '结算日到了', note: '公关反馈收齐了。确认第一周的账目。'};
}

const TRACK_LABEL: Record<string, string> = {idol: '偶像', actor: '影视', variety: '综艺'};

function CandidateCard({cand, onInterview, onSign, onReject}: {
  cand: Candidate;
  onInterview: (id: string) => void;
  onSign: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const daysLeft = cand.expiresDay - cand.reportDay;
  return <div className="candidate-card" role="group" aria-label={'候选人' + cand.name}>
    <div className="candidate-head">
      <strong>{cand.name}</strong>
      <StatusTag tone={cand.grade === 'A' ? 'ok' : cand.grade === 'B' ? 'warn' : 'muted'}>{cand.grade} 级 · {TRACK_LABEL[cand.track] ?? cand.track}</StatusTag>
      {cand.status === 'negotiating' && <StatusTag tone="ok">已约谈</StatusTag>}
    </div>
    <StatLine label="唱跳 / 表演" value={`${cand.stats.performance} / 100`}/>
    <StatLine label="颜值" value={`${cand.stats.appearance} / 100`}/>
    <StatLine label="路人缘" value={`${cand.stats.appeal} / 100`}/>
    <StatLine label="诉求" value={`签约金 ${formatWan(cand.demand.signBonusMinor)} · 分成 ${Math.round(cand.demand.shareRate * 100)}% · ${cand.demand.months} 个月`}/>
    <p className="quote">{cand.interviewed ? '已当面确认：' : '知夏听说：'}{cand.risk}</p>
    <div className="candidate-actions">
      {!cand.interviewed && <GhostButton onClick={() => onInterview(cand.id)}>先约谈谈谈</GhostButton>}
      <PrimaryButton onClick={() => onSign(cand.id)}>批准签约（{formatWan(cand.demand.signBonusMinor)}）</PrimaryButton>
      <GhostButton onClick={() => onReject(cand.id)}>婉拒</GhostButton>
    </div>
    <footer><StatusTag tone="warn">第 {cand.expiresDay} 日前不定会被别家截胡（窗口 {daysLeft} 天）</StatusTag></footer>
  </div>;
}

function ScoutSection({world, onStartScout, onInterview, onSign, onReject}: {
  world: WorldState;
  onStartScout: (track: string) => void;
  onInterview: (id: string) => void;
  onSign: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const tasks = Object.values(world.recruitment);
  const open = Object.values(world.candidatePool).filter(c => c.status === 'pending' || c.status === 'negotiating');
  const closed = Object.values(world.candidatePool).filter(c => !open.includes(c));
  const zhixia = world.staff.zhixia;
  return <>
    {open.length > 0 && <SoftCard tag="老板审批 · 等你决定" title={`${open.length} 份候选人档案`}>
      {open.map(c => <CandidateCard key={c.id} cand={c} onInterview={onInterview} onSign={onSign} onReject={onReject}/>)}
    </SoftCard>}
    <SoftCard tag="委派 · ADR-0003" title="寻访新人">
      <p>指定方向，林知夏外出 {3} 天带回 0–2 份档案（也可能空手而归）。寻访经费 3 万/次，占她的任务容量（{zhixia.capacity.used}/{zhixia.capacity.max}）。</p>
      <div className="track-picker" role="radiogroup" aria-label="寻访方向">
        {SCOUT_TRACKS.map(t =>
          <button key={t.id} type="button" className="track-option" onClick={() => onStartScout(t.id)}
            disabled={zhixia.capacity.used >= zhixia.capacity.max}
            aria-label={'寻访' + t.label + '，' + t.desc}>
            <strong>{t.label}</strong><small>{t.desc}</small>
          </button>)}
      </div>
      {tasks.filter(t => t.status === 'active').map((t: RecruitmentTask) =>
        <footer key={t.id}><StatusTag tone="warn">{t.title} 进行中 · 第 {t.dueDay} 日回报</StatusTag></footer>)}
    </SoftCard>
    {closed.length > 0 && <SoftCard tag="人才库记录" title={`已归档 ${closed.length} 份`}>
      {closed.map(c => <StatLine key={c.id} label={c.name} value={({
        signed: '已签约', rejected: '已婉拒', expired: '窗口期过', poached: '被别家签走', pending: '待处理', negotiating: '约谈中',
      } as Record<string, string>)[c.status] ?? c.status}/>)}
    </SoftCard>}
  </>;
}

export function CompanyPage({world, error, onContinueStory, onRestart, onAdvanceDay, onStartScout, onInterview, onSign, onReject}: {
  world: WorldState;
  error: string;
  onContinueStory: () => void;
  onRestart: () => void;
  onAdvanceDay: () => void;
  onStartScout: (track: string) => void;
  onInterview: (id: string) => void;
  onSign: (id: string) => void;
  onReject: (id: string) => void;
}) {
  const todo = todoFor(world);
  const f = world.story.flags;
  return <div className="page">
    <PageHeader title="工作室" subtitle={`${world.company.name} · 老板总览`}/>
    <div className="home-hero">
      <small>MY LITTLE COMPANY · CHAPTER 00</small>
      <h3>{world.company.name}<br/>从这里，重返星途。</h3>
    </div>
    <SoftCard tag="待办事项" title={todo.title}>
      <p>{todo.note}</p>
      <footer><PrimaryButton onClick={onContinueStory}>{f.firstWeekSettled ? '回看序章与结算' : '进入剧情 / 推进'}　→</PrimaryButton></footer>
    </SoftCard>
    <SoftCard tag="员工汇报" title="林知夏">
      <p>{f.firstWeekSettled ? '「第一周的报表我整理好了。资金和口碑的变化都在账本里。」' :
        world.clock.absoluteDay >= 5 ? '「星煌的动向我在盯着，有变化第一时间告诉你。」' :
        '「合同和通告都在资料夹里。别忘了按时吃饭。」'}</p>
      <footer><StatusTag tone="ok">执行经纪 · 在岗（任务容量 {world.staff.zhixia.capacity.used}/{world.staff.zhixia.capacity.max}）</StatusTag></footer>
    </SoftCard>
    {error && <div role="alert" className="error">{error}</div>}
    {f.firstWeekSettled && <>
      <ScoutSection world={world} onStartScout={onStartScout} onInterview={onInterview} onSign={onSign} onReject={onReject}/>
      <SoftCard tag="时间推进 · 唯一入口" title={`今天是 ${world.clock.month} 月 ${world.clock.day} 日`}>
        <p>推进一天：员工与艺人执行当天安排，账目入账本，新的汇报会送到手机。出现必须处理的事件时推进会被暂停。</p>
        <footer><PrimaryButton onClick={onAdvanceDay}>推进到下一天　›</PrimaryButton></footer>
      </SoftCard>
      <SoftCard title="想再走一遍？">
        <p>重玩序章可以尝试另一种对话与公关选择。</p>
        <footer><GhostButton onClick={onRestart}>重开序章 ↻</GhostButton></footer>
      </SoftCard>
    </>}
  </div>;
}

export function ArtistsPage({world}: {world: WorldState}) {
  const artists = Object.values(world.artists);
  if (artists.length === 0) {
    return <div className="page">
      <PageHeader title="艺人" subtitle="TALENT ROSTER"/>
      <EmptyState icon="♧" title="等待新成员" note="你的工作室尚未签约艺人。故事第一天，陆星遥会带着简历出现。"/>
    </div>;
  }
  return <div className="page">
    <PageHeader title="艺人" subtitle={`TALENT ROSTER · ${artists.length} 位签约`}/>
    {artists.map(a => <SoftCard key={a.id}
      tag={`${a.grade} 级 · ${TRACK_LABEL[a.track] ?? '多栖'}${a.id === 'lu' ? ' · 第一位签约艺人' : ''}`} title={a.name}>
      <div className="artist-row">
        <div className="artist-avatar portrait-placeholder" aria-label={a.name + '临时黑白人物剪影'}><CharacterPlaceholder characterId={a.id === 'lu' ? 'lu' : 'newface'}/></div>
        <div>
          <p>人气 {a.fans.toLocaleString()}</p>
          <StatusTag tone={a.availability === 'onGig' ? 'warn' : 'ok'}>{a.availability === 'onGig' ? '通告中' : '空档'}</StatusTag>
        </div>
      </div>
      <StatLine label="唱跳 / 表演" value={`${a.stats.performance} / 100`}/>
      <StatLine label="颜值" value={`${a.stats.appearance} / 100`}/>
      <StatLine label="路人缘" value={`${a.stats.appeal} / 100`}/>
      {a.history.length > 0 && <StatLine label="最近履历" value={a.history[a.history.length - 1].note}/>}
      {a.id === 'lu' && <p className="quote">「这一次，我也想陪你站到光里。」</p>}
    </SoftCard>)}
  </div>;
}

export function GigsPage({world}: {world: WorldState}) {
  const gig = Object.values(world.gigs)[0];
  const statusLabel = {available: '可接取', booked: '已接 · 待录制', shooting: '录制中', released: '已完成'} as Record<string, string>;
  return <div className="page">
    <PageHeader title="通告" subtitle="GIG MARKET"/>
    {gig && world.story.flags.summerGigAccepted
      ? <SoftCard tag={`${gig.platform ?? '青柠视频'} · 新人综艺`} title={gig.title}>
          <p>三日录制，新人生活观察类轻综艺。{gig.status === 'released' ? '录制完成，账目已入账本。' : '通告已经接受，等待后续安排。'}</p>
          <StatLine label="通告报酬" value={formatWan(gig.grossMinor)}/>
          <StatLine label="预计公司收入" value={formatWan(gig.companyNetMinor)}/>
          <StatLine label="状态" value={statusLabel[gig.status] ?? gig.status}/>
        </SoftCard>
      : <EmptyState icon="✦" title="市场暂时安静" note="正式的通告市场与竞标流程将在 M1 后续步骤接入。第一个机会会从剧情中到来。"/>}
  </div>;
}

export function ProfilePage({world, onRestart, onSave, onLoad, saveExists, saveInfo, saveNote}: {
  world: WorldState;
  onRestart: () => void;
  onSave: () => void;
  onLoad: () => void;
  saveExists: boolean;
  saveInfo: SaveMeta | null;
  saveNote: string;
}) {
  return <div className="page">
    <PageHeader title="个人档案" subtitle="FORMER SUPERSTAR"/>
    <SoftCard title="个人身份">
      <p>过去：顶流艺人<br/>现在：经纪公司创始人<br/>工作室：{world.company.name}</p>
      <footer><StatusTag tone="muted">复仇证据 · 0 / 3</StatusTag></footer>
    </SoftCard>
    <SoftCard title="存读档" tag=" Issue #5">
      {saveInfo
        ? <StatLine label={`槽位 ${saveInfo.slot} · ${saveInfo.dateLabel}`} value={formatWan(saveInfo.cashMinor)}/>
        : <p>槽位 0：{saveExists ? '有一个之前的存档' : '暂无存档'}</p>}
      <p>保存会记录日期、资金、任务、候选与剧情进度；读档后世界精确回到保存瞬间，不会重新抽取结果。</p>
      <footer>
        <PrimaryButton onClick={onSave}>保存到槽位 0</PrimaryButton>
        <GhostButton onClick={onLoad} >{saveExists || saveInfo ? '读取槽位 0' : '读取（暂无存档）'}</GhostButton>
      </footer>
      {saveNote && <p role="status">{saveNote}</p>}
    </SoftCard>
    <SoftCard title="本局账本" tag={`已记录 ${world.ledger.length} 笔`}>
      {world.ledger.length === 0
        ? <p>还没有入账记录。训练、公关与结算都会在这里留下明细。</p>
        : <div className="ledger-list">{world.ledger.slice(-8).map(e =>
            <StatLine key={e.id} label={`第${e.absoluteDay}日 · ${e.note}`} value={`${e.kind === 'expense' ? '−' : '+'}${formatWan(e.amountMinor)}`}/>)}</div>}
    </SoftCard>
    <SoftCard title="重新开始">
      <p>可以重玩第一周，尝试不同的对话与公关选择。当前进度会被新开局覆盖（记得先存档）。</p>
      <footer><GhostButton onClick={onRestart}>重开序章 ↻</GhostButton></footer>
    </SoftCard>
  </div>;
}

export function PhonePage({world, onClose}: {world: WorldState; onClose: () => void}) {
  const signed = world.story.flags.luSigned === true;
  const settled = world.story.flags.firstWeekSettled === true;
  const pr = world.story.flags.prChoice;
  const messages = Object.values(world.messages).sort((a, b) => b.absoluteDay - a.absoluteDay);
  return <div className="phone-sheet">
    <PageHeader title="手机" subtitle="MESSAGES & TRENDING"/>
    <button className="pale-btn sheet-close" onClick={onClose}>收起 ×</button>
    <div className="notifications">
      <div className="note"><b>知夏 · 置顶</b><br/>合同和通告都在资料夹里。别忘了按时吃饭。</div>
      <div className="note"><b>陆星遥</b><br/>{settled ? '节目播了！我妈妈把截图发到亲戚群里了！' : signed ? '我会加油的！今天还要练习吗？' : '听说你准备重新开公司了……可以聊聊吗？'}</div>
      <div className="note"><b>娱乐热搜 · 今日头条</b><br/>{pr ? '#过气艺人另起炉灶# · 舆情已更新' : '#春季选秀新面孔# · 热门话题'}</div>
      {messages.map(m => <div key={m.id} className="note"><b>{m.from} · 第{m.absoluteDay}日</b><br/><strong>{m.title}</strong><br/>{m.body}</div>)}
    </div>
    <SoftCard title="审批提醒">
      {(() => {
        const waiting = Object.values(world.candidatePool).filter(c => c.status === 'pending' || c.status === 'negotiating');
        if (waiting.length) return <p>{waiting.map(c => c.name).join('、')}的档案在工作台等你决定。{waiting.length} 份待审批。</p>;
        const active = Object.values(world.recruitment).filter(t => t.status === 'active');
        if (active.length) return <p>{active.map(t => t.title).join('、')}正在外勤，回报会送到这里。</p>;
        return <p>暂无待审批事项。寻访、合同与重大经营决策都会先送到这里提醒。</p>;
      })()}
      <footer><StatusTag tone={Object.values(world.candidatePool).some(c => c.status === 'pending' || c.status === 'negotiating') ? 'warn' : 'muted'}>
        {Object.values(world.candidatePool).some(c => c.status === 'pending' || c.status === 'negotiating') ? '有档案等你' : '暂无待办'}</StatusTag></footer>
    </SoftCard>
  </div>;
}

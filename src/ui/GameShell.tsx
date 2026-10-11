import type {ReactNode} from 'react';
import {TABS} from './navigation';
import type {TabId} from '../game/types';

/**
 * 游戏壳：竖屏主舞台。PC 居中呈现 412px 舞台并保留两侧开发文案栏；
 * 移动端全屏 + safe-area。Tab 与顶部条在全屏剧情层下隐藏。
 */
export function GameShell({resource, phoneUnread, onOpenPhone, onOpenProfile, activeTab, onSwitchTab, chromeHidden, overlay, children}: {
  resource: {dateLabel: string; money: string; reputation: number} | null;
  phoneUnread: number;
  onOpenPhone: () => void;
  onOpenProfile: () => void;
  activeTab: TabId;
  onSwitchTab: (tab: TabId) => void;
  /** 剧情全屏/结算模态时隐藏 Tab 栏与资源条 */
  chromeHidden: boolean;
  overlay?: ReactNode;
  children: ReactNode;
}) {
  return <div className="layout">
    <aside className="side">
      <div className="eyebrow">ENTERTAINMENT MANAGEMENT × VISUAL NOVEL</div>
      <h1>星途计划<span>✦</span></h1>
      <p>那些被夺走的星光，终有一天会再度亮起。</p>
      <div className="line"/>
      <p>Alpha M1 · 界面壳</p>
      <a href="/prototypes/galgame-v0.2.html" target="_blank" rel="noreferrer">查看完整 V0.2 视觉试玩 ↗</a>
    </aside>

    <main className="phone">
      <div className="status-strip"><span>✦ STARPATH</span><span>ALPHA M1</span></div>
      {!chromeHidden && <div className="chrome-top">
        <button className="profile-entry" onClick={onOpenProfile} aria-label="打开个人档案" title="老板个人档案">◉</button>
        {resource
          ? <div className="resources" role="status">
              <span>{resource.dateLabel}</span>
              <span>资金 <b>{resource.money}</b></span>
              <span>口碑 <b>{resource.reputation}</b></span>
            </div>
          : <div className="resources"><span>序章 · 重新启程</span></div>}
        <button className="phone-entry" onClick={onOpenPhone} aria-label="打开手机">
          ✉{phoneUnread > 0 && <i className="badge">{phoneUnread}</i>}
        </button>
      </div>}
      <div className="stage">{children}</div>
      {!chromeHidden && <nav className="bottom-nav" aria-label="主导航">
        {TABS.map(t => <button key={t.id} className={`navbtn${activeTab === t.id ? ' active' : ''}`}
          aria-current={activeTab === t.id ? 'page' : undefined}
          onClick={() => onSwitchTab(t.id)}>
          <span aria-hidden>{t.icon}</span>{t.label}
        </button>)}
      </nav>}
      {overlay}
    </main>

    <aside className="side right">
      <div className="eyebrow">DEVELOPMENT NOTE</div>
      <h2>一间小小的公司，<br/>一个不肯认输的你。</h2>
      <p>正式界面架构的第一块壳：导航、返回链与全屏剧情层在此联通。业务规则留在 engine 与数据层。</p>
      <div className="line"/>
      <p>当前里程碑：第一个游戏月的可玩经营循环。</p>
    </aside>
  </div>;
}

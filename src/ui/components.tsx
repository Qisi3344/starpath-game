import type {ReactNode} from 'react';

/* M1 最小组件集：语义 token 引用者，不写死颜色数值。 */

export function PageHeader({title, subtitle, onBack}: {
  title: string; subtitle?: string; onBack?: () => void;
}) {
  return <header className="page-header">
    {onBack
      ? <button className="back-btn" onClick={onBack} aria-label="返回">〈</button>
      : <span className="back-spacer"/>}
    <div className="page-header-text">
      <h2>{title}</h2>
      {subtitle && <small>{subtitle}</small>}
    </div>
  </header>;
}

export function SoftCard({tag, title, children, footer}: {
  tag?: string; title?: string; children?: ReactNode; footer?: ReactNode;
}) {
  return <section className="soft-card">
    {tag && <span className="pill">{tag}</span>}
    {title && <h3>{title}</h3>}
    {children}
    {footer}
  </section>;
}

export function StatusTag({tone, children}: {tone: 'ok' | 'warn' | 'danger' | 'muted'; children: ReactNode}) {
  return <span className={`status-tag status-${tone}`}>{children}</span>;
}

export function PrimaryButton({children, onClick, disabled}: {
  children: ReactNode; onClick?: () => void; disabled?: boolean;
}) {
  return <button className="btn-primary" onClick={onClick} disabled={disabled}>{children}</button>;
}

export function GhostButton({children, onClick}: {children: ReactNode; onClick?: () => void}) {
  return <button className="btn-ghost" onClick={onClick}>{children}</button>;
}

/** 空态/占位：明确说明能力边界，不用假内容冒充可点功能（蓝图第六节）。 */
export function EmptyState({icon, title, note}: {icon: string; title: string; note: string}) {
  return <div className="empty-state">
    <span className="empty-icon" aria-hidden>{icon}</span>
    <h3>{title}</h3>
    <p>{note}</p>
  </div>;
}

export function StatLine({label, value, strong}: {label: string; value: string; strong?: boolean}) {
  return <div className={`statline${strong ? ' total' : ''}`}><span>{label}</span><b>{value}</b></div>;
}

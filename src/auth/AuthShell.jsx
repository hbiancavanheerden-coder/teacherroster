import { Brand } from '../marketing/MarketingLayout.jsx';

export default function AuthShell({ title, subtitle, children, footer }) {
  return (
    <div className="auth-wrap">
      <div className="auth-card">
        <div className="center mb"><Brand /></div>
        <div className="card">
          <h3 style={{ fontSize: 24 }}>{title}</h3>
          {subtitle && <p className="muted small">{subtitle}</p>}
          {children}
        </div>
        {footer && <div className="center small mt">{footer}</div>}
      </div>
    </div>
  );
}

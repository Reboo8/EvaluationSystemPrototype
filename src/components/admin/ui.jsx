import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { X, Check, ShieldAlert, Lock } from 'lucide-react';
import { CLIENT_STATUS, WALLET_STATE, LEDGER_TYPE, TICKET_STATUS, MODULE_STATE, NOTIF_SEVERITY, useApp } from '../../store.jsx';

/* ═══════════ shared admin UI primitives (badges · toast · modal · reason gate · tabs) ═══════════ */

const Pill = ({ bg, fg, children, style }) => <span className="badge" style={{ background: bg, color: fg, ...style }}>{children}</span>;

export const ClientStatusBadge = ({ status }) => { const s = CLIENT_STATUS[status] || { label: status, bg: '#F3F4F6', fg: '#6B7280' }; return <Pill bg={s.bg} fg={s.fg}>{s.label}</Pill>; };
export const WalletStateBadge = ({ state }) => { const s = WALLET_STATE[state] || { label: state, bg: '#F3F4F6', fg: '#6B7280' }; return <Pill bg={s.bg} fg={s.fg}>{s.label}</Pill>; };
export const LedgerTypeBadge = ({ type }) => { const s = LEDGER_TYPE[type] || { label: type, bg: '#F3F4F6', fg: '#6B7280' }; return <Pill bg={s.bg} fg={s.fg}>{s.label}</Pill>; };
export const TicketStatusBadge = ({ status }) => { const s = TICKET_STATUS[status] || { label: status, bg: '#F3F4F6', fg: '#6B7280' }; return <Pill bg={s.bg} fg={s.fg}>{s.label}</Pill>; };
export const ModuleStateBadge = ({ state }) => { const s = MODULE_STATE[state] || { label: state, bg: '#F3F4F6', fg: '#6B7280' }; return <Pill bg={s.bg} fg={s.fg}>{s.label}</Pill>; };
export const SeverityBadge = ({ severity }) => { const s = NOTIF_SEVERITY[severity] || { label: severity, bg: '#F3F4F6', color: '#6B7280' }; return <Pill bg={s.bg} fg={s.color}>{s.label}</Pill>; };
export const PriorityBadge = ({ priority }) => { const m = { Urgent: ['#FEE2E2', '#B91C1C'], High: ['#FFEDD5', '#C2410C'], Medium: ['#EFF6FF', '#1E40AF'], Low: ['#F3F4F6', '#6B7280'] }; const [bg, fg] = m[priority] || m.Medium; return <Pill bg={bg} fg={fg}>{priority}</Pill>; };
export const PaymentStatusBadge = ({ status }) => { const m = { SUCCEEDED: ['#DCFCE7', '#15803D', 'Succeeded'], PENDING: ['#FEF3C7', '#B45309', 'Pending'], FAILED: ['#FEE2E2', '#B91C1C', 'Failed'], REVERSED: ['#F3F4F6', '#6B7280', 'Reversed'] }; const [bg, fg, l] = m[status] || ['#F3F4F6', '#6B7280', status]; return <Pill bg={bg} fg={fg}>{l}</Pill>; };
/* "default · pending" chip for values the spec has not finalised */
export const PendingChip = ({ children = 'default · pending' }) => <span style={{ display: 'inline-flex', alignItems: 'center', fontSize: 10, fontWeight: 700, letterSpacing: '.4px', textTransform: 'uppercase', color: '#9CA3AF', background: '#F3F4F6', border: '1px dashed #D1D5DB', borderRadius: 6, padding: '2px 7px', marginLeft: 6 }}>{children}</span>;
/* signed credits, coloured */
export const Credits = ({ n, bold = true }) => { const v = Number(n) || 0; return <span style={{ fontWeight: bold ? 700 : 500, color: v > 0 ? '#15803D' : v < 0 ? '#B91C1C' : '#6B7280', fontVariantNumeric: 'tabular-nums' }}>{v > 0 ? '+' : ''}{v.toLocaleString('en-IN')} cr</span>; };

/* ── toast (one per page) ── */
export function useToast() {
  const [toast, setToast] = useState(null);
  const show = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };
  const node = toast ? <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 90, display: 'flex', alignItems: 'center', gap: 9, background: '#14212A', color: '#fff', padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.18)', maxWidth: 460 }}><Check size={15} color="#34D399" /> {toast}</div> : null;
  return [show, node];
}

/* ── generic modal ── */
export function Modal({ title, onClose, children, width = 520, footer }) {
  useEffect(() => { const k = (e) => e.key === 'Escape' && onClose?.(); window.addEventListener('keydown', k); return () => window.removeEventListener('keydown', k); }, [onClose]);
  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(20,33,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 70, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width, maxWidth: '94vw', maxHeight: '90vh', display: 'flex', flexDirection: 'column' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '18px 22px', borderBottom: '1px solid #E2E8F0' }}>
          <h2 style={{ fontSize: 16.5, fontWeight: 700, margin: 0 }}>{title}</h2>
          <X size={18} color="#94A3B8" style={{ cursor: 'pointer' }} onClick={onClose} />
        </div>
        <div style={{ padding: 22, overflowY: 'auto' }}>{children}</div>
        {footer && <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, padding: '14px 22px', borderTop: '1px solid #E2E8F0' }}>{footer}</div>}
      </div>
    </div>
  );
}

/* ── reason gate for high-risk actions (spec §14): reason + audit; critical → re-auth step ──
   usage: const [ask, gateNode] = useReasonGate();  ask({ action:'client.suspend', title:'Suspend Flipkart', confirmLabel:'Suspend', danger:true }, (reason) => doIt(reason)) */
export function useReasonGate() {
  const { requiresReason, isCritical, can } = useApp();
  const [req, setReq] = useState(null);
  const [reason, setReason] = useState('');
  const [pw, setPw] = useState('');
  const ask = (opts, onConfirm) => {
    if (!can(opts.action)) return;
    if (!requiresReason(opts.action)) { onConfirm(''); return; }
    setReason(''); setPw(''); setReq({ ...opts, onConfirm });
  };
  const critical = req ? isCritical(req.action) : false;
  const ok = req && reason.trim().length >= 4 && (!critical || pw.length >= 4);
  const node = req ? (
    <Modal title={req.title || 'Confirm action'} onClose={() => setReq(null)} width={480}
      footer={<><button className="btn-ghost" onClick={() => setReq(null)}>Cancel</button><button className={req.danger ? 'btn-primary' : 'btn-success'} style={req.danger ? { background: '#DC2626' } : undefined} disabled={!ok} onClick={() => { const r = reason.trim(); const fn = req.onConfirm; setReq(null); fn(r); }}>{req.confirmLabel || 'Confirm'}</button></>}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', marginBottom: 14, fontSize: 12.5, color: '#92400E' }}>
        <ShieldAlert size={16} style={{ flexShrink: 0, marginTop: 1 }} />
        <div><b>High-risk action.</b> A reason is required and this will be written to the permanent audit log with your identity.{critical && <> <b>Critical:</b> re-authentication is required{' '}(second approval may apply).</>}</div>
      </div>
      {req.body && <div style={{ fontSize: 13, color: '#374151', marginBottom: 12 }}>{req.body}</div>}
      <label className="field-label">Reason <span className="req">*</span></label>
      <textarea className="input" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Why is this action being taken? (min 4 characters)" style={{ resize: 'vertical' }} />
      {critical && <><label className="field-label" style={{ marginTop: 12 }}><Lock size={12} style={{ verticalAlign: -2 }} /> Re-enter your password <span className="req">*</span></label><input className="input" type="password" value={pw} onChange={(e) => setPw(e.target.value)} placeholder="••••••••" /></>}
    </Modal>
  ) : null;
  return [ask, node];
}

/* ── permission-aware button: disabled + tooltip when the current admin role lacks the action ── */
export function PermButton({ action, className = 'btn-ghost', style, children, onClick, disabled, title }) {
  const { can } = useApp();
  const allowed = can(action);
  return <button className={className} style={style} disabled={disabled || !allowed} title={!allowed ? `Not permitted for your role (${action})` : title} onClick={allowed ? onClick : undefined}>{children}</button>;
}

/* ── URL-synced tabs (?tab=…) ── */
export function useTab(tabs, fallback) {
  const loc = useLocation(); const nav = useNavigate();
  const params = new URLSearchParams(loc.search);
  const cur = params.get('tab');
  const active = tabs.some((t) => t.key === cur) ? cur : (fallback || tabs[0].key);
  const setTab = (k) => { const p = new URLSearchParams(loc.search); p.set('tab', k); nav({ pathname: loc.pathname, search: '?' + p.toString() }, { replace: true }); };
  return [active, setTab, params];
}
export function Tabs({ tabs, active, onChange }) {
  return (
    <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid #E2E8F0', marginBottom: 18 }}>
      {tabs.map((t) => { const on = t.key === active; return (
        <button key={t.key} onClick={() => onChange(t.key)} style={{ background: 'none', border: 'none', borderBottom: on ? '2px solid #056FD4' : '2px solid transparent', padding: '10px 14px', fontSize: 13.5, fontWeight: on ? 700 : 500, color: on ? '#056FD4' : '#6B7280', cursor: 'pointer', marginBottom: -1, display: 'inline-flex', alignItems: 'center', gap: 7 }}>
          {t.label}{t.count != null && <span className="badge" style={{ background: on ? '#EFF6FF' : '#F3F4F6', color: on ? '#056FD4' : '#6B7280' }}>{t.count}</span>}
        </button>
      ); })}
    </div>
  );
}

/* ── small layout helpers ── */
export const PageHeader = ({ title, sub, right }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18, gap: 16 }}>
    <div><div style={{ fontSize: 20, fontWeight: 700 }}>{title}</div>{sub && <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>{sub}</div>}</div>
    {right && <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>{right}</div>}
  </div>
);
export const Kpi = ({ label, value, sub, color, bar, size = 26 }) => (
  <div className="kpi"><div className="eyebrow">{label}</div><div className="num" style={{ fontSize: size, color: color || '#14212A' }}>{value}</div>{sub && <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{sub}</div>}{bar && <div className="bar" style={{ background: bar }} />}</div>
);
export const EmptyRow = ({ cols, text = 'Nothing here.' }) => <tr><td colSpan={cols} style={{ textAlign: 'center', color: '#9CA3AF', padding: 26, fontSize: 13 }}>{text}</td></tr>;
export const Row = ({ k, v, last }) => <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '9px 0', borderBottom: last ? 'none' : '1px solid #F3F4F6', fontSize: 13 }}><span style={{ color: '#6B7280' }}>{k}</span><span style={{ fontWeight: 600, textAlign: 'right' }}>{v}</span></div>;
export const Toggle = ({ on, onClick, disabled }) => <span onClick={disabled ? undefined : onClick} style={{ display: 'inline-block', width: 34, height: 20, borderRadius: 9999, background: on ? '#16A34A' : '#CBD5E1', position: 'relative', cursor: disabled ? 'not-allowed' : 'pointer', opacity: disabled ? 0.5 : 1, transition: 'background .15s', flexShrink: 0 }}><span style={{ position: 'absolute', top: 2, left: on ? 16 : 2, width: 16, height: 16, borderRadius: '50%', background: '#fff', transition: 'left .15s' }} /></span>;
export const Mono = ({ children }) => <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, color: '#6B7280' }}>{children}</span>;

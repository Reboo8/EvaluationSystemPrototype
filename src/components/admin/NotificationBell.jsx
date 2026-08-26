import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Bell, Check, Inbox, Settings, ShieldCheck } from 'lucide-react';
import { useApp, roleName, NOTIF_SEVERITY } from '../../store.jsx';
import { SeverityBadge } from './ui.jsx';

/* ═══════════ Notification bell (spec §15) — event-driven · severity-based · role-routed · actionable ═══════════
   notificationsFor() already routes by role (Finance → billing, Support → support/ops, Compliance → compliance, Super → everything).
   Every item carries enough context to act (detail) and a deep link (to). */

const FILTERS = [
  { key: 'ALL',      label: 'All' },
  { key: 'CRITICAL', label: 'Critical' },
  { key: 'WARNING',  label: 'Warning' },
  { key: 'INFO',     label: 'Info' },
  { key: 'RESOLVED', label: 'Resolved' },
];

export default function NotificationBell() {
  const nav = useNavigate();
  const { notificationsFor, markNotificationRead, markAllNotificationsRead, currentAdmin, can } = useApp();
  const [open, setOpen] = useState(false);
  const [filter, setFilter] = useState('ALL');

  const all = notificationsFor();
  const unread = all.filter((n) => !n.read).length;
  const list = filter === 'ALL' ? all : all.filter((n) => n.severity === filter);
  const countOf = (k) => (k === 'ALL' ? all.length : all.filter((n) => n.severity === k).length);
  const filterLabel = (FILTERS.find((f) => f.key === filter) || {}).label || '';
  const openItem = (n) => { markNotificationRead(n.id); setOpen(false); nav(n.to); };

  return (
    <div style={{ position: 'relative' }}>
      <button className="bell" title={unread ? `${unread} unread notification${unread === 1 ? '' : 's'}` : 'Notifications'} onClick={() => setOpen((v) => !v)} style={{ borderColor: open ? '#056FD4' : undefined }}>
        <Bell size={18} color="#475569" />
        {unread > 0 && <span className="dot" />}
      </button>

      {open && (
        <>
          <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setOpen(false)} />
          <div className="card fade-in" style={{ position: 'absolute', top: 44, right: 0, width: 380, maxWidth: 'calc(100vw - 32px)', zIndex: 41, padding: 0, overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.14)' }}>
            {/* header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
              <div style={{ fontSize: 13.5, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8 }}>
                Notifications{unread > 0 && <span className="badge" style={{ background: '#FEE2E2', color: '#B91C1C' }}>{unread} unread</span>}
              </div>
              <button onClick={markAllNotificationsRead} disabled={unread === 0} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: 'none', border: 'none', color: unread ? '#056FD4' : '#9CA3AF', fontSize: 12, fontWeight: 600, cursor: unread ? 'pointer' : 'default', padding: 0 }}>
                <Check size={13} /> Mark all read
              </button>
            </div>

            {/* severity filters */}
            <div style={{ display: 'flex', gap: 5, padding: '10px 16px', borderBottom: '1px solid #F3F4F6', flexWrap: 'wrap' }}>
              {FILTERS.map((f) => <FilterChip key={f.key} on={filter === f.key} onClick={() => setFilter(f.key)} label={f.label} count={countOf(f.key)} sev={f.key} />)}
            </div>

            {/* list */}
            <div style={{ maxHeight: 420, overflowY: 'auto' }}>
              {list.length === 0 ? (
                <div style={{ padding: '34px 16px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>
                  <Inbox size={26} color="#CBD5E1" style={{ marginBottom: 8 }} />
                  <div>{all.length === 0 ? 'Nothing routed to your role yet — you’re all caught up.' : `No ${filter === 'ALL' ? '' : filterLabel.toLowerCase() + ' '}notifications.`}</div>
                </div>
              ) : list.map((n, i) => (
                <div key={n.id} onClick={() => openItem(n)} title={'Open: ' + n.to}
                  style={{ padding: '10px 14px 10px 13px', borderTop: i ? '1px solid #F3F4F6' : 'none', borderLeft: n.read ? '3px solid transparent' : '3px solid #056FD4', background: n.read ? '#fff' : '#F8FBFF', cursor: 'pointer' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <SeverityBadge severity={n.severity} />
                    <span style={{ fontSize: 11, color: '#9CA3AF', flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{n.category}</span>
                    <span style={{ fontSize: 11, color: '#9CA3AF', whiteSpace: 'nowrap' }}>{n.when}</span>
                  </div>
                  <div style={{ fontSize: 12.5, fontWeight: n.read ? 600 : 700, color: '#14212A' }}>{n.title}</div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2, lineHeight: 1.4 }}>{n.detail}</div>
                </div>
              ))}
            </div>

            {/* footer */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, padding: '9px 16px', borderTop: '1px solid #E2E8F0', background: '#FAFAFA', fontSize: 11.5, color: '#6B7280' }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5 }}><ShieldCheck size={13} color="#15803D" /> Routed to your role: <b style={{ color: '#374151' }}>{roleName(currentAdmin.role)}</b></span>
              {can('settings.manage') && (
                <span onClick={() => { setOpen(false); nav('/admin/settings?tab=notifications'); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, color: '#056FD4', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }}><Settings size={12} /> Routing</span>
              )}
            </div>
          </div>
        </>
      )}
    </div>
  );
}

/* ── local pieces ── */
function FilterChip({ on, onClick, label, count, sev }) {
  const c = NOTIF_SEVERITY[sev];
  return (
    <button onClick={onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, padding: '3px 8px', borderRadius: 9999, fontSize: 11.5, fontWeight: 600, border: `1px solid ${on ? '#056FD4' : '#E2E8F0'}`, background: on ? '#056FD4' : '#fff', color: on ? '#fff' : '#475569', cursor: 'pointer', fontFamily: 'inherit' }}>
      {c && <span style={{ width: 6, height: 6, borderRadius: '50%', background: on ? '#fff' : c.color }} />}
      {label}<span style={{ opacity: 0.7 }}>{count}</span>
    </button>
  );
}

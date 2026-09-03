import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, Briefcase, Wallet, User, HelpCircle, Bell, LogOut, Eye, X, ShieldAlert, Archive, Pause, LifeBuoy, ArrowRight, PanelLeftClose, PanelLeftOpen } from 'lucide-react';
import { useApp, fmtCr, initials, JOB_KINDS } from './store.jsx';
import { ClientStatusBadge, WalletStateBadge } from './components/admin/ui.jsx';

/* ═══════════ Client portal shell — Cuba (by Reboo8) · spec §03 status vs §06 wallet state shown separately ═══════════ */

/* wallet chip palette (WALLET_STATE colours + border) */
const CHIP = {
  HEALTHY:               { bg: '#DCFCE7', fg: '#15803D', bd: '#BBF7D0' },
  LOW_BALANCE:           { bg: '#FEF3C7', fg: '#B45309', bd: '#FDE68A' },
  ZERO:                  { bg: '#F3F4F6', fg: '#6B7280', bd: '#E5E7EB' },
  OVERDRAFT:             { bg: '#FEE2E2', fg: '#B91C1C', bd: '#FECACA' },
  BLOCKED_FOR_NEW_USAGE: { bg: '#14212A', fg: '#FFFFFF', bd: '#14212A' },
};
const num = (n) => (Number(n) || 0).toLocaleString('en-IN');

function Item({ to, icon: Icon, label, badge }) {
  return (
    <NavLink to={to} end title={label} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
      <Icon size={18} style={{ flexShrink: 0 }} />
      <span className="nav-label" style={{ flex: 1 }}>{label}</span>
      {badge ? <span className="count-badge">{badge}</span> : null}
    </NavLink>
  );
}
const SB_KEY = 'cuba_sidebar_collapsed';

/* wallet-driven notification (spec §06: dashboard warning + in-app notification) */
function walletNotif(w) {
  switch (w.state) {
    case 'LOW_BALANCE': return { t: `Low balance — ${fmtCr(w.available)} available`, s: `Below threshold ${fmtCr(w.lowBalanceThreshold)} · top up to keep evaluations flowing`, c: '#D97706', to: '/billing' };
    case 'ZERO': return { t: 'Zero balance — new paid evaluations start after a top-up', s: 'You stay active; running evaluations are unaffected', c: '#6B7280', to: '/billing' };
    case 'OVERDRAFT': return { t: `Outstanding −${num(w.outstanding)} cr`, s: 'New paid evaluations paused; running ones will finish · top-up clears the debt first', c: '#DC2626', to: '/billing' };
    case 'BLOCKED_FOR_NEW_USAGE': return { t: 'Wallet frozen by Cuba Admin', s: 'New paid usage is blocked · contact support', c: '#14212A', to: '/support' };
    default: return null;
  }
}

export default function Shell() {
  const nav = useNavigate();
  const { clientOpportunities: opportunities, impersonating, setImpersonating, currentClient, clientWallet, clientTickets, failedJobs, currentClientId, getPool } = useApp();
  const openCount = opportunities.filter((o) => o.status === 'OPEN').length;
  const [bellOpen, setBellOpen] = useState(false);
  /* collapsible sidebar — remembered per browser */
  const [collapsed, setCollapsed] = useState(() => { try { return localStorage.getItem(SB_KEY) === '1'; } catch { return false; } });
  const toggleSidebar = () => setCollapsed((v) => { const n = !v; try { localStorage.setItem(SB_KEY, n ? '1' : '0'); } catch { /* ignore */ } return n; });

  const c = currentClient || {};
  const w = clientWallet || { state: 'ZERO', available: 0, outstanding: 0 };
  const co = c.name || 'Client';
  const coIni = initials(co);
  const owner = c.owner?.name || co;
  const firstName = owner.split(' ')[0];
  const status = c.status || 'ACTIVE';
  const exitImpersonation = () => { const id = impersonating?.id; setImpersonating(null); nav(id ? '/admin/clients/' + id : '/admin/clients'); };

  /* notifications are derived from THIS workspace only — wallet, tickets, failed evaluations, pipeline */
  const waiting = (clientTickets || []).filter((t) => t.status === 'WAITING_ON_CLIENT');
  const myJobs = (failedJobs || []).filter((j) => j.clientId === currentClientId && j.status === 'OPEN');
  const oppExists = (id) => opportunities.some((o) => o.id === id);
  /* alerts = things needing action (wallet, pause, support, stuck evaluations) — they redden the bell */
  const alerts = [
    walletNotif(w),
    c.paused ? { t: 'Usage temporarily paused by Cuba Admin', s: 'New paid evaluations will not start until resumed', c: '#056FD4', to: '/support' } : null,
    ...waiting.map((t) => ({ t: `Support is waiting on you — ${t.id}`, s: `${t.subject} · ${t.updated || t.createdAt}`, c: '#6D28D9', to: '/support' })),
    ...myJobs.map((j) => ({
      t: `${JOB_KINDS[j.kind]?.label || j.kind} — ${j.candidate}`,
      s: `${j.oppTitle} · not a candidate failure${j.creditsHeld ? ` · ${fmtCr(j.creditsHeld)} held` : ''}`,
      c: '#D97706', to: oppExists(j.oppId) ? `/opportunities/${j.oppId}` : '/support',
    })),
  ].filter(Boolean);

  /* the rest is pipeline news for this workspace */
  const notifs = [
    ...alerts,
    ...opportunities.filter((o) => (o.cleared || 0) > 0).slice(0, 3).map((o) => ({
      t: `${o.cleared} candidate${o.cleared === 1 ? '' : 's'} cleared all stages`,
      s: `${o.title} · ranked by your weights`, c: '#16A34A', to: `/opportunities/${o.id}/rank`,
    })),
    ...opportunities.map((o) => { const soft = getPool(o.id).filter((x) => !x.pass && !x.rescued).length; return soft ? { t: `${soft} soft-rejected in the resume gate`, s: `${o.title} · review and rescue if the gate got it wrong`, c: '#056FD4', to: `/opportunities/${o.id}/pool` } : null; }),
  ].filter(Boolean);

  /* wallet chip */
  const chip = CHIP[w.state] || CHIP.ZERO;
  const chipLabel = w.state === 'OVERDRAFT' ? `−${num(w.outstanding)} cr outstanding`
    : w.state === 'BLOCKED_FOR_NEW_USAGE' ? `Wallet frozen · ${fmtCr(w.available)}`
    : w.state === 'LOW_BALANCE' ? `${fmtCr(w.available)} available · low`
    : `${fmtCr(w.available)} available`;

  return (
    <div className={collapsed ? 'sb-collapsed' : ''}>
      <aside className="sidebar">
        <div style={{ position: 'absolute', top: -40, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ position: 'relative', padding: '0 8px' }} className="sb-brand">
          <div className="sb-logo">{collapsed ? 'C' : 'Cuba'}</div>
          <div className="sb-sub">Client portal · by Reboo8</div>
        </div>
        <div className="sb-divider" />
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
          <Item to="/" icon={Home} label="Home" />
          <Item to="/opportunities" icon={Briefcase} label="Opportunities" badge={openCount || null} />
          <Item to="/billing" icon={Wallet} label="Credits & Wallet" />
        </nav>
        <div className="section-label">Account</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
          <Item to="/profile" icon={User} label="Profile" />
          <Item to="/support" icon={HelpCircle} label="Support" />
        </nav>
        <div style={{ marginTop: 'auto', position: 'relative' }}>
          <div className="sb-divider" />
          <div className="sb-footer" style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px' }} title={collapsed ? `${co} · Client Owner` : undefined}>
            <div className="avatar" style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 13, flexShrink: 0 }}>{coIni}</div>
            <div className="nav-label" style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 600, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{co}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5 }}>Client Owner</div>
            </div>
            <LogOut className="nav-label" size={18} color="rgba(255,255,255,0.7)" style={{ cursor: 'pointer' }} onClick={() => nav('/login')} />
          </div>
        </div>
      </aside>

      <div className="main">
        {impersonating && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#14212A', color: '#fff', padding: '8px 16px', fontSize: 12.5, fontWeight: 600 }}>
            <Eye size={14} /> Viewing <b>{co}</b>’s workspace as Cuba Admin
            <button onClick={exitImpersonation} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}><X size={12} /> Exit impersonation</button>
          </div>
        )}
        <header className="topbar">
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            <button className="sb-toggle" onClick={toggleSidebar} title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'} aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}>{collapsed ? <PanelLeftOpen size={18} /> : <PanelLeftClose size={18} />}</button>
            <div style={{ fontSize: 15, fontWeight: 600, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Good morning, {firstName} 👋</div>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {/* wallet chip → Credits & Wallet */}
            <button onClick={() => nav('/billing')} title={`Wallet: ${w.state.replace(/_/g, ' ').toLowerCase()} · balance ${fmtCr(w.balance)} · reserved ${fmtCr(w.reserved)}`}
              style={{ display: 'inline-flex', alignItems: 'center', gap: 7, background: chip.bg, color: chip.fg, border: `1px solid ${chip.bd}`, borderRadius: 9999, padding: '6px 13px 6px 10px', fontSize: 12.5, fontWeight: 700, cursor: 'pointer', fontVariantNumeric: 'tabular-nums', whiteSpace: 'nowrap' }}>
              <Wallet size={14} /> {chipLabel}
            </button>
            <div style={{ position: 'relative' }}>
              <button className="bell" onClick={() => setBellOpen((v) => !v)}><Bell size={18} color="#475569" />{notifs.length > 0 && <span className="dot" style={alerts.length ? { background: '#DC2626' } : undefined} />}</button>
              {bellOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setBellOpen(false)} />
                  <div className="card fade-in" style={{ position: 'absolute', top: 42, right: 0, width: 340, zIndex: 41, padding: 0, overflow: 'hidden' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 16px', borderBottom: '1px solid #E2E8F0', fontSize: 13.5, fontWeight: 700 }}>
                      Notifications <span className="badge" style={{ background: '#F3F4F6', color: '#6B7280' }}>{notifs.length}</span>
                    </div>
                    <div style={{ maxHeight: 360, overflowY: 'auto' }}>
                      {notifs.length === 0 && <div style={{ padding: 22, textAlign: 'center', color: '#9CA3AF', fontSize: 12.5 }}>You’re all caught up.</div>}
                      {notifs.map((n, i) => (
                        <div key={i} onClick={() => { setBellOpen(false); if (n.to) nav(n.to); }} style={{ display: 'flex', gap: 10, padding: '11px 16px', borderBottom: i < notifs.length - 1 ? '1px solid #F3F4F6' : 'none', cursor: n.to ? 'pointer' : 'default', background: i < alerts.length ? '#FAFCFF' : '#fff' }}>
                          <span style={{ width: 7, height: 7, borderRadius: '50%', background: n.c, marginTop: 5, flexShrink: 0 }} />
                          <div style={{ minWidth: 0 }}><div style={{ fontSize: 12.5, fontWeight: 600, color: '#14212A' }}>{n.t}</div><div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 1 }}>{n.s}</div></div>
                        </div>
                      ))}
                    </div>
                    <div style={{ display: 'flex', borderTop: '1px solid #E2E8F0' }}>
                      <div style={{ flex: 1, padding: '10px 16px', textAlign: 'center', fontSize: 12.5, color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => { setBellOpen(false); nav('/opportunities'); }}>All opportunities →</div>
                      <div style={{ flex: 1, padding: '10px 16px', textAlign: 'center', fontSize: 12.5, color: '#056FD4', fontWeight: 600, cursor: 'pointer', borderLeft: '1px solid #E2E8F0' }} onClick={() => { setBellOpen(false); nav('/billing'); }}>Credits & Wallet →</div>
                    </div>
                  </div>
                </>
              )}
            </div>
            <div className="user-pill" title={`${owner} · ${co}`}>
              <div className="avatar" style={{ width: 28, height: 28, background: '#E0EDFF', color: '#056FD4', fontSize: 11 }}>{initials(owner)}</div>
              <span style={{ fontSize: 13, color: '#475569', fontWeight: 500, whiteSpace: 'nowrap' }}>{owner} <span style={{ color: '#9CA3AF' }}>· {co}</span></span>
            </div>
          </div>
        </header>

        {/* account-status strips (spec §03) — account status and wallet state stay separate badges */}
        {status === 'SUSPENDED' && (
          <Strip tone="dark" icon={ShieldAlert} iconColor="#FCA5A5" status={status} wallet={w.state}
            text={<><b>Workspace suspended — read-only.</b> Reason: {c.statusReason || 'not specified'}. Contact Cuba support.</>}
            action={{ label: 'Contact support', to: '/support', icon: LifeBuoy }} nav={nav} />
        )}
        {status === 'OFFBOARDING' && (
          <Strip tone="dark" icon={Archive} iconColor="#FDBA74" status={status} wallet={w.state}
            text={<><b>Offboarding in progress</b> — new work is stopped; running evaluations will finish.{c.offboarding?.startedAt ? ` Started ${c.offboarding.startedAt}.` : ''}</>}
            action={{ label: 'Support', to: '/support', icon: LifeBuoy }} nav={nav} />
        )}
        {c.paused && status !== 'SUSPENDED' && status !== 'OFFBOARDING' && (
          <Strip tone="info" icon={Pause} iconColor="#1E40AF" status={status} wallet={w.state}
            text={<><b>Usage temporarily paused by Cuba Admin.</b> New paid evaluations will not start; running ones are never interrupted.</>}
            action={{ label: 'Support', to: '/support', icon: ArrowRight }} nav={nav} />
        )}
        <main className="content"><Outlet /></main>
      </div>
    </div>
  );
}

/* ── full-width status strip under the topbar ── */
function Strip({ tone, icon: Icon, iconColor, text, status, wallet, action, nav }) {
  const dark = tone === 'dark';
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap', padding: '10px 28px', fontSize: 13, background: dark ? '#14212A' : '#EFF6FF', color: dark ? '#fff' : '#1E40AF', borderBottom: dark ? 'none' : '1px solid #BFDBFE' }}>
      <Icon size={16} color={iconColor} style={{ flexShrink: 0 }} />
      <div style={{ flex: 1, minWidth: 200 }}>{text}</div>
      <span style={{ display: 'inline-flex', gap: 6, alignItems: 'center' }}><ClientStatusBadge status={status} /><WalletStateBadge state={wallet} /></span>
      {action && (
        <button onClick={() => nav(action.to)} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, background: dark ? 'rgba(255,255,255,0.15)' : '#fff', color: dark ? '#fff' : '#1E40AF', border: dark ? 'none' : '1px solid #BFDBFE', borderRadius: 6, padding: '4px 10px', fontSize: 12, fontWeight: 600, cursor: 'pointer' }}>
          {action.icon && <action.icon size={12} />} {action.label}
        </button>
      )}
    </div>
  );
}

import { useState, useEffect } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, Wallet, Activity, LifeBuoy, Boxes, Shield, BarChart3, Settings, ArrowLeft, Search, HelpCircle, ChevronDown, User, Eye, LogOut } from 'lucide-react';
import { useApp, ADMIN_ROLES, roleName, initials } from './store.jsx';
import { useToast } from './components/admin/ui.jsx';
import CommandPalette from './components/admin/CommandPalette.jsx';
import NotificationBell from './components/admin/NotificationBell.jsx';

/* ═══════════ Cuba Admin shell — dark sidebar (IA spec §19) + global header (spec §18: search/command · bell · help · avatar) ═══════════
   Nav items the current role cannot view are hidden (page-level); actions inside pages are gated action-level (spec §14).
   Pages still render when deep-linked — they self-gate with PermButton / can(). */

const NAV = [
  { to: '/admin',            icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/clients',    icon: Building2,       label: 'Clients' },
  { to: '/admin/credits',    icon: Wallet,          label: 'Credits & Billing', perm: ['ledger.view'] },
  { to: '/admin/usage',      icon: Activity,        label: 'Usage',             perm: ['usage.view'] },
  { to: '/admin/support',    icon: LifeBuoy,        label: 'Support & Ops',     perm: ['ticket.view'], badge: 'support' },
  { to: '/admin/platform',   icon: Boxes,           label: 'Platform',          perm: ['module.manage', 'integration.manage'] },
  { to: '/admin/compliance', icon: Shield,          label: 'Compliance',        perm: ['compliance.view'], badge: 'compliance' },
  { to: '/admin/analytics',  icon: BarChart3,       label: 'Analytics',         perm: ['analytics.view'] },
  { to: '/admin/settings',   icon: Settings,        label: 'Settings',          perm: ['settings.manage'] },
];

export default function AdminShell() {
  const nav = useNavigate();
  const { can, aggregates, currentAdmin, setCurrentRole, adminUsers } = useApp();
  const [palette, setPalette] = useState(false);
  const [menu, setMenu] = useState(false);
  const [toast, toastNode] = useToast();

  /* ⌘K / Ctrl+K toggles the command palette anywhere in the admin; Escape closes overlays */
  useEffect(() => {
    const k = (e) => {
      if ((e.metaKey || e.ctrlKey) && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); setMenu(false); setPalette((v) => !v); }
      else if (e.key === 'Escape') { setPalette(false); setMenu(false); }
    };
    window.addEventListener('keydown', k);
    return () => window.removeEventListener('keydown', k);
  }, []);

  const badges = { support: aggregates.openJobs.length + aggregates.openTickets.length, compliance: aggregates.pendingRequests.length };
  const visible = NAV.filter((n) => !n.perm || n.perm.some((p) => can(p)));
  const me = adminUsers.find((u) => u.id === currentAdmin.id);
  const readOnly = currentAdmin.role === 'analyst';

  const switchRole = (r) => { setCurrentRole(r.id); setMenu(false); toast(`Switched to ${r.name} — controls now reflect that role`); };

  return (
    <>
      {/* ── sidebar ── */}
      <aside className="sidebar" style={{ background: '#14212A' }}>
        <div style={{ position: 'relative', padding: '0 8px' }}>
          <div className="sb-logo" style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            Cuba <span style={{ fontSize: 10, fontWeight: 700, background: 'rgba(255,255,255,0.16)', padding: '2px 7px', borderRadius: 6, letterSpacing: '.6px' }}>ADMIN</span>
          </div>
          <div className="sb-sub">Control plane · by Reboo8</div>
        </div>
        <div className="sb-divider" />
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          {visible.map((n) => <Item key={n.to} to={n.to} icon={n.icon} label={n.label} end={n.end} badge={n.badge ? badges[n.badge] : 0} />)}
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <div className="sb-divider" />
          <div style={{ padding: '0 12px 8px', fontSize: 11, color: 'rgba(255,255,255,0.45)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Signed in as {currentAdmin.name} · {roleName(currentAdmin.role)}</div>
          <div className="nav-item" onClick={() => nav('/')} style={{ cursor: 'pointer' }}><ArrowLeft size={18} /> Exit admin</div>
        </div>
      </aside>

      {/* ── main ── */}
      <div className="main">
        <header className="topbar" style={{ gap: 16 }}>
          {/* global search / command (spec §16) */}
          <button onClick={() => { setMenu(false); setPalette(true); }} title="Global search / command palette — ⌘K or Ctrl+K"
            style={{ flex: 1, maxWidth: 560, minWidth: 0, display: 'flex', alignItems: 'center', gap: 9, height: 36, padding: '0 8px 0 12px', border: '1px solid #E2E8F0', borderRadius: 9, background: '#F8FAFC', color: '#9CA3AF', fontSize: 13, cursor: 'text', textAlign: 'left', fontFamily: 'inherit' }}>
            <Search size={15} color="#6B7280" style={{ flexShrink: 0 }} />
            <span style={{ flex: 1, minWidth: 0, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>Search clients, candidates, tickets, transactions…</span>
            <span className="kbd">⌘K</span>
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexShrink: 0 }}>
            <NotificationBell />
            <button className="bell" title="Help / Support" onClick={() => nav('/admin/support')}><HelpCircle size={18} color="#475569" /></button>

            {/* avatar + role switcher (D4) */}
            <div style={{ position: 'relative' }}>
              <div className="user-pill" onClick={() => setMenu((v) => !v)} style={{ cursor: 'pointer', borderColor: menu ? '#056FD4' : undefined }}>
                <div className="avatar" style={{ width: 28, height: 28, background: '#14212A', color: '#fff', fontSize: 11 }}>{initials(currentAdmin.name)}</div>
                <div style={{ lineHeight: 1.15 }}>
                  <div style={{ fontSize: 12.5, color: '#14212A', fontWeight: 600 }}>{currentAdmin.name}</div>
                  <div style={{ fontSize: 11, color: '#6B7280' }}>{roleName(currentAdmin.role)}</div>
                </div>
                <ChevronDown size={14} color="#94A3B8" />
              </div>

              {menu && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setMenu(false)} />
                  <div className="card fade-in" style={{ position: 'absolute', top: 44, right: 0, width: 330, zIndex: 41, padding: 0, overflow: 'hidden', boxShadow: '0 12px 32px rgba(0,0,0,0.14)' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '12px 16px', borderBottom: '1px solid #E2E8F0' }}>
                      <div className="avatar" style={{ width: 34, height: 34, background: '#14212A', color: '#fff', fontSize: 12 }}>{initials(currentAdmin.name)}</div>
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 13.5, fontWeight: 700 }}>{currentAdmin.name}</div>
                        <div style={{ fontSize: 11.5, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{me?.email || 'admin@cuba.reboo8.com'} · {roleName(currentAdmin.role)}</div>
                      </div>
                    </div>

                    <div style={{ padding: '10px 16px 2px', fontSize: 11, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#6B7280' }}>
                      Switch role <span style={{ fontWeight: 500, textTransform: 'none', letterSpacing: 0, color: '#9CA3AF' }}>(permissions are checked per action)</span>
                    </div>
                    {ADMIN_ROLES.map((r) => { const on = r.id === currentAdmin.role; return (
                      <div key={r.id} onClick={() => switchRole(r)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '7px 16px', cursor: 'pointer', background: on ? '#F8FBFF' : '#fff' }}>
                        <span style={{ width: 14, height: 14, borderRadius: '50%', border: `1.5px solid ${on ? '#056FD4' : '#CBD5E1'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
                          {on && <span style={{ width: 7, height: 7, borderRadius: '50%', background: '#056FD4' }} />}
                        </span>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 12.5, fontWeight: on ? 700 : 600, color: on ? '#056FD4' : '#14212A' }}>{r.name}</div>
                          <div style={{ fontSize: 11, color: '#9CA3AF' }}>{r.desc}</div>
                        </div>
                      </div>
                    ); })}

                    <div style={{ height: 1, background: '#E2E8F0', margin: '6px 0' }} />
                    <MenuRow icon={User} label="Profile (personal settings)" sub="Profile = personal · Settings = platform" onClick={() => { setMenu(false); toast('Personal settings are coming soon'); }} />
                    {can('settings.manage') && <MenuRow icon={Settings} label="Platform settings" sub="Cuba platform configuration" onClick={() => { setMenu(false); nav('/admin/settings'); }} />}
                    <div style={{ height: 1, background: '#E2E8F0', margin: '6px 0' }} />
                    <MenuRow icon={LogOut} label="Exit admin" sub="Back to the client portal" danger onClick={() => { setMenu(false); nav('/'); }} />
                    <div style={{ height: 6 }} />
                  </div>
                </>
              )}
            </div>
          </div>
        </header>

        {readOnly && (
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 28px', background: '#FFFBEB', borderBottom: '1px solid #FDE68A', color: '#92400E', fontSize: 12.5, fontWeight: 600 }}>
            <Eye size={14} /> Read-only role — actions are disabled
            <span style={{ fontWeight: 500, color: '#B45309' }}>· switch role from the avatar menu to demo write actions</span>
          </div>
        )}

        <main className="content"><Outlet /></main>
      </div>

      <CommandPalette open={palette} onClose={() => setPalette(false)} />
      {toastNode}
    </>
  );
}

/* ── local pieces ── */
function Item({ to, icon: Icon, label, end, badge }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
      {({ isActive }) => (
        <>
          <Icon size={18} /><span style={{ flex: 1 }}>{label}</span>
          {badge > 0 && (
            <span title="Needs attention" style={{ minWidth: 20, height: 20, padding: '0 6px', borderRadius: 9999, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11, fontWeight: 700, background: isActive ? '#FEE2E2' : 'rgba(255,255,255,0.16)', color: isActive ? '#B91C1C' : '#fff' }}>{badge}</span>
          )}
        </>
      )}
    </NavLink>
  );
}

function MenuRow({ icon: Icon, label, sub, onClick, danger }) {
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 16px', cursor: 'pointer' }}>
      <Icon size={15} color={danger ? '#B91C1C' : '#6B7280'} />
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 12.5, fontWeight: 600, color: danger ? '#B91C1C' : '#14212A' }}>{label}</div>
        {sub && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{sub}</div>}
      </div>
    </div>
  );
}

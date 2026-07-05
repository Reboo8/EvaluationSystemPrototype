import { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { Home, Briefcase, CreditCard, User, HelpCircle, Bell, LogOut, Eye, X } from 'lucide-react';
import { useApp } from './store.jsx';

const NOTIFS = [
  { t: 'Arjun Mehta cleared all stages', s: 'Software Developer · 2h ago', c: '#16A34A' },
  { t: '40 new applicants in resume gate', s: 'Customer Support (Tech) · 5h ago', c: '#056FD4' },
  { t: 'Weights changed — re-ranking done', s: 'General Physician · 1d ago', c: '#6D28D9' },
];

function Item({ to, icon: Icon, label, badge }) {
  return (
    <NavLink to={to} end className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
      <Icon size={18} />
      <span style={{ flex: 1 }}>{label}</span>
      {badge ? <span className="count-badge">{badge}</span> : null}
    </NavLink>
  );
}

export default function Shell() {
  const nav = useNavigate();
  const { opportunities, impersonating, setImpersonating } = useApp();
  const openCount = opportunities.filter((o) => o.status === 'OPEN').length;
  const [bellOpen, setBellOpen] = useState(false);
  const co = impersonating?.name || 'Flipkart';
  const coIni = co.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
  const exitImpersonation = () => { const id = impersonating?.id; setImpersonating(null); nav(id ? '/admin/clients/' + id : '/admin/clients'); };

  return (
    <>
      <aside className="sidebar">
        <div style={{ position: 'absolute', top: -40, right: -30, width: 120, height: 120, borderRadius: '50%', background: 'rgba(255,255,255,0.07)' }} />
        <div style={{ position: 'relative', padding: '0 8px' }}>
          <div className="sb-logo">Reboo8</div>
          <div className="sb-sub">Client Dashboard</div>
        </div>
        <div className="sb-divider" />
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
          <Item to="/" icon={Home} label="Home" />
          <Item to="/opportunities" icon={Briefcase} label="Opportunities" badge={openCount || null} />
          <Item to="/billing" icon={CreditCard} label="Billing" />
        </nav>
        <div className="section-label">Account</div>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4, position: 'relative' }}>
          <Item to="/profile" icon={User} label="Profile" />
          <Item to="/support" icon={HelpCircle} label="Support" />
        </nav>
        <div style={{ marginTop: 'auto', position: 'relative' }}>
          <div className="sb-divider" />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '0 8px' }}>
            <div className="avatar" style={{ width: 38, height: 38, background: 'rgba(255,255,255,0.2)', color: '#fff', fontSize: 13 }}>{coIni}</div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ color: '#fff', fontSize: 13.5, fontWeight: 600 }}>{co}</div>
              <div style={{ color: 'rgba(255,255,255,0.6)', fontSize: 11.5 }}>Client Admin</div>
            </div>
            <LogOut size={18} color="rgba(255,255,255,0.7)" style={{ cursor: 'pointer' }} onClick={() => nav('/login')} />
          </div>
        </div>
      </aside>

      <div className="main">
        {impersonating && (
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 10, background: '#14212A', color: '#fff', padding: '8px 16px', fontSize: 12.5, fontWeight: 600 }}>
            <Eye size={14} /> Viewing <b>{co}</b>’s workspace as operator
            <button onClick={exitImpersonation} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, background: 'rgba(255,255,255,0.15)', color: '#fff', border: 'none', borderRadius: 6, padding: '3px 9px', fontSize: 11.5, fontWeight: 600, cursor: 'pointer' }}><X size={12} /> Exit impersonation</button>
          </div>
        )}
        <header className="topbar">
          <div style={{ fontSize: 15, fontWeight: 600 }}>Good morning, {co} 👋</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
            <div style={{ position: 'relative' }}>
              <button className="bell" onClick={() => setBellOpen((v) => !v)}><Bell size={18} color="#475569" /><span className="dot" /></button>
              {bellOpen && (
                <>
                  <div style={{ position: 'fixed', inset: 0, zIndex: 40 }} onClick={() => setBellOpen(false)} />
                  <div className="card" style={{ position: 'absolute', top: 42, right: 0, width: 320, zIndex: 41, padding: 0, overflow: 'hidden' }}>
                    <div style={{ padding: '12px 16px', borderBottom: '1px solid #E2E8F0', fontSize: 13.5, fontWeight: 700 }}>Notifications</div>
                    {NOTIFS.map((n, i) => (
                      <div key={i} style={{ display: 'flex', gap: 10, padding: '11px 16px', borderBottom: i < NOTIFS.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                        <span style={{ width: 7, height: 7, borderRadius: '50%', background: n.c, marginTop: 5, flexShrink: 0 }} />
                        <div><div style={{ fontSize: 12.5, fontWeight: 600, color: '#14212A' }}>{n.t}</div><div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 1 }}>{n.s}</div></div>
                      </div>
                    ))}
                    <div style={{ padding: '10px 16px', textAlign: 'center', fontSize: 12.5, color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => { setBellOpen(false); nav('/opportunities'); }}>View all opportunities →</div>
                  </div>
                </>
              )}
            </div>
            <div className="user-pill">
              <div className="avatar" style={{ width: 28, height: 28, background: '#E0EDFF', color: '#056FD4', fontSize: 11 }}>{coIni}</div>
              <span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>{co}</span>
            </div>
          </div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </>
  );
}

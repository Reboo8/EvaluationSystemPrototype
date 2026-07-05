import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { LayoutDashboard, Building2, Package, CreditCard, Boxes, LifeBuoy, Shield, ArrowLeft } from 'lucide-react';

function Item({ to, icon: Icon, label, end }) {
  return (
    <NavLink to={to} end={end} className={({ isActive }) => 'nav-item' + (isActive ? ' active' : '')}>
      <Icon size={18} /> <span style={{ flex: 1 }}>{label}</span>
    </NavLink>
  );
}

export default function AdminShell() {
  const nav = useNavigate();
  return (
    <>
      <aside className="sidebar" style={{ background: '#14212A' }}>
        <div style={{ position: 'relative', padding: '0 8px' }}>
          <div className="sb-logo">Reboo8 <span style={{ fontSize: 10, background: 'rgba(255,255,255,0.16)', padding: '2px 7px', borderRadius: 6, verticalAlign: 'middle', letterSpacing: '.5px' }}>ADMIN</span></div>
          <div className="sb-sub">Control plane</div>
        </div>
        <div className="sb-divider" />
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
          <Item to="/admin" icon={LayoutDashboard} label="Overview" end />
          <Item to="/admin/clients" icon={Building2} label="Clients" />
          <Item to="/admin/plans" icon={Package} label="Plans" />
          <Item to="/admin/billing" icon={CreditCard} label="Billing" />
          <Item to="/admin/catalog" icon={Boxes} label="Module Catalog" />
          <Item to="/admin/support" icon={LifeBuoy} label="Support Desk" />
          <Item to="/admin/compliance" icon={Shield} label="Compliance" />
        </nav>
        <div style={{ marginTop: 'auto' }}>
          <div className="sb-divider" />
          <div className="nav-item" onClick={() => nav('/')} style={{ cursor: 'pointer' }}><ArrowLeft size={18} /> Exit admin</div>
        </div>
      </aside>
      <div className="main">
        <header className="topbar">
          <div style={{ fontSize: 15, fontWeight: 600 }}>Reboo8 Operator</div>
          <div className="user-pill"><div className="avatar" style={{ width: 28, height: 28, background: '#334155', color: '#fff', fontSize: 11 }}>OP</div><span style={{ fontSize: 13, color: '#475569', fontWeight: 500 }}>Operator</span></div>
        </header>
        <main className="content"><Outlet /></main>
      </div>
    </>
  );
}

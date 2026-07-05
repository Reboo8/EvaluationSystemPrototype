import { useNavigate } from 'react-router-dom';
import { Plus, AlertTriangle, CreditCard, Gauge, Mail, LifeBuoy, ArrowRight, TrendingUp } from 'lucide-react';
import { useApp, planOf, clientMrr, isServing, evalLimitReached } from '../store.jsx';

const fmtL = (n) => '₹' + (n / 100000).toFixed(2).replace(/\.?0+$/, '') + 'L';

export default function AdminOverview() {
  const nav = useNavigate();
  const { clients, invoices, tickets, auditLog } = useApp();

  const serving = clients.filter(isServing);
  const mrr = clients.reduce((a, c) => a + clientMrr(c), 0);
  const evals = clients.reduce((a, c) => a + c.evalsUsed, 0);
  const atLimit = clients.filter((c) => isServing(c) && evalLimitReached(c)).length;
  const openTickets = tickets.filter((t) => t.status !== 'RESOLVED').length;
  const failed = invoices.filter((i) => i.status === 'FAILED').length;

  // needs-attention queue (all derived from live usage/billing, not a static status field)
  const alerts = [];
  clients.filter((c) => c.billing === 'FAILED').forEach((c) => alerts.push({ icon: CreditCard, color: '#DC2626', bg: '#FEF2F2', title: `${c.name} — payment failed`, sub: 'In dunning · retry or suspend', to: '/admin/billing' }));
  clients.filter((c) => isServing(c) && evalLimitReached(c)).forEach((c) => alerts.push({ icon: Gauge, color: '#D97706', bg: '#FFFBEB', title: `${c.name} — at plan limit`, sub: `${c.evalsUsed}/${planOf(c.plan).evalLimit} evals · prompt upgrade`, to: '/admin/clients/' + c.id }));
  clients.filter((c) => { const lim = planOf(c.plan).evalLimit; return isServing(c) && lim !== Infinity && c.evalsUsed / lim >= 0.75 && c.evalsUsed < lim; }).forEach((c) => alerts.push({ icon: Gauge, color: '#D97706', bg: '#FFFBEB', title: `${c.name} — nearing limit`, sub: `${c.evalsUsed}/${planOf(c.plan).evalLimit} evals used`, to: '/admin/clients/' + c.id }));
  clients.filter((c) => c.status === 'INVITED').forEach((c) => alerts.push({ icon: Mail, color: '#056FD4', bg: '#EFF6FF', title: `${c.name} — invite pending`, sub: 'Awaiting activation · resend if stale', to: '/admin/clients/' + c.id }));
  tickets.filter((t) => t.priority === 'Urgent' && t.status !== 'RESOLVED').forEach((t) => alerts.push({ icon: LifeBuoy, color: '#DC2626', bg: '#FEF2F2', title: `Urgent ticket — ${t.id}`, sub: t.subject, to: '/admin/support' }));

  const kpis = [
    { label: 'Active Clients', value: serving.length, sub: `${clients.length} total tenants` },
    { label: 'MRR', value: fmtL(mrr), sub: 'Monthly recurring', color: '#059669', bar: '#16A34A' },
    { label: 'Evals this month', value: evals.toLocaleString('en-IN'), sub: 'Across all tenants', bar: '#056FD4' },
    { label: 'At plan limit', value: atLimit, sub: 'Upgrade candidates', color: '#D97706', bar: '#F59E0B' },
    { label: 'Open tickets', value: openTickets, sub: 'Support desk', bar: '#6D28D9' },
    { label: 'Failed payments', value: failed, sub: 'In dunning', color: failed ? '#DC2626' : '#14212A', bar: '#DC2626' },
  ];

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 18 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Operator Overview</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Platform health across every client tenant</div>
        </div>
        <button className="btn-primary" onClick={() => nav('/admin/clients/new')}><Plus size={15} /> Onboard client</button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6,1fr)', gap: 14, marginBottom: 20 }}>
        {kpis.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="eyebrow">{k.label}</div>
            <div className="num" style={{ fontSize: 26, color: k.color || '#14212A' }}>{k.value}</div>
            <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{k.sub}</div>
            {k.bar && <div className="bar" style={{ background: k.bar }} />}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* needs attention */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <AlertTriangle size={16} color="#D97706" />
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Needs attention</h2>
            <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>{alerts.length}</span>
          </div>
          {alerts.length === 0 ? (
            <div style={{ padding: 24, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>All clear — nothing needs you right now.</div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {alerts.map((a, i) => (
                <div key={i} onClick={() => nav(a.to)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '11px 13px', border: '1px solid #E2E8F0', borderRadius: 10, cursor: 'pointer' }}
                  onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFF'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}>
                  <div style={{ width: 34, height: 34, borderRadius: 8, background: a.bg, color: a.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><a.icon size={17} /></div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 13.5, fontWeight: 600, color: '#14212A' }}>{a.title}</div>
                    <div style={{ fontSize: 12, color: '#9CA3AF' }}>{a.sub}</div>
                  </div>
                  <ArrowRight size={15} color="#CBD5E1" />
                </div>
              ))}
            </div>
          )}
        </div>

        {/* recent activity */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14 }}>
            <TrendingUp size={16} color="#056FD4" />
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Recent activity</h2>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            {auditLog.slice(0, 7).map((a, i) => (
              <div key={a.id} style={{ display: 'flex', gap: 10, padding: '9px 0', borderBottom: i < 6 ? '1px solid #F3F4F6' : 'none' }}>
                <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#056FD4', marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1 }}>
                  <div style={{ fontSize: 12.5, color: '#14212A' }}><b>{a.action}</b> · {a.resource}</div>
                  <div style={{ fontSize: 11, color: '#9CA3AF' }}>{a.actor} · {a.when}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}

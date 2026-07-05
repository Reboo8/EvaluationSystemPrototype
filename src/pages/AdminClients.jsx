import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Search } from 'lucide-react';
import { useApp, planOf, evalLimitReached } from '../store.jsx';

const PALETTE = [['#DBEAFE', '#1E40AF'], ['#DCFCE7', '#15803D'], ['#EDE9FE', '#6D28D9'], ['#FFEDD5', '#C2410C']];
const ini = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export const CLIENT_STATUS = {
  ACTIVE: ['#DCFCE7', '#15803D', 'Active'],
  LIMIT: ['#FEF3C7', '#B45309', 'Limit reached'],
  PAST_DUE: ['#FEE2E2', '#B91C1C', 'Past due'],
  SUSPENDED: ['#F3F4F6', '#6B7280', 'Suspended'],
  INVITED: ['#DBEAFE', '#1E40AF', 'Invite pending'],
};
export function StatusBadge({ status }) {
  const [bg, fg, label] = CLIENT_STATUS[status] || ['#F3F4F6', '#6B7280', status];
  return <span className="badge" style={{ background: bg, color: fg }}>{label}</span>;
}

export default function AdminClients() {
  const nav = useNavigate();
  const { clients } = useApp();
  const [q, setQ] = useState('');
  const list = clients.filter((c) => c.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
        <div>
          <div style={{ fontSize: 20, fontWeight: 700 }}>Clients <span style={{ color: '#9CA3AF', fontWeight: 600, fontSize: 15 }}>[{clients.length}]</span></div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Every tenant, their plan, usage and billing state</div>
        </div>
        <button className="btn-primary" onClick={() => nav('/admin/clients/new')}><Plus size={15} /> Onboard client</button>
      </div>

      <div style={{ position: 'relative', marginBottom: 14, maxWidth: 320 }}>
        <Search size={15} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
        <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search clients…" style={{ paddingLeft: 34 }} />
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table>
          <thead><tr><th>Company</th><th>Plan</th><th>Eval usage</th><th>Opps</th><th>Status</th><th>Billing</th></tr></thead>
          <tbody>
            {list.map((c, i) => {
              const [bg, fg] = PALETTE[i % PALETTE.length];
              const plan = planOf(c.plan);
              const pct = plan.evalLimit === Infinity ? 35 : Math.min(100, Math.round((c.evalsUsed / plan.evalLimit) * 100));
              const hot = evalLimitReached(c);
              return (
                <tr className="row" key={c.id} onClick={() => nav('/admin/clients/' + c.id)}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className="avatar" style={{ width: 32, height: 32, background: bg, color: fg, fontSize: 11 }}>{ini(c.name)}</div><div><div style={{ fontWeight: 600 }}>{c.name}</div><div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{c.industry}</div></div></div></td>
                  <td>{plan.name}</td>
                  <td style={{ minWidth: 160 }}><div style={{ fontSize: 12, color: '#6B7280', marginBottom: 4 }}>{c.evalsUsed} / {plan.evalLimit === Infinity ? '∞' : plan.evalLimit}</div><div className="progress-track"><div style={{ width: pct + '%', height: '100%', background: hot ? '#F59E0B' : 'linear-gradient(90deg,#60A5FA,#056FD4)', borderRadius: 10 }} /></div></td>
                  <td>{c.oppsOpen}</td>
                  <td><StatusBadge status={c.status} /></td>
                  <td>{c.billing === 'FAILED' ? <span style={{ color: '#B91C1C', fontWeight: 600, fontSize: 12.5 }}>Failed</span> : c.billing === 'NONE' ? <span style={{ color: '#9CA3AF', fontSize: 12.5 }}>—</span> : <span style={{ color: '#16A34A', fontSize: 12.5 }}>Current</span>}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </>
  );
}

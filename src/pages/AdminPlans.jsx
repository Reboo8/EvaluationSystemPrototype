import { Check, Minus } from 'lucide-react';
import { useApp, PLANS, clientMrr } from '../store.jsx';

const fmt = (n) => '₹' + n.toLocaleString('en-IN');

const MATRIX = [
  ['Open opportunities', (p) => p.oppLimit === Infinity ? '∞' : p.oppLimit],
  ['Evaluations / month', (p) => p.evalLimit === Infinity ? '∞' : p.evalLimit],
  ['Team seats', (p) => p.seats === Infinity ? '∞' : p.seats],
  ['All test modules', (p) => p.id !== 'starter'],
  ['Multilingual AI Interview', (p) => p.id !== 'starter'],
  ['Rank · Compare · Pool', (p) => p.id !== 'starter'],
  ['Career page + embed/widget', (p) => p.id !== 'starter'],
  ['Custom modules + SSO', (p) => p.id === 'enterprise'],
  ['Bias-audit reports + SLA', (p) => p.id === 'enterprise'],
];

export default function AdminPlans() {
  const { clients } = useApp();
  const countOn = (pid) => clients.filter((c) => c.plan === pid).length;
  const mrrOn = (pid) => clients.filter((c) => c.plan === pid).reduce((a, c) => a + clientMrr(c), 0);

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Plans</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Tiers define each tenant’s usage limits, features and price. Distribution is live across your clients.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 16, marginBottom: 22 }}>
        {PLANS.map((p) => (
          <div key={p.id} className="card" style={{ padding: '22px 20px', position: 'relative', border: p.popular ? '1.5px solid #056FD4' : '1px solid #E2E8F0' }}>
            {p.popular && <span className="badge" style={{ position: 'absolute', top: -10, left: 20, background: '#056FD4', color: '#fff' }}>Most popular</span>}
            <div style={{ fontSize: 16, fontWeight: 700 }}>{p.name}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color: '#056FD4', margin: '6px 0 2px' }}>{p.price ? fmt(p.price) : 'Custom'}<span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>{p.price ? '/mo' : ''}</span></div>
            <div style={{ display: 'flex', gap: 14, margin: '12px 0 14px', paddingBottom: 14, borderBottom: '1px solid #F3F4F6' }}>
              <div><div style={{ fontSize: 18, fontWeight: 700 }}>{countOn(p.id)}</div><div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>Clients</div></div>
              <div><div style={{ fontSize: 18, fontWeight: 700, color: '#059669' }}>{'₹' + (mrrOn(p.id) / 100000).toFixed(2).replace(/\.?0+$/, '') + 'L'}</div><div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '.5px' }}>MRR</div></div>
            </div>
            {p.features.map((f) => <div key={f} style={{ display: 'flex', gap: 7, fontSize: 12.5, color: '#374151', padding: '3px 0' }}><Check size={14} color="#16A34A" style={{ flexShrink: 0, marginTop: 1 }} /> {f}</div>)}
          </div>
        ))}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px', fontSize: 15, fontWeight: 700 }}>Feature comparison</div>
        <table>
          <thead><tr><th>Capability</th>{PLANS.map((p) => <th key={p.id} style={{ textAlign: 'center' }}>{p.name}</th>)}</tr></thead>
          <tbody>
            {MATRIX.map(([label, fn]) => (
              <tr key={label}>
                <td style={{ fontWeight: 600 }}>{label}</td>
                {PLANS.map((p) => {
                  const v = fn(p);
                  return <td key={p.id} style={{ textAlign: 'center' }}>{v === true ? <Check size={16} color="#16A34A" /> : v === false ? <Minus size={16} color="#CBD5E1" /> : <b>{v}</b>}</td>;
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  );
}

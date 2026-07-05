import { CreditCard, FileText } from 'lucide-react';

export default function Billing() {
  return (
    <>
      <div className="card" style={{ padding: '22px 24px', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <div>
            <div className="eyebrow">Current Plan</div>
            <div style={{ fontSize: 22, fontWeight: 700, margin: '4px 0' }}>Growth <span style={{ fontSize: 14, color: '#6B7280', fontWeight: 600 }}>· ₹35,000 / month</span></div>
            <div style={{ fontSize: 13, color: '#6B7280' }}>200 evaluations / month · renews 1 Jul 2026</div>
          </div>
          <span className="badge" style={{ background: '#DCFCE7', color: '#15803D' }}>Active</span>
        </div>
        <div style={{ marginTop: 18 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 6 }}><span style={{ color: '#6B7280' }}>Usage this month</span><span style={{ fontWeight: 700 }}>47 / 200 evaluations</span></div>
          <div className="progress-track" style={{ height: 9 }}><div style={{ width: '23.5%', height: '100%', background: 'linear-gradient(90deg,#60A5FA,#056FD4)', borderRadius: 10 }} /></div>
        </div>
      </div>

      <div style={{ fontSize: 15, fontWeight: 700, marginBottom: 12 }}>Available Plans</div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 18 }}>
        {[['Starter', '₹10,000', '50 evaluations / month', 'Downgrade', false],
          ['Growth', '₹35,000', '200 evaluations / month', 'Your plan', true],
          ['Enterprise', 'Custom', 'Unlimited · dedicated support', 'Contact sales', false]].map(([n, p, d, cta, cur]) => (
          <div className="card" key={n} style={{ padding: '20px 22px', border: cur ? '2px solid #056FD4' : '1px solid #E2E8F0' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><div style={{ fontWeight: 700, fontSize: 16 }}>{n}</div>{cur && <span className="badge" style={{ background: '#EFF6FF', color: '#056FD4' }}>Current</span>}</div>
            <div style={{ fontSize: 24, fontWeight: 700, margin: '8px 0' }}>{p}{p !== 'Custom' && <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>/mo</span>}</div>
            <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 14 }}>{d}</div>
            <button className={cur ? 'btn-ghost' : n === 'Enterprise' ? 'btn-primary' : 'btn-ghost'} style={{ width: '100%', justifyContent: 'center' }} disabled={cur}>{cta}</button>
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
        <div className="card" style={{ padding: '20px 22px' }}><h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>Payment Method</h2><div style={{ display: 'flex', alignItems: 'center', gap: 10, color: '#6B7280', fontSize: 13 }}><CreditCard size={18} /> No payment method on file</div><button className="btn-ghost" style={{ marginTop: 14 }}>+ Add payment method</button></div>
        <div className="card" style={{ padding: '20px 22px' }}><h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>Invoice History</h2><div style={{ textAlign: 'center', color: '#9CA3AF', fontSize: 13, padding: '18px 0' }}><FileText size={24} /><div style={{ marginTop: 6 }}>No invoices yet</div></div></div>
      </div>
    </>
  );
}

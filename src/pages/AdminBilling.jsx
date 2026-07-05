import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { CreditCard, RefreshCw, Pause, Check } from 'lucide-react';
import { useApp, clientMrr } from '../store.jsx';

const fmt = (n) => '₹' + n.toLocaleString('en-IN');
const fmtL = (n) => '₹' + (n / 100000).toFixed(2).replace(/\.?0+$/, '') + 'L';

export default function AdminBilling() {
  const nav = useNavigate();
  const { clients, invoices, retryPayment, setClientStatus } = useApp();
  const [toast, setToast] = useState(null);
  const show = (m) => { setToast(m); setTimeout(() => setToast(null), 2000); };
  const nameOf = (cid) => (clients.find((c) => c.id === cid) || {}).name || '—';

  const mrr = clients.reduce((a, c) => a + clientMrr(c), 0);
  const collected = invoices.filter((i) => i.status === 'PAID').reduce((a, i) => a + i.amount, 0);
  const outstanding = invoices.filter((i) => i.status !== 'PAID').reduce((a, i) => a + i.amount, 0);
  const dunning = invoices.filter((i) => i.status === 'FAILED');

  return (
    <>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Billing & Revenue</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Invoices, payments (Razorpay) and dunning across all tenants.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 20 }}>
        <div className="kpi"><div className="eyebrow">MRR</div><div className="num" style={{ color: '#059669' }}>{fmtL(mrr)}</div><div className="bar" style={{ background: '#16A34A' }} /></div>
        <div className="kpi"><div className="eyebrow">Collected (Jun)</div><div className="num">{fmtL(collected)}</div><div className="bar" style={{ background: '#056FD4' }} /></div>
        <div className="kpi"><div className="eyebrow">Outstanding</div><div className="num" style={{ color: outstanding ? '#D97706' : '#14212A' }}>{fmtL(outstanding)}</div><div className="bar" style={{ background: '#F59E0B' }} /></div>
        <div className="kpi"><div className="eyebrow">In dunning</div><div className="num" style={{ color: dunning.length ? '#DC2626' : '#14212A' }}>{dunning.length}</div><div className="bar" style={{ background: '#DC2626' }} /></div>
      </div>

      {/* dunning queue */}
      {dunning.length > 0 && (
        <div className="card" style={{ overflow: 'hidden', marginBottom: 18, border: '1px solid #FCA5A5' }}>
          <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 9, background: '#FEF2F2' }}>
            <CreditCard size={17} color="#B91C1C" /><span style={{ fontSize: 15, fontWeight: 700, color: '#991B1B' }}>Dunning queue</span>
            <span className="badge" style={{ background: '#FEE2E2', color: '#B91C1C' }}>{dunning.length} failed</span>
          </div>
          <table>
            <thead><tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Attempted</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
            <tbody>
              {dunning.map((i) => {
                const cl = clients.find((c) => c.id === i.clientId);
                return (
                  <tr className="row" key={i.id}>
                    <td style={{ fontWeight: 600 }}>{i.id}</td>
                    <td><span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => cl && nav('/admin/clients/' + cl.id)}>{nameOf(i.clientId)}</span></td>
                    <td>{fmt(i.amount)}</td>
                    <td style={{ color: '#6B7280' }}>{i.date}</td>
                    <td style={{ textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 8 }}>
                        <button className="btn-success" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => { retryPayment(i.id); show('Payment recovered · ' + nameOf(i.clientId) + ' reinstated'); }}><RefreshCw size={13} /> Retry & recover</button>
                        {cl && cl.status !== 'SUSPENDED' && <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5, color: '#B91C1C' }} onClick={() => { setClientStatus(cl.id, 'SUSPENDED'); show(nameOf(i.clientId) + ' suspended'); }}><Pause size={13} /> Suspend</button>}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* all invoices */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '14px 18px', fontSize: 15, fontWeight: 700 }}>All invoices</div>
        <table>
          <thead><tr><th>Invoice</th><th>Client</th><th>Amount</th><th>Date</th><th>Status</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
          <tbody>
            {invoices.map((i) => (
              <tr className="row" key={i.id}>
                <td style={{ fontWeight: 600 }}>{i.id}</td>
                <td>{nameOf(i.clientId)}</td>
                <td>{fmt(i.amount)}</td>
                <td style={{ color: '#6B7280' }}>{i.date}</td>
                <td>{i.status === 'PAID' ? <span className="badge" style={{ background: '#DCFCE7', color: '#15803D' }}>Paid</span> : i.status === 'FAILED' ? <span className="badge" style={{ background: '#FEE2E2', color: '#B91C1C' }}>Failed</span> : <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>Pending</span>}</td>
                <td style={{ textAlign: 'right' }}>
                  {i.status === 'PENDING' ? <button className="btn-ghost" style={{ padding: '5px 11px', fontSize: 12 }} onClick={() => { retryPayment(i.id); show('Payment collected · ' + i.id); }}>Collect</button>
                    : i.status === 'FAILED' ? <span style={{ fontSize: 12, color: '#B91C1C' }}>In dunning ↑</span>
                      : <span style={{ color: '#CBD5E1' }}>—</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 80, display: 'flex', alignItems: 'center', gap: 9, background: '#14212A', color: '#fff', padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}><Check size={15} color="#34D399" /> {toast}</div>}
    </>
  );
}

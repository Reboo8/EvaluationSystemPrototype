import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Mail, CheckCircle2, Pause, Play, Package, LogIn, CreditCard, Check, X } from 'lucide-react';
import { useApp, planOf, PLANS } from '../store.jsx';
import { StatusBadge } from './AdminClients.jsx';

const PALETTE = [['#DBEAFE', '#1E40AF'], ['#DCFCE7', '#15803D'], ['#EDE9FE', '#6D28D9'], ['#FFEDD5', '#C2410C']];
const ini = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();
const fmt = (n) => '₹' + n.toLocaleString('en-IN');

function Bar({ used, lim }) {
  const over = lim !== Infinity && used >= lim;
  const pct = lim === Infinity ? 30 : Math.min(100, Math.round((used / lim) * 100));
  return (
    <>
      <div style={{ fontSize: 22, fontWeight: 700, color: over ? '#B91C1C' : '#14212A' }}>{used} <span style={{ fontSize: 13, color: '#9CA3AF', fontWeight: 600 }}>/ {lim === Infinity ? '∞' : lim}</span></div>
      <div className="progress-track" style={{ marginTop: 6 }}><div style={{ width: pct + '%', height: '100%', background: over ? '#F59E0B' : 'linear-gradient(90deg,#60A5FA,#056FD4)', borderRadius: 10 }} /></div>
    </>
  );
}

export default function AdminClientDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const { getClient, invoices, tickets, activateClient, resendInvite, setClientStatus, changeClientPlan, setImpersonating } = useApp();
  const c = getClient(id);
  const [planModal, setPlanModal] = useState(false);
  const [toast, setToast] = useState(null);

  if (!c) return <div className="card" style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Client not found. <span style={{ color: '#056FD4', cursor: 'pointer' }} onClick={() => nav('/admin/clients')}>Back</span></div>;

  const plan = planOf(c.plan);
  const cInvoices = invoices.filter((i) => i.clientId === c.id);
  const cTickets = tickets.filter((t) => t.clientId === c.id);
  const [bg, fg] = PALETTE[0];
  const show = (m) => { setToast(m); setTimeout(() => setToast(null), 2000); };

  return (
    <>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
        <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/admin/clients')}>Clients</span> › {c.name}
      </div>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 22 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div className="avatar" style={{ width: 52, height: 52, background: bg, color: fg, fontSize: 17 }}>{ini(c.name)}</div>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
              <h1 style={{ fontSize: 23, fontWeight: 700, margin: 0 }}>{c.name}</h1>
              <StatusBadge status={c.status} />
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{c.industry} · {c.contact} · client since {c.since}</div>
          </div>
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {c.status === 'INVITED' && <>
            <button className="btn-ghost" onClick={() => { resendInvite(c.id); show('Invite re-sent to ' + c.contact); }}><Mail size={15} /> Resend invite</button>
            <button className="btn-success" onClick={() => { activateClient(c.id); show('Client activated'); }}><CheckCircle2 size={15} /> Activate</button>
          </>}
          {(c.status === 'ACTIVE' || c.status === 'LIMIT' || c.status === 'PAST_DUE') && <>
            <button className="btn-ghost" onClick={() => { setImpersonating({ id: c.id, name: c.name }); nav('/'); }}><LogIn size={15} /> Impersonate</button>
            <button className="btn-ghost" onClick={() => setPlanModal(true)}><Package size={15} /> Change plan</button>
            <button className="btn-ghost" style={{ color: '#B91C1C' }} onClick={() => { setClientStatus(c.id, 'SUSPENDED'); show('Client suspended'); }}><Pause size={15} /> Suspend</button>
          </>}
          {c.status === 'SUSPENDED' && <button className="btn-success" onClick={() => { setClientStatus(c.id, 'ACTIVE'); show('Client reinstated'); }}><Play size={15} /> Reinstate</button>}
        </div>
      </div>

      {/* past-due banner */}
      {c.billing === 'FAILED' && (
        <div className="card" style={{ padding: '14px 18px', marginBottom: 18, background: '#FEF2F2', border: '1px solid #FCA5A5', display: 'flex', alignItems: 'center', gap: 12 }}>
          <CreditCard size={18} color="#B91C1C" />
          <div style={{ flex: 1, fontSize: 13, color: '#991B1B' }}><b>Payment failed.</b> This account is in dunning — recover the payment or it will be suspended.</div>
          <button className="btn-primary" onClick={() => nav('/admin/billing')}>Go to Billing</button>
        </div>
      )}

      {/* usage KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 18 }}>
        <div className="kpi"><div className="eyebrow">Plan</div><div className="num" style={{ fontSize: 22 }}>{plan.name}</div><div style={{ fontSize: 12, color: '#9CA3AF' }}>{plan.price ? fmt(plan.price) + '/mo' : 'Custom pricing'}</div></div>
        <div className="kpi"><div className="eyebrow">Evaluations</div><Bar used={c.evalsUsed} lim={plan.evalLimit} /></div>
        <div className="kpi"><div className="eyebrow">Open opportunities</div><Bar used={c.oppsOpen} lim={plan.oppLimit} /></div>
        <div className="kpi"><div className="eyebrow">Seats</div><Bar used={c.seatsUsed} lim={plan.seats} /></div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* plan features */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>{plan.name} plan — features unlocked</h2>
            <span style={{ fontSize: 12.5, color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => setPlanModal(true)}>Change →</span>
          </div>
          {plan.features.map((f) => (
            <div key={f} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '6px 0', fontSize: 13, color: '#374151' }}><Check size={14} color="#16A34A" /> {f}</div>
          ))}
        </div>

        {/* invoices + tickets */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', fontSize: 15, fontWeight: 700 }}>Invoices</div>
            <table>
              <thead><tr><th>Invoice</th><th>Amount</th><th>Date</th><th>Status</th></tr></thead>
              <tbody>
                {cInvoices.length === 0 ? <tr><td colSpan={4} style={{ color: '#9CA3AF', textAlign: 'center', padding: 18 }}>No invoices yet.</td></tr> :
                  cInvoices.map((i) => (
                    <tr key={i.id}><td style={{ fontWeight: 600 }}>{i.id}</td><td>{fmt(i.amount)}</td><td style={{ color: '#6B7280' }}>{i.date}</td>
                      <td>{i.status === 'PAID' ? <span className="badge" style={{ background: '#DCFCE7', color: '#15803D' }}>Paid</span> : i.status === 'FAILED' ? <span className="badge" style={{ background: '#FEE2E2', color: '#B91C1C' }}>Failed</span> : <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>Pending</span>}</td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span style={{ fontSize: 15, fontWeight: 700 }}>Support tickets</span><span style={{ fontSize: 12.5, color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/admin/support')}>Desk →</span></div>
            {cTickets.length === 0 ? <div style={{ padding: 18, color: '#9CA3AF', textAlign: 'center', fontSize: 13 }}>No tickets.</div> :
              cTickets.map((t) => (
                <div key={t.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '11px 18px', borderTop: '1px solid #F3F4F6' }}>
                  <span style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12, color: '#9CA3AF' }}>{t.id}</span>
                  <span style={{ flex: 1, fontSize: 13, fontWeight: 500 }}>{t.subject}</span>
                  <span className="badge" style={{ background: t.status === 'RESOLVED' ? '#DCFCE7' : t.status === 'IN_PROGRESS' ? '#FEF3C7' : '#DBEAFE', color: t.status === 'RESOLVED' ? '#15803D' : t.status === 'IN_PROGRESS' ? '#B45309' : '#1E40AF' }}>{t.status.replace('_', ' ')}</span>
                </div>
              ))}
          </div>
        </div>
      </div>

      {planModal && (
        <div onClick={() => setPlanModal(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(20,33,42,0.45)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
          <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: 560, maxWidth: '94vw', padding: 22 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
              <h2 style={{ fontSize: 16.5, fontWeight: 700, margin: 0 }}>Change plan — {c.name}</h2>
              <X size={18} color="#94A3B8" style={{ cursor: 'pointer' }} onClick={() => setPlanModal(false)} />
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {PLANS.map((p) => {
                const on = p.id === c.plan;
                return (
                  <div key={p.id} onClick={() => { changeClientPlan(c.id, p.id); setPlanModal(false); show('Plan changed to ' + p.name); }}
                    style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '14px 16px', border: `1.5px solid ${on ? '#056FD4' : '#E2E8F0'}`, background: on ? '#F8FBFF' : '#fff', borderRadius: 10, cursor: 'pointer' }}>
                    <div>
                      <div style={{ fontSize: 14, fontWeight: 700 }}>{p.name} {on && <span className="badge" style={{ background: '#EFF6FF', color: '#056FD4', marginLeft: 6 }}>current</span>}</div>
                      <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{p.evalLimit === Infinity ? 'Unlimited evals' : p.evalLimit + ' evals'} · {p.oppLimit === Infinity ? '∞' : p.oppLimit} opps · {p.seats === Infinity ? '∞' : p.seats} seats</div>
                    </div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: '#056FD4' }}>{p.price ? fmt(p.price) : 'Custom'}</div>
                  </div>
                );
              })}
            </div>
          </div>
        </div>
      )}

      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 80, display: 'flex', alignItems: 'center', gap: 9, background: '#14212A', color: '#fff', padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}><Check size={15} color="#34D399" /> {toast}</div>}
    </>
  );
}

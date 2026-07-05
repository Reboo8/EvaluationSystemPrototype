import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, CheckCircle2 } from 'lucide-react';
import { useApp } from '../store.jsx';

const PRIO = { Urgent: ['#FEE2E2', '#B91C1C'], High: ['#FFEDD5', '#C2410C'], Medium: ['#EFF6FF', '#1E40AF'], Low: ['#F3F4F6', '#6B7280'] };
const ST = { OPEN: ['#DBEAFE', '#1E40AF', 'Open'], IN_PROGRESS: ['#FEF3C7', '#B45309', 'In progress'], RESOLVED: ['#DCFCE7', '#15803D', 'Resolved'] };
const FILTERS = [['all', 'All'], ['open', 'Open'], ['IN_PROGRESS', 'In progress'], ['RESOLVED', 'Resolved']];

export default function AdminSupport() {
  const nav = useNavigate();
  const { tickets, clients, resolveTicket } = useApp();
  const [filter, setFilter] = useState('all');
  const [toast, setToast] = useState(null);
  const show = (m) => { setToast(m); setTimeout(() => setToast(null), 2000); };
  const nameOf = (cid) => (clients.find((c) => c.id === cid) || {}).name || '—';

  const open = tickets.filter((t) => t.status !== 'RESOLVED').length;
  const urgent = tickets.filter((t) => t.priority === 'Urgent' && t.status !== 'RESOLVED').length;
  const list = tickets.filter((t) => filter === 'all' ? true : filter === 'open' ? t.status !== 'RESOLVED' : t.status === filter);

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Support Desk</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Tickets from every client tenant · {open} open{urgent ? ` · ${urgent} urgent` : ''}.</div>
      </div>

      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        {FILTERS.map(([k, l]) => {
          const on = filter === k;
          return <button key={k} onClick={() => setFilter(k)} className={on ? 'btn-primary' : 'btn-ghost'} style={{ padding: '7px 14px', fontSize: 12.5 }}>{l}</button>;
        })}
      </div>

      <div className="card" style={{ overflow: 'hidden' }}>
        <table>
          <thead><tr><th>Ticket</th><th>Client</th><th>Subject</th><th>Priority</th><th>Status</th><th>Updated</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
          <tbody>
            {list.length === 0 ? <tr><td colSpan={7} style={{ textAlign: 'center', color: '#9CA3AF', padding: 28 }}>No tickets in this view.</td></tr> :
              list.map((t) => {
                const [pb, pf] = PRIO[t.priority] || PRIO.Medium;
                const [sb, sf, sl] = ST[t.status] || ST.OPEN;
                const cl = clients.find((c) => c.name && c.id === t.clientId);
                return (
                  <tr className="row" key={t.id}>
                    <td style={{ fontFamily: 'ui-monospace, Menlo, monospace', fontSize: 12.5, color: '#6B7280' }}>{t.id}</td>
                    <td><span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => cl && nav('/admin/clients/' + cl.id)}>{nameOf(t.clientId)}</span></td>
                    <td style={{ fontWeight: 500 }}>{t.subject}</td>
                    <td><span className="badge" style={{ background: pb, color: pf }}>{t.priority}</span></td>
                    <td><span className="badge" style={{ background: sb, color: sf }}>{sl}</span></td>
                    <td style={{ color: '#6B7280' }}>{t.updated}</td>
                    <td style={{ textAlign: 'right' }}>{t.status === 'RESOLVED' ? <span style={{ fontSize: 12.5, color: '#16A34A', fontWeight: 600 }}><CheckCircle2 size={13} style={{ verticalAlign: -2 }} /> Done</span> : <button className="btn-success" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => { resolveTicket(t.id); show(t.id + ' resolved'); }}><Check size={13} /> Resolve</button>}</td>
                  </tr>
                );
              })}
          </tbody>
        </table>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 80, display: 'flex', alignItems: 'center', gap: 9, background: '#14212A', color: '#fff', padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}><Check size={15} color="#34D399" /> {toast}</div>}
    </>
  );
}

import { useState } from 'react';
import { Download, ShieldCheck, Check } from 'lucide-react';
import { useApp } from '../store.jsx';

export default function AdminCompliance() {
  const { auditLog, erasures, clients, fulfillErasure } = useApp();
  const [toast, setToast] = useState(null);
  const show = (m) => { setToast(m); setTimeout(() => setToast(null), 2000); };
  const nameOf = (cid) => (clients.find((c) => c.id === cid) || {}).name || '—';
  const pending = erasures.filter((e) => e.status === 'PENDING').length;

  const downloadReport = () => {
    const rows = [['Metric', 'Value'], ['Adverse-impact (4/5ths rule)', 'Pass'], ['Last audit run', '24 Jun 2026'], ['Next scheduled', '24 Jul 2026'], ['Clients audited', String(clients.length)]];
    const csv = rows.map((r) => r.join(',')).join('\n');
    try {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const a = document.createElement('a'); a.href = url; a.download = 'adverse-impact-report.csv'; document.body.appendChild(a); a.click(); a.remove(); URL.revokeObjectURL(url);
      show('Adverse-impact report downloaded');
    } catch { show('Report generation queued'); }
  };

  return (
    <>
      <div style={{ marginBottom: 16 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Compliance</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Bias audits, model provenance, audit trail and data-subject requests.</div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        <div className="card" style={{ padding: '20px 22px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>Bias Audits</h2>
          <Row k="Adverse-impact (4/5ths rule)" v={<span className="badge" style={{ background: '#DCFCE7', color: '#15803D' }}>Pass</span>} />
          <Row k="Last audit run" v="24 Jun 2026" />
          <Row k="Next scheduled" v="24 Jul 2026" last />
          <button className="btn-ghost" style={{ marginTop: 12 }} onClick={downloadReport}><Download size={14} /> Download report</button>
        </div>
        <div className="card" style={{ padding: '20px 22px' }}>
          <h2 style={{ fontSize: 15, fontWeight: 700, margin: '0 0 12px' }}>Model Versions</h2>
          <table>
            <thead><tr><th>Pipeline</th><th>Model</th><th>Ver</th></tr></thead>
            <tbody>
              {[['Resume match', 'embeddings', 'v1.3'], ['Assessment scoring', 'llama-3.3-70b', 'v2.1'], ['Interview scoring', 'llama-3.3-70b', 'v2.1'], ['Proctoring', 'CV ensemble', 'v1.0']].map((r) => <tr key={r[0]}><td>{r[0]}</td><td>{r[1]}</td><td>{r[2]}</td></tr>)}
            </tbody>
          </table>
        </div>

        {/* erasure queue */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 9 }}>
            <ShieldCheck size={16} color="#056FD4" /><span style={{ fontSize: 15, fontWeight: 700 }}>Data-erasure requests</span>
            {pending > 0 && <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>{pending} pending</span>}
          </div>
          <table>
            <thead><tr><th>Subject</th><th>Client</th><th>Requested</th><th style={{ textAlign: 'right' }}>Action</th></tr></thead>
            <tbody>
              {erasures.map((e) => (
                <tr className="row" key={e.id}>
                  <td style={{ fontWeight: 600 }}>{e.subject}</td>
                  <td>{nameOf(e.clientId)}</td>
                  <td style={{ color: '#6B7280' }}>{e.requested}</td>
                  <td style={{ textAlign: 'right' }}>{e.status === 'FULFILLED' ? <span className="badge" style={{ background: '#DCFCE7', color: '#15803D' }}>Fulfilled</span> : <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => { fulfillErasure(e.id); show('Erasure fulfilled · ' + e.subject); }}>Fulfill request</button>}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* live audit log */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '16px 20px', fontSize: 15, fontWeight: 700 }}>Audit Log</div>
          <table>
            <thead><tr><th>When</th><th>Actor</th><th>Action</th><th>Resource</th></tr></thead>
            <tbody>
              {auditLog.slice(0, 10).map((r) => <tr key={r.id}><td style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{r.when}</td><td>{r.actor}</td><td>{r.action}</td><td>{r.resource}</td></tr>)}
            </tbody>
          </table>
        </div>
      </div>

      {toast && <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 80, display: 'flex', alignItems: 'center', gap: 9, background: '#14212A', color: '#fff', padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}><Check size={15} color="#34D399" /> {toast}</div>}
    </>
  );
}

const Row = ({ k, v, last }) => <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '9px 0', borderBottom: last ? 'none' : '1px solid #F3F4F6', fontSize: 13 }}><span>{k}</span><span>{v}</span></div>;

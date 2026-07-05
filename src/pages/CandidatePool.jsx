import { useParams, useNavigate } from 'react-router-dom';
import { Send } from 'lucide-react';
import { useApp } from '../store.jsx';
import OppTabs from '../components/OppTabs.jsx';

const PALETTE = [['#DBEAFE', '#1E40AF'], ['#DCFCE7', '#15803D'], ['#EDE9FE', '#6D28D9'], ['#FFEDD5', '#C2410C'], ['#FCE7F3', '#BE185D']];
const ini = (n) => n.split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function CandidatePool() {
  const { id } = useParams();
  const nav = useNavigate();
  const { getOpportunity, getPool, rescue } = useApp();
  const opp = getOpportunity(id);
  const pool = getPool(id);

  if (!opp) return <div className="card" style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Opportunity not found.</div>;

  return (
    <>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
        <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/opportunities')}>Opportunities</span> › {opp.title}
      </div>
      <OppTabs id={id} active="pool" />

      <div style={{ fontSize: 17, fontWeight: 700 }}>Candidate Pool <span style={{ color: '#9CA3AF', fontWeight: 600 }}>— {pool.length} scanned</span></div>
      <div style={{ fontSize: 12.5, color: '#6B7280', margin: '2px 0 16px' }}>Resume-gate results. Rejected candidates stay here with the reason — rescue anyone the analyser knocked out by mistake.</div>

      <div className="card" style={{ overflow: 'hidden' }}>
        {pool.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No candidates have entered the resume gate yet. Use “Send Assessment” to add some.</div>
        ) : (
          <table>
            <thead><tr><th>Candidate</th><th>Fit</th><th>Status</th><th>Reason</th><th></th></tr></thead>
            <tbody>
              {pool.map((c, i) => {
                const [bg, fg] = PALETTE[i % PALETTE.length];
                return (
                  <tr key={c.id}>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className="avatar" style={{ width: 32, height: 32, background: bg, color: fg, fontSize: 11 }}>{ini(c.name)}</div><span style={{ fontWeight: 600 }}>{c.name}</span></div></td>
                    <td style={{ fontWeight: 700, color: c.fit >= 60 ? '#059669' : '#D97706' }}>{c.fit}</td>
                    <td>{c.pass
                      ? <span className="badge" style={{ background: '#DCFCE7', color: '#15803D' }}>{c.rescued ? 'Rescued → assessment' : 'Passed → assessment'}</span>
                      : <span className="badge" style={{ background: '#FEF2F2', color: '#DC2626' }}>Rejected</span>}</td>
                    <td style={{ color: '#6B7280', fontSize: 12.5 }}>{c.reason || '—'}</td>
                    <td>{!c.pass && <button className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => rescue(id, c.id)}><Send size={13} /> Rescue / send link</button>}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </>
  );
}

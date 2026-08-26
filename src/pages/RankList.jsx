import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { Columns2, FileText } from 'lucide-react';
import { useApp, weightedScore, ranked } from '../store.jsx';
import OppTabs from '../components/OppTabs.jsx';

const PALETTE = [['#DBEAFE', '#1E40AF'], ['#DCFCE7', '#15803D'], ['#EDE9FE', '#6D28D9'], ['#FFEDD5', '#C2410C'], ['#FCE7F3', '#BE185D']];
const ini = (n) => n.replace(/^Dr\.?\s*/, '').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function RankList() {
  const { id } = useParams();
  const nav = useNavigate();
  const { getOpportunity, getCandidates } = useApp();
  const opp = getOpportunity(id);
  const [sel, setSel] = useState([]);

  if (!opp) return <div className="card" style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>Opportunity not found.</div>;

  const weights = opp.assessment?.weights || [];
  const agents = ranked(getCandidates(id), weights);
  const toggle = (cid) => setSel((s) => (s.includes(cid) ? s.filter((x) => x !== cid) : [...s, cid]));
  const compare = () => nav(`/opportunities/${id}/compare?ids=${sel.join(',')}`);

  return (
    <>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
        <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/opportunities')}>Opportunities</span> › {opp.title}
      </div>
      <OppTabs id={id} active="rank" />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Rank List <span style={{ color: '#9CA3AF', fontWeight: 600 }}>— {agents.length} cleared</span></div>
          <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 2 }}>Auto-ranked by weighted score · {weights.map((w) => `${w.label} ${w.w}%`).join(' · ')}</div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 3 }}>Thresholds <b>gate</b> — they decide who reaches this list. Weights <b>rank</b> — they decide the order. Open a report for provenance and to override a decision.</div>
        </div>
        <button className="btn-primary" disabled={sel.length < 2} onClick={compare}><Columns2 size={15} /> Compare ({sel.length})</button>
      </div>

      <div className="card" style={{ overflow: 'auto' }}>
        {agents.length === 0 ? (
          <div style={{ padding: 48, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No candidates have cleared yet.</div>
        ) : (
          <table>
            <thead><tr><th style={{ width: 36 }}></th><th>Rank</th><th>Candidate</th><th>Weighted</th>{weights.map((w) => <th key={w.label}>{w.label}</th>)}<th>CEFR</th><th style={{ textAlign: 'right' }}>Report</th></tr></thead>
            <tbody>
              {agents.map((a, i) => {
                const [bg, fg] = PALETTE[i % PALETTE.length];
                return (
                  <tr className="row" key={a.id}>
                    <td><input type="checkbox" checked={sel.includes(a.id)} onChange={() => toggle(a.id)} /></td>
                    <td style={{ fontWeight: 700, color: '#056FD4' }}>#{i + 1}</td>
                    <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><div className="avatar" style={{ width: 32, height: 32, background: bg, color: fg, fontSize: 11 }}>{ini(a.name)}</div><span style={{ fontWeight: 600, color: '#056FD4', cursor: 'pointer' }} onClick={() => nav(`/opportunities/${id}/candidate/${a.id}`)}>{a.name}</span>{String(a.id).startsWith('live_') && <span className="badge" style={{ background: '#EDE9FE', color: '#6D28D9' }}>new</span>}{a.pending && <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>recovery in progress</span>}</div></td>
                    <td style={{ fontWeight: 700, color: '#059669' }}>{weightedScore(a, weights)}</td>
                    {weights.map((w) => <td key={w.label}>{a.pending?.module === w.label ? <span className="badge" title={`Technical failure ≠ candidate failure · ${a.pending.jobId} · credits held, not charged`} style={{ background: '#FEF3C7', color: '#B45309', whiteSpace: 'nowrap' }}>Score pending</span> : (a.scores?.[w.label] ?? '—')}</td>)}
                    <td><span className="badge" style={{ background: '#EFF6FF', color: '#1E40AF' }}>{a.cefr}</span></td>
                    <td style={{ textAlign: 'right' }}><span style={{ fontSize: 12.5, color: '#056FD4', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap', display: 'inline-flex', alignItems: 'center', gap: 5 }} onClick={() => nav(`/opportunities/${id}/candidate/${a.id}`)}><FileText size={13} /> Open →</span></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
      {agents.length > 0 && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 10 }}>Tick 2+ candidates, then “Compare” for a side-by-side. Each report carries the provenance of its score (assessment version, rubric, weights, thresholds, model) and the human override.</div>}
    </>
  );
}

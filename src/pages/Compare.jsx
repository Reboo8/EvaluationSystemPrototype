import { useParams, useSearchParams, useNavigate } from 'react-router-dom';
import { useApp, weightedScore } from '../store.jsx';

const PALETTE = [['#DBEAFE', '#1E40AF'], ['#DCFCE7', '#15803D'], ['#EDE9FE', '#6D28D9'], ['#FFEDD5', '#C2410C']];
const ini = (n) => n.replace(/^Dr\.?\s*/, '').split(' ').map((w) => w[0]).slice(0, 2).join('').toUpperCase();

export default function Compare() {
  const { id } = useParams();
  const nav = useNavigate();
  const [sp] = useSearchParams();
  const { getOpportunity, getCandidates } = useApp();
  const opp = getOpportunity(id);
  const ids = (sp.get('ids') || '').split(',').filter(Boolean);
  const all = getCandidates(id);
  const cands = ids.length ? all.filter((c) => ids.includes(c.id)) : all.slice(0, 3);
  const weights = opp?.assessment?.weights || [];

  const rows = [
    { label: 'Weighted score', get: (c) => weightedScore(c, weights), numeric: true },
    ...weights.map((w) => ({ label: w.label, get: (c) => c.scores?.[w.label], numeric: true })),
    { label: 'CEFR', get: (c) => c.cefr, numeric: false },
    { label: 'Experience', get: (c) => c.exp, numeric: false },
  ];

  return (
    <>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
        <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav(`/opportunities/${id}/rank`)}>Rank List</span> › Compare
      </div>
      <div style={{ fontSize: 17, fontWeight: 700 }}>Compare Candidates</div>
      <div style={{ fontSize: 12.5, color: '#6B7280', margin: '2px 0 4px' }}>Best value per row is highlighted green.</div>
      <div style={{ fontSize: 12, color: '#9CA3AF', margin: '0 0 16px' }}>Everyone here already cleared the thresholds — thresholds <b>gate</b>. The weighted score below is what <b>ranks</b> them{weights.length > 0 ? ` (${weights.map((w) => `${w.label} ${w.w}%`).join(' · ')})` : ''}.</div>

      {cands.length === 0 ? (
        <div className="card" style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>No candidates selected. <span style={{ color: '#056FD4', cursor: 'pointer' }} onClick={() => nav(`/opportunities/${id}/rank`)}>Back to Rank List</span></div>
      ) : (
        <div className="card" style={{ overflow: 'auto' }}>
          <table>
            <thead>
              <tr>
                <th>Metric</th>
                {cands.map((c, i) => {
                  const [bg, fg] = PALETTE[i % PALETTE.length];
                  return <th key={c.id}><div style={{ display: 'flex', alignItems: 'center', gap: 8 }}><div className="avatar" style={{ width: 28, height: 28, background: bg, color: fg, fontSize: 10 }}>{ini(c.name)}</div><span style={{ textTransform: 'none', fontSize: 13, color: '#14212A', fontWeight: 700 }}>{c.name}</span></div></th>;
                })}
              </tr>
            </thead>
            <tbody>
              {rows.map((r) => {
                let best = -1;
                if (r.numeric) {
                  const vals = cands.map((c) => { const n = Number(r.get(c)); return isNaN(n) ? -Infinity : n; });
                  const max = Math.max(...vals);
                  // only highlight a strict, unique winner — true ties highlight none
                  if (max > -Infinity && vals.filter((v) => v === max).length === 1) best = vals.indexOf(max);
                }
                return (
                  <tr key={r.label}>
                    <td style={{ fontWeight: 600, color: '#6B7280' }}>{r.label}</td>
                    {cands.map((c, i) => {
                      const v = r.get(c); const win = i === best;
                      return <td key={c.id} style={win ? { background: '#ECFDF5', color: '#15803D', fontWeight: 700 } : { fontWeight: 600 }}>{v ?? '—'}{win ? ' ✓' : ''}</td>;
                    })}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

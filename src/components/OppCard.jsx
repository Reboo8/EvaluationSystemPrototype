import { useNavigate } from 'react-router-dom';
import { Code2, Check } from 'lucide-react';

const badgeColors = (status) =>
  status === 'OPEN' ? ['#DCFCE7', '#15803D']
  : status === 'DRAFT' ? ['#F3F4F6', '#6B7280']
  : status === 'PAUSED' ? ['#FEF3C7', '#B45309']
  : ['#DBEAFE', '#1E40AF'];

export default function OppCard({ opp }) {
  const nav = useNavigate();
  const pct = opp.requiredPositions ? Math.round((opp.cleared / opp.requiredPositions) * 100) : 0;
  const [bb, bf] = badgeColors(opp.status);
  const meta = [opp.location, opp.roleType, opp.workMode].filter(Boolean).join(' · ');

  return (
    <div className="card opp-card" style={{ padding: '18px 22px 16px' }} onClick={() => nav('/opportunities/' + opp.id)}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 14 }}>
        <div className="icon-box"><Code2 size={20} /></div>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span style={{ fontSize: 15, fontWeight: 700 }}>{opp.title}</span>
            <span className="badge" style={{ background: bb, color: bf }}>
              {opp.status === 'OPEN' && <span style={{ width: 5, height: 5, borderRadius: '50%', background: bf }} />} {opp.status}
            </span>
          </div>
          <div style={{ fontSize: 12.5, color: '#9CA3AF', marginTop: 3 }}>{meta || '—'}</div>
        </div>
        <span style={{ fontSize: 13, color: '#056FD4', fontWeight: 600, whiteSpace: 'nowrap' }}>View details →</span>
      </div>

      <div style={{ margin: '16px 0 14px' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 7 }}>
          <span style={{ fontSize: 12, color: '#6B7280', fontWeight: 500 }}>Hiring Progress</span>
          <span style={{ fontSize: 12.5 }}><b>{opp.cleared} of {opp.requiredPositions}</b> filled</span>
        </div>
        <div className="progress-track"><div style={{ width: pct + '%', height: '100%', background: 'linear-gradient(90deg,#22C55E,#16A34A)', borderRadius: 10 }} /></div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span className="chip" style={{ background: '#ECFDF5', color: '#16A34A' }}><Check size={13} /> {opp.status === 'DRAFT' ? 'Draft' : 'On Track'}</span>
        <div style={{ display: 'flex', gap: 34, textAlign: 'right' }}>
          {[['Required', opp.requiredPositions, '#14212A'], ['Cleared', opp.cleared, '#16A34A'], ['In Pipeline', opp.inPipeline, '#056FD4']].map(([l, v, c]) => (
            <div key={l}>
              <div style={{ fontSize: 9, fontWeight: 700, letterSpacing: '0.5px', textTransform: 'uppercase', color: '#9CA3AF' }}>{l}</div>
              <div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

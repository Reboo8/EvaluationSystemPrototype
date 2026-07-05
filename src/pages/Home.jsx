import { useNavigate } from 'react-router-dom';
import { Plus, CalendarDays } from 'lucide-react';
import { useApp } from '../store.jsx';
import OppCard from '../components/OppCard.jsx';

export default function Home() {
  const nav = useNavigate();
  const { opportunities } = useApp();

  const totalRequired = opportunities.reduce((a, o) => a + (o.requiredPositions || 0), 0);
  const cleared = opportunities.reduce((a, o) => a + (o.cleared || 0), 0);
  const inPipeline = opportunities.reduce((a, o) => a + (o.inPipeline || 0), 0);
  const stillNeeded = Math.max(0, totalRequired - cleared);

  const kpis = [
    { label: 'Total Positions Required', value: totalRequired, sub: `Across ${opportunities.length} ${opportunities.length === 1 ? 'opportunity' : 'opportunities'}` },
    { label: 'In Pipeline', value: inPipeline, sub: 'Active screening', bar: '#056FD4' },
    { label: 'Total Cleared', value: cleared, sub: 'Passed all evaluation stages', bar: '#16A34A', color: '#059669' },
    { label: 'Still Needed', value: stillNeeded, sub: 'To fulfill active roles', bar: '#F59E0B' },
  ];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 26 }}>
        {kpis.map((k) => (
          <div className="kpi" key={k.label}>
            <div className="eyebrow">{k.label}</div>
            <div className="num" style={{ color: k.color || '#14212A' }}>{k.value}</div>
            <div style={{ fontSize: 12, color: '#6B7280' }}>{k.sub}</div>
            {k.bar && <div className="bar" style={{ background: k.bar }} />}
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Live Opportunities <span style={{ color: '#9CA3AF', fontWeight: 600 }}>[{opportunities.length}]</span></div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Manage and track your active hiring cycles</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#6B7280', fontWeight: 500 }}><CalendarDays size={14} /> June 2026</span>
          <button className="btn-primary" onClick={() => nav('/opportunities/new')}><Plus size={15} /> Create New</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {opportunities.map((o) => <OppCard key={o.id} opp={o} />)}
      </div>
    </>
  );
}

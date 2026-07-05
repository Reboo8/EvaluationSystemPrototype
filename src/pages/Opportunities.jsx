import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus } from 'lucide-react';
import { useApp } from '../store.jsx';
import OppCard from '../components/OppCard.jsx';

const TABS = ['All', 'Open', 'Draft', 'Closed'];

export default function Opportunities() {
  const nav = useNavigate();
  const { opportunities } = useApp();
  const [tab, setTab] = useState('All');

  const filtered = opportunities.filter((o) => tab === 'All' || o.status === tab.toUpperCase());

  return (
    <>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          {TABS.map((t) => (
            <span key={t} className="chip" onClick={() => setTab(t)}
              style={{ cursor: 'pointer', background: tab === t ? '#056FD4' : '#fff', color: tab === t ? '#fff' : '#6B7280', border: tab === t ? 'none' : '1px solid #E2E8F0' }}>
              {t}
            </span>
          ))}
        </div>
        <button className="btn-primary" onClick={() => nav('/opportunities/new')}><Plus size={15} /> Create New</button>
      </div>

      {filtered.length === 0 ? (
        <div className="card" style={{ padding: '48px', textAlign: 'center', color: '#9CA3AF' }}>No opportunities in “{tab}”.</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {filtered.map((o) => <OppCard key={o.id} opp={o} />)}
        </div>
      )}
    </>
  );
}

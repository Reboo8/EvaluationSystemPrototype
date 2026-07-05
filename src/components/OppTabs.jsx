import { useNavigate } from 'react-router-dom';

export default function OppTabs({ id, active }) {
  const nav = useNavigate();
  const tabs = [
    ['overview', 'Overview', `/opportunities/${id}`],
    ['rank', 'Rank List', `/opportunities/${id}/rank`],
    ['pool', 'Candidate Pool', `/opportunities/${id}/pool`],
  ];
  return (
    <div style={{ display: 'flex', gap: 6, marginBottom: 18 }}>
      {tabs.map(([k, label, to]) => (
        <span key={k} className="chip" onClick={() => nav(to)}
          style={{ cursor: 'pointer', background: active === k ? '#056FD4' : '#fff', color: active === k ? '#fff' : '#6B7280', border: active === k ? 'none' : '1px solid #E2E8F0' }}>
          {label}
        </span>
      ))}
    </div>
  );
}

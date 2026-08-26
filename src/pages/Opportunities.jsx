import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, AlertTriangle, Wallet } from 'lucide-react';
import { useApp, fmtCr } from '../store.jsx';
import OppCard from '../components/OppCard.jsx';

const TABS = ['All', 'Open', 'Draft', 'Closed'];

export default function Opportunities() {
  const nav = useNavigate();
  const { clientOpportunities: opportunities, clientEstimate, clientWallet: w } = useApp();
  const [tab, setTab] = useState('All');

  const filtered = opportunities.filter((o) => tab === 'All' || o.status === tab.toUpperCase());

  return (
    <>
      <WalletNote w={w} onTopUp={() => nav('/billing')} />

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
        <>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {filtered.map((o) => {
              const est = clientEstimate(o);
              const short = Math.max(0, est.total - w.available);
              const funded = short === 0;
              return (
                <div key={o.id}>
                  <OppCard opp={o} />
                  <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', padding: '8px 4px 0' }}>
                    <span className="badge" style={{ background: funded ? '#DCFCE7' : '#FEF3C7', color: funded ? '#15803D' : '#B45309' }}>
                      {funded ? 'Funded' : `Underfunded by ${fmtCr(short)}`}
                    </span>
                    <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>
                      est. {fmtCr(est.total)} for {est.target} hire{est.target === 1 ? '' : 's'} · {fmtCr(est.perCandidate)} per fully-evaluated candidate · {fmtCr(w.available)} available
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
          <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 14 }}>
            Funding is a safety guide, not a pre-charge — credits are consumed only when services actually run, and an underfunded opportunity still opens.
          </div>
        </>
      )}
    </>
  );
}

/* ── wallet state surfaced once, only when it is not HEALTHY (locked rule: wallet ≠ account status) ── */
function WalletNote({ w, onTopUp }) {
  if (w.state === 'HEALTHY') return null;
  const TopUp = () => <span style={{ color: w.state === 'BLOCKED_FOR_NEW_USAGE' ? '#93C5FD' : '#056FD4', fontWeight: 700, cursor: 'pointer' }} onClick={onTopUp}>Top up →</span>;

  if (w.state === 'LOW_BALANCE') return (
    <div className="banner warn"><AlertTriangle size={17} />
      <div style={{ flex: 1 }}>Low balance: <b>{fmtCr(w.available)} available</b> (threshold {fmtCr(w.lowBalanceThreshold)}). New evaluations still start — top up before the queue is affected. <TopUp /></div>
    </div>
  );
  if (w.state === 'ZERO') return (
    <div className="banner warn"><Wallet size={17} />
      <div style={{ flex: 1 }}>Zero credits. Your workspace stays active — opportunities, drafts and configuration all keep working; only the next <i>paid</i> evaluation waits for credits. <TopUp /></div>
    </div>
  );
  if (w.state === 'OVERDRAFT') return (
    <div className="banner danger"><AlertTriangle size={17} />
      <div style={{ flex: 1 }}>Outstanding <b>−{fmtCr(w.outstanding)}</b>. New paid evaluations are paused; the ones already running will finish. A top-up clears the debt first. <TopUp /></div>
    </div>
  );
  return (
    <div className="banner dark"><AlertTriangle size={17} />
      <div style={{ flex: 1 }}>Wallet frozen by Cuba Admin — new paid usage is blocked. Running evaluations continue to completion. <TopUp /></div>
    </div>
  );
}

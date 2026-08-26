import { useNavigate } from 'react-router-dom';
import { Plus, CalendarDays, AlertTriangle, Snowflake, LifeBuoy, Pause, Bug, ArrowRight } from 'lucide-react';
import { useApp, fmtCr, WALLET_STATE } from '../store.jsx';
import { Kpi } from '../components/admin/ui.jsx';
import OppCard from '../components/OppCard.jsx';

/* wallet KPI text colour by state (spec §06) */
const KPI_COLOR = { HEALTHY: '#15803D', LOW_BALANCE: '#B45309', ZERO: '#6B7280', OVERDRAFT: '#B91C1C', BLOCKED_FOR_NEW_USAGE: '#14212A' };
const MODNAME = { resume: 'Resume / JD Screen', written: 'Written', mcq: 'MCQ', coding: 'Coding', sjt: 'SJT', language: 'Language', personality: 'Personality', typing: 'Typing', computer: 'Computer Literacy', interview: 'AI Interview', simulation: 'Simulation', custom: 'Custom' };

export default function Home() {
  const nav = useNavigate();
  const { clientOpportunities: opportunities, clientWallet: w, moduleAvailableFor, currentClientId, failedJobs } = useApp();

  /* §10 boundary: when Cuba Admin changes WHAT is offered, the roles already using it must say so (candidates would otherwise just stop advancing) */
  const affected = opportunities
    .filter((o) => o.status === 'OPEN')
    .map((o) => ({ o, blocked: (o.assessment?.modules || []).filter((m) => !moduleAvailableFor(m.key, currentClientId).ok) }))
    .filter((x) => x.blocked.length > 0);
  const pausedNames = Array.from(new Set(affected.flatMap((x) => x.blocked.map((m) => MODNAME[m.key] || m.key))));
  /* §09: the client's own stuck evaluations, surfaced where they land first */
  const myJobs = (failedJobs || []).filter((j) => j.clientId === currentClientId && j.status === 'OPEN');
  const heldTotal = myJobs.reduce((a, j) => a + (j.creditsHeld || 0), 0);

  const totalRequired = opportunities.reduce((a, o) => a + (o.requiredPositions || 0), 0);
  const cleared = opportunities.reduce((a, o) => a + (o.cleared || 0), 0);
  const inPipeline = opportunities.reduce((a, o) => a + (o.inPipeline || 0), 0);
  const stillNeeded = Math.max(0, totalRequired - cleared);

  const stateLabel = WALLET_STATE[w.state]?.label || w.state;
  const creditsSub = w.outstanding > 0 ? `${stateLabel} · ${fmtCr(w.outstanding)} outstanding` : stateLabel;

  const kpis = [
    { label: 'Total Positions Required', value: totalRequired, sub: `Across ${opportunities.length} ${opportunities.length === 1 ? 'opportunity' : 'opportunities'}` },
    { label: 'In Pipeline', value: inPipeline, sub: 'Active screening', bar: '#056FD4' },
    { label: 'Total Cleared', value: cleared, sub: 'Passed all evaluation stages', bar: '#16A34A', color: '#059669' },
    { label: 'Still Needed', value: stillNeeded, sub: 'To fulfill active roles', bar: '#F59E0B' },
    { label: 'Credits Available', value: fmtCr(w.available), sub: creditsSub, bar: KPI_COLOR[w.state], color: KPI_COLOR[w.state], size: 24 },
  ];

  return (
    <>
      <WalletBanner w={w} nav={nav} />

      {affected.length > 0 && (
        <div className="banner warn">
          <Pause size={17} />
          <div style={{ flex: 1 }}>
            <b>{pausedNames.join(', ')} {pausedNames.length === 1 ? 'is' : 'are'} currently unavailable — changed by Cuba Admin.</b>{' '}
            {affected.length} live {affected.length === 1 ? 'role uses' : 'roles use'} {pausedNames.length === 1 ? 'it' : 'them'} ({affected.map((x) => x.o.title).join(', ')}) — candidates will hold at that stage; anything already running finishes.
          </div>
          <button className="btn-ghost" onClick={() => nav('/opportunities/' + affected[0].o.id)}>Review role <ArrowRight size={13} /></button>
        </div>
      )}

      {myJobs.length > 0 && (
        <div className="banner warn">
          <Bug size={17} />
          <div style={{ flex: 1 }}>
            <b>{myJobs.length} evaluation{myJobs.length === 1 ? '' : 's'} need{myJobs.length === 1 ? 's' : ''} attention.</b>{' '}
            {myJobs.slice(0, 2).map((j) => `${j.candidate} · ${j.oppTitle}`).join(', ')}{myJobs.length > 2 ? ` and ${myJobs.length - 2} more` : ''} — a technical failure, never a candidate failure{heldTotal > 0 ? `, with ${fmtCr(heldTotal)} held and reversible` : ''}.
          </div>
          <button className="btn-ghost" onClick={() => nav('/support')}><LifeBuoy size={13} /> Open Support</button>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 14, marginBottom: 26 }}>
        {kpis.map((k) => <Kpi key={k.label} {...k} />)}
      </div>

      <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', marginBottom: 14, flexWrap: 'wrap', gap: 10 }}>
        <div>
          <div style={{ fontSize: 17, fontWeight: 700 }}>Live Opportunities <span style={{ color: '#9CA3AF', fontWeight: 600 }}>[{opportunities.length}]</span></div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Manage and track your active hiring cycles</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12.5, color: '#6B7280', fontWeight: 500 }}><CalendarDays size={14} /> August 2026</span>
          <button className="btn-primary" onClick={() => nav('/opportunities/new')}><Plus size={15} /> Create New</button>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
        {opportunities.map((o) => <OppCard key={o.id} opp={o} />)}
      </div>
    </>
  );
}

/* ── wallet-state banner (spec §06) — mirrors Billing's messaging in brief, dashboard form ── */
function WalletBanner({ w, nav }) {
  if (w.state === 'LOW_BALANCE') {
    return (
      <div className="banner warn">
        <AlertTriangle size={17} />
        <div style={{ flex: 1 }}>Low balance: <b>{fmtCr(w.available)} available</b> (threshold {fmtCr(w.lowBalanceThreshold)}). Top up to keep evaluations flowing.</div>
        <button className="btn-ghost" onClick={() => nav('/billing')}><Plus size={13} /> Top up</button>
      </div>
    );
  }
  if (w.state === 'ZERO') {
    return (
      <div className="banner warn">
        <AlertTriangle size={17} />
        <div style={{ flex: 1 }}>Zero balance — you stay active and can configure everything; new paid evaluations start after a top-up.</div>
        <button className="btn-ghost" onClick={() => nav('/billing')}><Plus size={13} /> Top up</button>
      </div>
    );
  }
  if (w.state === 'OVERDRAFT') {
    return (
      <div className="banner danger">
        <AlertTriangle size={17} />
        <div style={{ flex: 1 }}>Outstanding −{fmtCr(w.outstanding)}. New paid evaluations are paused; running ones will finish. Top-up clears the debt first.</div>
        <button className="btn-primary" style={{ background: '#DC2626' }} onClick={() => nav('/billing')}><Plus size={13} /> Top up</button>
      </div>
    );
  }
  if (w.state === 'BLOCKED_FOR_NEW_USAGE') {
    return (
      <div className="banner dark">
        <Snowflake size={17} />
        <div style={{ flex: 1 }}>New paid usage is blocked by Cuba Admin (wallet frozen). Contact support.</div>
        <button className="btn-ghost" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} onClick={() => nav('/support')}><LifeBuoy size={13} /> Contact support</button>
      </div>
    );
  }
  return null;
}

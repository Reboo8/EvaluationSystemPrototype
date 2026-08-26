import { useState, useMemo, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Users, Activity, FileText, ClipboardCheck, Mic, Video, AlertTriangle, Coins, ChevronRight, Snowflake, Pause, Play, Flame, Ban, ShieldAlert, Gauge, Check, X, Unlock, Layers, Info, Search, Briefcase, User, Building2, ArrowUpRight, Eye, FlaskConical, Bug, Undo2 } from 'lucide-react';
import { useApp, walletOf, canStartPaidWork, fmtCr, DEFAULTS, weightedScore, JOB_KINDS } from '../store.jsx';
import { ClientStatusBadge, WalletStateBadge, LedgerTypeBadge, ModuleStateBadge, PendingChip, Credits, useToast, useReasonGate, PermButton, PageHeader, Kpi, EmptyRow, Mono } from '../components/admin/ui.jsx';

/* ═══════════════════════════════════════════════════════════════════════════
   Usage — spec §08
   • Reporting: the 8 metrics per client (candidates, evaluations, resume analyses, attempts/completions,
     AI interviews + minutes, proctoring sessions, failed/aborted, credits consumed).
   • Drill-down: Client → Opportunity → Candidate → Service (URL: ?client=clX&opp=ID).
   • Safety controls: "the seatbelt, not the steering wheel" — max overdraft, wallet freeze, pause usage,
     spike flag, service-specific emergency disable, emergency suspension.
   ═══════════════════════════════════════════════════════════════════════════ */

const METRICS = [
  { key: 'candidates',          label: 'Candidates processed',  icon: Users },
  { key: 'evaluations',         label: 'Evaluations',           icon: Activity },
  { key: 'resumeAnalyses',      label: 'Resume analyses',       icon: FileText },
  { key: 'assessmentAttempts',  label: 'Assessment attempts',   icon: ClipboardCheck, pair: 'assessmentCompletions', pairLabel: 'completions' },
  { key: 'interviews',          label: 'AI interviews',         icon: Mic, minutes: 'interviewMinutes' },
  { key: 'proctoringSessions',  label: 'Proctoring sessions',   icon: Video },
  { key: 'failed',              label: 'Failed / aborted',      icon: AlertTriangle, danger: true },
  { key: 'creditsConsumed',     label: 'Credits consumed',      icon: Coins, credits: true },
];

const SPLIT = { 1: [1], 2: [0.62, 0.38], 3: [0.52, 0.31, 0.17] };
const GENERIC_NAMES = ['Aarav Patel', 'Ishita Bose', 'Neel Kulkarni', 'Ritu Agarwal', 'Sameer Joshi', 'Tara Krishnan', 'Vivaan Rao', 'Zoya Ahmed', 'Kabir Malhotra', 'Anika Sen'];
const STAGES = ['Cleared', 'AI interview', 'Assessment', 'Assessment', 'Resume gate'];
const num = (v) => (Number(v) || 0).toLocaleString('en-IN');
const isRealName = (s) => s && !/applicants?$/i.test(s);

/* Level 2 rows for a client */
function buildOpps(client, opportunities, ledger, failedJobs, overrides) {
  if (!client) return [];
  const own = opportunities.filter((o) => (o.clientId || 'cl1') === client.id);
  if (own.length) {
    return own.map((o) => ({ id: o.id, title: o.title, status: o.status, applied: o.funnel?.applied || 0, assessments: o.funnel?.assessment || 0, interviews: o.funnel?.interview || 0, cleared: o.cleared ?? o.funnel?.cleared ?? 0, real: true, opp: o }));
  }
  const u = client.usage || {};
  if (!u.candidates) return [];
  const known = []; const seen = new Set();
  [...ledger, ...failedJobs, ...overrides].filter((x) => x.clientId === client.id && x.oppId && x.oppTitle).forEach((x) => { if (!seen.has(x.oppId)) { seen.add(x.oppId); known.push({ id: x.oppId, title: x.oppTitle }); } });
  /* no invented titles: only opportunities with real evidence in the ledger / failed-jobs / overrides are listed */
  const list = known.slice(0, 3);
  if (!list.length) return [];
  const split = SPLIT[list.length] || SPLIT[1];
  return list.map((o, i) => ({
    ...o, status: client.status === 'ACTIVE' ? 'OPEN' : 'CLOSED', real: false,
    applied: Math.round(u.candidates * split[i]), assessments: Math.round(u.assessmentAttempts * split[i]),
    interviews: Math.round(u.interviews * split[i]), cleared: Math.round(u.evaluations * 0.22 * split[i]),
  }));
}
/* Level 3 rows for an opportunity */
function buildCands(client, opp, getCandidates, ledger, failedJobs, overrides) {
  if (!client || !opp) return [];
  /* one source of truth for the headline number: always recompute from sub-scores × the opportunity's live weights */
  if (opp.real) return getCandidates(opp.id).map((c) => ({ id: c.id, name: c.name, stage: 'Cleared', weighted: weightedScore(c, opp.opp?.assessment?.weights || []), clearedAt: c.clearedAt, real: true }));
  const names = []; const seen = new Set();
  [...ledger, ...failedJobs, ...overrides].filter((x) => x.clientId === client.id && x.oppId === opp.id && isRealName(x.candidate)).forEach((x) => { if (!seen.has(x.candidate)) { seen.add(x.candidate); names.push(x.candidate); } });
  const off = (opp.id.length * 3) % GENERIC_NAMES.length;
  const rotated = [...GENERIC_NAMES.slice(off), ...GENERIC_NAMES.slice(0, off)];
  rotated.forEach((nm) => { if (names.length < 5 && !seen.has(nm)) { seen.add(nm); names.push(nm); } });
  return names.map((nm, i) => ({ id: `${opp.id}-c${i}`, name: nm, stage: STAGES[i] || 'Resume gate', real: false }));
}

export default function AdminUsage() {
  const nav = useNavigate(); const loc = useLocation();
  const { clients, opportunities, getCandidates, ledger, failedJobs, overrides, rateCard, modules, notifications,
    setOverdraftLimit, freezeWallet, unfreezeWallet, pauseClientUsage, resumeClientUsage, acknowledgeSpike, pauseModule, unpauseModule, suspendClient, reinstateClient,
    reserveCredits, settleReserve, releaseReserve, recordUsage, reportFailedJob } = useApp();
  const [show, toastNode] = useToast();
  const [ask, gateNode] = useReasonGate();
  const params = new URLSearchParams(loc.search);
  const qClient = params.get('client'); const qOpp = params.get('opp');

  /* ── URL is the source of truth for client + opportunity (deep links: ?client=clX&opp=ID) ── */
  const ownerOfOpp = (oid) => (opportunities.find((o) => o.id === oid)?.clientId || (ledger.find((e) => e.oppId === oid) || failedJobs.find((j) => j.oppId === oid))?.clientId || null);
  const selId = qClient && clients.some((c) => c.id === qClient) ? qClient : (qOpp ? ownerOfOpp(qOpp) : null);
  const client = clients.find((c) => c.id === selId) || null;
  const setParams = (patch) => { const p = new URLSearchParams(loc.search); Object.entries(patch).forEach(([k, v]) => (v ? p.set(k, v) : p.delete(k))); const s = p.toString(); nav({ pathname: loc.pathname, search: s ? '?' + s : '' }, { replace: true }); };

  const oppRows = useMemo(() => buildOpps(client, opportunities, ledger, failedJobs, overrides), [client, opportunities, ledger, failedJobs, overrides]);
  const opp = oppRows.find((r) => r.id === qOpp) || null;
  const candRows = useMemo(() => buildCands(client, opp, getCandidates, ledger, failedJobs, overrides), [client, opp, ledger, failedJobs, overrides]); // eslint-disable-line react-hooks/exhaustive-deps
  const [candId, setCandId] = useState(null);
  useEffect(() => { setCandId(null); }, [selId, qOpp]);
  const cand = candRows.find((c) => c.id === candId) || null;

  /* ── live producer: reserve → settle / release, usage counters and the failed-jobs queue all need a call site (spec §04/§05/§08/§09) ── */
  const [simKey, setSimKey] = useState('');
  const [simHold, setSimHold] = useState(null);   // { reserveId, key, name, hold }
  const [simActual, setSimActual] = useState('');
  useEffect(() => { setSimKey(''); setSimHold(null); setSimActual(''); }, [candId, selId, qOpp]);

  /* per-candidate services from the ledger (trace: Client → Opportunity → Candidate → Module → Usage → Rate → Credits) */
  const servicesFor = (c) => (client && c ? ledger.filter((e) => e.clientId === client.id && e.candidate === c.name) : []);
  const consumedFor = (c) => { const es = servicesFor(c); const credits = es.filter((e) => e.credits < 0).reduce((a, e) => a + -e.credits, 0); const mods = Array.from(new Set(es.map((e) => e.module).filter(Boolean))); return { credits, mods, count: es.length }; };
  const expectedServices = (o) => { const keys = o?.real ? [...(o.opp?.assessment?.modules || []).map((m) => m.key), 'proctoring'] : ['resume', 'mcq', 'interview', 'proctoring']; return keys.map((k) => rateCard.find((r) => r.key === k)).filter(Boolean); };

  /* ── simulate one real evaluation against the live contract ── */
  const simRate = () => expectedServices(opp).find((r) => r.key === simKey) || null;
  const suggestedActual = (r) => (r.key === 'interview' ? Math.max(1, Math.round(r.credits * 0.925)) : r.credits);
  const simCtx = (r) => ({ oppId: opp.id, oppTitle: opp.title, candidate: cand.name, module: r.name, rate: `${r.credits} cr / ${String(r.unit).replace('per ', '')}` });
  const simStart = () => {
    const r = simRate(); if (!r || !client || !cand) return;
    const rid = reserveCredits(client.id, { ...simCtx(r), usage: 'hold before start', hold: r.credits });
    if (r.key !== 'proctoring' && r.key !== 'interview') recordUsage(client.id, { assessmentAttempts: 1 });
    setSimHold({ reserveId: rid, key: r.key, name: r.name, hold: r.credits });
    setSimActual(String(suggestedActual(r)));
    show(`RESERVE ${rid} — ${fmtCr(r.credits)} held for ${cand.name} · ${r.name}`);
  };
  const simSettle = () => {
    if (!simHold || !client || !cand) return;
    const actual = Math.max(0, Math.min(simHold.hold, Math.round(Number(simActual) || 0)));
    const minutes = simHold.key === 'interview' ? 14 + (cand.name.length % 9) : 0;
    settleReserve(client.id, simHold.reserveId, actual, {
      oppId: opp.id, oppTitle: opp.title, candidate: cand.name, module: simHold.name,
      usage: simHold.key === 'interview' ? `1 interview · ${minutes} min` : '1 attempt',
      rate: `${simHold.hold} cr / ${String(simRate()?.unit || 'per attempt').replace('per ', '')}`, hold: simHold.hold,
    });
    recordUsage(client.id, simHold.key === 'interview'
      ? { interviews: 1, interviewMinutes: minutes, evaluations: 1 }
      : simHold.key === 'proctoring' ? { proctoringSessions: 1 }
      : { assessmentCompletions: 1, evaluations: 1 });
    setSimHold(null); setSimActual('');
    show(`SETTLEMENT — ${actual} used · ${simHold.hold - actual} released${walletOf(client).balance - actual < 0 ? ' (overdraft: the running evaluation was not stopped)' : ''}`);
  };
  const simRelease = () => {
    if (!simHold || !client) return;
    releaseReserve(client.id, simHold.reserveId);
    setSimHold(null); setSimActual('');
    show(`Hold released — ${fmtCr(simHold.hold)} back to available, nothing consumed`);
  };
  const simFail = () => {
    const r = simRate(); if (!client || !cand) return;
    const kind = simHold?.key === 'interview' || r?.key === 'interview' ? 'AI_PROVIDER_FAILURE' : (simHold?.key || r?.key) === 'resume' ? 'RESUME_PARSE_FAILED' : 'STUCK_ASSESSMENT';
    reportFailedJob(client.id, kind, {
      oppId: opp.id, oppTitle: opp.title, candidate: cand.name, module: simHold?.name || r?.name || '—',
      detail: 'Simulated provider failure during the evaluation — credits held stay reversible',
      creditsHeld: simHold?.hold || 0,
    });
    recordUsage(client.id, { failed: 1 });
    show(`${JOB_KINDS[kind].label} raised — ${cand.name} joins the Needs Attention queue`);
  };

  /* ── totals + table ── */
  const totals = useMemo(() => clients.reduce((t, c) => { Object.keys(c.usage || {}).forEach((k) => { t[k] = (t[k] || 0) + (c.usage[k] || 0); }); return t; }, {}), [clients]);
  const [q, setQ] = useState('');
  const rows = clients.filter((c) => !q || [c.name, c.tenantId, c.industry].some((s) => (s || '').toLowerCase().includes(q.toLowerCase())));

  /* ── safety-control local state ── */
  const [odEdit, setOdEdit] = useState(false); const [odVal, setOdVal] = useState('');
  const [modKey, setModKey] = useState('');
  useEffect(() => { setOdEdit(false); setOdVal(client ? String(walletOf(client).overdraftLimit) : ''); }, [selId]); // eslint-disable-line react-hooks/exhaustive-deps
  const pausable = modules.filter((m) => (m.state === 'ACTIVE' || m.state === 'BETA') && !m.paused);
  const pausedMods = modules.filter((m) => m.paused);
  const modSel = pausable.find((m) => m.key === modKey) || pausable[0] || null;
  const w = client ? walletOf(client) : null;
  const spike = !!client?.flags?.includes('spike');
  const spikeNote = client ? notifications.find((x) => /usage spike/i.test(x.title || '') && (x.title || '').includes(client.name))?.detail : '';
  const gate = client ? canStartPaidWork(client) : null;

  return (
    <>
      <PageHeader title="Usage" sub="Exactly how each client is using Cuba — Client → Opportunity → Candidate → Service"
        right={<div style={{ position: 'relative' }}><Search size={14} color="#9CA3AF" style={{ position: 'absolute', left: 11, top: 11 }} /><input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Filter clients…" style={{ width: 240, paddingLeft: 32 }} /></div>} />

      {/* ── totals (spec §08 reporting) ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        {METRICS.map((m) => {
          const v = totals[m.key] || 0;
          const sub = m.pair ? `${num(totals[m.pair])} ${m.pairLabel} · ${totals[m.key] ? Math.round(((totals[m.pair] || 0) / totals[m.key]) * 100) : 0}%`
            : m.minutes ? `${num(totals[m.minutes])} min · ~${Math.round((totals[m.minutes] || 0) / 60)} h`
            : m.credits ? 'across all wallets · 1 credit = ₹10'
            : m.danger ? 'technical failure ≠ candidate failure' : `${clients.filter((c) => (c.usage?.[m.key] || 0) > 0).length} clients`;
          return <Kpi key={m.key} label={m.label} value={m.credits ? fmtCr(v) : num(v)} sub={sub} color={m.danger && v > 0 ? '#B91C1C' : undefined} size={24} bar={m.danger ? '#B91C1C' : m.credits ? '#6D28D9' : '#056FD4'} />;
        })}
      </div>

      {/* ── per-client table ── */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <div><div style={{ fontSize: 15, fontWeight: 700 }}>Usage by client</div><div style={{ fontSize: 12, color: '#9CA3AF' }}>Click a row to drill down. Account status and wallet state are separate — a client can be ACTIVE with zero credits.</div></div>
          <span style={{ fontSize: 12, color: '#6B7280' }}>{rows.length} of {clients.length} clients</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Client</th><th>Account</th><th>Wallet</th><th className="tnum">Candidates</th><th className="tnum">Evaluations</th><th className="tnum">Resume</th><th className="tnum">Attempts / compl.</th><th className="tnum">Interviews</th><th className="tnum">Proctoring</th><th className="tnum">Failed</th><th className="tnum">Credits</th><th>Flags</th></tr></thead>
            <tbody>
              {rows.length === 0 ? <EmptyRow cols={12} text="No clients match this filter." /> : rows.map((c) => {
                const u = c.usage || {}; const cw = walletOf(c); const on = c.id === selId;
                return (
                  <tr key={c.id} className="row" onClick={() => setParams({ client: c.id, opp: null })} style={on ? { background: '#F8FBFF' } : undefined}>
                    <td style={on ? { background: '#F8FBFF' } : undefined}><div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}>{on && <ChevronRight size={13} color="#056FD4" />}{c.name}</div><Mono>{c.tenantId}</Mono></td>
                    <td><ClientStatusBadge status={c.status} /></td>
                    <td><WalletStateBadge state={cw.state} /></td>
                    <td className="tnum">{num(u.candidates)}</td>
                    <td className="tnum">{num(u.evaluations)}</td>
                    <td className="tnum">{num(u.resumeAnalyses)}</td>
                    <td className="tnum">{num(u.assessmentAttempts)} <span style={{ color: '#9CA3AF' }}>/ {num(u.assessmentCompletions)}</span></td>
                    <td className="tnum">{num(u.interviews)} <span style={{ color: '#9CA3AF', fontSize: 12 }}>· {num(u.interviewMinutes)} min</span></td>
                    <td className="tnum">{num(u.proctoringSessions)}</td>
                    <td className="tnum" style={{ color: (u.failed || 0) >= 7 ? '#B91C1C' : undefined, fontWeight: (u.failed || 0) >= 7 ? 700 : 400 }}>{num(u.failed)}</td>
                    <td className="tnum" style={{ fontWeight: 600 }}>{fmtCr(u.creditsConsumed)}</td>
                    <td><div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                      {(c.flags || []).includes('spike') && <span className="chip" style={{ background: '#FEF3C7', color: '#B45309' }}><Flame size={12} /> Spike</span>}
                      {c.paused && <span className="chip" style={{ background: '#F3F4F6', color: '#6B7280' }}><Pause size={12} /> Paused</span>}
                      {cw.frozen && <span className="chip" style={{ background: '#14212A', color: '#fff' }}><Snowflake size={12} /> Frozen</span>}
                      {!(c.flags || []).length && !c.paused && !cw.frozen && <span style={{ color: '#D1D5DB' }}>—</span>}
                    </div></td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── drill-down + safety controls ── */}
      {!client ? (
        <div className="card" style={{ padding: 40, textAlign: 'center' }}>
          <Layers size={28} color="#CBD5E1" />
          <div style={{ fontSize: 15, fontWeight: 700, marginTop: 10 }}>Select a client to see the drill-down</div>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4 }}>Client → Opportunity → Candidate → Service, plus the safety controls for that client.</div>
        </div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 2fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
          {/* ── drill-down panel ── */}
          <div className="card fade-in" style={{ padding: '18px 20px' }}>
            {/* breadcrumb */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13, marginBottom: 14, flexWrap: 'wrap' }}>
              <Crumb icon={Building2} active={!opp} onClick={() => setParams({ client: client.id, opp: null })}>{client.name}</Crumb>
              {opp && <><ChevronRight size={14} color="#9CA3AF" /><Crumb icon={Briefcase} active={!cand} onClick={() => setCandId(null)}>{opp.title}</Crumb></>}
              {cand && <><ChevronRight size={14} color="#9CA3AF" /><Crumb icon={User} active>{cand.name}</Crumb></>}
              <span style={{ marginLeft: 'auto', fontSize: 12, color: '#056FD4', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={() => nav('/admin/clients/' + client.id)}>Client detail <ArrowUpRight size={13} /></span>
            </div>

            {/* Level 1 · client summary */}
            {!opp && (
              <>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Level 1 · Client</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{ fontSize: 17, fontWeight: 700 }}>{client.name}</span>
                  <ClientStatusBadge status={client.status} /><WalletStateBadge state={w.state} />
                  {client.paused && <span className="chip" style={{ background: '#F3F4F6', color: '#6B7280' }}><Pause size={12} /> Usage paused</span>}
                  {spike && <span className="chip" style={{ background: '#FEF3C7', color: '#B45309' }}><Flame size={12} /> Usage spike</span>}
                  <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 'auto' }}>{client.industry} · <Mono>{client.tenantId}</Mono> · since {client.since}</span>
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 14 }}>
                  {METRICS.map((m) => { const Icon = m.icon; const v = client.usage?.[m.key] || 0; return (
                    <div key={m.key} style={{ border: '1px solid #EEF2F7', borderRadius: 10, padding: '10px 12px', background: '#FAFBFD' }}>
                      <div style={{ fontSize: 10.5, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.5px', display: 'flex', alignItems: 'center', gap: 5 }}><Icon size={12} /> {m.label}</div>
                      <div className="tnum" style={{ fontSize: 18, fontWeight: 700, marginTop: 3, color: m.danger && v > 0 ? '#B91C1C' : '#14212A' }}>{m.credits ? fmtCr(v) : num(v)}</div>
                      <div style={{ fontSize: 11, color: '#9CA3AF' }}>{m.pair ? `${num(client.usage?.[m.pair])} ${m.pairLabel}` : m.minutes ? `${num(client.usage?.[m.minutes])} min` : m.credits ? `${fmtCr(w.available)} available` : ' '}</div>
                    </div>
                  ); })}
                </div>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12.5, padding: '10px 12px', borderRadius: 8, background: gate.ok ? '#F0FDF4' : '#FFFBEB', border: `1px solid ${gate.ok ? '#BBF7D0' : '#FDE68A'}`, color: gate.ok ? '#166534' : '#92400E', marginBottom: 16 }}>
                  {gate.ok ? <Check size={14} /> : <Info size={14} />}
                  <span><b>Next paid evaluation:</b> {gate.ok ? 'may start — wallet and account allow new usage.' : gate.reason} Running evaluations are never interrupted.</span>
                </div>

                {/* Level 2 · opportunities */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div className="eyebrow">Level 2 · Opportunities</div>
                  {oppRows.length > 0 && !oppRows[0].real && <span className="chip" style={{ background: '#F3F4F6', color: '#6B7280', fontSize: 11 }}>sample breakdown · derived from usage totals</span>}
                  {oppRows.length > 0 && oppRows[0].real && <span className="chip" style={{ background: '#EFF6FF', color: '#1E40AF', fontSize: 11 }}>live opportunities</span>}
                </div>
                <div style={{ border: '1px solid #EEF2F7', borderRadius: 10, overflow: 'hidden' }}>
                  <table>
                    <thead><tr><th>Opportunity</th><th>Status</th><th className="tnum">Applied</th><th className="tnum">Assessments</th><th className="tnum">Interviews</th><th className="tnum">Cleared</th><th></th></tr></thead>
                    <tbody>
                      {oppRows.length === 0 ? <EmptyRow cols={7} text="No usage yet — this client has not run any evaluation." /> : oppRows.map((o) => (
                        <tr key={o.id} className="row" onClick={() => setParams({ client: client.id, opp: o.id })}>
                          <td style={{ fontWeight: 600 }}>{o.title}<div><Mono>{o.id}</Mono></div></td>
                          <td><span className="badge" style={{ background: o.status === 'OPEN' ? '#DCFCE7' : '#F3F4F6', color: o.status === 'OPEN' ? '#15803D' : '#6B7280' }}>{o.status}</span></td>
                          <td className="tnum">{num(o.applied)}</td><td className="tnum">{num(o.assessments)}</td><td className="tnum">{num(o.interviews)}</td><td className="tnum" style={{ fontWeight: 600 }}>{num(o.cleared)}</td>
                          <td style={{ textAlign: 'right' }}><ChevronRight size={15} color="#9CA3AF" /></td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}

            {/* Level 3 · candidates */}
            {opp && !cand && (
              <>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Level 3 · Candidates</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{opp.title}</span>
                  <span className="badge" style={{ background: opp.status === 'OPEN' ? '#DCFCE7' : '#F3F4F6', color: opp.status === 'OPEN' ? '#15803D' : '#6B7280' }}>{opp.status}</span>
                  {!opp.real && <span className="chip" style={{ background: '#F3F4F6', color: '#6B7280', fontSize: 11 }}>sample breakdown</span>}
                  <span style={{ fontSize: 12, color: '#9CA3AF', marginLeft: 'auto' }}>{num(opp.applied)} applied · {num(opp.assessments)} assessed · {num(opp.interviews)} interviewed · {num(opp.cleared)} cleared</span>
                </div>
                <div style={{ border: '1px solid #EEF2F7', borderRadius: 10, overflow: 'hidden' }}>
                  <table>
                    <thead><tr><th>Candidate</th><th>Stage</th><th>Services consumed</th><th className="tnum">Credits</th><th></th></tr></thead>
                    <tbody>
                      {candRows.length === 0 ? <EmptyRow cols={5} text="No candidates on record for this opportunity." /> : candRows.map((c) => { const cons = consumedFor(c); return (
                        <tr key={c.id} className="row" onClick={() => setCandId(c.id)}>
                          <td><div style={{ fontWeight: 600 }}>{c.name}</div>{c.real && <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>weighted {c.weighted} · cleared {c.clearedAt}</div>}</td>
                          <td><span className="badge" style={{ background: c.stage === 'Cleared' ? '#DCFCE7' : c.stage === 'AI interview' ? '#EDE9FE' : c.stage === 'Assessment' ? '#EFF6FF' : '#F3F4F6', color: c.stage === 'Cleared' ? '#15803D' : c.stage === 'AI interview' ? '#6D28D9' : c.stage === 'Assessment' ? '#1E40AF' : '#6B7280' }}>{c.stage}</span></td>
                          <td style={{ fontSize: 12.5, color: cons.count ? '#374151' : '#9CA3AF' }}>{cons.count ? `${cons.mods.join(' · ')} (${cons.count} ledger ${cons.count === 1 ? 'entry' : 'entries'})` : '—'}</td>
                          <td className="tnum" style={{ fontWeight: 600, color: cons.credits ? '#14212A' : '#9CA3AF' }}>{cons.credits ? fmtCr(cons.credits) : '—'}</td>
                          <td style={{ textAlign: 'right' }}><ChevronRight size={15} color="#9CA3AF" /></td>
                        </tr>
                      ); })}
                    </tbody>
                  </table>
                </div>
                <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 8 }}>Services consumed are read from the immutable ledger where the candidate is named; "—" means no ledger entry names this candidate yet.</div>
              </>
            )}

            {/* Level 4 · services */}
            {cand && (
              <>
                <div className="eyebrow" style={{ marginBottom: 8 }}>Level 4 · Services</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginBottom: 12 }}>
                  <span style={{ fontSize: 16, fontWeight: 700 }}>{cand.name}</span>
                  <span style={{ fontSize: 12.5, color: '#6B7280' }}>{opp.title} · {client.name}</span>
                  {cand.real && <span className="chip" style={{ background: '#EFF6FF', color: '#1E40AF', fontSize: 11, cursor: 'pointer' }} onClick={() => nav('/admin/compliance?tab=provenance&cand=' + cand.id)}><Eye size={12} /> Provenance</span>}
                </div>
                {(() => { const es = servicesFor(cand); const cons = consumedFor(cand); return (
                  <>
                    <div style={{ border: '1px solid #EEF2F7', borderRadius: 10, overflow: 'hidden' }}>
                      <table>
                        <thead><tr><th>Module / service</th><th>Type</th><th>Usage</th><th>Rate</th><th className="tnum">Credits</th><th>Ledger</th></tr></thead>
                        <tbody>
                          {es.length === 0 ? <EmptyRow cols={6} text="No ledger entry names this candidate yet — expected services per rate card are listed below." /> : es.map((e) => (
                            <tr key={e.id}>
                              <td style={{ fontWeight: 600 }}>{e.module || '—'}</td>
                              <td><LedgerTypeBadge type={e.type} /></td>
                              <td style={{ fontSize: 12.5, color: '#374151' }}>{e.usage || e.reason || e.note || '—'}{e.hold ? <span style={{ color: '#9CA3AF' }}> · hold {e.hold} cr</span> : null}</td>
                              <td style={{ fontSize: 12.5 }}>{e.rate ? <>{e.rate}<PendingChip /></> : '—'}</td>
                              <td className="tnum"><Credits n={e.credits} /></td>
                              <td><Mono>{e.id}</Mono><div style={{ fontSize: 11, color: '#9CA3AF' }}>{e.when}</div></td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginTop: 10, color: '#374151' }}>
                      <span>Trace: <b>{client.name}</b> → <b>{opp.title}</b> → <b>{cand.name}</b> → Module → Usage → Rate → Credits</span>
                      <span>Net consumed: <b>{fmtCr(cons.credits)}</b></span>
                    </div>
                    <div className="eyebrow" style={{ margin: '16px 0 8px' }}>Expected services · rate card{cand.real && opp.real ? ' (from the opportunity’s assessment)' : ''}</div>
                    <div style={{ border: '1px solid #EEF2F7', borderRadius: 10, overflow: 'hidden' }}>
                      <table>
                        <thead><tr><th>Module</th><th>Unit</th><th className="tnum">Rate</th><th>Status</th></tr></thead>
                        <tbody>
                          {expectedServices(opp).length === 0 ? <EmptyRow cols={4} text="No paid modules configured." /> : expectedServices(opp).map((r) => { const posted = es.some((e) => (e.module || '').toLowerCase() === r.name.toLowerCase()); const m = modules.find((x) => x.key === r.key); return (
                            <tr key={r.key}>
                              <td style={{ fontWeight: 600 }}>{r.name} {m && <ModuleStateBadge state={m.state} />}{m?.paused && <span className="chip" style={{ background: '#FEE2E2', color: '#B91C1C', fontSize: 10.5, marginLeft: 6 }}>new attempts paused</span>}</td>
                              <td style={{ color: '#6B7280', fontSize: 12.5 }}>{r.unit}</td>
                              <td className="tnum">{r.credits} cr<PendingChip /></td>
                              <td style={{ fontSize: 12.5, color: posted ? '#15803D' : '#9CA3AF' }}>{posted ? 'posted to ledger' : 'not yet consumed'}</td>
                            </tr>
                          ); })}
                        </tbody>
                      </table>
                    </div>

                    {/* ── run one real evaluation so the ledger, the wallet holds, the 8 counters and the queue all move ── */}
                    <div className="card" style={{ padding: '14px 16px', marginTop: 16, background: '#FAFAFF', borderColor: '#E0E7FF' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                        <FlaskConical size={15} color="#6D28D9" />
                        <span style={{ fontSize: 14, fontWeight: 700 }}>Simulate an evaluation</span>
                        <span className="chip" style={{ background: '#EDE9FE', color: '#6D28D9', fontSize: 10.5 }}>operator tool</span>
                        <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#6B7280' }}>reserved now <b className="tnum">{fmtCr(w.reserved)}</b> · available <b className="tnum">{fmtCr(w.available)}</b></span>
                      </div>
                      <div style={{ fontSize: 12, color: '#6B7280', margin: '4px 0 12px' }}>
                        Runs the real contract against <b>{cand.name}</b>: RESERVE holds credits before the module starts, SETTLEMENT consumes the actual usage and releases the rest, and a running evaluation goes into OVERDRAFT rather than being stopped.
                      </div>

                      {!simHold ? (
                        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
                          <select className="input" value={simKey} onChange={(e) => setSimKey(e.target.value)} style={{ width: 'auto', minWidth: 210, padding: '7px 10px', fontSize: 12.5 }}>
                            <option value="">Choose a paid module…</option>
                            {expectedServices(opp).map((r) => <option key={r.key} value={r.key}>{r.name} — {r.credits} cr {r.unit}</option>)}
                          </select>
                          <PermButton action="usage.pause" className="btn-primary" style={{ padding: '7px 13px', fontSize: 12.5 }} disabled={!simKey} onClick={simStart}>Start module · hold {simKey ? simRate()?.credits : 0} cr</PermButton>
                          <PermButton action="usage.pause" style={{ padding: '7px 13px', fontSize: 12.5 }} disabled={!simKey} onClick={simFail}><Bug size={13} /> Simulate provider failure</PermButton>
                        </div>
                      ) : (
                        <>
                          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap', background: '#fff', border: '1px solid #FDE68A', borderRadius: 10, padding: '10px 14px' }}>
                            <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>RESERVE {simHold.reserveId}</span>
                            <span style={{ fontSize: 12.5 }}><b>{simHold.name}</b> running for {cand.name} · <b className="tnum">{fmtCr(simHold.hold)}</b> held</span>
                            <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 7, fontSize: 12.5 }}>
                              actual used
                              <input className="input tnum" type="number" min="0" max={simHold.hold} value={simActual} onChange={(e) => setSimActual(e.target.value)} style={{ width: 74, padding: '6px 8px', fontSize: 12.5 }} />
                              cr
                            </span>
                            <PermButton action="usage.pause" className="btn-success" style={{ padding: '7px 13px', fontSize: 12.5 }} onClick={simSettle}><Check size={13} /> Settle</PermButton>
                            <PermButton action="usage.pause" style={{ padding: '7px 13px', fontSize: 12.5 }} onClick={simRelease}><Undo2 size={13} /> Candidate abandoned · release</PermButton>
                            <PermButton action="usage.pause" style={{ padding: '7px 13px', fontSize: 12.5 }} onClick={simFail}><Bug size={13} /> Fail</PermButton>
                          </div>
                          <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 8 }}>
                            Settling {simActual || 0} of {simHold.hold} cr posts a SETTLEMENT reading “{Math.max(0, Math.min(simHold.hold, Math.round(Number(simActual) || 0)))} used · {Math.max(0, simHold.hold - Math.max(0, Math.min(simHold.hold, Math.round(Number(simActual) || 0))))} released”.
                            {w.balance - Math.max(0, Math.round(Number(simActual) || 0)) < 0 && <b style={{ color: '#B91C1C' }}> This client cannot cover it — the entry will post as OVERDRAFT and the evaluation still finishes.</b>}
                          </div>
                        </>
                      )}
                    </div>
                  </>
                ); })()}
              </>
            )}
          </div>

          {/* ── safety controls ── */}
          <div className="card fade-in" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}><ShieldAlert size={16} color="#B45309" /><span style={{ fontSize: 15, fontWeight: 700 }}>Safety controls</span></div>
            <div style={{ fontSize: 12, color: '#6B7280', marginBottom: 6 }}>“Seatbelt, not steering wheel” — these protect the platform; they never micromanage normal hiring or stop a running evaluation.</div>
            <div style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12, color: '#374151', marginBottom: 4 }}><b>{client.name}</b> <ClientStatusBadge status={client.status} /> <WalletStateBadge state={w.state} /></div>

            {/* 1 · max overdraft */}
            <Control icon={Gauge} title="Maximum overdraft" desc="Governs whether NEW paid work may start when available credits run out. Never terminates a running evaluation.">
              <span className="tnum" style={{ fontSize: 13, fontWeight: 700 }}>{fmtCr(w.overdraftLimit)}</span>{w.overdraftLimit === DEFAULTS.overdraftLimit && <PendingChip />}
              {!odEdit ? (
                <PermButton action="wallet.overdraft" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => { setOdVal(String(w.overdraftLimit)); setOdEdit(true); }}>Change</PermButton>
              ) : (
                <>
                  <input className="input" type="number" min="0" step="100" value={odVal} onChange={(e) => setOdVal(e.target.value)} style={{ width: 110, padding: '6px 10px', fontSize: 12.5 }} />
                  <button className="btn-primary" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => ask({ action: 'wallet.overdraft', title: `Change overdraft limit — ${client.name}`, confirmLabel: 'Apply limit', body: `${fmtCr(w.overdraftLimit)} → ${fmtCr(Number(odVal) || 0)}. New paid work may start only while available − cost ≥ −limit.` }, (reason) => { setOverdraftLimit(client.id, Number(odVal) || 0, reason); setOdEdit(false); show(`Overdraft limit set to ${fmtCr(Number(odVal) || 0)}`); })}><Check size={13} /> Apply</button>
                  <button className="btn-ghost" style={{ padding: '6px 10px', fontSize: 12.5 }} onClick={() => setOdEdit(false)}><X size={13} /></button>
                </>
              )}
            </Control>

            {/* 2 · wallet freeze */}
            <Control icon={Snowflake} title={w.frozen ? 'Wallet frozen' : 'Wallet freeze'} desc="Blocks all NEW paid usage on this wallet while balances stay intact. Running work completes and settles normally." tone={w.frozen ? 'warn' : undefined}>
              {w.frozen ? (
                <PermButton action="wallet.freeze" className="btn-success" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => ask({ action: 'wallet.freeze', title: `Unfreeze wallet — ${client.name}`, confirmLabel: 'Unfreeze' }, () => { unfreezeWallet(client.id); show('Wallet unfrozen — new paid usage allowed'); })}><Unlock size={13} /> Unfreeze</PermButton>
              ) : (
                <PermButton action="wallet.freeze" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => ask({ action: 'wallet.freeze', title: `Freeze wallet — ${client.name}`, confirmLabel: 'Freeze wallet', danger: true, body: 'Wallet state becomes BLOCKED_FOR_NEW_USAGE. Account status is unaffected.' }, (reason) => { freezeWallet(client.id, reason); show('Wallet frozen'); })}><Snowflake size={13} /> Freeze</PermButton>
              )}
              <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>balance {fmtCr(w.balance)} · reserved {fmtCr(w.reserved)}</span>
            </Control>

            {/* 3 · pause usage */}
            <Control icon={client.paused ? Play : Pause} title={client.paused ? 'Client usage paused' : 'Temporarily pause client usage'} desc="Stops the NEXT evaluation from starting for this client (e.g. during a dispute). In-progress candidates finish safely." tone={client.paused ? 'warn' : undefined}>
              {client.paused ? (
                <PermButton action="usage.pause" className="btn-success" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => { resumeClientUsage(client.id); show('Client usage resumed'); }}><Play size={13} /> Resume usage</PermButton>
              ) : (
                <PermButton action="usage.pause" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => ask({ action: 'usage.pause', title: `Pause usage — ${client.name}`, confirmLabel: 'Pause usage', body: 'New evaluations will not start until resumed. The client sees "Usage temporarily paused by Cuba Admin".' }, (reason) => { pauseClientUsage(client.id, reason); show('Client usage paused'); })}><Pause size={13} /> Pause usage</PermButton>
              )}
            </Control>

            {/* 4 · spike */}
            <Control icon={Flame} title="Suspicious usage spike" desc="Auto-detected when volume jumps against the client’s 7-day average. A flag is informational — acknowledge after review." tone={spike ? 'warn' : undefined}>
              {spike ? (
                <>
                  <span className="chip" style={{ background: '#FEF3C7', color: '#B45309' }}><Flame size={12} /> Flagged</span>
                  <PermButton action="usage.pause" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => { acknowledgeSpike(client.id); show('Spike acknowledged — flag cleared, audit entry written'); }}><Check size={13} /> Acknowledge</PermButton>
                  {spikeNote && <div style={{ flexBasis: '100%', fontSize: 11.5, color: '#92400E' }}>{spikeNote}</div>}
                </>
              ) : <span className="chip" style={{ background: '#DCFCE7', color: '#15803D' }}><Check size={12} /> No spike detected</span>}
            </Control>

            {/* 5 · service-specific emergency disable */}
            <Control icon={Ban} title="Service-specific emergency disable" desc="Platform-wide: pauses NEW attempts of one module for every client (e.g. provider outage). Running attempts finish; the module stays in its state.">
              {pausable.length ? (
                <>
                  <select className="input" value={modSel?.key || ''} onChange={(e) => setModKey(e.target.value)} style={{ width: 170, padding: '6px 10px', fontSize: 12.5 }}>
                    {pausable.map((m) => <option key={m.key} value={m.key}>{m.name} · {m.state}</option>)}
                  </select>
                  <PermButton action="module.emergency" style={{ padding: '6px 12px', fontSize: 12.5, color: '#B91C1C' }} onClick={() => modSel && ask({ action: 'module.emergency', title: `Emergency pause — ${modSel.name}`, confirmLabel: 'Pause new attempts', danger: true, body: 'Applies to all clients. Existing attempts are not interrupted; a CRITICAL platform notification is raised.' }, (reason) => { pauseModule(modSel.key, reason); show(`${modSel.name} paused for new attempts`); })}><Ban size={13} /> Pause new attempts</PermButton>
                </>
              ) : <span style={{ fontSize: 12.5, color: '#9CA3AF' }}>No pausable modules.</span>}
              {pausedMods.length > 0 && (
                <div style={{ flexBasis: '100%', display: 'flex', flexDirection: 'column', gap: 6, marginTop: 4 }}>
                  {pausedMods.map((m) => (
                    <div key={m.key} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, background: '#FEF2F2', border: '1px solid #FCA5A5', borderRadius: 8, padding: '6px 10px' }}>
                      <AlertTriangle size={13} color="#B91C1C" /><span style={{ flex: 1 }}><b>{m.name}</b> — new attempts paused</span>
                      <PermButton action="module.emergency" style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => ask({ action: 'module.emergency', title: `Lift emergency pause — ${m.name}`, confirmLabel: 'Lift pause' }, () => { unpauseModule(m.key); show(`${m.name} accepting new attempts again`); })}>Lift pause</PermButton>
                    </div>
                  ))}
                </div>
              )}
            </Control>

            {/* 6 · emergency suspension */}
            <div style={{ padding: '12px 0 0' }}>
              <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
                <span style={{ width: 30, height: 30, borderRadius: 8, background: '#FEE2E2', color: '#B91C1C', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><ShieldAlert size={15} /></span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 13, fontWeight: 700 }}>{client.status === 'SUSPENDED' ? 'Client suspended' : 'Emergency client suspension'}</div>
                  <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>Account-level block for abuse, security or commercial reasons. Data preserved; new activity restricted; reversible via reinstate.{client.statusReason && client.status === 'SUSPENDED' ? ` Reason: ${client.statusReason}.` : ''}</div>
                  <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>
                    {client.status === 'SUSPENDED' ? (
                      <PermButton action="client.reinstate" className="btn-success" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => { reinstateClient(client.id); show(`${client.name} reinstated`); }}><Play size={13} /> Reinstate</PermButton>
                    ) : client.status === 'ACTIVE' ? (
                      <PermButton action="client.suspend" className="btn-primary" style={{ padding: '6px 12px', fontSize: 12.5, background: '#DC2626' }} onClick={() => ask({ action: 'client.suspend', title: `Suspend ${client.name}`, confirmLabel: 'Suspend client', danger: true, body: 'Suspension is an ACCOUNT status; the wallet keeps its own state. Running candidate evaluations complete safely.' }, (reason) => { suspendClient(client.id, reason); show(`${client.name} suspended`); })}><ShieldAlert size={13} /> Suspend client</PermButton>
                    ) : <span style={{ fontSize: 12.5, color: '#9CA3AF' }}>Not applicable while <ClientStatusBadge status={client.status} /></span>}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {gateNode}
      {toastNode}
    </>
  );
}

/* ───────────── local helpers ───────────── */
function Crumb({ icon: Icon, active, onClick, children }) {
  return (
    <span onClick={active ? undefined : onClick} style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontWeight: active ? 700 : 600, color: active ? '#14212A' : '#056FD4', cursor: active ? 'default' : 'pointer' }}>
      <Icon size={14} /> {children}
    </span>
  );
}
function Control({ icon: Icon, title, desc, children, tone }) {
  const col = tone === 'danger' ? '#B91C1C' : tone === 'warn' ? '#B45309' : '#056FD4';
  const bg = tone === 'danger' ? '#FEE2E2' : tone === 'warn' ? '#FEF3C7' : '#EFF6FF';
  return (
    <div style={{ padding: '12px 0', borderBottom: '1px solid #F3F4F6' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <span style={{ width: 30, height: 30, borderRadius: 8, background: bg, color: col, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={15} /></span>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontSize: 13, fontWeight: 700 }}>{title}</div>
          <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 2 }}>{desc}</div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginTop: 8 }}>{children}</div>
        </div>
      </div>
    </div>
  );
}

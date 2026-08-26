import { useMemo, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowUpRight, ArrowDownRight, Activity, Users, Plug, CircleDollarSign, Coins, AlertTriangle, Building2, TrendingUp, Download, Radio } from 'lucide-react';
import { useApp, walletOf, fmtCr, fmtMoney, CURRENCY } from '../store.jsx';
import { PageHeader, Kpi, EmptyRow, ClientStatusBadge, WalletStateBadge, PendingChip, Mono, useToast } from '../components/admin/ui.jsx';

/* ═══════════════════════════════════════════════════════════════════════════
   Analytics — spec §13: Business · Usage · Client health · Platform trends.
   Charts are inline SVG (viewBox + width 100%), no chart libraries; everything is computed from the store.
   ═══════════════════════════════════════════════════════════════════════════ */

const kf = (v) => { const n = Number(v) || 0; return n >= 1000 ? (n / 1000).toFixed(n >= 10000 ? 0 : 1) + 'k' : String(n); };
const lakh = (v) => { const n = Number(v) || 0; return n >= 100000 ? '₹' + (n / 100000).toFixed(1) + 'L' : fmtMoney(n); };
const num = (v) => (Number(v) || 0).toLocaleString('en-IN');
const csvCell = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';
const RANGES = [3, 6];

const HEALTH = {
  'Negative':          { bg: '#FEE2E2', fg: '#B91C1C', rank: 0, why: 'wallet below zero — new paid evaluations blocked until top-up' },
  'Repeated failures': { bg: '#FFEDD5', fg: '#C2410C', rank: 1, why: '≥ 7 failed / aborted evaluations — check provider health and failed-jobs queue' },
  'Low credits':       { bg: '#FEF3C7', fg: '#B45309', rank: 2, why: 'available credits at or below threshold — nudge a top-up' },
  'High usage':        { bg: '#EDE9FE', fg: '#6D28D9', rank: 3, why: 'spike flag or very high consumption — confirm it is expected' },
  'Inactive':          { bg: '#F3F4F6', fg: '#6B7280', rank: 4, why: 'not ACTIVE or no evaluations yet' },
  'Healthy':           { bg: '#DCFCE7', fg: '#15803D', rank: 5, why: 'funded, active, no repeated failures' },
};
function healthOf(c) {
  const w = walletOf(c); const u = c.usage || {}; const out = [];
  if (c.status !== 'ACTIVE' || !(u.candidates > 0)) out.push('Inactive');
  if (w.state === 'OVERDRAFT') out.push('Negative');
  if ((u.failed || 0) >= 7) out.push('Repeated failures');
  if (w.state === 'LOW_BALANCE' || w.state === 'ZERO') out.push('Low credits');
  if ((c.flags || []).includes('spike') || (u.creditsConsumed || 0) >= 100000) out.push('High usage');
  if (!out.length) out.push('Healthy');
  return out.sort((a, b) => HEALTH[a].rank - HEALTH[b].rank);
}
const INT_STATUS = { CONNECTED: ['Connected', '#DCFCE7', '#15803D'], DEGRADED: ['Degraded', '#FEF3C7', '#B45309'], NOT_CONFIGURED: ['Not configured', '#F3F4F6', '#6B7280'], DISCONNECTED: ['Disconnected', '#FEE2E2', '#B91C1C'] };

export default function AdminAnalytics() {
  const nav = useNavigate();
  const { clients, usageSeries: raw, aggregates: ag, integrations, failedJobs, ledger, payments } = useApp();
  const [show, toastNode] = useToast();
  const [range, setRange] = useState(6);

  /* Anything that happens while this session is open lands in the CURRENT month's bucket, so the
     last bar actually moves when an operator records a payment, grants credits or runs an evaluation. */
  const base = useRef(null);
  if (base.current === null) {
    base.current = {
      ledgerIds: new Set(ledger.map((e) => e.id)),
      paymentIds: new Set(payments.map((p) => p.id)),
      candidates: ag.totalCandidates, interviews: ag.totalInterviews, failed: ag.totalFailed,
    };
  }
  const newLedger = ledger.filter((e) => !base.current.ledgerIds.has(e.id));
  const newPayments = payments.filter((p) => !base.current.paymentIds.has(p.id) && p.status === 'SUCCEEDED');
  const live = {
    creditsSold: newLedger.filter((e) => e.type === 'PURCHASE' || e.type === 'ADMIN_GRANT').reduce((a, e) => a + e.credits, 0),
    creditsConsumed: newLedger.filter((e) => ['CONSUMPTION', 'SETTLEMENT', 'OVERDRAFT'].includes(e.type)).reduce((a, e) => a - e.credits, 0),
    revenue: newPayments.reduce((a, p) => a + (p.amount || 0), 0),
    candidates: Math.max(0, ag.totalCandidates - base.current.candidates),
    interviews: Math.max(0, ag.totalInterviews - base.current.interviews),
    failures: Math.max(0, ag.totalFailed - base.current.failed),
  };
  const liveTotal = Object.values(live).reduce((a, v) => a + v, 0);
  /* overlay the live delta on the latest bucket, then trim to the selected range */
  const bump = (arr, delta) => { const out = [...(arr || [])]; if (out.length) out[out.length - 1] = (out[out.length - 1] || 0) + delta; return out.slice(-range); };
  const s = {
    months: (raw.months || []).slice(-range),
    creditsSold: bump(raw.creditsSold, live.creditsSold),
    creditsConsumed: bump(raw.creditsConsumed, live.creditsConsumed),
    revenue: bump(raw.revenue, live.revenue),
    candidates: bump(raw.candidates, live.candidates),
    interviews: bump(raw.interviews, live.interviews),
    failures: bump(raw.failures, live.failures),
  };
  const months = s.months;
  const active = clients.filter((c) => c.status === 'ACTIVE');

  const exportCsv = () => {
    const head = ['Month', 'Credits sold', 'Credits consumed', 'Revenue (INR)', 'Candidates', 'AI interviews', 'Failures'];
    const rows = months.map((m, i) => [m + ' 2026', s.creditsSold[i], s.creditsConsumed[i], s.revenue[i], s.candidates[i], s.interviews[i], s.failures[i]]);
    const csv = [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
    try {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const el = document.createElement('a'); el.href = url; el.download = `cuba-analytics-${range}mo.csv`; document.body.appendChild(el); el.click(); el.remove(); URL.revokeObjectURL(url);
    } catch { /* download blocked */ }
    show(`Analytics exported · ${rows.length} months`);
  };
  const arpc = active.length ? Math.round(ag.revenue / active.length) : 0;
  const sumU = (k) => clients.reduce((a, c) => a + (c.usage?.[k] || 0), 0);

  const health = useMemo(() => clients.map((c) => ({ c, w: walletOf(c), labels: healthOf(c) })).sort((a, b) => HEALTH[a.labels[0]].rank - HEALTH[b.labels[0]].rank || (b.c.usage?.creditsConsumed || 0) - (a.c.usage?.creditsConsumed || 0)), [clients]);
  const healthCounts = useMemo(() => health.reduce((m, h) => { m[h.labels[0]] = (m[h.labels[0]] || 0) + 1; return m; }, {}), [health]);

  const withHealth = integrations.filter((i) => i.health);
  const intCounts = integrations.reduce((m, i) => { m[i.status] = (m[i.status] || 0) + 1; return m; }, {});
  const avgLatency = withHealth.length ? Math.round(withHealth.reduce((a, i) => a + (i.health.latencyMs || 0), 0) / withHealth.length) : 0;
  const avgError = withHealth.length ? (withHealth.reduce((a, i) => a + (i.health.errorRate || 0), 0) / withHealth.length) : 0;
  const totalCost = withHealth.reduce((a, i) => a + (i.health.cost || 0), 0);
  const topCost = [...withHealth].sort((a, b) => (b.health.cost || 0) - (a.health.cost || 0)).slice(0, 5);
  const failRate = months.map((_, i) => (s.candidates[i] ? (s.failures[i] / s.candidates[i]) * 100 : 0));
  const openJobs = failedJobs.filter((j) => j.status === 'OPEN').length;

  return (
    <>
      {toastNode}
      <PageHeader title="Analytics" sub="Business · Usage · Client health · Platform trends" right={<>
        <span style={{ fontSize: 12, color: '#9CA3AF', alignSelf: 'center', display: 'inline-flex', alignItems: 'center', gap: 6 }}><Activity size={13} /> {months[0]}–{months[months.length - 1]} 2026</span>
        <div style={{ display: 'flex', gap: 6 }}>{RANGES.map((r) => <button key={r} className={'filter-btn' + (range === r ? ' active' : '')} onClick={() => setRange(r)}>{r} mo</button>)}</div>
        <button className="btn-ghost" onClick={exportCsv}><Download size={15} /> Export CSV</button>
      </>} />

      {liveTotal > 0 && (
        <div className="banner info" style={{ marginBottom: 16 }}>
          <Radio size={16} style={{ flexShrink: 0 }} />
          <div style={{ flex: 1 }}>
            <b>This session has moved {months[months.length - 1]}.</b>{' '}
            {[live.creditsSold && `+${num(live.creditsSold)} cr sold`, live.creditsConsumed && `${num(live.creditsConsumed)} cr consumed`, live.revenue && `${fmtMoney(live.revenue)} collected`, live.candidates && `${num(live.candidates)} candidates`, live.interviews && `${num(live.interviews)} interviews`, live.failures && `${num(live.failures)} failures`].filter(Boolean).join(' · ')}{' '}
            — folded into the latest bucket of every chart below.
          </div>
        </div>
      )}

      {/* ── Business ── */}
      <SectionTitle icon={CircleDollarSign} title="Business" sub="Clients, revenue, credits sold, outstanding balances" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 22 }}>
        <Kpi label="Revenue collected" value={fmtMoney(ag.revenue)} sub="succeeded payments · money domain" size={22} bar="#15803D" />
        <Kpi label="Credits sold" value={fmtCr(ag.creditsSold)} sub={<>PURCHASE ledger entries · 1 cr = ₹{CURRENCY.perCredit}<PendingChip /></>} size={22} bar="#056FD4" />
        <Kpi label="Outstanding balances" value={fmtCr(ag.outstanding)} sub={`${ag.negative.length} negative wallet${ag.negative.length === 1 ? '' : 's'} · platform-covered shortfall`} color={ag.outstanding > 0 ? '#B91C1C' : undefined} size={22} bar={ag.outstanding > 0 ? '#B91C1C' : '#E2E8F0'} />
        <Kpi label="Active clients" value={num(active.length)} sub={`${clients.length} total · ${clients.filter((c) => c.status === 'INVITE_PENDING').length} invite pending`} size={22} bar="#056FD4" />
        <Kpi label="ARPC" value={fmtMoney(arpc)} sub="revenue ÷ active clients" size={22} bar="#6D28D9" />
      </div>

      {/* ── Usage ── */}
      <SectionTitle icon={Activity} title="Usage" sub="Candidates, assessments, interviews, proctoring, credits consumed" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 14 }}>
        <Kpi label="Candidates" value={num(ag.totalCandidates)} sub={`${num(sumU('resumeAnalyses'))} resume analyses`} size={22} />
        <Kpi label="Assessment attempts" value={num(sumU('assessmentAttempts'))} sub={`${num(sumU('assessmentCompletions'))} completed`} size={22} />
        <Kpi label="AI interviews" value={num(ag.totalInterviews)} sub={`${num(sumU('interviewMinutes'))} min · ~${Math.round(sumU('interviewMinutes') / 60)} h`} size={22} />
        <Kpi label="Proctoring sessions" value={num(ag.totalProctoring)} sub={`${num(ag.totalFailed)} failed / aborted`} size={22} />
        <Kpi label="Credits consumed" value={fmtCr(ag.creditsConsumed)} sub={<>lifetime per-client counters — not the same window as the ledger above<PendingChip>seed · not ledger-derived</PendingChip></>} size={22} bar="#6D28D9" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14, marginBottom: 22 }}>
        <ChartCard icon={Coins} title="Credits sold vs consumed" sub="per month · credits" months={months} kind="bars" fmt={kf}
          series={[{ label: 'Credits sold', values: s.creditsSold, color: '#056FD4' }, { label: 'Credits consumed', values: s.creditsConsumed, color: '#6D28D9' }]} />
        <ChartCard icon={CircleDollarSign} title="Revenue" sub="₹ collected per month" months={months} kind="bars" fmt={lakh}
          series={[{ label: 'Revenue (₹)', values: s.revenue, color: '#15803D' }]} />
        <ChartCard icon={Users} title="Candidates & interviews" sub="per month · each line on its own scale" months={months} kind="line" fmt={kf}
          series={[{ label: 'Candidates', values: s.candidates, color: '#056FD4' }, { label: 'AI interviews', values: s.interviews, color: '#6D28D9' }]} />
        <ChartCard icon={AlertTriangle} title="Failures" sub="failed / aborted evaluations per month" months={months} kind="bars" fmt={(v) => num(v)} invert
          series={[{ label: 'Failures', values: s.failures, color: '#B91C1C' }]} />
      </div>

      {/* ── Client health + Platform trends ── */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 18, alignItems: 'start' }}>
        <div>
          <SectionTitle icon={Building2} title="Client health" sub="Low credits, negative wallets, inactive / high-usage clients, repeated failures" />
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '12px 18px', display: 'flex', gap: 8, flexWrap: 'wrap', borderBottom: '1px solid #F3F4F6' }}>
              {Object.keys(HEALTH).map((k) => <span key={k} className="chip" style={{ background: HEALTH[k].bg, color: HEALTH[k].fg, opacity: healthCounts[k] ? 1 : 0.45 }}>{k} <b>{healthCounts[k] || 0}</b></span>)}
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>Client</th><th>Account</th><th>Wallet</th><th className="tnum">Credits consumed</th><th className="tnum">Evaluations</th><th className="tnum">Failed</th><th>Health</th></tr></thead>
                <tbody>
                  {health.length === 0 ? <EmptyRow cols={7} text="No clients yet." /> : health.map(({ c, w, labels }) => { const h = HEALTH[labels[0]]; const u = c.usage || {}; return (
                    <tr key={c.id} className="row" onClick={() => nav('/admin/clients/' + c.id)} title={h.why}>
                      <td><div style={{ fontWeight: 600 }}>{c.name}</div><Mono>{c.tenantId}</Mono></td>
                      <td><ClientStatusBadge status={c.status} /></td>
                      <td><WalletStateBadge state={w.state} /></td>
                      <td className="tnum" style={{ fontWeight: 600 }}>{fmtCr(u.creditsConsumed)}</td>
                      <td className="tnum">{num(u.evaluations)}</td>
                      <td className="tnum" style={{ color: (u.failed || 0) >= 7 ? '#B91C1C' : undefined, fontWeight: (u.failed || 0) >= 7 ? 700 : 400 }}>{num(u.failed)}</td>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                          <span className="badge" style={{ background: h.bg, color: h.fg }}>{labels[0]}</span>
                          {labels.slice(1).map((l) => <span key={l} style={{ fontSize: 11, color: HEALTH[l].fg }}>+ {l}</span>)}
                          <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#056FD4', fontWeight: 600, whiteSpace: 'nowrap' }} onClick={(e) => { e.stopPropagation(); nav('/admin/usage?client=' + c.id); }}>usage →</span>
                        </div>
                      </td>
                    </tr>
                  ); })}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        <div>
          <SectionTitle icon={TrendingUp} title="Platform trends" sub="Running jobs, failures, queues, incidents, provider health & cost" />
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginBottom: 14 }}>
              <Mini label="Running" value={ag.runningJobs} />
              <Mini label="Queued" value={ag.queued} />
              <Mini label="Open failures" value={openJobs} color={openJobs ? '#B91C1C' : undefined} />
              <Mini label="Incidents" value={ag.incidents} color={ag.incidents ? '#B45309' : undefined} />
            </div>

            <div className="eyebrow" style={{ marginBottom: 6 }}>Failure rate · failures ÷ candidates</div>
            <div style={{ display: 'flex', alignItems: 'flex-end', gap: 12, marginBottom: 14 }}>
              <div className="spark" style={{ flex: 1 }}>{failRate.map((r, i) => { const max = Math.max(...failRate, 0.01); return <span key={i} className={i === failRate.length - 1 ? 'last' : ''} style={{ height: `${Math.max(6, (r / max) * 100)}%`, background: i === failRate.length - 1 ? '#B91C1C' : '#FECACA' }} title={`${months[i]} · ${r.toFixed(2)}%`} />; })}</div>
              <div style={{ textAlign: 'right' }}><div className="tnum" style={{ fontSize: 18, fontWeight: 700 }}>{failRate[failRate.length - 1].toFixed(2)}%</div><Delta cur={failRate[failRate.length - 1]} prev={failRate[failRate.length - 2]} invert label={months[months.length - 2]} /></div>
            </div>

            <div className="eyebrow" style={{ marginBottom: 6 }}>Integrations health</div>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 10 }}>
              {Object.keys(INT_STATUS).map((k) => { const [l, bg, fg] = INT_STATUS[k]; return <span key={k} className="chip" style={{ background: bg, color: fg, opacity: intCounts[k] ? 1 : 0.45 }}>{l} <b>{intCounts[k] || 0}</b></span>; })}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 8, marginBottom: 14 }}>
              <Mini label="Avg latency" value={`${num(avgLatency)} ms`} color={avgLatency > 800 ? '#B45309' : undefined} />
              <Mini label="Avg error rate" value={`${avgError.toFixed(1)}%`} color={avgError > 2 ? '#B45309' : undefined} />
              <Mini label="Provider cost / mo" value={lakh(totalCost)} />
            </div>
            {ag.degradedIntegrations.length > 0 && (
              <div className="banner warn" style={{ marginBottom: 12, padding: '8px 12px', fontSize: 12 }}><AlertTriangle size={14} /> <span>{ag.degradedIntegrations.map((i) => i.name).join(', ')} degraded — <b style={{ cursor: 'pointer' }} onClick={() => nav('/admin/platform?tab=integrations')}>review integrations →</b></span></div>
            )}

            <div className="eyebrow" style={{ marginBottom: 6 }}>Top cost providers</div>
            {topCost.length === 0 ? <div style={{ fontSize: 12.5, color: '#9CA3AF', padding: '10px 0' }}>No provider usage recorded.</div> : topCost.map((i) => { const pct = totalCost ? (i.health.cost / totalCost) * 100 : 0; const [, , fg] = INT_STATUS[i.status] || INT_STATUS.CONNECTED; return (
              <div key={i.id} style={{ marginBottom: 8 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 3 }}>
                  <span style={{ fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 6 }}><Plug size={12} color={fg} /> {i.name} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>· {i.category}</span></span>
                  <span className="tnum" style={{ fontWeight: 600 }}>{fmtMoney(i.health.cost)} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>({pct.toFixed(0)}%)</span></span>
                </div>
                <div className="progress-track"><div style={{ width: `${pct}%`, height: '100%', background: i.status === 'DEGRADED' ? '#F59E0B' : '#056FD4', borderRadius: 10 }} /></div>
                <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }}>{i.health.usage} · {i.health.latencyMs} ms · {i.health.errorRate}% errors</div>
              </div>
            ); })}
          </div>
        </div>
      </div>
    </>
  );
}

/* ───────────── local helpers ───────────── */
function SectionTitle({ icon: Icon, title, sub }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 10 }}>
      <span style={{ width: 28, height: 28, borderRadius: 8, background: '#EFF6FF', color: '#056FD4', display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}><Icon size={15} /></span>
      <div><div style={{ fontSize: 15, fontWeight: 700 }}>{title}</div>{sub && <div style={{ fontSize: 12, color: '#9CA3AF' }}>{sub}</div>}</div>
    </div>
  );
}
function Mini({ label, value, color }) {
  return <div style={{ border: '1px solid #EEF2F7', borderRadius: 10, padding: '8px 10px', background: '#FAFBFD' }}><div className="eyebrow" style={{ fontSize: 9.5 }}>{label}</div><div className="tnum" style={{ fontSize: 16, fontWeight: 700, marginTop: 2, color: color || '#14212A' }}>{value}</div></div>;
}
function Delta({ cur, prev, invert, label }) {
  const d = prev ? ((cur - prev) / prev) * 100 : 0;
  const good = invert ? d <= 0 : d >= 0;
  return <span style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 700, color: good ? '#15803D' : '#B91C1C', whiteSpace: 'nowrap' }}>{d >= 0 ? <ArrowUpRight size={13} /> : <ArrowDownRight size={13} />}{Math.abs(d).toFixed(1)}% vs {label}</span>;
}
function ChartCard({ icon: Icon, title, sub, months, series, kind, fmt, invert }) {
  const p = series[0]; const last = p.values[p.values.length - 1]; const prev = p.values[p.values.length - 2] || 0;
  return (
    <div className="card" style={{ padding: '16px 18px', minWidth: 0 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 6 }}>
        <div><div style={{ fontSize: 14, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 7 }}><Icon size={15} color={p.color} /> {title}</div>{sub && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 2 }}>{sub}</div>}</div>
        <div style={{ textAlign: 'right' }}><div className="tnum" style={{ fontSize: 20, fontWeight: 700, letterSpacing: -0.5 }}>{fmt(last)}</div><Delta cur={last} prev={prev} invert={invert} label={months[months.length - 2]} /></div>
      </div>
      {kind === 'line' ? <Lines months={months} series={series} fmt={fmt} /> : <Bars months={months} series={series} fmt={fmt} />}
      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', marginTop: 6 }}>
        {series.map((sr) => <span key={sr.label} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#6B7280' }}><span style={{ width: 10, height: 10, borderRadius: kind === 'line' ? 9999 : 2, background: sr.color, display: 'inline-block' }} />{sr.label} · <b className="tnum" style={{ color: '#14212A' }}>{fmt(sr.values[sr.values.length - 1])}</b> {months[months.length - 1]}</span>)}
      </div>
    </div>
  );
}
function Bars({ months, series, fmt }) {
  const W = 320, H = 150, L = 6, R = 6, T = 16, B = 20; const ih = H - T - B;
  const max = Math.max(1, ...series.flatMap((s) => s.values)) * 1.08;
  const gw = (W - L - R) / months.length; const bw = (gw * 0.66) / series.length;
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', height: 'auto' }} role="img" aria-label={series.map((s) => s.label).join(' vs ')}>
      {[0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1={L} x2={W - R} y1={T + ih * (1 - g)} y2={T + ih * (1 - g)} stroke="#F1F5F9" strokeWidth="1" />)}
      <line x1={L} x2={W - R} y1={T + ih} y2={T + ih} stroke="#E2E8F0" strokeWidth="1" />
      {months.map((m, i) => {
        const lastM = i === months.length - 1;
        return (
          <g key={m}>
            {series.map((s, j) => { const v = s.values[i] || 0; const h = (v / max) * ih; const x = L + i * gw + gw * 0.17 + j * bw; return (
              <g key={s.label}>
                <rect x={x} y={T + ih - h} width={Math.max(2, bw - 2)} height={h} rx="2" fill={s.color} opacity={lastM ? 1 : 0.5}><title>{`${m} · ${s.label}: ${fmt(v)}`}</title></rect>
                {series.length === 1 && <text x={x + (bw - 2) / 2} y={T + ih - h - 3} textAnchor="middle" fontSize="8" fontWeight="700" fill={lastM ? '#14212A' : '#9CA3AF'}>{fmt(v)}</text>}
              </g>
            ); })}
            <text x={L + i * gw + gw / 2} y={H - 6} textAnchor="middle" fontSize="9" fontWeight={lastM ? 700 : 500} fill={lastM ? '#14212A' : '#9CA3AF'}>{m}</text>
          </g>
        );
      })}
    </svg>
  );
}
function Lines({ months, series, fmt }) {
  const W = 320, H = 150, L = 10, R = 34, T = 16, B = 20; const ih = H - T - B;
  const step = (W - L - R) / Math.max(1, months.length - 1);
  const pts = (s) => { const max = Math.max(1, ...s.values) * 1.08; return s.values.map((v, i) => [L + i * step, T + ih - (v / max) * ih]); };
  return (
    <svg viewBox={`0 0 ${W} ${H}`} width="100%" style={{ display: 'block', height: 'auto' }} role="img" aria-label={series.map((s) => s.label).join(' and ')}>
      {[0.25, 0.5, 0.75, 1].map((g) => <line key={g} x1={L} x2={W - R} y1={T + ih * (1 - g)} y2={T + ih * (1 - g)} stroke="#F1F5F9" strokeWidth="1" />)}
      <line x1={L} x2={W - R} y1={T + ih} y2={T + ih} stroke="#E2E8F0" strokeWidth="1" />
      {series.map((s) => { const p = pts(s); const lp = p[p.length - 1]; return (
        <g key={s.label}>
          <polyline points={p.map((q) => q.join(',')).join(' ')} fill="none" stroke={s.color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
          {p.map((q, i) => <circle key={i} cx={q[0]} cy={q[1]} r={i === p.length - 1 ? 3.5 : 2.2} fill={i === p.length - 1 ? s.color : '#fff'} stroke={s.color} strokeWidth="1.5"><title>{`${months[i]} · ${s.label}: ${fmt(s.values[i])}`}</title></circle>)}
          <text x={lp[0] + 6} y={lp[1] + 3} fontSize="8.5" fontWeight="700" fill={s.color}>{fmt(s.values[s.values.length - 1])}</text>
        </g>
      ); })}
      {months.map((m, i) => <text key={m} x={L + i * step} y={H - 6} textAnchor="middle" fontSize="9" fontWeight={i === months.length - 1 ? 700 : 500} fill={i === months.length - 1 ? '#14212A' : '#9CA3AF'}>{m}</text>)}
    </svg>
  );
}

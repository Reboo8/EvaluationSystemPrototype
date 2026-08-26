import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, Bug, AlertTriangle, ArrowRight, History, TrendingUp, Wallet, Coins, Snowflake, Hourglass, LifeBuoy, FileClock, Plug, Mail, CheckCircle2, Activity, Building2, Users, Gauge } from 'lucide-react';
import { useApp, fmtCr, fmtMoney, walletOf, WALLET_STATE, JOB_KINDS, DEFAULTS, CURRENCY, caseLabel } from '../store.jsx';
import { PageHeader, PermButton, PendingChip, WalletStateBadge, ClientStatusBadge, PriorityBadge, TicketStatusBadge, EmptyRow } from '../components/admin/ui.jsx';

/* ═══════════ Admin Dashboard (spec §13) — business + usage + platform health + Needs Attention in ~30 s ═══════════ */

const LEVEL = {
  critical: { rank: 0, label: 'Critical', color: '#B91C1C', bg: '#FEE2E2', dot: '#DC2626' },
  warning:  { rank: 1, label: 'Warning',  color: '#B45309', bg: '#FEF3C7', dot: '#F59E0B' },
  info:     { rank: 2, label: 'Info',     color: '#1E40AF', bg: '#DBEAFE', dot: '#056FD4' },
};
const REQ_LABEL = { DELETION: 'Deletion request', ACCESS: 'Access request', EXPORT: 'Export request', CORRECTION: 'Correction request' };
const CATEGORY_DOT = { Credits: '#15803D', Client: '#056FD4', Recovery: '#B45309', Override: '#6D28D9', Scoring: '#0369A1', Module: '#C2410C', Integration: '#6B7280', Settings: '#6B7280', Support: '#6D28D9', Impersonation: '#B91C1C', 'Data request': '#6D28D9', 'Assessment config': '#0369A1' };
const LIST_LIMIT = 9;

const fmtN = (n) => (Number(n) || 0).toLocaleString('en-IN');
const MONTHS = { jan: 0, feb: 1, mar: 2, apr: 3, may: 4, jun: 5, jul: 6, aug: 7, sep: 8, oct: 9, nov: 10, dec: 11 };
/* store stamps look like "26 Aug 2026 12:04" or "20 Aug 2026" (en-GB may emit "Sept") */
function parseStamp(s) {
  if (!s) return null;
  const m = String(s).match(/^(\d{1,2})\s+([A-Za-z]{3})[A-Za-z]*\s+(\d{4})(?:\s+(\d{1,2}):(\d{2}))?/);
  if (!m) return null;
  const mo = MONTHS[m[2].toLowerCase()]; if (mo == null) return null;
  return new Date(Number(m[3]), mo, Number(m[1]), Number(m[4] || 0), Number(m[5] || 0));
}
const minutesSince = (s) => { const d = parseStamp(s); return d ? Math.max(0, Math.round((Date.now() - d.getTime()) / 60000)) : null; };
const daysSince = (s) => { const d = parseStamp(s); return d ? Math.max(0, Math.floor((Date.now() - d.getTime()) / 86400000)) : null; };
const fmtDuration = (m) => (m < 60 ? `${m} min` : m < 1440 ? `${Math.floor(m / 60)}h ${m % 60}m` : `${Math.floor(m / 1440)}d ${Math.floor((m % 1440) / 60)}h`);

export default function AdminOverview() {
  const nav = useNavigate();
  const { clients, failedJobs, tickets, auditLog, usageSeries, aggregates, settings, nameOf, ledger } = useApp();
  const [levelFilter, setLevelFilter] = useState('all');
  const [showAll, setShowAll] = useState(false);

  /* ── derived live from the store ── */
  const interviewMinutes = clients.reduce((a, c) => a + (c.usage?.interviewMinutes || 0), 0);
  const inactive = clients.filter((c) => c.status === 'INVITE_PENDING' || (c.usage?.evaluations || 0) === 0);
  const highUsage = clients.filter((c) => (c.flags || []).includes('spike'));
  const defaultThreshold = settings?.credits?.lowBalanceThreshold ?? DEFAULTS.lowBalanceThreshold;
  const openJobs = aggregates.openJobs;

  /* Platform health, derived instead of asserted: an open RESERVE with no settlement IS an evaluation in flight (spec §05/§13). */
  const settledRefs = new Set(ledger.filter((e) => e.reserveRef).map((e) => e.reserveRef));
  const openHolds = ledger.filter((e) => e.type === 'RESERVE' && !settledRefs.has(e.id));
  const heldCredits = openHolds.reduce((a, e) => a + (e.hold || 0), 0);
  const queuedJobs = failedJobs.filter((j) => j.status === 'OPEN' && (j.kind === 'PENDING_SCORE' || String(j.kind).startsWith('STUCK_')));

  /* ── Needs Attention queue (spec §13 priority + §06 low / negative) ── */
  const clientBadges = (c) => <><ClientStatusBadge status={c.status} /><WalletStateBadge state={walletOf(c).state} /></>;
  const items = [];
  // negative wallets — new paid evaluations blocked, running work finishes (§06)
  aggregates.negative.forEach((c) => { const w = walletOf(c); items.push({ key: 'neg-' + c.id, level: 'critical', icon: Wallet, title: `${c.name} — negative wallet −${fmtCr(w.outstanding)}`, sub: `new paid evaluations blocked · running work finishes · overdraft limit ${fmtCr(w.overdraftLimit)} · top-up clears debt first`, to: '/admin/clients/' + c.id, right: clientBadges(c) }); });
  // blocked / frozen wallets
  aggregates.blocked.forEach((c) => { const w = walletOf(c); items.push({ key: 'blk-' + c.id, level: 'critical', icon: Snowflake, title: `${c.name} — wallet frozen (blocked for new usage)`, sub: `${c.statusReason || 'unfreeze when the issue is resolved'} · balance ${fmtCr(w.balance)}`, to: '/admin/clients/' + c.id, right: clientBadges(c) }); });
  // stuck jobs ≥ 30 min (STUCK_* kinds, not yet recovered)
  const stuckIds = new Set();
  failedJobs.filter((j) => String(j.kind).startsWith('STUCK_') && j.status !== 'RECOVERED').forEach((j) => {
    const m = minutesSince(j.since); if (m == null || m < 30) return;
    stuckIds.add(j.id);
    items.push({ key: 'stuck-' + j.id, level: 'critical', icon: Hourglass, title: `${JOB_KINDS[j.kind]?.label || j.kind} for ${fmtDuration(m)} — ${j.candidate}`, sub: `${nameOf(j.clientId)} · ${j.oppTitle} · ${j.module} · since ${j.since}`, to: `/admin/support?tab=jobs&job=${j.id}`, right: <JobBadges job={j} /> });
  });
  // open failed jobs (technical failure ≠ candidate failure)
  openJobs.filter((j) => !stuckIds.has(j.id)).forEach((j) => items.push({ key: 'job-' + j.id, level: 'critical', icon: Bug, title: `${JOB_KINDS[j.kind]?.label || j.kind} — ${j.candidate}`, sub: `${nameOf(j.clientId)} · ${j.oppTitle} · ${j.module} · since ${j.since}`, to: `/admin/support?tab=jobs&job=${j.id}`, right: <JobBadges job={j} /> }));
  // urgent tickets (critical) then high (warning) — anything not RESOLVED / CLOSED
  const pendingTickets = tickets.filter((t) => (t.priority === 'Urgent' || t.priority === 'High') && t.status !== 'RESOLVED' && t.status !== 'CLOSED');
  const ticketItem = (t) => ({ key: 'tkt-' + t.id, level: t.priority === 'Urgent' ? 'critical' : 'warning', icon: LifeBuoy, title: `${t.priority} ticket ${t.id} — ${t.subject}`, sub: `${nameOf(t.clientId)} · ${caseLabel(t.caseType)}${t.candidate ? ' · ' + t.candidate : ''} · updated ${t.updated}`, to: `/admin/support?tab=tickets&ticket=${t.id}`, right: <><PriorityBadge priority={t.priority} /><TicketStatusBadge status={t.status} /></> });
  pendingTickets.filter((t) => t.priority === 'Urgent').forEach((t) => items.push(ticketItem(t)));
  // low-credit clients (client stays ACTIVE — §06)
  aggregates.lowCredit.forEach((c) => {
    const w = walletOf(c); const zero = w.state === 'ZERO';
    items.push({ key: 'low-' + c.id, level: 'warning', icon: Coins, title: zero ? `${c.name} — zero balance` : `${c.name} — low balance ${fmtCr(w.available)}`,
      sub: <>threshold {fmtCr(w.lowBalanceThreshold)}{w.lowBalanceThreshold === defaultThreshold && <PendingChip />} · top-up or grant{zero ? ' · new paid evaluations paused, running work unaffected' : ''}</>,
      to: `/admin/credits?tab=wallets&action=add&client=${c.id}`, right: clientBadges(c) });
  });
  pendingTickets.filter((t) => t.priority === 'High').forEach((t) => items.push(ticketItem(t)));
  // compliance requests with a due date (§11)
  aggregates.pendingRequests.forEach((r) => items.push({ key: 'dr-' + r.id, level: 'warning', icon: FileClock, title: `${r.id} · ${REQ_LABEL[r.type] || r.type} — ${r.subject}`, sub: `${nameOf(r.clientId)} · due ${r.due} · ${r.status === 'IN_PROGRESS' ? 'in progress' : 'pending'}${r.legalHold ? ' · legal hold: ' + (r.holdReason || 'applied') : ''}`, to: '/admin/compliance?tab=requests', right: r.legalHold ? <span className="badge" style={{ background: '#EDE9FE', color: '#6D28D9' }}>Legal hold</span> : <span className="badge" style={{ background: '#F3F4F6', color: '#6B7280' }}>{r.type}</span> }));
  // degraded integrations (§17)
  aggregates.degradedIntegrations.forEach((i) => items.push({ key: 'int-' + i.id, level: 'warning', icon: Plug, title: `${i.name} degraded — ${i.category}`, sub: `error rate ${i.health?.errorRate ?? '—'}% · latency ${i.health?.latencyMs ?? '—'} ms · ${i.role || 'provider'} · last tested ${i.lastTested}`, to: '/admin/platform?tab=integrations', right: <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>Degraded</span> }));
  // invite-pending clients older than a week (§03)
  clients.filter((c) => c.status === 'INVITE_PENDING').forEach((c) => {
    const d = daysSince(c.invitedAt || c.since); if (d == null || d < 7) return;
    items.push({ key: 'inv-' + c.id, level: 'info', icon: Mail, title: `${c.name} — invite pending for ${d} days`, sub: `owner ${c.owner?.email || '—'} · invited ${c.invitedAt || c.since} · resend or revoke`, to: '/admin/clients/' + c.id, right: clientBadges(c) });
  });
  items.sort((a, b) => LEVEL[a.level].rank - LEVEL[b.level].rank);
  const counts = { critical: items.filter((i) => i.level === 'critical').length, warning: items.filter((i) => i.level === 'warning').length, info: items.filter((i) => i.level === 'info').length };
  const visible = items.filter((i) => levelFilter === 'all' || i.level === levelFilter);
  const shown = showAll ? visible : visible.slice(0, LIST_LIMIT);

  /* ── KPI strips (§13: Business · Usage · Platform Health · Client Health) ── */
  const business = [
    { label: 'Active clients', value: fmtN(aggregates.activeClients), sub: `${clients.length} total tenants`, to: '/admin/clients' },
    { label: 'Revenue collected', value: fmtMoney(aggregates.revenue), sub: <>succeeded payments · {fmtMoney(CURRENCY.perCredit)} / credit<PendingChip /></>, color: '#15803D', to: '/admin/credits?tab=payments' },
    { label: 'Credits sold', value: fmtCr(aggregates.creditsSold), sub: 'PURCHASE ledger entries', to: '/admin/credits?tab=ledger' },
    { label: 'Outstanding / negative', value: fmtCr(aggregates.outstanding), sub: aggregates.negative.length ? `${aggregates.negative.length} wallet${aggregates.negative.length > 1 ? 's' : ''} in overdraft` : 'no wallets in overdraft', color: aggregates.outstanding > 0 ? '#B91C1C' : '#14212A', to: '/admin/credits?tab=wallets&filter=OVERDRAFT' },
  ];
  const usage = [
    { label: 'Candidates processed', value: fmtN(aggregates.totalCandidates), sub: 'across all tenants', to: '/admin/usage' },
    { label: 'Evaluations', value: fmtN(aggregates.totalEvals), sub: `${fmtN(aggregates.totalFailed)} failed / aborted`, to: '/admin/usage' },
    { label: 'AI interviews', value: fmtN(aggregates.totalInterviews), sub: `${fmtN(interviewMinutes)} min total`, to: '/admin/usage' },
    { label: 'Proctoring sessions', value: fmtN(aggregates.totalProctoring), sub: 'camera + mic + tab-switch', to: '/admin/usage' },
    { label: 'Credits consumed', value: fmtCr(aggregates.creditsConsumed), sub: 'actual service usage', to: '/admin/credits?tab=ledger' },
  ];
  const platform = [
    { label: 'Running jobs', value: fmtN(openHolds.length), sub: openHolds.length ? `${fmtCr(heldCredits)} held before start` : 'no open holds', to: '/admin/support?tab=running' },
    { label: 'Queued', value: fmtN(queuedJobs.length), sub: 'pending score / stuck — waiting on a worker', color: queuedJobs.length ? '#B45309' : '#14212A', to: '/admin/support?tab=jobs' },
    { label: 'Failed / stuck', value: fmtN(openJobs.length), sub: 'open in recovery queue', color: openJobs.length ? '#B91C1C' : '#14212A', to: '/admin/support?tab=jobs' },
    { label: 'Incidents', value: fmtN(aggregates.degradedIntegrations.length), sub: 'degraded integrations', color: aggregates.degradedIntegrations.length ? '#B45309' : '#14212A', to: '/admin/platform?tab=integrations' },
  ];
  const clientHealth = [
    { label: 'Low-credit clients', value: fmtN(aggregates.lowCredit.length), sub: 'active · low or zero balance', color: aggregates.lowCredit.length ? '#B45309' : '#14212A', to: '/admin/credits?tab=wallets&filter=LOW_BALANCE' },
    { label: 'Negative wallets', value: fmtN(aggregates.negative.length), sub: 'overdraft · new work blocked', color: aggregates.negative.length ? '#B91C1C' : '#14212A', to: '/admin/credits?tab=wallets&filter=OVERDRAFT' },
    { label: 'Inactive', value: fmtN(inactive.length), sub: 'invite pending or 0 evaluations', to: '/admin/clients' },
    { label: 'High-usage', value: fmtN(highUsage.length), sub: 'usage spike flagged', color: highUsage.length ? '#6D28D9' : '#14212A', to: '/admin/usage' },
  ];

  /* ── credits series (last 6 months) ── */
  const months = usageSeries?.months || [];
  const sold = usageSeries?.creditsSold || [];
  const consumed = usageSeries?.creditsConsumed || [];
  const seriesMax = Math.max(1, ...sold, ...consumed);
  const sum = (arr) => arr.reduce((a, v) => a + (Number(v) || 0), 0);

  return (
    <>
      <PageHeader title="Dashboard" sub="Business + usage + platform health — understand Cuba in ~30 seconds"
        right={<>
          <button className="btn-ghost" onClick={() => nav('/admin/support?tab=jobs')}><Bug size={15} /> Open failed jobs{openJobs.length > 0 && <span className="badge" style={{ background: '#FEE2E2', color: '#B91C1C' }}>{openJobs.length}</span>}</button>
          <PermButton action="client.create" className="btn-primary" onClick={() => nav('/admin/clients/new')}><Plus size={15} /> Onboard client</PermButton>
        </>} />

      {/* KPI strips */}
      <div style={{ display: 'grid', gap: 14, marginBottom: 18 }}>
        <Strip icon={Building2} title="Business" linkLabel="Credits & Billing" to="/admin/credits" cells={business} nav={nav} />
        <Strip icon={Gauge} title="Usage" linkLabel="Usage report" to="/admin/usage" cells={usage} nav={nav} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 14 }}>
          <Strip icon={Activity} title="Platform health" linkLabel="Running & failed" to="/admin/support?tab=running" cells={platform} nav={nav} />
          <Strip icon={Users} title="Client health" linkLabel="Clients" to="/admin/clients" cells={clientHealth} nav={nav} />
        </div>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 18, alignItems: 'start' }}>
        {/* ── Needs attention ── */}
        <div className="card" style={{ padding: '18px 20px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
            <AlertTriangle size={16} color={counts.critical ? '#DC2626' : '#D97706'} />
            <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Needs attention</h2>
            <span className="badge" style={{ background: counts.critical ? '#FEE2E2' : items.length ? '#FEF3C7' : '#DCFCE7', color: counts.critical ? '#B91C1C' : items.length ? '#B45309' : '#15803D' }}>{items.length}</span>
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {[['all', 'All', items.length], ['critical', 'Critical', counts.critical], ['warning', 'Warning', counts.warning], ['info', 'Info', counts.info]].filter(([k, , n]) => k === 'all' || n > 0).map(([k, l, n]) => (
                <button key={k} className={'filter-btn' + (levelFilter === k ? ' active' : '')} style={{ padding: '4px 10px', fontSize: 12 }} onClick={() => { setLevelFilter(k); setShowAll(false); }}>{l} <span style={{ opacity: 0.7 }}>{n}</span></button>
              ))}
            </div>
          </div>
          <div style={{ fontSize: 11.5, color: '#9CA3AF', marginBottom: 12 }}>Low-credit clients · negative wallets · failed evaluations · stuck jobs · pending tickets · compliance requests — critical first.</div>
          {visible.length === 0 ? (
            <div style={{ padding: '30px 16px', textAlign: 'center', color: '#6B7280', fontSize: 13 }}>
              <CheckCircle2 size={26} color="#16A34A" style={{ display: 'block', margin: '0 auto 8px' }} />
              <div style={{ fontWeight: 600, color: '#14212A' }}>{items.length === 0 ? 'All clear' : 'Nothing at this level'}</div>
              <div style={{ fontSize: 12, marginTop: 2 }}>{items.length === 0 ? 'Nothing needs you right now.' : 'Switch the filter to see the other items.'}</div>
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {shown.map((it) => <AttentionRow key={it.key} item={it} onClick={() => nav(it.to)} />)}
              {visible.length > LIST_LIMIT && (
                <button className="btn-ghost" style={{ alignSelf: 'center', marginTop: 4, padding: '6px 14px', fontSize: 12.5 }} onClick={() => setShowAll((v) => !v)}>{showAll ? 'Show fewer' : `Show all ${visible.length}`}</button>
              )}
            </div>
          )}
        </div>

        {/* ── right column ── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 18, minWidth: 0 }}>
          {/* recent activity */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10 }}>
              <History size={16} color="#056FD4" />
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Recent activity</h2>
              <span onClick={() => nav('/admin/compliance?tab=audit')} style={{ marginLeft: 'auto', fontSize: 12.5, color: '#056FD4', fontWeight: 600, cursor: 'pointer' }}>Audit log →</span>
            </div>
            {auditLog.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No activity recorded yet.</div>
            ) : auditLog.slice(0, 8).map((a, i, arr) => (
              <div key={a.id} title={a.reason ? 'Reason: ' + a.reason : undefined} style={{ display: 'flex', gap: 10, padding: '8px 0', borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                <span style={{ width: 7, height: 7, borderRadius: '50%', background: CATEGORY_DOT[a.category] || '#9CA3AF', marginTop: 6, flexShrink: 0 }} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 12.5, color: '#14212A' }}><b>{a.action}</b> · <span style={{ color: '#475569' }}>{a.resource}</span></div>
                  <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 1 }}>{a.actor} · {a.when}</div>
                </div>
                <span className="chip" style={{ fontSize: 10.5, padding: '2px 8px', background: '#F3F4F6', color: '#6B7280', alignSelf: 'flex-start', whiteSpace: 'nowrap' }}>{a.category}</span>
              </div>
            ))}
          </div>

          {/* credits — last 6 months */}
          <div className="card" style={{ padding: '18px 20px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12 }}>
              <TrendingUp size={16} color="#056FD4" />
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Credits — last 6 months</h2>
              <span onClick={() => nav('/admin/analytics')} style={{ marginLeft: 'auto', fontSize: 12.5, color: '#056FD4', fontWeight: 600, cursor: 'pointer' }}>Analytics →</span>
            </div>
            {months.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No series data.</div>
            ) : (
              <>
                <SparkRow label="Sold" series={sold} months={months} max={seriesMax} colors={['#BFDBFE', '#056FD4']} />
                <SparkRow label="Consumed" series={consumed} months={months} max={seriesMax} colors={['#DDD6FE', '#6D28D9']} />
                <div style={{ display: 'flex', gap: 12 }}>
                  <div style={{ width: 74, flexShrink: 0 }} />
                  <div style={{ flex: 1, display: 'grid', gridTemplateColumns: `repeat(${months.length}, minmax(0, 1fr))`, gap: 3 }}>{months.map((m) => <div key={m} style={{ textAlign: 'center', fontSize: 10.5, color: '#9CA3AF' }}>{m}</div>)}</div>
                  <div style={{ width: 84, flexShrink: 0 }} />
                </div>
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: '1px solid #F3F4F6', fontSize: 11.5, color: '#6B7280', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
                  <span><Dot c="#056FD4" /> 6-mo sold <b className="tnum" style={{ color: '#14212A' }}>{fmtCr(sum(sold))}</b></span>
                  <span><Dot c="#6D28D9" /> 6-mo consumed <b className="tnum" style={{ color: '#14212A' }}>{fmtCr(sum(consumed))}</b></span>
                </div>
              </>
            )}
          </div>

          {/* wallet states */}
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px 10px', display: 'flex', alignItems: 'center', gap: 8 }}>
              <Wallet size={16} color="#056FD4" />
              <h2 style={{ fontSize: 15, fontWeight: 700, margin: 0 }}>Wallet states</h2>
              <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>wallet state ≠ account status</span>
              <span onClick={() => nav('/admin/credits?tab=wallets')} style={{ marginLeft: 'auto', fontSize: 12.5, color: '#056FD4', fontWeight: 600, cursor: 'pointer' }}>Wallets →</span>
            </div>
            <div className="table-wrap">
              <table>
                <thead><tr><th>State</th><th>Clients</th><th style={{ textAlign: 'right' }}>Count</th></tr></thead>
                <tbody>
                  {clients.length === 0 ? <EmptyRow cols={3} text="No client wallets yet." /> : Object.keys(WALLET_STATE).map((k) => {
                    const list = clients.filter((c) => walletOf(c).state === k);
                    return (
                      <tr key={k} className="row" onClick={() => nav(`/admin/credits?tab=wallets&filter=${k}`)}>
                        <td><WalletStateBadge state={k} /></td>
                        <td style={{ fontSize: 12.5, color: list.length ? '#475569' : '#C4C9D2' }}>{list.length ? list.map((c) => c.name).join(', ') : '—'}</td>
                        <td className="tnum" style={{ textAlign: 'right', fontWeight: 700, color: list.length ? '#14212A' : '#C4C9D2' }}>{list.length}</td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
            <div style={{ padding: '10px 18px', borderTop: '1px solid #F3F4F6', fontSize: 11.5, color: '#6B7280', display: 'flex', flexWrap: 'wrap', gap: '4px 14px', alignItems: 'center' }}>
              <span>Low-balance threshold {fmtCr(defaultThreshold)}<PendingChip /></span>
              <span>Overdraft limit {fmtCr(settings?.credits?.overdraftLimit ?? DEFAULTS.overdraftLimit)}<PendingChip /></span>
              <span>1 credit = {fmtMoney(CURRENCY.perCredit)}<PendingChip /></span>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════ local components ═══════════ */

/* labelled KPI strip: eyebrow group title + a row of cells (eyebrow / num / sub), each cell deep-links */
function Strip({ icon: Icon, title, linkLabel, to, cells, nav }) {
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, padding: '11px 16px 0' }}>
        <Icon size={13} color="#6B7280" />
        <span className="eyebrow" style={{ color: '#6B7280' }}>{title}</span>
        {to && <span onClick={() => nav(to)} style={{ marginLeft: 'auto', fontSize: 12, color: '#056FD4', fontWeight: 600, cursor: 'pointer' }}>{linkLabel} →</span>}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `repeat(${cells.length}, minmax(0, 1fr))` }}>
        {cells.map((k, i) => (
          <div key={k.label} onClick={k.to ? () => nav(k.to) : undefined}
            style={{ padding: '6px 16px 14px', borderLeft: i ? '1px solid #F3F4F6' : 'none', cursor: k.to ? 'pointer' : 'default', minWidth: 0, transition: 'background .12s' }}
            onMouseEnter={(e) => { if (k.to) e.currentTarget.style.background = '#F8FAFF'; }} onMouseLeave={(e) => { e.currentTarget.style.background = 'transparent'; }}>
            <div className="eyebrow">{k.label}</div>
            <div className="num tnum" style={{ fontSize: 24, color: k.color || '#14212A', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{k.value}</div>
            {k.sub && <div style={{ fontSize: 11.5, color: '#9CA3AF', display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>{k.sub}</div>}
          </div>
        ))}
      </div>
    </div>
  );
}

/* one Needs-Attention row: level rail · icon box · title / sub · badges · arrow */
function AttentionRow({ item, onClick }) {
  const L = LEVEL[item.level] || LEVEL.info; const Icon = item.icon;
  return (
    <div onClick={onClick} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px 10px 10px', border: '1px solid #E2E8F0', borderLeft: `3px solid ${L.dot}`, borderRadius: 10, cursor: 'pointer', background: '#fff', transition: 'background .12s' }}
      onMouseEnter={(e) => { e.currentTarget.style.background = '#F8FAFF'; }} onMouseLeave={(e) => { e.currentTarget.style.background = '#fff'; }}>
      <div style={{ width: 34, height: 34, borderRadius: 8, background: L.bg, color: L.color, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}><Icon size={17} /></div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#14212A' }}>{item.title}</div>
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 1, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>{item.sub}</div>
      </div>
      {item.right && <div style={{ display: 'flex', gap: 6, alignItems: 'center', justifyContent: 'flex-end', flexWrap: 'wrap', flexShrink: 0, maxWidth: '40%' }}>{item.right}</div>}
      <ArrowRight size={15} color="#CBD5E1" style={{ flexShrink: 0 }} />
    </div>
  );
}

/* failed-job badges: queue status + credits on hold */
function JobBadges({ job }) {
  const m = { OPEN: ['#DBEAFE', '#1E40AF', 'Open'], ESCALATED: ['#FFEDD5', '#C2410C', 'Escalated'], RECOVERED: ['#DCFCE7', '#15803D', 'Recovered'] };
  const [bg, fg, l] = m[job.status] || ['#F3F4F6', '#6B7280', job.status];
  return (
    <>
      {job.creditsHeld > 0 && <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>{fmtCr(job.creditsHeld)} on hold</span>}
      <span className="badge" style={{ background: bg, color: fg }}>{l}</span>
    </>
  );
}

/* one sparkline row (label · .spark bars · latest value) */
function SparkRow({ label, series, months, max, colors }) {
  const last = Number(series[series.length - 1]) || 0; const prev = Number(series[series.length - 2]) || 0;
  const delta = prev ? Math.round(((last - prev) / prev) * 100) : null;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 8 }}>
      <div style={{ width: 74, flexShrink: 0 }}>
        <div style={{ fontSize: 12, fontWeight: 600, color: '#374151' }}>{label}</div>
        <div style={{ fontSize: 10.5, color: delta == null ? '#9CA3AF' : delta >= 0 ? '#15803D' : '#B91C1C' }}>{delta == null ? '—' : `${delta >= 0 ? '+' : ''}${delta}% MoM`}</div>
      </div>
      <div className="spark" style={{ flex: 1 }}>
        {series.map((v, i) => <span key={i} title={`${months[i] || ''}: ${fmtCr(v)}`} style={{ height: Math.max(6, Math.round(((Number(v) || 0) / max) * 100)) + '%', background: i === series.length - 1 ? colors[1] : colors[0] }} />)}
      </div>
      <div className="tnum" style={{ width: 84, textAlign: 'right', fontSize: 13, fontWeight: 700, color: colors[1], flexShrink: 0 }}>{fmtCr(last)}</div>
    </div>
  );
}

const Dot = ({ c }) => <span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 2, background: c, marginRight: 5, verticalAlign: -1 }} />;

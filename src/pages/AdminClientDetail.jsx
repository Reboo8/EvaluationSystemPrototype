import { useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  Mail, Ban, Sparkles, LogIn, Pause, Play, ShieldAlert, Archive, Download, RotateCcw, Wallet, Plus, Undo2, SlidersHorizontal, Gauge,
  Snowflake, Flame, Check, CheckCircle2, ArrowRight, AlertTriangle, AlertCircle, Activity, Puzzle, Building2, Pencil,
  RefreshCw, Lock, History, LifeBuoy, Wrench, ClipboardList, Coins, FileText,
} from 'lucide-react';
import { useApp, walletOf, fmtCr, fmtMoney, initials, CURRENCY, DEFAULTS, CLIENT_STATUS, JOB_KINDS, caseLabel } from '../store.jsx';
import {
  ClientStatusBadge, WalletStateBadge, LedgerTypeBadge, TicketStatusBadge, ModuleStateBadge, PriorityBadge, PaymentStatusBadge,
  PendingChip, Credits, useToast, Modal, useReasonGate, PermButton, useTab, Tabs, EmptyRow, Row, Mono,
} from '../components/admin/ui.jsx';

/* ═══════════ Admin › Clients › Client detail (spec §03 lifecycle · §04–§07 wallet · §08 usage & safety · §09 tickets/jobs · §10 module access · §12 offboarding) ═══════════ */

const TABS = [
  { key: 'overview', label: 'Overview' },
  { key: 'ledger', label: 'Ledger' },
  { key: 'payments', label: 'Payments' },
  { key: 'tickets', label: 'Tickets' },
  { key: 'jobs', label: 'Failed jobs' },
  { key: 'modules', label: 'Module access' },
  { key: 'offboarding', label: 'Offboarding' },
];
const LIFECYCLE = ['ACTIVE', 'OFFBOARDING', 'DEACTIVATED', 'RETENTION', 'DELETED'];
const PAY_METHODS = ['Bank transfer (offline)', 'Razorpay', 'Card', 'UPI', 'Cheque (offline)'];
const NON_PENDING = ['ACTIVE', 'SUSPENDED', 'OFFBOARDING', 'DEACTIVATED', 'RETENTION', 'DELETED'];
const dangerBtn = { color: '#B91C1C', borderColor: '#FCA5A5' };
const linkStyle = { fontSize: 12.5, color: '#056FD4', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const num = (n) => (Number(n) || 0).toLocaleString('en-IN');

export default function AdminClientDetail() {
  const { id } = useParams();
  const nav = useNavigate();
  const {
    getClient, ledger, payments, tickets, failedJobs, modules, settings, OFFBOARDING_STEPS, setImpersonating, addAudit, moduleAvailableFor,
    resendInvite, revokeInvite, activateClient, suspendClient, reinstateClient, startOffboarding, completeOffboardingStep, updateClient, exportClientData,
    addCredits, refundCredits, manualAdjust, setOverdraftLimit, setLowBalanceThreshold, freezeWallet, unfreezeWallet, retryPayment,
    pauseClientUsage, resumeClientUsage, acknowledgeSpike, grantModuleAccess, revokeModuleAccess,
  } = useApp();
  const c = getClient(id);
  const [show, toastNode] = useToast();
  const [ask, gateNode] = useReasonGate();
  const [tab, setTab] = useTab(TABS);
  const [modal, setModal] = useState(null);

  if (!c) {
    return (
      <div className="card" style={{ padding: 40, textAlign: 'center', color: '#9CA3AF' }}>
        Client not found. <span style={{ color: '#056FD4', cursor: 'pointer', fontWeight: 600 }} onClick={() => nav('/admin/clients')}>Back to clients</span>
      </div>
    );
  }

  const w = walletOf(c);
  const st = CLIENT_STATUS[c.status] || {};
  const u = c.usage || {};
  const cLedger = ledger.filter((e) => e.clientId === c.id);
  const cPayments = payments.filter((p) => p.clientId === c.id);
  const cTickets = tickets.filter((t) => t.clientId === c.id);
  const cJobs = failedJobs.filter((j) => j.clientId === c.id);
  const openTickets = cTickets.filter((t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED');
  const openJobs = cJobs.filter((j) => j.status === 'OPEN');
  const hasSpike = (c.flags || []).includes('spike');
  const isPending = c.status === 'INVITE_PENDING';
  const isActive = c.status === 'ACTIVE';
  const isSuspended = c.status === 'SUSPENDED';
  const inClosure = ['OFFBOARDING', 'DEACTIVATED', 'RETENTION', 'DELETED'].includes(c.status);
  const tabs = TABS.map((t) => ({
    ...t,
    count: t.key === 'ledger' ? cLedger.length : t.key === 'payments' ? cPayments.length : t.key === 'tickets' ? openTickets.length : t.key === 'jobs' ? openJobs.length : undefined,
  }));

  /* ── lifecycle actions (spec §03) ── */
  const doResend = () => { resendInvite(c.id); show(`Invite re-sent to ${c.owner?.email}`); };
  const doRevoke = () => { revokeInvite(c.id); show('Invite revoked — owner link no longer works'); };
  const doActivate = () => { activateClient(c.id); show(`${c.name} is now ACTIVE (owner activation simulated)`); };
  const doImpersonate = () => ask(
    { action: 'impersonate', title: `Impersonate ${c.name}`, confirmLabel: 'Enter workspace', body: 'You will see the client workspace as an operator. The session is banner-marked and written to the audit log.' },
    (reason) => { addAudit('Impersonation', 'Impersonated client workspace', c.name, { clientId: c.id, reason }); setImpersonating({ id: c.id, name: c.name }); nav('/'); },
  );
  const doSuspend = () => ask(
    { action: 'client.suspend', title: `Suspend ${c.name}`, confirmLabel: 'Suspend', danger: true, body: 'Temporary administrative block. Data is preserved and new activity is restricted. Running candidate evaluations still finish. The client can later return to ACTIVE.' },
    (reason) => { suspendClient(c.id, reason); show(`${c.name} suspended`); },
  );
  const doReinstate = () => { reinstateClient(c.id); show(`${c.name} reinstated — status ACTIVE`); };
  const doOffboard = () => ask(
    { action: 'client.offboard', title: `Start offboarding ${c.name}`, confirmLabel: 'Start offboarding', danger: true, body: 'Permanent lifecycle closure. New opportunities, evaluations and users stop; running candidate evaluations finish safely; export, retention and deletion follow the 9-step checklist.' },
    (reason) => { startOffboarding(c.id, reason); setTab('offboarding'); show('Offboarding started — checklist opened'); },
  );
  const doPause = () => ask(
    { action: 'usage.pause', title: `Pause usage for ${c.name}`, confirmLabel: 'Pause usage', body: 'Temporarily stops new paid evaluations for this client. Running evaluations are never interrupted. Account status stays ACTIVE.' },
    (reason) => { pauseClientUsage(c.id, reason); show('Client usage paused'); },
  );
  const doResume = () => ask(
    { action: 'usage.pause', title: `Resume usage for ${c.name}`, confirmLabel: 'Resume usage', body: 'New paid evaluations may start again (subject to wallet rules).' },
    () => { resumeClientUsage(c.id); show('Client usage resumed'); },
  );
  const doExport = () => ask(
    { action: 'client.export', title: `Export ${c.name} data`, confirmLabel: 'Generate export', body: 'Generates the eligible client data export (scores / reports, assessment configuration, ledger, payments). Recorded as a data request in the audit log.' },
    (reason) => { exportClientData(c.id, reason); show('Client data export generated · audit entry written'); },
  );
  const doAckSpike = () => { acknowledgeSpike(c.id); show('Usage spike acknowledged'); };

  /* ── wallet actions (spec §07) ── */
  const doAdd = (f) => { addCredits(c.id, f.credits, { type: f.type, method: f.method, reference: f.reference, reason: f.reason }); setModal(null); show(`+${num(f.credits)} cr ${f.type === 'PURCHASE' ? 'purchase recorded' : 'granted'}${w.balance < 0 ? ' · debt cleared first' : ''}`); };
  const doRefund = (f) => { setModal(null); ask(
    { action: 'wallet.refund', title: `Refund ${fmtCr(f.credits)} to ${c.name}`, confirmLabel: 'Post refund', body: `A REFUND / REVERSAL entry of +${num(f.credits)} cr will be appended to the ledger${f.ref ? ` (ref ${f.ref})` : ''}. The original charge stays in the ledger — corrections are reversal entries.` },
    (reason) => { refundCredits(c.id, f.credits, reason, f.ref); show(`Refund of ${fmtCr(f.credits)} posted`); },
  ); };
  const doAdjust = (f) => { setModal(null); ask(
    { action: 'wallet.adjust', title: `Manual adjustment ${f.credits > 0 ? '+' : ''}${num(f.credits)} cr — ${c.name}`, confirmLabel: 'Post adjustment', danger: f.credits < 0, body: 'Exceptional accounting correction. Appended as an immutable MANUAL_ADJUSTMENT entry with your identity and reason.' },
    (reason) => { manualAdjust(c.id, f.credits, reason); show(`Manual adjustment ${f.credits > 0 ? '+' : ''}${num(f.credits)} cr posted`); },
  ); };
  const doOverdraft = (f) => { setModal(null); ask(
    { action: 'wallet.overdraft', title: `Change overdraft limit → ${fmtCr(f.limit)}`, confirmLabel: 'Change limit', body: `Current limit ${fmtCr(w.overdraftLimit)}. The overdraft limit governs whether NEW work may start; it never terminates a running candidate evaluation.` },
    (reason) => { setOverdraftLimit(c.id, f.limit, reason); show(`Overdraft limit set to ${fmtCr(f.limit)}`); },
  ); };
  const doThreshold = (f) => { setLowBalanceThreshold(c.id, f.threshold); setModal(null); show(`Low-balance threshold set to ${fmtCr(f.threshold)}`); };
  const doFreeze = () => ask(
    { action: 'wallet.freeze', title: `Freeze wallet — ${c.name}`, confirmLabel: 'Freeze wallet', danger: true, body: 'Blocks all new paid usage (wallet state → Blocked for new usage). Running evaluations still finish. Account status is unchanged.' },
    (reason) => { freezeWallet(c.id, reason); show('Wallet frozen'); },
  );
  const doUnfreeze = () => ask(
    { action: 'wallet.freeze', title: `Unfreeze wallet — ${c.name}`, confirmLabel: 'Unfreeze', body: 'New paid usage may start again, subject to balance and overdraft rules.' },
    () => { unfreezeWallet(c.id); show('Wallet unfrozen'); },
  );
  const doRetry = (p) => { retryPayment(p.id); show(`${p.id} recovered · +${num(p.credits)} cr issued`); };
  const doEdit = (patch) => { updateClient(c.id, patch); setModal(null); show('Organization details updated'); };
  const doStep = (s) => ask(
    { action: 'client.offboard', title: `Mark step done — ${s.label}`, confirmLabel: 'Mark done', body: 'Offboarding steps are permanent, audited actions on a closing tenant.' },
    () => { completeOffboardingStep(c.id, s.key); show(`Step completed: ${s.label}`); },
  );
  const doGrant = (m) => { grantModuleAccess(m.key, c.id); show(`${m.name} (beta) granted to ${c.name}`); };
  const doRevokeAccess = (m) => { revokeModuleAccess(m.key, c.id); show(`${m.name} (beta) revoked for ${c.name}`); };

  return (
    <>
      {/* breadcrumb */}
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
        <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/admin/clients')}>Clients</span> › {c.name}
      </div>

      {/* header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, minWidth: 0 }}>
          <div className="avatar" style={{ width: 54, height: 54, background: st.bg || '#DBEAFE', color: st.fg || '#1E40AF', fontSize: 18 }}>{initials(c.name)}</div>
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
              <h1 style={{ fontSize: 23, fontWeight: 700, margin: 0 }}>{c.name}</h1>
              <ClientStatusBadge status={c.status} />
              <WalletStateBadge state={w.state} />
              {c.paused && <span className="badge" style={{ background: '#EFF6FF', color: '#1E40AF' }}><Pause size={11} /> Usage paused</span>}
              {hasSpike && <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}><Flame size={11} /> Spike flagged</span>}
              {isPending && c.inviteRevoked && <span className="badge" style={{ background: '#FEE2E2', color: '#B91C1C' }}><Ban size={11} /> Invite revoked</span>}
            </div>
            <div style={{ fontSize: 13, color: '#6B7280', marginTop: 4, display: 'flex', flexWrap: 'wrap', gap: '2px 6px', alignItems: 'center' }}>
              <span>{c.industry}</span><Dot /><span>{c.country}</span><Dot /><Mono>{c.tenantId}</Mono><Dot />
              <span>{c.owner?.name} <span style={{ color: '#9CA3AF' }}>({c.owner?.email})</span></span><Dot /><span>since {c.since}</span>
            </div>
            {c.statusReason && (
              <div style={{ fontSize: 12.5, marginTop: 5, color: isSuspended ? '#B91C1C' : '#C2410C', display: 'flex', alignItems: 'center', gap: 6 }}>
                <AlertCircle size={13} /> {st.label}{c.suspendedAt ? ` since ${c.suspendedAt}` : c.offboarding?.startedAt ? ` since ${c.offboarding.startedAt}` : ''} — {c.statusReason}
              </div>
            )}
          </div>
        </div>

        {/* status-driven actions (spec §03 · §08 · §12) */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {isPending && <>
            <PermButton action="client.invite" onClick={doResend}><Mail size={15} /> Resend invite</PermButton>
            <PermButton action="client.invite" style={dangerBtn} disabled={!!c.inviteRevoked} onClick={doRevoke} title={c.inviteRevoked ? 'Already revoked — resend to issue a new invite' : undefined}><Ban size={15} /> Revoke invite</PermButton>
            <PermButton action="client.invite" onClick={doActivate} title="Prototype-only: simulates the owner clicking the activation link"><Sparkles size={15} /> Simulate owner activation <span className="badge" style={{ background: '#EDE9FE', color: '#6D28D9', marginLeft: 2 }}>prototype</span></PermButton>
          </>}
          {isActive && <>
            <PermButton action="impersonate" onClick={doImpersonate}><LogIn size={15} /> Impersonate</PermButton>
            {c.paused
              ? <PermButton action="usage.pause" className="btn-success" onClick={doResume}><Play size={15} /> Resume usage</PermButton>
              : <PermButton action="usage.pause" onClick={doPause}><Pause size={15} /> Pause usage</PermButton>}
            <PermButton action="client.suspend" style={dangerBtn} onClick={doSuspend}><ShieldAlert size={15} /> Suspend</PermButton>
            <PermButton action="client.offboard" style={dangerBtn} onClick={doOffboard}><Archive size={15} /> Start offboarding <Lock size={11} /></PermButton>
          </>}
          {isSuspended && <>
            <PermButton action="client.reinstate" className="btn-success" onClick={doReinstate}><RotateCcw size={15} /> Reinstate</PermButton>
            <PermButton action="client.offboard" style={dangerBtn} onClick={doOffboard}><Archive size={15} /> Start offboarding <Lock size={11} /></PermButton>
          </>}
          {inClosure && <button className="btn-ghost" onClick={() => setTab('offboarding')}><ClipboardList size={15} /> Offboarding checklist</button>}
          {NON_PENDING.includes(c.status) && <PermButton action="client.export" onClick={doExport}><Download size={15} /> Export data</PermButton>}
        </div>
      </div>

      {/* banners (spec §06 · §08) */}
      {isPending && (
        <div className="banner info"><Mail size={17} />
          <div style={{ flex: 1 }}><b>Awaiting owner activation.</b> Invited {c.invitedAt || c.since}{c.inviteRevoked ? ' · invite revoked — resend to issue a new link' : ''}. The workspace cannot be used until {c.owner?.name || 'the owner'} activates; the wallet already exists at {fmtCr(w.balance)}.</div>
        </div>
      )}
      {w.frozen && (
        <div className="banner dark"><Snowflake size={17} />
          <div style={{ flex: 1 }}><b>Wallet frozen.</b> New paid usage is blocked until Cuba Admin unfreezes the wallet; running evaluations still finish.{w.balance < 0 ? ` Outstanding −${fmtCr(w.outstanding)} remains and is cleared first by the next top-up.` : ''}</div>
          <PermButton action="wallet.freeze" className="btn-ghost" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} onClick={doUnfreeze}>Unfreeze</PermButton>
        </div>
      )}
      {w.state === 'OVERDRAFT' && (
        <div className="banner danger"><AlertTriangle size={17} />
          <div style={{ flex: 1 }}><b>Negative wallet −{fmtCr(w.outstanding)}.</b> New paid evaluations are blocked; running evaluations finish. Top-up clears debt first.</div>
          <PermButton action="wallet.addCredits" className="btn-primary" onClick={() => setModal('add')}><Plus size={14} /> Add credits</PermButton>
        </div>
      )}
      {w.state === 'LOW_BALANCE' && (
        <div className="banner warn"><AlertTriangle size={17} />
          <div style={{ flex: 1 }}><b>Low balance — {fmtCr(w.available)} available</b> (threshold {fmtCr(w.lowBalanceThreshold)}). Client stays ACTIVE; a dashboard warning and notification were sent. New evaluations still start until available credits run out.</div>
          <PermButton action="wallet.addCredits" className="btn-ghost" onClick={() => setModal('add')}><Plus size={14} /> Add credits</PermButton>
        </div>
      )}
      {w.state === 'ZERO' && !isPending && (
        <div className="banner warn"><AlertTriangle size={17} />
          <div style={{ flex: 1 }}><b>Zero balance.</b> Client stays ACTIVE — new paid evaluations are paused until a top-up; running work is unaffected.</div>
          <PermButton action="wallet.addCredits" className="btn-ghost" onClick={() => setModal('add')}><Plus size={14} /> Add credits</PermButton>
        </div>
      )}
      {c.paused && (
        <div className="banner info"><Pause size={17} />
          <div style={{ flex: 1 }}><b>Usage paused by Cuba Admin.</b> New evaluations will not start for this client; running ones finish. {inClosure ? 'Paused automatically as part of offboarding.' : 'Account status is unchanged.'}</div>
          {isActive && <PermButton action="usage.pause" className="btn-ghost" onClick={doResume}><Play size={14} /> Resume usage</PermButton>}
        </div>
      )}
      {hasSpike && (
        <div className="banner warn"><Flame size={17} />
          <div style={{ flex: 1 }}><b>Suspicious usage spike detected.</b> Volume is well above this client's 7-day average — auto-flagged, no action taken. Review usage before intervening: safety controls are the seatbelt, not the steering wheel.</div>
          <button className="btn-ghost" onClick={() => nav(`/admin/usage?client=${c.id}`)}><Activity size={14} /> View usage</button>
          <PermButton action="client.edit" className="btn-ghost" onClick={doAckSpike}><Check size={14} /> Acknowledge</PermButton>
        </div>
      )}

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {/* ═══ OVERVIEW ═══ */}
      {tab === 'overview' && (
        <div className="fade-in">
          {/* wallet card (spec §05 · §07) */}
          <div className="card" style={{ padding: '18px 20px', marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span className="icon-box" style={{ width: 34, height: 34 }}><Wallet size={17} /></span>
                <h2 className="section-title" style={{ margin: 0 }}>Credit wallet</h2>
                <WalletStateBadge state={w.state} />
                {w.frozen && <span className="badge" style={{ background: '#F3F4F6', color: '#374151' }}><Snowflake size={11} /> Frozen</span>}
              </div>
              <div style={{ fontSize: 12, color: '#9CA3AF' }}>Wallet accounting (credits) is separate from money accounting (₹ payments) · 1 credit = {fmtMoney(CURRENCY.perCredit)}<PendingChip /></div>
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
              <Stat label="Current balance" value={<span style={{ color: w.balance < 0 ? '#B91C1C' : '#14212A' }}>{fmtCr(w.balance)}</span>} sub={w.balance < 0 ? 'negative — platform covered a running evaluation' : 'credits on the wallet'} big />
              <Stat label="Reserved" value={fmtCr(w.reserved)} sub="held before a paid module starts" />
              <Stat label="Available" value={<span style={{ color: w.available === 0 ? '#B91C1C' : '#15803D' }}>{fmtCr(w.available)}</span>} sub="balance − reserved · governs the next evaluation" />
              <Stat label="Outstanding (negative)" value={<span style={{ color: w.outstanding > 0 ? '#B91C1C' : '#6B7280' }}>{w.outstanding > 0 ? `−${fmtCr(w.outstanding)}` : '—'}</span>} sub={w.outstanding > 0 ? 'cleared first by the next top-up' : 'no debt'} />
              <Stat label={<>Overdraft limit<PendingChip /></>} value={fmtCr(w.overdraftLimit)} sub={`new work may start down to −${num(w.overdraftLimit)} cr · never stops a running evaluation`} />
              <Stat label={<>Low-balance threshold<PendingChip /></>} value={fmtCr(w.lowBalanceThreshold)} sub={`platform default ${fmtCr(DEFAULTS.lowBalanceThreshold)}`} />
              <Stat label="Last top-up" value={w.lastTopUp || '—'} sub={w.lastTopUp ? 'purchase or grant' : 'no credits received yet'} />
              <Stat label="Recent usage" value={fmtCr(u.creditsConsumed)} sub={`consumed to date · ${num(u.evaluations)} evaluations`} />
            </div>
            <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 16, paddingTop: 14, borderTop: '1px solid #F3F4F6', alignItems: 'center' }}>
              <PermButton action="wallet.addCredits" className="btn-primary" onClick={() => setModal('add')}><Plus size={14} /> Add credits</PermButton>
              <PermButton action="wallet.refund" onClick={() => setModal('refund')}><Undo2 size={14} /> Refund</PermButton>
              <PermButton action="wallet.adjust" onClick={() => setModal('adjust')}><SlidersHorizontal size={14} /> Manual adjustment <Lock size={11} /></PermButton>
              <PermButton action="wallet.overdraft" onClick={() => setModal('overdraft')}><Gauge size={14} /> Change overdraft limit <Lock size={11} /></PermButton>
              <PermButton action="wallet.threshold" onClick={() => setModal('threshold')}><AlertTriangle size={14} /> Set low-balance threshold</PermButton>
              {w.frozen
                ? <PermButton action="wallet.freeze" className="btn-success" onClick={doUnfreeze}><Flame size={14} /> Unfreeze wallet</PermButton>
                : <PermButton action="wallet.freeze" style={dangerBtn} onClick={doFreeze}><Snowflake size={14} /> Freeze wallet</PermButton>}
              <span style={{ marginLeft: 'auto', fontSize: 11.5, color: '#9CA3AF', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Lock size={11} /> = critical · reason + re-authentication</span>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 18, alignItems: 'start' }}>
            {/* usage summary (spec §08) */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <h2 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Activity size={16} color="#056FD4" /> Usage summary</h2>
                <span style={linkStyle} onClick={() => nav(`/admin/usage?client=${c.id}`)}>Full usage <ArrowRight size={13} /></span>
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 10 }}>
                <Metric label="Candidates" value={num(u.candidates)} />
                <Metric label="Evaluations" value={num(u.evaluations)} />
                <Metric label="Resume analyses" value={num(u.resumeAnalyses)} />
                <Metric label="Assessments" value={num(u.assessmentAttempts)} sub={`${num(u.assessmentCompletions)} completed`} />
                <Metric label="AI interviews" value={num(u.interviews)} sub={`${num(u.interviewMinutes)} min`} />
                <Metric label="Proctoring" value={num(u.proctoringSessions)} sub="sessions" />
                <Metric label="Failed / aborted" value={num(u.failed)} color={u.failed > 0 ? '#B45309' : undefined} sub={openJobs.length ? `${openJobs.length} open job${openJobs.length > 1 ? 's' : ''}` : 'technical ≠ candidate failure'} />
                <Metric label="Credits consumed" value={num(u.creditsConsumed)} sub="cr" />
              </div>
              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid #F3F4F6', fontSize: 12, color: '#6B7280', display: 'flex', flexWrap: 'wrap', gap: '4px 14px' }}>
                <span style={{ fontWeight: 700, color: '#374151' }}>Safety controls</span>
                <span>Max overdraft <b>{fmtCr(w.overdraftLimit)}</b></span>
                <span>Wallet <b>{w.frozen ? 'frozen' : 'open'}</b></span>
                <span>Usage <b>{c.paused ? 'paused' : 'running'}</b></span>
                <span>Spike flag <b>{hasSpike ? 'raised' : 'none'}</b></span>
                <span>Open opps <b>{num(c.oppsOpen)}</b> · seats <b>{num(c.seats)}</b></span>
              </div>
            </div>

            {/* organization details (spec §02) */}
            <div className="card" style={{ padding: '18px 20px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                <h2 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Building2 size={16} color="#056FD4" /> Organization details</h2>
                <PermButton action="client.edit" className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => setModal('edit')}><Pencil size={13} /> Edit</PermButton>
              </div>
              <Row k="Legal name" v={c.legalName || '—'} />
              <Row k="Website" v={c.website || '—'} />
              <Row k="Tenant ID" v={<Mono>{c.tenantId}</Mono>} />
              <Row k="Primary owner" v={<span>{c.owner?.name} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>· {c.owner?.designation}</span></span>} />
              <Row k="Owner contact" v={<span style={{ fontWeight: 500 }}>{c.owner?.email} · {c.owner?.phone}</span>} />
              <Row k="Billing" v={<span style={{ fontWeight: 500 }}>{c.billing?.currency || 'INR'}{c.billing?.gstin ? ` · GSTIN ${c.billing.gstin}` : ' · GSTIN pending'}{c.billing?.address ? ` · ${c.billing.address}` : ''}</span>} />
              <Row k="Sales / account owner" v={c.salesOwner || '—'} />
              <Row k="Timeline" v={<span style={{ fontWeight: 500 }}>since {c.since}{c.invitedAt ? ` · invited ${c.invitedAt}` : ''}{c.activatedAt ? ` · activated ${c.activatedAt}` : ''}</span>} last />
              <div style={{ marginTop: 12, background: '#F8FAFF', border: '1px solid #EEF2F7', borderRadius: 8, padding: '10px 12px' }}>
                <div className="eyebrow" style={{ marginBottom: 4 }}>Internal notes</div>
                <div style={{ fontSize: 13, color: c.notes ? '#374151' : '#9CA3AF' }}>{c.notes || 'No internal notes yet.'}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ═══ LEDGER (spec §05) ═══ */}
      {tab === 'ledger' && (
        <div className="card fade-in" style={{ overflow: 'hidden' }}>
          <CardHead icon={History} title="Credit ledger" sub="Immutable — entries are never edited or deleted; corrections are reversal entries. Every consumption traces Client → Opportunity → Candidate → Module → Usage → Rate → Credits." right={<span style={linkStyle} onClick={() => nav(`/admin/credits?tab=ledger&client=${c.id}`)}>Open in Credits &amp; Billing <ArrowRight size={13} /></span>} />
          <div className="table-wrap">
            <table>
              <thead><tr><th>Entry</th><th>When</th><th>Type</th><th style={{ textAlign: 'right' }}>Credits</th><th style={{ textAlign: 'right' }}>Balance after</th><th>Trace · reason · reference</th><th>Actor</th></tr></thead>
              <tbody>
                {cLedger.length === 0 ? <EmptyRow cols={7} text="No credit movements yet — the wallet was created at 0." /> : cLedger.map((e) => (
                  <tr key={e.id}>
                    <td><Mono>{e.id}</Mono></td>
                    <td style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{e.when}</td>
                    <td><LedgerTypeBadge type={e.type} /></td>
                    <td style={{ textAlign: 'right' }}>{e.type === 'RESERVE' ? <span style={{ color: '#B45309', fontWeight: 700 }}>hold {num(e.hold)} cr</span> : <Credits n={e.credits} />}</td>
                    <td className="tnum" style={{ textAlign: 'right', fontWeight: 600, color: e.balanceAfter < 0 ? '#B91C1C' : '#14212A' }}>{num(e.balanceAfter)} cr</td>
                    <td style={{ fontSize: 12.5 }}>
                      {e.oppTitle && <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}><span style={{ fontWeight: 600 }}>{e.oppTitle}</span>{e.candidate && <><ArrowRight size={11} color="#9CA3AF" /><span>{e.candidate}</span></>}{e.module && <><ArrowRight size={11} color="#9CA3AF" /><span>{e.module}</span></>}</div>}
                      {(e.usage || e.rate) && <div style={{ color: '#6B7280' }}>{[e.usage, e.rate].filter(Boolean).join(' · ')}</div>}
                      {e.reason && <div style={{ color: '#374151' }}>Reason: {e.reason}</div>}
                      {e.ref && <div style={{ color: '#6B7280' }}>Ref <Mono>{e.ref}</Mono></div>}
                      {e.reserveRef && <div style={{ color: '#6B7280' }}>Settles <Mono>{e.reserveRef}</Mono></div>}
                      {e.note && <div style={{ color: '#9CA3AF' }}>{e.note}</div>}
                    </td>
                    <td style={{ color: '#6B7280', fontSize: 12.5, whiteSpace: 'nowrap' }}>{e.actor}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ PAYMENTS (spec §07 billing records) ═══ */}
      {tab === 'payments' && (
        <div className="card fade-in" style={{ overflow: 'hidden' }}>
          <CardHead icon={Coins} title="Payments" sub="Money domain (₹) — related to the wallet but a separate table. Credits are issued only when a payment succeeds; failed and pending payments never issue credits." right={<span style={linkStyle} onClick={() => nav(`/admin/credits?tab=payments&client=${c.id}`)}>All payments <ArrowRight size={13} /></span>} />
          <div className="table-wrap">
            <table>
              <thead><tr><th>Payment</th><th>Date</th><th>Status</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>Credits</th><th>Method</th><th>Reference</th><th>Note</th><th></th></tr></thead>
              <tbody>
                {cPayments.length === 0 ? <EmptyRow cols={9} text="No payments recorded for this client." /> : cPayments.map((p) => (
                  <tr key={p.id}>
                    <td><Mono>{p.id}</Mono></td>
                    <td style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{p.date}</td>
                    <td><PaymentStatusBadge status={p.status} /></td>
                    <td className="tnum" style={{ textAlign: 'right', fontWeight: 600 }}>{fmtMoney(p.amount)} <span style={{ color: '#9CA3AF', fontWeight: 500, fontSize: 11 }}>{p.currency}</span></td>
                    <td className="tnum" style={{ textAlign: 'right', fontWeight: 600, color: p.status === 'SUCCEEDED' ? '#15803D' : '#9CA3AF' }}>{num(p.credits)} cr</td>
                    <td style={{ fontSize: 12.5 }}>{p.method}{/offline|cheque/i.test(p.method) && <span className="badge" style={{ background: '#F3F4F6', color: '#6B7280', marginLeft: 6 }}>manual</span>}</td>
                    <td><Mono>{p.reference || '—'}</Mono></td>
                    <td style={{ fontSize: 12.5, color: '#6B7280' }}>{p.note || '—'}</td>
                    <td style={{ textAlign: 'right' }}>{p.status === 'FAILED' && <PermButton action="payment.record" className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => doRetry(p)}><RefreshCw size={12} /> Retry</PermButton>}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ TICKETS (spec §09) ═══ */}
      {tab === 'tickets' && (
        <div className="card fade-in" style={{ overflow: 'hidden' }}>
          <CardHead icon={LifeBuoy} title="Support tickets" sub="Support path: Candidate → Client Support → Cuba Admin. Candidate issues arrive here via the client." right={<span style={linkStyle} onClick={() => nav('/admin/support?tab=tickets')}>Support desk <ArrowRight size={13} /></span>} />
          <div className="table-wrap">
            <table>
              <thead><tr><th>Ticket</th><th>Subject</th><th>Case</th><th>Priority</th><th>Status</th><th>Updated</th><th></th></tr></thead>
              <tbody>
                {cTickets.length === 0 ? <EmptyRow cols={7} text="No tickets raised by this client." /> : cTickets.map((t) => (
                  <tr key={t.id} className="row" onClick={() => nav(`/admin/support?ticket=${t.id}`)}>
                    <td><Mono>{t.id}</Mono></td>
                    <td><div style={{ fontWeight: 600 }}>{t.subject}</div>{(t.candidate || t.oppTitle) && <div style={{ fontSize: 12, color: '#6B7280' }}>{[t.candidate, t.oppTitle].filter(Boolean).join(' · ')}</div>}</td>
                    <td style={{ fontSize: 12.5 }}>{caseLabel(t.caseType)}</td>
                    <td><PriorityBadge priority={t.priority} /></td>
                    <td><TicketStatusBadge status={t.status} /></td>
                    <td style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{t.updated}</td>
                    <td style={{ textAlign: 'right' }}><ArrowRight size={14} color="#9CA3AF" /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ FAILED JOBS (spec §09 needs-attention queue) ═══ */}
      {tab === 'jobs' && (
        <div className="card fade-in" style={{ overflow: 'hidden' }}>
          <CardHead icon={Wrench} title="Failed jobs / needs attention" sub="A technical failure must not be interpreted as candidate failure. Recovery actions (retry, resend, extend, reset, retake, resume, reverse credits, escalate) live in the Support desk." right={<span style={linkStyle} onClick={() => nav('/admin/support?tab=jobs')}>Failed jobs queue <ArrowRight size={13} /></span>} />
          <div className="table-wrap">
            <table>
              <thead><tr><th>Job</th><th>Kind</th><th>Candidate</th><th>Module</th><th>Since</th><th style={{ textAlign: 'right' }}>Credits held</th><th>Status</th><th></th></tr></thead>
              <tbody>
                {cJobs.length === 0 ? <EmptyRow cols={8} text="No failed or stuck jobs for this client." /> : cJobs.map((j) => {
                  const k = JOB_KINDS[j.kind] || { label: j.kind, color: '#6B7280' };
                  return (
                    <tr key={j.id} className="row" onClick={() => nav(`/admin/support?tab=jobs&job=${j.id}`)}>
                      <td><Mono>{j.id}</Mono></td>
                      <td><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: k.color }}><span style={{ width: 8, height: 8, borderRadius: '50%', background: k.color }} />{k.label}</span><div style={{ fontSize: 12, color: '#6B7280', maxWidth: 360 }}>{j.detail}</div></td>
                      <td><div style={{ fontWeight: 600 }}>{j.candidate}</div><div style={{ fontSize: 12, color: '#6B7280' }}>{j.oppTitle}</div></td>
                      <td style={{ fontSize: 12.5 }}>{j.module}</td>
                      <td style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{j.since}</td>
                      <td className="tnum" style={{ textAlign: 'right', fontWeight: 600, color: j.creditsHeld > 0 ? '#B45309' : '#9CA3AF' }}>{num(j.creditsHeld)} cr</td>
                      <td><JobStatus status={j.status} /></td>
                      <td style={{ textAlign: 'right' }}><ArrowRight size={14} color="#9CA3AF" /></td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ MODULE ACCESS (spec §10) ═══ */}
      {tab === 'modules' && (
        <div className="card fade-in" style={{ overflow: 'hidden' }}>
          <CardHead icon={Puzzle} title="Module access" sub={<><b>Admin controls what Cuba offers; the client controls how it is used inside an opportunity.</b> Active modules are available to every client; Beta modules need a per-client grant; Disabled and Deprecated modules are never available for new use.</>} right={<span style={linkStyle} onClick={() => nav('/admin/platform?tab=modules')}>Platform modules <ArrowRight size={13} /></span>} />
          <div className="table-wrap">
            <table>
              <thead><tr><th>Module</th><th>Version</th><th>State</th><th>Rollout</th><th>Availability for {c.name}</th><th></th></tr></thead>
              <tbody>
                {modules.length === 0 ? <EmptyRow cols={6} text="No modules in the catalog." /> : modules.map((m) => {
                  const av = moduleAvailableFor(m.key, c.id);
                  const granted = (m.clientAccess || []).includes(c.id) || (c.moduleAccess || []).includes(m.key);
                  return (
                    <tr key={m.key}>
                      <td><div style={{ fontWeight: 600 }}>{m.name}</div><div style={{ fontSize: 12, color: '#6B7280' }}>{m.scoring} · {m.defaults}</div></td>
                      <td><Mono>{m.version}</Mono></td>
                      <td><ModuleStateBadge state={m.state} />{m.paused && <span className="badge" style={{ background: '#FEE2E2', color: '#B91C1C', marginLeft: 6 }}>paused</span>}</td>
                      <td style={{ fontSize: 12.5 }}>{m.rollout}</td>
                      <td style={{ fontSize: 12.5 }}>
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: av.ok ? '#15803D' : '#6B7280' }}>
                          {av.ok ? <CheckCircle2 size={14} /> : <Ban size={14} />}
                          {m.state === 'ACTIVE' ? (m.paused ? 'New attempts paused' : 'Available (all clients)') : m.state === 'BETA' ? (granted ? 'Granted (beta)' : 'Not granted') : m.state === 'DISABLED' ? 'Disabled by Cuba Admin' : 'Deprecated — no new opportunities'}
                        </span>
                        {av.note && m.state !== 'BETA' && <div style={{ color: '#9CA3AF' }}>{av.note}</div>}
                      </td>
                      <td style={{ textAlign: 'right' }}>
                        {m.state === 'BETA' && (granted
                          ? <PermButton action="module.manage" className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12, ...dangerBtn }} onClick={() => doRevokeAccess(m)}>Revoke access</PermButton>
                          : <PermButton action="module.manage" className="btn-primary" style={{ padding: '5px 10px', fontSize: 12 }} onClick={() => doGrant(m)}>Grant access</PermButton>)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ═══ OFFBOARDING (spec §12) ═══ */}
      {tab === 'offboarding' && (
        <div className="fade-in">
          <div className="card" style={{ padding: '18px 20px', marginBottom: 18 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
              <h2 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><Archive size={16} color="#C2410C" /> Lifecycle</h2>
              <ClientStatusBadge status={c.status} />
            </div>
            <LifecycleStrip current={c.status} />
            {(isSuspended || isPending) && <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 10 }}>{isSuspended ? 'SUSPENDED is a temporary block outside the closure path — reinstate to ACTIVE or start offboarding.' : 'INVITE_PENDING is before the lifecycle path — revoke the invite instead of offboarding.'}</div>}
          </div>

          {c.offboarding ? (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
              <div className="card" style={{ padding: '18px 20px' }}>
                <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ClipboardList size={16} color="#056FD4" /> Offboarding checklist</h2>
                <div style={{ background: '#FFF7ED', border: '1px solid #FED7AA', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: '#9A3412', marginBottom: 14 }}>
                  <b>Reason:</b> {c.offboarding.reason} <span style={{ color: '#C2410C' }}>· started {c.offboarding.startedAt}</span>
                </div>
                <OffboardingSteps steps={c.offboarding.steps || []} client={c} wallet={w} openTickets={openTickets.length} openJobs={openJobs.length} settings={settings} onStep={doStep} onExport={doExport} onAdd={() => setModal('add')} />
              </div>
              <RetentionCard settings={settings} nav={nav} />
            </div>
          ) : (
            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1.2fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
              <div className="card" style={{ padding: '18px 20px' }}>
                <h2 className="section-title" style={{ display: 'flex', alignItems: 'center', gap: 8 }}><ClipboardList size={16} color="#056FD4" /> Not offboarding</h2>
                <p style={{ fontSize: 13, color: '#374151', margin: '0 0 12px', lineHeight: 1.5 }}>
                  Offboarding is a <b>permanent</b> closure: new opportunities, evaluations and users stop; running candidate evaluations finish safely; pending work, negative balance and payment issues are cleared; remaining credits are settled; an eligible data export is provided; then the configured retention period, optional legal hold, and finally deletion / anonymisation of eligible personal data.
                </p>
                <ol style={{ margin: '0 0 14px', paddingLeft: 20, fontSize: 12.5, color: '#6B7280', lineHeight: 1.7 }}>
                  {OFFBOARDING_STEPS.map((s) => <li key={s.key}>{s.label}</li>)}
                </ol>
                {(isActive || isSuspended) && <PermButton action="client.offboard" className="btn-primary" style={{ background: '#DC2626' }} onClick={doOffboard}><Archive size={14} /> Start offboarding <Lock size={11} /></PermButton>}
                {isPending && <div style={{ fontSize: 12.5, color: '#9CA3AF' }}>Nothing to offboard yet — revoke the invite to abandon this organization.</div>}
              </div>
              <RetentionCard settings={settings} nav={nav} />
            </div>
          )}
        </div>
      )}

      {/* modals */}
      {modal === 'add' && <AddCreditsModal client={c} wallet={w} onClose={() => setModal(null)} onSubmit={doAdd} />}
      {modal === 'refund' && <RefundModal client={c} onClose={() => setModal(null)} onSubmit={doRefund} />}
      {modal === 'adjust' && <AdjustModal client={c} wallet={w} onClose={() => setModal(null)} onSubmit={doAdjust} />}
      {modal === 'overdraft' && <OverdraftModal wallet={w} onClose={() => setModal(null)} onSubmit={doOverdraft} />}
      {modal === 'threshold' && <ThresholdModal wallet={w} onClose={() => setModal(null)} onSubmit={doThreshold} />}
      {modal === 'edit' && <EditDetailsModal client={c} onClose={() => setModal(null)} onSubmit={doEdit} />}
      {gateNode}
      {toastNode}
    </>
  );
}

/* ═══════════ local components ═══════════ */

const Dot = () => <span style={{ color: '#CBD5E1' }}>·</span>;

function Stat({ label, value, sub, big }) {
  return (
    <div style={{ background: '#F8FAFF', border: '1px solid #EEF2F7', borderRadius: 10, padding: '12px 14px', minWidth: 0 }}>
      <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>{label}</div>
      <div className="tnum" style={{ fontSize: big ? 24 : 19, fontWeight: 700, letterSpacing: '-0.5px', marginTop: 4, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

function Metric({ label, value, sub, color }) {
  return (
    <div style={{ border: '1px solid #EEF2F7', borderRadius: 10, padding: '10px 12px', minWidth: 0 }}>
      <div className="eyebrow">{label}</div>
      <div className="tnum" style={{ fontSize: 20, fontWeight: 700, letterSpacing: '-0.5px', marginTop: 3, color: color || '#14212A' }}>{value}</div>
      {sub && <div style={{ fontSize: 11, color: '#9CA3AF' }}>{sub}</div>}
    </div>
  );
}

function CardHead({ icon: Icon, title, sub, right }) {
  return (
    <div style={{ padding: '16px 18px 12px', display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap' }}>
      <div style={{ minWidth: 0 }}>
        <h2 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}>{Icon && <Icon size={16} color="#056FD4" />} {title}</h2>
        {sub && <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 4, maxWidth: 760 }}>{sub}</div>}
      </div>
      {right}
    </div>
  );
}

function JobStatus({ status }) {
  const m = { OPEN: ['#FEF3C7', '#B45309', 'Open'], RECOVERED: ['#DCFCE7', '#15803D', 'Recovered'], ESCALATED: ['#EDE9FE', '#6D28D9', 'Escalated'] };
  const [bg, fg, l] = m[status] || ['#F3F4F6', '#6B7280', status];
  return <span className="badge" style={{ background: bg, color: fg }}>{l}</span>;
}

function LifecycleStrip({ current }) {
  const idx = LIFECYCLE.indexOf(current);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      {LIFECYCLE.map((s, i) => {
        const on = i === idx; const done = idx > -1 && i < idx;
        const meta = CLIENT_STATUS[s] || {};
        return (
          <div key={s} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span className="chip" style={{ background: on ? '#056FD4' : done ? '#DCFCE7' : '#F3F4F6', color: on ? '#fff' : done ? '#15803D' : '#9CA3AF', border: on ? '1px solid #056FD4' : '1px solid transparent', fontWeight: on ? 700 : 600 }}>
              {done && <Check size={12} />}{meta.label || s}
            </span>
            {i < LIFECYCLE.length - 1 && <ArrowRight size={13} color="#CBD5E1" />}
          </div>
        );
      })}
    </div>
  );
}

function OffboardingSteps({ steps, client, wallet, openTickets, openJobs, settings, onStep, onExport, onAdd }) {
  const nextIdx = steps.findIndex((s) => !s.done);
  const priv = settings?.privacy || {};
  const hint = (key) => {
    switch (key) {
      case 'stop': return `${num(client.oppsOpen)} open opportunities · usage ${client.paused ? 'paused' : 'still running'}`;
      case 'drain': return 'Running candidate evaluations are never interrupted — wait for in-flight interviews / attempts to settle.';
      case 'clear': return `${openTickets} open ticket${openTickets === 1 ? '' : 's'} · ${openJobs} open job${openJobs === 1 ? '' : 's'} · ${wallet.outstanding > 0 ? `outstanding −${fmtCr(wallet.outstanding)} must be cleared` : 'no negative balance'}`;
      case 'settle': return `Remaining balance ${fmtCr(wallet.balance)} · reserved ${fmtCr(wallet.reserved)}`;
      case 'export': return 'Eligible data export: scores / reports, assessment configuration, ledger and payments.';
      case 'retention': return `Configured per data category (${(priv.retention || []).length} categories) — see table.`;
      case 'hold': return `Legal hold default: ${priv.legalHoldDefault ? 'on' : 'off'} — apply when disputes or regulatory requests exist.`;
      case 'purge': return `${priv.anonymiseAfterRetention ? 'Anonymise' : 'Delete'} eligible personal data after retention · backups purged after ${priv.backupDeletionDays ?? '—'} days`;
      default: return '';
    }
  };
  return (
    <div style={{ display: 'flex', flexDirection: 'column' }}>
      {steps.map((s, i) => {
        const isNext = i === nextIdx;
        return (
          <div key={s.key} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '10px 0', borderBottom: i < steps.length - 1 ? '1px solid #F3F4F6' : 'none', opacity: !s.done && !isNext ? 0.7 : 1 }}>
            <span className={'step-circle' + (s.done ? ' done' : isNext ? ' active' : '')} style={{ width: 28, height: 28, fontSize: 12 }}>{s.done ? <Check size={14} /> : i + 1}</span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ fontSize: 13.5, fontWeight: 600, color: s.done ? '#6B7280' : '#14212A', textDecoration: s.done ? 'line-through' : 'none' }}>{s.label}{s.key === 'settle' && <PendingChip>settlement rules · pending</PendingChip>}{s.key === 'purge' && <PendingChip>deletion timing · pending</PendingChip>}</div>
              {hint(s.key) && <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 2 }}>{hint(s.key)}</div>}
              {isNext && s.key === 'clear' && wallet.outstanding > 0 && <div style={{ marginTop: 6 }}><PermButton action="wallet.addCredits" className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={onAdd}><Plus size={12} /> Add credits to clear debt</PermButton></div>}
              {isNext && s.key === 'export' && <div style={{ marginTop: 6 }}><PermButton action="client.export" className="btn-ghost" style={{ padding: '5px 10px', fontSize: 12 }} onClick={onExport}><Download size={12} /> Generate export</PermButton></div>}
            </div>
            {isNext && <PermButton action="client.offboard" className="btn-primary" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => onStep(s)}><Check size={13} /> Mark done <Lock size={11} /></PermButton>}
            {s.done && <span style={{ fontSize: 12, color: '#15803D', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4, paddingTop: 6 }}><CheckCircle2 size={13} /> Done</span>}
          </div>
        );
      })}
      {nextIdx === -1 && steps.length > 0 && <div style={{ marginTop: 12, fontSize: 12.5, color: '#15803D', fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><CheckCircle2 size={14} /> All steps complete — eligible personal data deleted or anonymised.</div>}
    </div>
  );
}

function RetentionCard({ settings, nav }) {
  const priv = settings?.privacy || {};
  const rows = priv.retention || [];
  return (
    <div className="card" style={{ overflow: 'hidden' }}>
      <CardHead icon={FileText} title="Data categories requiring retention policy" sub={<>Retention durations are country / legal-specific and still <b>pending</b>; values below are platform defaults from Settings → Data &amp; Privacy.</>} right={<span style={linkStyle} onClick={() => nav('/admin/settings?tab=privacy')}>Privacy settings <ArrowRight size={13} /></span>} />
      <div className="table-wrap">
        <table>
          <thead><tr><th>Category</th><th style={{ textAlign: 'right' }}>Retention</th><th>Legal hold</th><th>Note</th></tr></thead>
          <tbody>
            {rows.length === 0 ? <EmptyRow cols={4} text="No retention policy configured." /> : rows.map((r) => (
              <tr key={r.category}>
                <td style={{ fontWeight: 600 }}>{r.category}</td>
                <td className="tnum" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{num(r.days)} days<PendingChip /></td>
                <td style={{ fontSize: 12.5 }}>{r.legalHoldable ? <span style={{ color: '#6D28D9', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Lock size={12} /> Can be applied</span> : <span style={{ color: '#9CA3AF' }}>—</span>}</td>
                <td style={{ fontSize: 12.5, color: '#6B7280' }}>{r.note || '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div style={{ padding: '10px 18px 14px', fontSize: 12, color: '#6B7280', display: 'flex', flexWrap: 'wrap', gap: '4px 14px', borderTop: '1px solid #F3F4F6' }}>
        <span>Legal hold default <b>{priv.legalHoldDefault ? 'on' : 'off'}</b></span>
        <span>After retention <b>{priv.anonymiseAfterRetention ? 'anonymise' : 'delete'}</b></span>
        <span>Backup deletion <b>{priv.backupDeletionDays ?? '—'} days</b><PendingChip /></span>
        <span style={{ ...linkStyle, marginLeft: 'auto' }} onClick={() => nav('/admin/compliance?tab=requests')}>Data requests &amp; legal hold <ArrowRight size={12} /></span>
      </div>
    </div>
  );
}

/* ── form helpers ── */
const Field = ({ label, children, hint, req }) => (
  <div style={{ marginBottom: 12 }}>
    <label className="field-label">{label}{req && <span className="req"> *</span>}</label>
    {children}
    {hint && <div className="hint">{hint}</div>}
  </div>
);
const Preview = ({ children, tone = 'info' }) => {
  const t = { info: ['#EFF6FF', '#BFDBFE', '#1E40AF'], warn: ['#FFFBEB', '#FDE68A', '#92400E'], ok: ['#F0FDF4', '#BBF7D0', '#15803D'] }[tone];
  return <div style={{ background: t[0], border: `1px solid ${t[1]}`, color: t[2], borderRadius: 8, padding: '9px 12px', fontSize: 12.5, marginBottom: 12 }}>{children}</div>;
};
const gateHint = <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: '#6B7280', marginTop: 4 }}><ShieldAlert size={14} style={{ flexShrink: 0, marginTop: 1 }} /> On confirm you will be asked for a reason (and re-authentication for critical actions); the entry is written to the permanent audit log.</div>;

function AddCreditsModal({ client, wallet, onClose, onSubmit }) {
  const [credits, setCredits] = useState('');
  const [type, setType] = useState('PURCHASE');
  const [method, setMethod] = useState(PAY_METHODS[0]);
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const n = Math.max(0, Math.floor(Number(credits) || 0));
  const money = n * CURRENCY.perCredit;
  const after = wallet.balance + n;
  const ok = n > 0 && (type === 'PURCHASE' || reason.trim().length >= 3);
  return (
    <Modal title={`Add credits — ${client.name}`} onClose={onClose} width={540}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!ok} onClick={() => onSubmit({ credits: n, type, method, reference: reference.trim(), reason: reason.trim() })}><Plus size={14} /> {type === 'PURCHASE' ? 'Record purchase' : 'Grant credits'}</button></>}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div className={'radio-card' + (type === 'PURCHASE' ? ' active' : '')} onClick={() => setType('PURCHASE')}><Coins size={15} /> Purchase (client pays)</div>
        <div className={'radio-card' + (type === 'ADMIN_GRANT' ? ' active' : '')} onClick={() => setType('ADMIN_GRANT')}><Sparkles size={15} /> Admin grant (free)</div>
      </div>
      <Field label="Credits" req>
        <input className="input" type="number" min={1} value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="e.g. 10000" autoFocus />
      </Field>
      {type === 'PURCHASE' && <>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
          <Field label="Payment method">
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select>
          </Field>
          <Field label="Invoice / payment reference" hint="Auto-generated if empty">
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="INV-2090" />
          </Field>
        </div>
        <Preview tone="info"><b>Amount {fmtMoney(money)}</b> at {fmtMoney(CURRENCY.perCredit)} / credit<PendingChip /> — a SUCCEEDED payment record and a PURCHASE ledger entry will be created.</Preview>
      </>}
      {type === 'ADMIN_GRANT' && (
        <Field label="Reason" req hint="Promotional / trial / goodwill — recorded on the ADMIN_GRANT ledger entry">
          <input className="input" value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Goodwill credit for Aug 19 latency incident" />
        </Field>
      )}
      {n > 0 && (wallet.balance < 0
        ? <Preview tone="warn">Outstanding <b>−{fmtCr(wallet.outstanding)}</b> is cleared first → balance after: <b>{fmtCr(after)}</b>{after >= 0 ? ' · new evaluations may start again' : ' · still negative — new evaluations stay blocked'}</Preview>
        : <Preview tone="ok">Balance after: <b>{fmtCr(after)}</b> · available {fmtCr(Math.max(0, after - wallet.reserved))}</Preview>)}
    </Modal>
  );
}

function RefundModal({ client, onClose, onSubmit }) {
  const [credits, setCredits] = useState('');
  const [ref, setRef] = useState('');
  const n = Math.max(0, Math.floor(Number(credits) || 0));
  return (
    <Modal title={`Refund credits — ${client.name}`} onClose={onClose} width={500}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={n <= 0} onClick={() => onSubmit({ credits: n, ref: ref.trim() })}><Undo2 size={14} /> Continue</button></>}>
      <Field label="Credits to refund" req><input className="input" type="number" min={1} value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="e.g. 80" autoFocus /></Field>
      <Field label="Reference (job / ledger / ticket)" hint="e.g. JOB-8807, LX-10259 or TKT-1058 — links the reversal to the original charge">
        <input className="input" value={ref} onChange={(e) => setRef(e.target.value)} placeholder="JOB-8807" />
      </Field>
      <Preview tone="info">Reverses an invalid or system-failure charge with a <b>REFUND / REVERSAL</b> entry (+{num(n)} cr). The original entry is never edited.</Preview>
      {gateHint}
    </Modal>
  );
}

function AdjustModal({ client, wallet, onClose, onSubmit }) {
  const [sign, setSign] = useState(1);
  const [credits, setCredits] = useState('');
  const n = Math.max(0, Math.floor(Number(credits) || 0)) * sign;
  return (
    <Modal title={`Manual adjustment — ${client.name}`} onClose={onClose} width={500}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={n === 0} onClick={() => onSubmit({ credits: n })}><SlidersHorizontal size={14} /> Continue</button></>}>
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <div className={'radio-card' + (sign === 1 ? ' active' : '')} onClick={() => setSign(1)}><Plus size={15} /> Add credits</div>
        <div className={'radio-card' + (sign === -1 ? ' active' : '')} onClick={() => setSign(-1)}>− Deduct credits</div>
      </div>
      <Field label="Credits" req><input className="input" type="number" min={1} value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="e.g. 500" autoFocus /></Field>
      {n !== 0 && <Preview tone={n < 0 ? 'warn' : 'ok'}>Balance {fmtCr(wallet.balance)} → <b>{fmtCr(wallet.balance + n)}</b></Preview>}
      <Preview tone="warn"><b>Critical action.</b> Exceptional accounting correction only — prefer Refund for system-failure reversals and Add credits for purchases / grants.</Preview>
      {gateHint}
    </Modal>
  );
}

function OverdraftModal({ wallet, onClose, onSubmit }) {
  const [limit, setLimit] = useState(String(wallet.overdraftLimit));
  const n = Math.max(0, Math.floor(Number(limit) || 0));
  return (
    <Modal title="Change overdraft limit" onClose={onClose} width={480}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={n === wallet.overdraftLimit} onClick={() => onSubmit({ limit: n })}><Gauge size={14} /> Continue</button></>}>
      <Field label="Overdraft limit (credits)" req hint={<>Current {fmtCr(wallet.overdraftLimit)} · platform default {fmtCr(DEFAULTS.overdraftLimit)}<PendingChip /></>}>
        <input className="input" type="number" min={0} value={limit} onChange={(e) => setLimit(e.target.value)} autoFocus />
      </Field>
      <Preview tone="info">The limit controls whether <b>new</b> work may start when available credits are short. It is never used to terminate a running candidate evaluation.</Preview>
      {gateHint}
    </Modal>
  );
}

function ThresholdModal({ wallet, onClose, onSubmit }) {
  const [threshold, setThreshold] = useState(String(wallet.lowBalanceThreshold));
  const n = Math.max(0, Math.floor(Number(threshold) || 0));
  return (
    <Modal title="Set low-balance threshold" onClose={onClose} width={460}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={n === wallet.lowBalanceThreshold} onClick={() => onSubmit({ threshold: n })}><Check size={14} /> Save threshold</button></>}>
      <Field label="Threshold (available credits)" req hint={<>Current {fmtCr(wallet.lowBalanceThreshold)} · platform default {fmtCr(DEFAULTS.lowBalanceThreshold)}<PendingChip /></>}>
        <input className="input" type="number" min={0} value={threshold} onChange={(e) => setThreshold(e.target.value)} autoFocus />
      </Field>
      <Preview tone="info">Below this level the client sees a dashboard warning and gets an email / in-app notification; the client stays ACTIVE and Admin sees it under Needs Attention.</Preview>
    </Modal>
  );
}

function EditDetailsModal({ client, onClose, onSubmit }) {
  const [f, setF] = useState({ legalName: client.legalName || '', website: client.website || '', industry: client.industry || '', country: client.country || '', salesOwner: client.salesOwner || '', gstin: client.billing?.gstin || '', address: client.billing?.address || '', notes: client.notes || '' });
  const set = (k) => (e) => setF((x) => ({ ...x, [k]: e.target.value }));
  return (
    <Modal title={`Edit organization — ${client.name}`} onClose={onClose} width={600}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" onClick={() => onSubmit({ legalName: f.legalName.trim() || client.legalName, website: f.website.trim(), industry: f.industry.trim(), country: f.country.trim(), salesOwner: f.salesOwner.trim(), billing: { ...(client.billing || {}), gstin: f.gstin.trim(), address: f.address.trim() }, notes: f.notes })}><Check size={14} /> Save changes</button></>}>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '0 12px' }}>
        <Field label="Legal name"><input className="input" value={f.legalName} onChange={set('legalName')} /></Field>
        <Field label="Website"><input className="input" value={f.website} onChange={set('website')} /></Field>
        <Field label="Industry"><input className="input" value={f.industry} onChange={set('industry')} /></Field>
        <Field label="Country"><input className="input" value={f.country} onChange={set('country')} /></Field>
        <Field label="GSTIN"><input className="input" value={f.gstin} onChange={set('gstin')} placeholder="29AABCF1234A1Z5" /></Field>
        <Field label="Billing address"><input className="input" value={f.address} onChange={set('address')} /></Field>
      </div>
      <Field label="Sales / account owner"><input className="input" value={f.salesOwner} onChange={set('salesOwner')} /></Field>
      <Field label="Internal notes" hint="Visible to Cuba Admins only">
        <textarea className="input" rows={3} value={f.notes} onChange={set('notes')} style={{ resize: 'vertical' }} />
      </Field>
      <div style={{ fontSize: 12, color: '#9CA3AF' }}>Owner identity and tenant ID are not editable here — an audit entry is written on save.</div>
    </Modal>
  );
}

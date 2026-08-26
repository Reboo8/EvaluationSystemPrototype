import { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Wallet, HandCoins, Calculator, History, Receipt, AlertTriangle, Snowflake, ArrowRight, Download, Info, Check, X, Pencil,
  CreditCard, Landmark, Zap, LifeBuoy, Pause, Plus, Loader2, ShieldCheck, Ban, CheckCircle2, RefreshCw, Archive, Bug, Coins, ChevronDown, ChevronUp,
} from 'lucide-react';
import { useApp, fmtCr, fmtMoney, CURRENCY, DEFAULTS, LEDGER_TYPE, CLIENT_STATUS, JOB_KINDS } from '../store.jsx';
import { ClientStatusBadge, WalletStateBadge, LedgerTypeBadge, PaymentStatusBadge, PendingChip, Credits, useToast, EmptyRow, Mono } from '../components/admin/ui.jsx';

/* ═══════════ Client › Credits & Wallet — spec §04 wallet lifecycle · §05 ledger · §06 low / zero / negative / blocked · §07 billing records.
   Client point of view: no plans, no monthly fee — buy credits, consume them only when evaluation services run.
   Deep links: /billing?action=buy|topup (scrolls to Buy credits) · /billing?pack=5000 (pre-selects a pack). ═══════════ */

const PACKS = [2500, 5000, 10000, 25000];
const METHODS = [
  { key: 'Razorpay', label: 'Razorpay', icon: Zap, sub: 'UPI · net banking · wallets — credits added instantly' },
  { key: 'Card', label: 'Card', icon: CreditCard, sub: 'Visa · Mastercard · Amex — credits added instantly' },
  { key: 'Bank transfer (offline)', label: 'Bank transfer — request invoice', icon: Landmark, sub: 'NEFT / RTGS — credits issued once Finance confirms (1–2 business days)' },
];
const CLOSED = ['DEACTIVATED', 'RETENTION', 'DELETED'];
const num = (n) => (Number(n) || 0).toLocaleString('en-IN');
const linkStyle = { fontSize: 12.5, color: '#056FD4', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 };
const statBox = { background: '#F8FAFF', border: '1px solid #EEF2F7', borderRadius: 10, padding: '12px 14px', minWidth: 0 };
const smallBtn = { padding: '5px 10px', fontSize: 12 };

export default function Billing() {
  const nav = useNavigate();
  const loc = useLocation();
  const {
    currentClient, currentClientId, clientWallet: w, clientLedger, clientPayments, rateCard, clientOpportunities: opportunities, settings,
    clientEstimate, clientCanStart, buyCredits, recordPayment, setClientLowBalanceThreshold, failedJobs,
  } = useApp();
  const [show, toastNode] = useToast();
  const buyRef = useRef(null);
  const params = new URLSearchParams(loc.search);
  const [pack, setPack] = useState(() => { const p = Number(params.get('pack')); return PACKS.includes(p) ? p : 10000; });
  const [custom, setCustom] = useState('');
  const [method, setMethod] = useState('Razorpay');
  const [busy, setBusy] = useState(false);
  const [typeFilter, setTypeFilter] = useState('ALL');
  const [holdsOpen, setHoldsOpen] = useState(false);

  const wantsBuy = ['buy', 'topup'].includes(params.get('action'));
  useEffect(() => { if (wantsBuy && buyRef.current) buyRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' }); }, [wantsBuy]);

  const c = currentClient || {};
  const status = c.status || 'ACTIVE';
  const st = CLIENT_STATUS[status] || {};
  const usage = c.usage || {};
  const fx = settings?.credits || DEFAULTS;
  const rateOf = (k) => (rateCard || []).find((r) => r.key === k)?.credits || 0;
  const rateName = (k) => (rateCard || []).find((r) => r.key === k)?.name || k;
  const interviewRate = rateOf('interview') || 80;
  const resumeRate = rateOf('resume');
  const oppExists = (id) => (opportunities || []).some((o) => o.id === id);

  /* §05: what the "Reserved" number is actually made of — RESERVE entries with no settlement yet, plus attempts stuck in recovery */
  const settledRefs = new Set(clientLedger.filter((e) => e.reserveRef).map((e) => e.reserveRef));
  const openHolds = clientLedger.filter((e) => e.type === 'RESERVE' && !settledRefs.has(e.id));
  const openJobs = (failedJobs || []).filter((j) => j.clientId === currentClientId && j.status === 'OPEN' && j.creditsHeld > 0);
  const holdsExplained = openHolds.reduce((a, e) => a + (e.hold || 0), 0);
  const jobsHeld = openJobs.reduce((a, j) => a + (j.creditsHeld || 0), 0);

  const credits = custom !== '' ? Math.max(0, Math.floor(Number(custom) || 0)) : pack;
  const money = credits * CURRENCY.perCredit;
  const after = w.balance + credits;
  const availableAfter = Math.max(0, after - (w.reserved || 0));
  const isBank = method.startsWith('Bank');
  const closed = CLOSED.includes(status);
  const canPay = credits > 0 && !busy && !closed;
  const start = clientCanStart(0);
  const scrollToBuy = () => buyRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const presentTypes = Object.keys(LEDGER_TYPE).filter((t) => clientLedger.some((e) => e.type === t));
  const ledgerRows = typeFilter === 'ALL' ? clientLedger : clientLedger.filter((e) => e.type === typeFilter);

  /* ── actions ── */
  const doPay = () => {
    if (!canPay) return;
    setBusy(true);
    const hadDebt = w.balance < 0; const debt = w.outstanding;
    setTimeout(() => {
      if (isBank) {
        // offline path: money record first (PENDING) — credits + PURCHASE ledger entry only when Finance confirms (spec §07)
        recordPayment(currentClientId, { amount: money, method: 'Bank transfer (offline)', status: 'PENDING', reference: '' });
        show(`Invoice requested — ${fmtMoney(money)} for ${num(credits)} cr · credits are issued once Finance confirms the transfer`);
      } else {
        buyCredits(credits, method);
        show(`+${num(credits)} cr added · ${fmtMoney(money)} via ${method}${hadDebt ? ` · ${fmtCr(Math.min(debt, credits))} of outstanding cleared first` : ''}`);
      }
      setBusy(false); setCustom('');
    }, 600);
  };
  const doThreshold = (n) => { setClientLowBalanceThreshold(n); show(`Low-balance alert set to ${fmtCr(n)} available`); };
  const doInvoice = (p) => show(`Invoice ${p.reference || p.id} — PDF download started (prototype)`);
  const doRetryPayment = (p) => { setMethod(p.method === 'Card' ? 'Card' : 'Razorpay'); setCustom(String(p.credits)); scrollToBuy(); show(`Retrying ${p.id} — review the order and pay again`); };

  return (
    <>
      {/* header */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 16, marginBottom: 18, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Credits &amp; Wallet</h1>
          <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3, maxWidth: 680 }}>You buy credits and consume them only when evaluation services run. No subscription, no monthly fee.</div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 13.5, fontWeight: 600 }}>{c.name}</span>
          <Mono>{c.tenantId}</Mono>
          <ClientStatusBadge status={status} />
          <WalletStateBadge state={w.state} />
        </div>
      </div>

      {/* wallet-state banners (spec §06) — same spirit as Home */}
      {w.state === 'BLOCKED_FOR_NEW_USAGE' && (
        <div className="banner dark"><Snowflake size={17} />
          <div style={{ flex: 1 }}><b>Wallet frozen by Cuba Admin.</b> New paid usage is blocked; evaluations already running still finish.{w.outstanding > 0 ? ` Outstanding −${fmtCr(w.outstanding)} is cleared first by your next top-up.` : ''} Contact support to resolve.</div>
          <button className="btn-ghost" style={{ background: 'rgba(255,255,255,0.12)', color: '#fff', borderColor: 'rgba(255,255,255,0.3)' }} onClick={() => nav('/support')}><LifeBuoy size={14} /> Contact support</button>
        </div>
      )}
      {w.state === 'OVERDRAFT' && (
        <div className="banner danger"><AlertTriangle size={17} />
          <div style={{ flex: 1 }}><b>Outstanding −{fmtCr(w.outstanding)}.</b> Cuba covered a shortfall so a running evaluation could finish. New paid evaluations are paused; running ones continue. Your next top-up clears this first.</div>
          <button className="btn-primary" style={{ background: '#DC2626' }} onClick={scrollToBuy}><Plus size={14} /> Top up now</button>
        </div>
      )}
      {w.state === 'ZERO' && (
        <div className="banner warn"><AlertTriangle size={17} />
          <div style={{ flex: 1 }}><b>Zero balance.</b> Your account stays Active — you can configure opportunities and your team, but new paid evaluations are paused until you top up. Running work is unaffected.</div>
          <button className="btn-primary" onClick={scrollToBuy}><Plus size={14} /> Buy credits</button>
        </div>
      )}
      {w.state === 'LOW_BALANCE' && (
        <div className="banner warn"><AlertTriangle size={17} />
          <div style={{ flex: 1 }}><b>Low balance — {fmtCr(w.available)} available</b> (alert threshold {fmtCr(w.lowBalanceThreshold)}). Evaluations still start until available credits run out; top up to avoid a pause.</div>
          <button className="btn-ghost" onClick={scrollToBuy}><Plus size={14} /> Top up</button>
        </div>
      )}
      {c.paused && (
        <div className="banner info"><Pause size={17} />
          <div style={{ flex: 1 }}><b>Usage temporarily paused by Cuba Admin.</b> New evaluations will not start; running ones finish. Your wallet and account status are unchanged.</div>
          <button className="btn-ghost" onClick={() => nav('/support')}><LifeBuoy size={14} /> Ask support</button>
        </div>
      )}
      {status === 'SUSPENDED' && (
        <div className="banner danger"><Ban size={17} />
          <div style={{ flex: 1 }}><b>Account suspended{c.statusReason ? ` — ${c.statusReason}` : ''}.</b> Data is preserved and new activity is restricted. Purchases still clear any outstanding balance first, but new evaluations stay blocked until Cuba reinstates the account.</div>
          <button className="btn-ghost" style={{ color: '#B91C1C', borderColor: '#FCA5A5' }} onClick={() => nav('/support')}><LifeBuoy size={14} /> Contact support</button>
        </div>
      )}
      {status === 'OFFBOARDING' && (
        <div className="banner warn"><Archive size={17} />
          <div style={{ flex: 1 }}><b>Account is offboarding.</b> New work has stopped; running evaluations finish safely. Remaining credits are settled per commercial policy<PendingChip>settlement rules · pending</PendingChip></div>
        </div>
      )}
      {closed && (
        <div className="banner info"><Info size={17} />
          <div style={{ flex: 1 }}><b>Workspace closed ({st.label}).</b> The ledger and payment history below remain available for your records.</div>
        </div>
      )}

      {/* ═══ wallet summary (spec §05 wallet summary fields · §06 states · §07 client view) ═══ */}
      <div className="card" style={{ padding: '18px 20px', marginBottom: 18 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
            <span className="icon-box" style={{ width: 34, height: 34 }}><Wallet size={17} /></span>
            <h2 className="section-title" style={{ margin: 0 }}>Credit wallet</h2>
            <WalletStateBadge state={w.state} />
            {w.frozen && <span className="badge" style={{ background: '#F3F4F6', color: '#374151' }}><Snowflake size={11} /> Frozen</span>}
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontSize: 12, color: '#9CA3AF', display: 'inline-flex', alignItems: 'center' }}>1 credit = {fmtMoney(CURRENCY.perCredit)}<PendingChip /></span>
            <button className="btn-primary" disabled={closed} onClick={scrollToBuy}><Plus size={14} /> Top up</button>
          </div>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12 }}>
          <Stat big label="Current balance" value={<span style={{ color: w.balance < 0 ? '#B91C1C' : '#14212A' }}>{fmtCr(w.balance)}</span>} sub={w.balance < 0 ? 'negative — Cuba covered a running evaluation' : 'credits on your wallet'} />
          <Stat label="Reserved" value={fmtCr(w.reserved)} sub={<span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 3 }} onClick={() => setHoldsOpen((v) => !v)}>{openHolds.length + openJobs.length > 0 ? `${openHolds.length + openJobs.length} open hold${openHolds.length + openJobs.length === 1 ? '' : 's'}` : 'holds for evaluations about to start'} {holdsOpen ? <ChevronUp size={12} /> : <ChevronDown size={12} />}</span>} />
          <Stat label="Available" value={<span style={{ color: w.available === 0 ? '#B91C1C' : '#15803D' }}>{fmtCr(w.available)}</span>} sub="balance − reserved · governs your next evaluation" />
          {w.outstanding > 0 && <Stat label="Outstanding" value={<span style={{ color: '#B91C1C' }}>−{fmtCr(w.outstanding)}</span>} sub={<span style={{ color: '#B91C1C', fontWeight: 600 }}>top-up clears this first</span>} />}
          <Stat label={<>Overdraft limit<PendingChip /></>} value={fmtCr(w.overdraftLimit)} sub={`new work may start down to −${num(w.overdraftLimit)} cr · never stops a running evaluation`} />
          <ThresholdStat value={w.lowBalanceThreshold} onSave={doThreshold} />
          <Stat label="Last top-up" value={w.lastTopUp || '—'} sub={w.lastTopUp ? 'purchase or grant' : 'no credits received yet'} />
          <Stat label="Consumed to date" value={fmtCr(usage.creditsConsumed)} sub={`${num(usage.evaluations)} evaluations · ${num(usage.interviews)} AI interviews`} />
        </div>
        {holdsOpen && (
          <div style={{ marginTop: 14, border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
            <div style={{ padding: '10px 14px', background: '#F8FAFF', borderBottom: '1px solid #E2E8F0', fontSize: 12.5, color: '#374151', display: 'flex', alignItems: 'center', gap: 7, flexWrap: 'wrap' }}>
              <Coins size={13} color="#B45309" /> <b>What your {fmtCr(w.reserved)} reserved is holding.</b> A hold is not a charge — when the module finishes, a Settlement consumes the actual usage and releases the rest.
            </div>
            {openHolds.length === 0 && openJobs.length === 0 ? (
              <div style={{ padding: 20, textAlign: 'center', color: '#9CA3AF', fontSize: 12.5 }}>No open holds — nothing is reserved against a named evaluation right now.</div>
            ) : (
              <table>
                <thead><tr><th>Hold</th><th>Opportunity → Candidate → Module</th><th style={{ textAlign: 'right' }}>Held</th><th>State</th></tr></thead>
                <tbody>
                  {openHolds.map((e) => (
                    <tr key={e.id}>
                      <td><Mono>{e.id}</Mono><div style={{ fontSize: 11, color: '#9CA3AF' }}>{e.when}</div></td>
                      <td style={{ fontSize: 12.5 }}>{e.oppTitle} <ArrowRight size={11} color="#9CA3AF" /> {e.candidate} <ArrowRight size={11} color="#9CA3AF" /> {e.module}</td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#B45309' }}>{fmtCr(e.hold)}</td>
                      <td><span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>awaiting settlement</span></td>
                    </tr>
                  ))}
                  {openJobs.map((j) => (
                    <tr key={j.id}>
                      <td><Mono>{j.id}</Mono><div style={{ fontSize: 11, color: '#9CA3AF' }}>{j.since}</div></td>
                      <td style={{ fontSize: 12.5 }}>{j.oppTitle} <ArrowRight size={11} color="#9CA3AF" /> {j.candidate} <ArrowRight size={11} color="#9CA3AF" /> {j.module}<div style={{ color: '#6B7280' }}>{JOB_KINDS[j.kind]?.label || j.kind} — technical failure, not a candidate result</div></td>
                      <td style={{ textAlign: 'right', fontWeight: 700, color: '#B45309' }}>{fmtCr(j.creditsHeld)}</td>
                      <td><span className="badge" style={{ background: '#FEE2E2', color: '#B91C1C' }}><Bug size={11} /> in recovery</span></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
            <div style={{ padding: '10px 14px', borderTop: '1px solid #F3F4F6', fontSize: 11.5, color: '#6B7280', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
              <span>Traced holds <b>{fmtCr(holdsExplained + jobsHeld)}</b> of {fmtCr(w.reserved)} reserved</span>
              {jobsHeld > 0 && <span style={{ color: '#B45309' }}>{fmtCr(jobsHeld)} sits on evaluations Cuba is recovering — reversible. <span style={{ color: '#056FD4', fontWeight: 700, cursor: 'pointer' }} onClick={() => nav('/support')}>Open Support →</span></span>}
            </div>
          </div>
        )}

        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap', marginTop: 14, paddingTop: 12, borderTop: '1px solid #F3F4F6', fontSize: 12.5 }}>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontWeight: 600, color: start.ok ? '#15803D' : '#B91C1C' }}>{start.ok ? <CheckCircle2 size={14} /> : <Ban size={14} />}{start.ok ? 'Next paid evaluation can start' : 'Next paid evaluation is blocked'}</span>
          {!start.ok && <span style={{ color: '#6B7280' }}>{start.reason}</span>}
          <span style={{ color: '#9CA3AF', marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 5 }}><ShieldCheck size={13} /> Billing can pause your next evaluation — never one already in progress.</span>
        </div>
      </div>

      {/* ═══ buy credits (spec §04 how credits enter · §06 top-up clears debt first) ═══ */}
      <div ref={buyRef} className="card" style={{ padding: '18px 20px', marginBottom: 18, scrollMarginTop: 72 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, flexWrap: 'wrap', marginBottom: 14 }}>
          <div>
            <h2 className="section-title" style={{ margin: 0, display: 'flex', alignItems: 'center', gap: 8 }}><HandCoins size={16} color="#056FD4" /> Buy credits</h2>
            <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 4 }}>Pay once, use across every opportunity. Credits never expire and are consumed only when a service runs for a candidate.</div>
          </div>
          <span style={{ fontSize: 12, color: '#9CA3AF', display: 'inline-flex', alignItems: 'center' }}>{fmtMoney(CURRENCY.perCredit)} per credit<PendingChip /></span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 12, marginBottom: 16 }}>
          {PACKS.map((p) => { const on = custom === '' && pack === p; return (
            <div key={p} onClick={() => { setPack(p); setCustom(''); }} style={{ border: on ? '2px solid #056FD4' : '1px solid #E2E8F0', background: on ? '#EFF6FF' : '#fff', borderRadius: 10, padding: on ? '13px 15px' : '14px 16px', cursor: 'pointer', minWidth: 0 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}><span className="eyebrow">Pack</span>{on && <Check size={14} color="#056FD4" />}</div>
              <div className="tnum" style={{ fontSize: 22, fontWeight: 700, letterSpacing: '-0.5px', marginTop: 4, color: on ? '#056FD4' : '#14212A' }}>{num(p)} cr</div>
              <div style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>{fmtMoney(p * CURRENCY.perCredit)}</div>
              <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 3 }}>≈ {num(Math.floor(p / interviewRate))} AI interviews</div>
            </div>
          ); })}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
          <div>
            <Field label="Custom amount (credits)" hint={custom !== '' && credits > 0 ? `${fmtMoney(money)} · ≈ ${num(Math.floor(credits / interviewRate))} AI interviews · ≈ ${num(resumeRate ? Math.floor(credits / resumeRate) : 0)} resume screens` : 'Any amount — packs are only shortcuts'}>
              <input className="input" type="number" min={1} value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="e.g. 7500" />
            </Field>
            <Field label="Payment method">
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {METHODS.map((m) => { const on = method === m.key; return (
                  <div key={m.key} className={'radio-card' + (on ? ' active' : '')} onClick={() => setMethod(m.key)} style={{ justifyContent: 'flex-start', textAlign: 'left', padding: '10px 12px', gap: 10 }}>
                    <span style={{ width: 16, height: 16, borderRadius: '50%', border: on ? '5px solid #056FD4' : '2px solid #CBD5E1', flexShrink: 0, background: '#fff' }} />
                    <m.icon size={15} style={{ flexShrink: 0 }} />
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600 }}>{m.label}</div>
                      <div style={{ fontSize: 11.5, color: on ? '#3B82F6' : '#9CA3AF', fontWeight: 500 }}>{m.sub}</div>
                    </div>
                  </div>
                ); })}
              </div>
            </Field>
          </div>

          <div style={{ ...statBox, padding: '14px 16px' }}>
            <div className="eyebrow" style={{ marginBottom: 6 }}>Order summary</div>
            <SRow k="Credits" v={`${num(credits)} cr`} />
            <SRow k={<>Rate<PendingChip /></>} v={`${fmtMoney(CURRENCY.perCredit)} / credit`} />
            <SRow k="Amount payable" v={<span style={{ fontSize: 16 }}>{fmtMoney(money)}</span>} />
            {w.balance < 0 ? (
              <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', color: '#92400E', borderRadius: 8, padding: '9px 12px', fontSize: 12.5, margin: '10px 0 2px', lineHeight: 1.5 }}>
                <b>Debt first:</b> −{fmtCr(w.outstanding)} cleared, then {after >= 0 ? <b>+{fmtCr(availableAfter)} available</b> : <b>−{fmtCr(-after)} still outstanding — new evaluations stay paused</b>}.
              </div>
            ) : (
              <SRow k="Available after" v={<span style={{ color: '#15803D' }}>{fmtCr(availableAfter)}</span>} last />
            )}
            <button className="btn-primary" style={{ width: '100%', justifyContent: 'center', marginTop: 10 }} disabled={!canPay} onClick={doPay}>
              {busy ? <Loader2 size={14} className="spin" /> : isBank ? <Receipt size={14} /> : <ShieldCheck size={14} />} {isBank ? 'Request invoice' : 'Pay & add credits'}
            </button>
            <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 8, lineHeight: 1.5 }}>
              {closed ? `Purchases are unavailable — the account is ${st.label}.` : isBank ? 'A proforma invoice is emailed to your billing contact. The payment shows as Pending below; credits and a PURCHASE ledger entry appear once Finance confirms.' : 'Creates a payment record (₹) and a PURCHASE entry in your credit ledger — two separate records, one purchase.'}
            </div>
          </div>
        </div>
      </div>

      {/* ═══ estimated cost guidance (spec §02 cost guidance · §04 funding guidance · §10 rate card) ═══ */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 18 }}>
        <CardHead icon={Calculator} title="Estimated cost guidance" sub={<>Rates come from Cuba's rate card<PendingChip /> — estimates only. Actual credits are consumed only when a service runs for a candidate; nothing is charged per opportunity.</>} />
        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1.25fr)', borderTop: '1px solid #F3F4F6' }}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Service</th><th>Unit</th><th style={{ textAlign: 'right' }}>Credits / unit</th><th style={{ textAlign: 'right' }}>₹ / unit</th></tr></thead>
              <tbody>
                {(rateCard || []).length === 0 ? <EmptyRow cols={4} text="Rate card not published yet." /> : rateCard.map((r) => (
                  <tr key={r.key}>
                    <td style={{ fontWeight: 600 }}>{r.name}</td>
                    <td style={{ color: '#6B7280', fontSize: 12.5 }}>{r.unit}</td>
                    <td className="tnum" style={{ textAlign: 'right', fontWeight: 600 }}>{num(r.credits)} cr</td>
                    <td className="tnum" style={{ textAlign: 'right', color: '#6B7280' }}>{fmtMoney(r.credits * CURRENCY.perCredit)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ borderLeft: '1px solid #F3F4F6', padding: '14px 18px', minWidth: 0 }}>
            <div className="eyebrow" style={{ marginBottom: 4 }}>Typical per-candidate cost — your opportunities</div>
            {(opportunities || []).length === 0 ? (
              <div style={{ color: '#9CA3AF', fontSize: 13, padding: '18px 0', textAlign: 'center' }}>No opportunities yet — create one to see its estimated cost per candidate.</div>
            ) : opportunities.map((opp, i) => {
              const est = clientEstimate(opp);
              const mods = (opp.assessment?.modules || []).filter((m) => m.key !== 'resume').map((m) => rateName(m.key));
              const funded = est.total <= w.available;
              return (
                <div key={opp.id} style={{ padding: '10px 0', borderBottom: i < opportunities.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
                    <span style={{ ...linkStyle, fontSize: 13.5 }} onClick={() => nav('/opportunities/' + opp.id)}>{opp.title} <ArrowRight size={13} /></span>
                    <span className="badge" style={{ background: opp.status === 'OPEN' ? '#DCFCE7' : '#F3F4F6', color: opp.status === 'OPEN' ? '#15803D' : '#6B7280' }}>{opp.status}</span>
                  </div>
                  <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2 }}>{[...mods, 'Proctoring'].join(' + ')}</div>
                  <div style={{ display: 'flex', gap: 14, marginTop: 8, flexWrap: 'wrap' }}>
                    <Mini label="Per fully-evaluated candidate" value={`${num(est.perCandidate)} cr`} sub={`≈ ${fmtMoney(est.perCandidate * CURRENCY.perCredit)}`} />
                    <Mini label="Per applicant screened" value={`${num(resumeRate)} cr`} sub={`resume gate · ≈ ${fmtMoney(resumeRate * CURRENCY.perCredit)}`} />
                    <Mini label={`Funding guidance · target ${num(est.target)}`} value={`${num(est.total)} cr`} tone={funded ? 'ok' : 'warn'} sub={`${num(est.resumeCap)} screens (×${fx.fundingResumeX ?? DEFAULTS.fundingResumeX}) + ${num(est.fullCap)} full evaluations (×${fx.fundingFullX ?? DEFAULTS.fundingFullX}) · ${funded ? 'covered by available credits' : `short by ${num(est.total - w.available)} cr`}`} />
                  </div>
                </div>
              );
            })}
            <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start', fontSize: 12, color: '#6B7280', marginTop: 12, paddingTop: 10, borderTop: '1px solid #F3F4F6', lineHeight: 1.5 }}>
              <Info size={14} style={{ flexShrink: 0, marginTop: 2 }} />
              <span>Funding guidance (hiring target ×{fx.fundingResumeX ?? DEFAULTS.fundingResumeX} for the resume gate, ×{fx.fundingFullX ?? DEFAULTS.fundingFullX} for full evaluation<PendingChip />) is a <b>safety requirement, not a pre-charge</b> — credits are consumed only when services actually run.</span>
            </div>
          </div>
        </div>
      </div>

      {/* ═══ ledger (spec §05 immutable · traceable) ═══ */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 18 }}>
        <CardHead icon={History} title="Credit ledger" sub="Immutable — every movement is a new entry, never edited or deleted; corrections appear as reversal entries. Each consumption traces Opportunity → Candidate → Module · usage · rate."
          right={<div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className={'filter-btn' + (typeFilter === 'ALL' ? ' active' : '')} onClick={() => setTypeFilter('ALL')}>All <span style={{ opacity: 0.7 }}>{clientLedger.length}</span></button>
            {presentTypes.map((t) => <button key={t} className={'filter-btn' + (typeFilter === t ? ' active' : '')} onClick={() => setTypeFilter(t)}>{LEDGER_TYPE[t].label}</button>)}
          </div>} />
        <div className="table-wrap">
          <table>
            <thead><tr><th>Entry</th><th>When</th><th>Type</th><th style={{ textAlign: 'right' }}>Credits</th><th style={{ textAlign: 'right' }}>Balance after</th><th>Trace</th><th>Note / reason</th></tr></thead>
            <tbody>
              {ledgerRows.length === 0 ? <EmptyRow cols={7} text={typeFilter === 'ALL' ? 'No credit movements yet — your wallet was created at 0 cr.' : `No ${LEDGER_TYPE[typeFilter]?.label.toLowerCase()} entries yet.`} /> : ledgerRows.map((e) => (
                <tr key={e.id}>
                  <td><Mono>{e.id}</Mono></td>
                  <td style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{e.when}</td>
                  <td><LedgerTypeBadge type={e.type} /></td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>{e.type === 'RESERVE' ? <span style={{ color: '#B45309', fontWeight: 700 }}>hold {num(e.hold)} cr</span> : <Credits n={e.credits} />}</td>
                  <td className="tnum" style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: e.balanceAfter < 0 ? '#B91C1C' : '#14212A' }}>{num(e.balanceAfter)} cr</td>
                  <td style={{ fontSize: 12.5 }}>
                    {e.oppTitle ? (
                      <>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
                          {oppExists(e.oppId) ? <span style={{ fontWeight: 600, color: '#056FD4', cursor: 'pointer' }} onClick={() => nav('/opportunities/' + e.oppId)}>{e.oppTitle}</span> : <span style={{ fontWeight: 600 }}>{e.oppTitle}</span>}
                          {e.candidate && <><ArrowRight size={11} color="#9CA3AF" /><span>{e.candidate}</span></>}
                          {e.module && <><ArrowRight size={11} color="#9CA3AF" /><span>{e.module}</span></>}
                        </div>
                        {(e.usage || e.rate) && <div style={{ color: '#6B7280' }}>{[e.usage, e.rate].filter(Boolean).join(' · ')}</div>}
                      </>
                    ) : <span style={{ color: '#9CA3AF' }}>Wallet-level</span>}
                    {e.ref && <div style={{ color: '#6B7280' }}>Ref <Mono>{e.ref}</Mono></div>}
                    {e.reserveRef && <div style={{ color: '#6B7280' }}>Settles <Mono>{e.reserveRef}</Mono></div>}
                  </td>
                  <td style={{ fontSize: 12.5, color: '#6B7280', maxWidth: 280 }}>{e.reason || e.note || '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ payments (spec §07 billing records — money domain, separate from credits) ═══ */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 18 }}>
        <CardHead icon={Receipt} title="Payments &amp; invoices" sub="Money records (₹) — related to the wallet but a separate ledger. Credits are issued only when a payment succeeds; pending and failed payments never issue credits." />
        <div className="table-wrap">
          <table>
            <thead><tr><th>Payment</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>Credits</th><th>Method</th><th>Status</th><th>Reference</th><th>Note</th><th></th></tr></thead>
            <tbody>
              {clientPayments.length === 0 ? <EmptyRow cols={9} text="No payments yet — your first purchase will appear here with its invoice." /> : clientPayments.map((p) => (
                <tr key={p.id}>
                  <td><Mono>{p.id}</Mono></td>
                  <td style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{p.date}</td>
                  <td className="tnum" style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{fmtMoney(p.amount)} <span style={{ color: '#9CA3AF', fontWeight: 500, fontSize: 11 }}>{p.currency}</span></td>
                  <td className="tnum" style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap', color: p.status === 'SUCCEEDED' ? '#15803D' : '#9CA3AF' }}>{num(p.credits)} cr</td>
                  <td style={{ fontSize: 12.5 }}>{p.method}</td>
                  <td><PaymentStatusBadge status={p.status} /></td>
                  <td><Mono>{p.reference || '—'}</Mono></td>
                  <td style={{ fontSize: 12.5, color: '#6B7280' }}>{p.note || '—'}</td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {p.status === 'FAILED'
                      ? <button className="btn-ghost" style={smallBtn} disabled={closed} onClick={() => doRetryPayment(p)}><RefreshCw size={12} /> Retry payment</button>
                      : <button className="btn-ghost" style={smallBtn} onClick={() => doInvoice(p)}><Download size={12} /> {p.status === 'PENDING' ? 'Proforma invoice' : 'Download invoice'}</button>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ═══ support path (spec §09: wrong credit deduction dispute · payment succeeded but credits missing) ═══ */}
      <div className="card" style={{ padding: '16px 20px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
        <span className="icon-box" style={{ width: 38, height: 38 }}><LifeBuoy size={18} /></span>
        <div style={{ flex: 1, minWidth: 240 }}>
          <div style={{ fontSize: 13.5, fontWeight: 700 }}>Something doesn't add up?</div>
          <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 2 }}>Every deduction is traceable to a candidate and a service. A technical failure is never charged as your candidate's failure — disputed charges are reversed with a REFUND entry.</div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 4 }}>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button className="btn-ghost" onClick={() => nav('/support')}>Payment succeeded but credits missing</button>
            <button className="btn-primary" onClick={() => nav('/support')}>Dispute a deduction <ArrowRight size={14} /></button>
          </div>
          <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>Opens Support · case: Wrong credit deduction dispute</span>
        </div>
      </div>

      {toastNode}
    </>
  );
}

/* ═══════════ local components ═══════════ */

function Stat({ label, value, sub, big }) {
  return (
    <div style={statBox}>
      <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>{label}</div>
      <div className="tnum" style={{ fontSize: big ? 24 : 19, fontWeight: 700, letterSpacing: '-0.5px', marginTop: 4, lineHeight: 1.2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 3 }}>{sub}</div>}
    </div>
  );
}

/* editable low-balance alert threshold → setClientLowBalanceThreshold (spec §06 low balance · §07 threshold) */
function ThresholdStat({ value, onSave }) {
  const [edit, setEdit] = useState(false);
  const [v, setV] = useState(String(value));
  const n = Math.max(0, Math.floor(Number(v) || 0));
  const save = () => { onSave(n); setEdit(false); };
  return (
    <div style={statBox}>
      <div className="eyebrow" style={{ display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>Low-balance alert<PendingChip /></div>
      {edit ? (
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 6 }}>
          <input className="input" type="number" min={0} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') save(); if (e.key === 'Escape') setEdit(false); }} autoFocus style={{ padding: '6px 10px', fontSize: 13, minWidth: 0 }} />
          <button className="btn-primary" style={{ padding: '6px 9px' }} onClick={save} title="Save"><Check size={13} /></button>
          <button className="btn-ghost" style={{ padding: '6px 8px' }} onClick={() => setEdit(false)} title="Cancel"><X size={13} /></button>
        </div>
      ) : (
        <div className="tnum" style={{ fontSize: 19, fontWeight: 700, letterSpacing: '-0.5px', marginTop: 4, lineHeight: 1.2, display: 'flex', alignItems: 'center', gap: 8 }}>
          {fmtCr(value)}
          <span title="Edit threshold" onClick={() => { setV(String(value)); setEdit(true); }} style={{ display: 'inline-flex', alignItems: 'center', gap: 3, fontSize: 11.5, fontWeight: 600, color: '#056FD4', cursor: 'pointer', letterSpacing: 0 }}><Pencil size={12} /> Edit</span>
        </div>
      )}
      <div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 3 }}>we alert you when available credits drop below this · platform default {fmtCr(DEFAULTS.lowBalanceThreshold)}</div>
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

function Mini({ label, value, sub, tone }) {
  const col = tone === 'ok' ? '#15803D' : tone === 'warn' ? '#B45309' : '#14212A';
  return (
    <div style={{ minWidth: 0, flex: '1 1 150px' }}>
      <div className="eyebrow">{label}</div>
      <div className="tnum" style={{ fontSize: 16, fontWeight: 700, color: col, marginTop: 2 }}>{value}</div>
      {sub && <div style={{ fontSize: 11.5, color: '#9CA3AF', lineHeight: 1.4 }}>{sub}</div>}
    </div>
  );
}

const Field = ({ label, children, hint }) => (
  <div style={{ marginBottom: 12 }}>
    <label className="field-label">{label}</label>
    {children}
    {hint && <div className="hint">{hint}</div>}
  </div>
);

const SRow = ({ k, v, last }) => (
  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '7px 0', borderBottom: last ? 'none' : '1px solid #EEF2F7', fontSize: 13 }}>
    <span style={{ color: '#6B7280', display: 'inline-flex', alignItems: 'center' }}>{k}</span>
    <span className="tnum" style={{ fontWeight: 700, textAlign: 'right' }}>{v}</span>
  </div>
);

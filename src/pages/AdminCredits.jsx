import { useState, useEffect, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Lock, Unlock, Snowflake, Search, ChevronRight, ChevronDown, ShieldCheck, RefreshCw, Check, Calculator, AlertTriangle, ExternalLink, Banknote, HandCoins, Gauge, Receipt, Info, History, Coins } from 'lucide-react';
import { useApp, CLIENT_STATUS, WALLET_STATE, LEDGER_TYPE, CURRENCY, DEFAULTS, walletOf, estimateFunding, fmtCr, fmtMoney, roleName } from '../store.jsx';
import { ClientStatusBadge, WalletStateBadge, LedgerTypeBadge, PaymentStatusBadge, PendingChip, Credits, useToast, Modal, useReasonGate, PermButton, useTab, Tabs, PageHeader, Kpi, EmptyRow, Mono } from '../components/admin/ui.jsx';

/* ═══════════ Credits & Billing — /admin/credits (spec §04 §05 §06 §07 + rate card §10) ═══════════
   Tabs: wallets | ledger | payments | ratecard.  Deep links: ?filter=<WALLET_STATE> ?action=add ?q=<id> ?client=<id>
   Wallet accounting (credits) and money accounting (payments) are related but separate domains. */

const TAB_DEFS = [{ key: 'wallets', label: 'Wallets' }, { key: 'ledger', label: 'Ledger' }, { key: 'payments', label: 'Payments' }, { key: 'ratecard', label: 'Rate card' }];
const PAY_STATUS = ['SUCCEEDED', 'PENDING', 'FAILED', 'REVERSED'];
const ADD_ELIGIBLE = ['ACTIVE', 'SUSPENDED', 'INVITE_PENDING'];
const PURCHASE_METHODS = ['Razorpay link', 'Card', 'Bank transfer (offline)'];
const OFFLINE_METHODS = ['Bank transfer (offline)', 'Cheque (offline)', 'UPI (offline)', 'Razorpay link', 'Card'];
const SM = { padding: '5px 10px', fontSize: 12, gap: 5 };

/* spec §06 — one-line meaning per wallet state */
const WALLET_MEANING = {
  HEALTHY: 'Available credits are above the low-balance threshold — new paid evaluations start normally.',
  LOW_BALANCE: 'Available credits at or below the threshold. Client stays ACTIVE; dashboard warning + email / in-app notice; flagged here as needing attention.',
  ZERO: 'Balance is 0. Client stays ACTIVE and can configure the team and create drafts; the next paid evaluation waits for a top-up.',
  OVERDRAFT: 'Balance is negative — allowed only to protect work already in progress. New paid evaluations must not start; a top-up clears the debt first.',
  BLOCKED_FOR_NEW_USAGE: 'Wallet frozen by Cuba Admin. No new paid usage regardless of balance; running evaluations still finish and settle.',
};
/* spec §05 — example column of the transaction-type table */
const LEDGER_EXAMPLE = { PURCHASE: '+50,000 credits', ADMIN_GRANT: '+2,000 credits', CONSUMPTION: '−80 AI Interview', RESERVE: '100 credits reserved', SETTLEMENT: '74 used, 26 released', REFUND: '+80 credits', OVERDRAFT: 'Wallet becomes −15', MANUAL_ADJUSTMENT: '+/−500 with reason', PAYMENT_REVERSAL: 'Credits / debt adjusted' };

const hit = (q, ...vals) => { const s = (q || '').trim().toLowerCase(); return !s || vals.some((v) => (v ?? '').toString().toLowerCase().includes(s)); };
const isOffline = (m) => (m || '').toLowerCase().includes('offline');

export default function AdminCredits() {
  const nav = useNavigate();
  const loc = useLocation();
  const { clients, getClient, nameOf, ledger, payments, rateCard, settings, aggregates, can, opportunities, currentAdmin, addCredits, freezeWallet, unfreezeWallet, recordPayment, retryPayment, setRate } = useApp();
  const tabs = TAB_DEFS.map((t) => ({ ...t, count: t.key === 'wallets' ? clients.length : t.key === 'ledger' ? ledger.length : t.key === 'payments' ? payments.length : rateCard.length }));
  const [tab, setTab] = useTab(tabs);
  const [show, toastNode] = useToast();
  const [ask, gateNode] = useReasonGate();

  /* filters / deep-link state */
  const [walletFilter, setWalletFilter] = useState('ALL');
  const [walletQ, setWalletQ] = useState('');
  const [ledgerType, setLedgerType] = useState('ALL');
  const [ledgerClient, setLedgerClient] = useState('ALL');
  const [ledgerQ, setLedgerQ] = useState('');
  const [payStatus, setPayStatus] = useState('ALL');
  const [payClient, setPayClient] = useState('ALL');
  const [payQ, setPayQ] = useState('');
  const [focusClient, setFocusClient] = useState(null);
  const [expanded, setExpanded] = useState(null);
  const [addOpen, setAddOpen] = useState(false);
  const [addClient, setAddClient] = useState('');
  const [payOpen, setPayOpen] = useState(false);

  /* consume ?filter ?client ?q ?action once, then strip them from the URL (tab stays) — works even when already mounted (command palette) */
  useEffect(() => {
    const p = new URLSearchParams(loc.search);
    const t = p.get('tab') || 'wallets';
    let touched = false;
    const f = p.get('filter'); if (f) { if (WALLET_STATE[f]) setWalletFilter(f); p.delete('filter'); touched = true; }
    const c = p.get('client'); if (c) { setFocusClient(c); setLedgerClient(c); setPayClient(c); setAddClient(c); p.delete('client'); touched = true; }
    const q = p.get('q'); if (q) { if (t === 'ledger') { setLedgerQ(q); if (ledger.some((e) => e.id === q)) setExpanded(q); } else if (t === 'payments') setPayQ(q); else setWalletQ(q); p.delete('q'); touched = true; }
    if (p.get('action') === 'add') { setAddOpen(true); p.delete('action'); touched = true; }
    if (touched) { const s = p.toString(); nav({ pathname: loc.pathname, search: s ? '?' + s : '' }, { replace: true }); }
  }, [loc.search]); // eslint-disable-line react-hooks/exhaustive-deps

  /* derived */
  const walletRows = useMemo(() => clients.map((c) => ({ c, w: walletOf(c) })), [clients]);
  const reservedTotal = walletRows.reduce((a, { w }) => a + (w.reserved || 0), 0);
  const walletCounts = walletRows.reduce((m, { w }) => ({ ...m, [w.state]: (m[w.state] || 0) + 1 }), {});
  const visibleWallets = walletRows.filter(({ c, w }) => (walletFilter === 'ALL' || w.state === walletFilter) && hit(walletQ, c.name, c.tenantId, c.owner?.email, c.legalName));
  const ledgerRows = ledger.filter((e) => (ledgerType === 'ALL' || e.type === ledgerType) && (ledgerClient === 'ALL' || e.clientId === ledgerClient) && hit(ledgerQ, e.id, e.candidate, e.ref, e.reserveRef, e.oppTitle, e.module, e.reason, nameOf(e.clientId)));
  const ledgerCounts = ledger.reduce((m, e) => ({ ...m, [e.type]: (m[e.type] || 0) + 1 }), {});
  const payRows = payments.filter((p) => (payStatus === 'ALL' || p.status === payStatus) && (payClient === 'ALL' || p.clientId === payClient) && hit(payQ, p.id, p.reference, p.method, p.note, nameOf(p.clientId)));
  const payAgg = (st) => payments.filter((p) => p.status === st).reduce((a, p) => ({ n: a.n + 1, amt: a.amt + (p.amount || 0) }), { n: 0, amt: 0 });
  const jumpToLedger = (q) => { setLedgerType('ALL'); setLedgerClient('ALL'); setLedgerQ(q); if (ledger.some((e) => e.id === q)) setExpanded(q); setTab('ledger'); };
  const jumpToPayments = (q) => { setPayStatus('ALL'); setPayClient('ALL'); setPayQ(q); setTab('payments'); };

  /* actions */
  const openAdd = (clientId) => { setAddClient(clientId || focusClient || ''); setAddOpen(true); };
  const submitAdd = ({ clientId, credits, type, method, reference, reason }) => {
    const c = getClient(clientId); const before = walletOf(c).balance;
    addCredits(clientId, credits, { type, method, reference, reason });
    setAddOpen(false);
    show(`${type === 'PURCHASE' ? 'Purchase recorded' : 'Admin grant posted'} · +${credits.toLocaleString('en-IN')} cr → ${c?.name}${before < 0 ? ` (cleared ${fmtCr(-before)} debt first)` : ''}`);
  };
  const submitPayment = ({ clientId, amount, method, reference, status }) => {
    recordPayment(clientId, { amount, method, reference, status });
    setPayOpen(false);
    show(status === 'SUCCEEDED' ? `Offline payment ${fmtMoney(amount)} recorded · +${Math.round(amount / CURRENCY.perCredit).toLocaleString('en-IN')} cr issued to ${nameOf(clientId)}` : `Pending payment ${fmtMoney(amount)} recorded for ${nameOf(clientId)} — credits issue on confirmation`);
  };
  const onFreeze = (c) => ask({ action: 'wallet.freeze', title: `Freeze wallet — ${c.name}`, confirmLabel: 'Freeze wallet', danger: true, body: 'Blocks NEW paid usage only. Candidate evaluations already running continue and settle normally. Account status is unchanged.' }, (reason) => { freezeWallet(c.id, reason); show(`Wallet frozen — ${c.name} · new paid usage blocked`); });
  const onUnfreeze = (c) => ask({ action: 'wallet.freeze', title: `Unfreeze wallet — ${c.name}`, confirmLabel: 'Unfreeze', body: 'Restores new paid usage. Normal wallet rules (balance, threshold, overdraft limit) apply again.' }, () => { unfreezeWallet(c.id); show(`Wallet unfrozen — ${c.name}`); });
  const onRetry = (p) => { retryPayment(p.id); show(`${p.id} ${p.status === 'PENDING' ? 'confirmed' : 'recovered'} · +${(p.credits || 0).toLocaleString('en-IN')} cr issued to ${nameOf(p.clientId)}`); };
  const onSaveRate = (key, credits) => { setRate(key, credits); show(`Rate card updated · ${rateCard.find((r) => r.key === key)?.name || key} → ${credits} cr (audited)`); };

  const example = opportunities[0];
  const est = example ? estimateFunding(example, rateCard, settings) : null;
  const creditCfg = settings?.credits || DEFAULTS;

  return (
    <>
      <PageHeader title="Credits & Billing" sub="Wallet accounting (credits) and money accounting (payments) are related but separate domains" right={<>
        <PermButton action="payment.record" className="btn-ghost" onClick={() => setPayOpen(true)}><Receipt size={15} /> Record offline payment</PermButton>
        <PermButton action="wallet.addCredits" className="btn-primary" onClick={() => openAdd()}><Plus size={15} /> Add credits</PermButton>
      </>} />

      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
        <Kpi label="Credits sold" value={fmtCr(aggregates.creditsSold)} sub="PURCHASE entries in the ledger" bar="#15803D" size={24} />
        <Kpi label="Credits consumed" value={fmtCr(aggregates.creditsConsumed)} sub="actual service usage · all clients" bar="#056FD4" size={24} />
        <Kpi label="Outstanding" value={fmtCr(aggregates.outstanding)} color={aggregates.outstanding > 0 ? '#B91C1C' : undefined} sub={`${aggregates.negative.length} negative wallet${aggregates.negative.length === 1 ? '' : 's'} · new work blocked`} bar="#B91C1C" size={24} />
        <Kpi label="Reserved" value={fmtCr(reservedTotal)} sub="holds before paid modules start" bar="#B45309" size={24} />
        <Kpi label="Revenue collected" value={fmtMoney(aggregates.revenue)} sub="succeeded payments · money domain" bar="#6D28D9" size={24} />
      </div>

      <Tabs tabs={tabs} active={tab} onChange={setTab} />

      {/* ───────── WALLETS ───────── */}
      {tab === 'wallets' && (
        <div className="fade-in">
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <button className={'filter-btn' + (walletFilter === 'ALL' ? ' active' : '')} onClick={() => setWalletFilter('ALL')}>All <span style={{ opacity: .7 }}>{walletRows.length}</span></button>
            {Object.keys(WALLET_STATE).map((k) => <button key={k} className={'filter-btn' + (walletFilter === k ? ' active' : '')} onClick={() => setWalletFilter(k)}>{WALLET_STATE[k].label} <span style={{ opacity: .7 }}>{walletCounts[k] || 0}</span></button>)}
            <SearchBox value={walletQ} onChange={setWalletQ} placeholder="Search client / tenant id…" />
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr>
                <th>Client</th><th>Wallet state</th>
                <th style={{ textAlign: 'right' }}>Balance</th><th style={{ textAlign: 'right' }}>Reserved</th><th style={{ textAlign: 'right' }}>Available</th><th style={{ textAlign: 'right' }}>Outstanding</th>
                <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Overdraft limit <PendingChip /></th>
                <th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Low-balance threshold <PendingChip /></th>
                <th>Last top-up</th><th>Actions</th>
              </tr></thead>
              <tbody>
                {visibleWallets.length === 0 ? <EmptyRow cols={10} text={walletFilter === 'ALL' && !walletQ ? 'No client wallets yet — wallets are created with each organization.' : 'No wallets match this filter.'} /> : visibleWallets.map(({ c, w }) => {
                  const canAdd = ADD_ELIGIBLE.includes(c.status);
                  return (
                    <tr key={c.id} className="row" onClick={() => nav('/admin/clients/' + c.id)} style={focusClient === c.id ? { background: '#F8FBFF' } : undefined}>
                      <td>
                        <div style={{ fontWeight: 600, color: '#056FD4' }}>{c.name}</div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}><ClientStatusBadge status={c.status} /><Mono>{c.tenantId}</Mono></div>
                      </td>
                      <td><WalletStateBadge state={w.state} />{c.paused && <div style={{ fontSize: 11, color: '#B45309', marginTop: 4 }}>usage paused</div>}</td>
                      <td className="tnum" style={{ textAlign: 'right', fontWeight: 700, color: w.balance < 0 ? '#B91C1C' : '#14212A' }}>{w.balance.toLocaleString('en-IN')} cr</td>
                      <td className="tnum" style={{ textAlign: 'right', color: w.reserved ? '#B45309' : '#9CA3AF' }}>{w.reserved ? fmtCr(w.reserved) : '—'}</td>
                      <td className="tnum" style={{ textAlign: 'right', fontWeight: 600 }}>{fmtCr(w.available)}</td>
                      <td className="tnum" style={{ textAlign: 'right', fontWeight: 700, color: w.outstanding ? '#B91C1C' : '#9CA3AF' }}>{w.outstanding ? '−' + fmtCr(w.outstanding) : '—'}</td>
                      <td className="tnum" style={{ textAlign: 'right', color: '#6B7280' }}>{fmtCr(w.overdraftLimit)}</td>
                      <td className="tnum" style={{ textAlign: 'right', color: '#6B7280' }}>{fmtCr(w.lowBalanceThreshold ?? DEFAULTS.lowBalanceThreshold)}</td>
                      <td style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{w.lastTopUp || <span style={{ color: '#9CA3AF' }}>never</span>}</td>
                      <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: 'nowrap' }}>
                        <div style={{ display: 'flex', gap: 6 }}>
                          <PermButton action="wallet.addCredits" className="btn-ghost" style={SM} disabled={!canAdd} title={!canAdd ? `${CLIENT_STATUS[c.status]?.label} — remaining credits settle per commercial policy` : undefined} onClick={() => openAdd(c.id)}><Plus size={13} /> Add credits</PermButton>
                          {w.frozen
                            ? <PermButton action="wallet.freeze" className="btn-ghost" style={SM} onClick={() => onUnfreeze(c)}><Unlock size={13} /> Unfreeze</PermButton>
                            : <PermButton action="wallet.freeze" className="btn-ghost" style={{ ...SM, color: '#B91C1C' }} onClick={() => onFreeze(c)}><Snowflake size={13} /> Freeze</PermButton>}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* explainer strip */}
          <div className="card" style={{ padding: '16px 18px', marginTop: 18 }}>
            <div className="section-title">Wallet states — what each one means</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 12 }}>
              {Object.keys(WALLET_STATE).map((k) => (
                <div key={k} style={{ background: '#F8FAFC', border: '1px solid #EEF2F7', borderRadius: 10, padding: 12 }}>
                  <WalletStateBadge state={k} />
                  <div style={{ fontSize: 12.5, color: '#374151', marginTop: 8, lineHeight: 1.45 }}>{WALLET_MEANING[k]}</div>
                </div>
              ))}
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 12, marginTop: 14 }}>
              <div className="banner info" style={{ marginBottom: 0 }}><ShieldCheck size={16} style={{ flexShrink: 0 }} /><div><b>Locked rule.</b> Billing can prevent the next evaluation from starting, but never interrupts one in progress.</div></div>
              <div className="banner info" style={{ marginBottom: 0 }}><Gauge size={16} style={{ flexShrink: 0 }} /><div><b>Locked rule.</b> Overdraft limit controls whether new work may start — never used to terminate a running evaluation.</div></div>
            </div>
            <div style={{ fontSize: 12, color: '#6B7280', marginTop: 12, lineHeight: 1.5 }}>
              Wallet state ≠ account status — low, zero and overdraft are wallet states, not client statuses; a client can be ACTIVE with 0 credits. Platform defaults: low-balance threshold {DEFAULTS.lowBalanceThreshold.toLocaleString('en-IN')} cr · overdraft limit {DEFAULTS.overdraftLimit.toLocaleString('en-IN')} cr <PendingChip /> — per-client values change from Client detail (refund · manual adjustment · overdraft limit · threshold), platform-wide in <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/admin/settings?tab=credits')}>Settings → Credits &amp; Billing</span>.
            </div>
          </div>
        </div>
      )}

      {/* ───────── LEDGER ───────── */}
      {tab === 'ledger' && (
        <div className="fade-in">
          <div className="banner info"><Lock size={16} style={{ flexShrink: 0 }} /><div><b>Immutable</b> — entries are never edited or deleted; corrections are opposite / reversal entries. Every consumption traces Client → Opportunity → Candidate → Module → Usage → Rate → Credits.</div></div>
          {!can('ledger.view') && <div className="banner warn"><Lock size={16} style={{ flexShrink: 0 }} /><div><b>Read-only restriction.</b> Your role ({roleName(currentAdmin.role)}) does not include <span className="kbd">ledger.view</span> — entries are withheld. Switch role from the header to view them.</div></div>}
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <button className={'filter-btn' + (ledgerType === 'ALL' ? ' active' : '')} onClick={() => setLedgerType('ALL')}>All <span style={{ opacity: .7 }}>{ledger.length}</span></button>
            {Object.keys(LEDGER_TYPE).map((k) => <button key={k} className={'filter-btn' + (ledgerType === k ? ' active' : '')} onClick={() => setLedgerType(k)}>{LEDGER_TYPE[k].label} <span style={{ opacity: .7 }}>{ledgerCounts[k] || 0}</span></button>)}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <ClientSelect clients={clients} value={ledgerClient} onChange={setLedgerClient} />
            <SearchBox value={ledgerQ} onChange={setLedgerQ} placeholder="Search entry id / candidate / reference…" />
            {(ledgerQ || ledgerClient !== 'ALL' || ledgerType !== 'ALL') && <button className="btn-ghost" style={SM} onClick={() => { setLedgerQ(''); setLedgerClient('ALL'); setLedgerType('ALL'); }}>Clear</button>}
            <span style={{ marginLeft: 'auto', fontSize: 12.5, color: '#6B7280' }}>{ledgerRows.length} of {ledger.length} entries · newest first</span>
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th style={{ width: 28 }} /><th>Entry</th><th>When</th><th>Client</th><th>Type</th><th style={{ textAlign: 'right' }}>Credits</th><th style={{ textAlign: 'right' }}>Balance after</th><th>Trace</th><th>Reason / ref / note</th><th>Actor</th></tr></thead>
              <tbody>
                {!can('ledger.view') ? <EmptyRow cols={10} text="Not permitted for your role (ledger.view)." /> : ledgerRows.length === 0 ? <EmptyRow cols={10} text={ledger.length === 0 ? 'No ledger entries yet.' : 'No entries match these filters.'} /> : ledgerRows.map((e) => {
                  const open = expanded === e.id; const c = getClient(e.clientId);
                  return (
                    <LedgerRowGroup key={e.id} e={e} c={c} open={open} onToggle={() => setExpanded(open ? null : e.id)} nav={nav} onJumpLedger={jumpToLedger} onJumpPayments={jumpToPayments} />
                  );
                })}
              </tbody>
            </table>
          </div>

          {/* legend */}
          <div className="card" style={{ marginTop: 18, overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8 }}><History size={15} color="#6B7280" /><span style={{ fontSize: 15, fontWeight: 700 }}>Transaction types</span><span style={{ fontSize: 12.5, color: '#6B7280' }}>· spec §05 — every credit movement is one of these</span></div>
            <div className="table-wrap"><table>
              <thead><tr><th>Type</th><th>Meaning</th><th>Example</th><th style={{ textAlign: 'right' }}>Direction</th></tr></thead>
              <tbody>
                {Object.keys(LEDGER_TYPE).map((k) => { const t = LEDGER_TYPE[k]; return (
                  <tr key={k}><td><LedgerTypeBadge type={k} /> <Mono>{k}</Mono></td><td style={{ color: '#374151' }}>{t.desc}</td><td className="tnum" style={{ color: '#6B7280' }}>{LEDGER_EXAMPLE[k]}</td><td style={{ textAlign: 'right', color: '#6B7280', fontSize: 12.5 }}>{t.sign > 0 ? 'credits in (+)' : t.sign < 0 ? 'credits out (−)' : 'no balance change'}</td></tr>
                ); })}
              </tbody>
            </table></div>
          </div>
        </div>
      )}

      {/* ───────── PAYMENTS ───────── */}
      {tab === 'payments' && (
        <div className="fade-in">
          <div className="banner info"><Banknote size={16} style={{ flexShrink: 0 }} /><div><b>Money domain.</b> Payments live in the money domain; credits are issued to the wallet only when a payment succeeds. Failed and pending payments never touch the ledger until recovered or confirmed.</div></div>
          {!can('payments.view') && <div className="banner warn"><Lock size={16} style={{ flexShrink: 0 }} /><div><b>Read-only restriction.</b> Your role ({roleName(currentAdmin.role)}) does not include <span className="kbd">payments.view</span> — records are withheld. Switch role from the header to view them.</div></div>}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 14, marginBottom: 18 }}>
            {PAY_STATUS.map((st) => { const a = payAgg(st); const col = { SUCCEEDED: '#15803D', PENDING: '#B45309', FAILED: '#B91C1C', REVERSED: '#6B7280' }[st]; return (
              <div key={st} className="kpi" onClick={() => setPayStatus(payStatus === st ? 'ALL' : st)} style={{ cursor: 'pointer', outline: payStatus === st ? '2px solid #056FD4' : 'none' }}>
                <div className="eyebrow">{st === 'SUCCEEDED' ? 'Succeeded' : st === 'PENDING' ? 'Pending' : st === 'FAILED' ? 'Failed' : 'Reversed'}</div>
                <div className="num" style={{ fontSize: 24, color: col }}>{st === 'SUCCEEDED' ? fmtMoney(a.amt) : a.n}</div>
                <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{st === 'SUCCEEDED' ? `${a.n} payment${a.n === 1 ? '' : 's'} · credits issued` : st === 'REVERSED' ? `${fmtMoney(a.amt)} charged back · credits reversed` : `${fmtMoney(a.amt)} · credits not issued`}</div>
                <div className="bar" style={{ background: col }} />
              </div>
            ); })}
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center', marginBottom: 14 }}>
            <button className={'filter-btn' + (payStatus === 'ALL' ? ' active' : '')} onClick={() => setPayStatus('ALL')}>All <span style={{ opacity: .7 }}>{payments.length}</span></button>
            {PAY_STATUS.map((st) => <button key={st} className={'filter-btn' + (payStatus === st ? ' active' : '')} onClick={() => setPayStatus(st)}>{st.charAt(0) + st.slice(1).toLowerCase()} <span style={{ opacity: .7 }}>{payAgg(st).n}</span></button>)}
            <ClientSelect clients={clients} value={payClient} onChange={setPayClient} />
            <SearchBox value={payQ} onChange={setPayQ} placeholder="Search payment id / invoice…" />
            {(payQ || payClient !== 'ALL' || payStatus !== 'ALL') && <button className="btn-ghost" style={SM} onClick={() => { setPayQ(''); setPayClient('ALL'); setPayStatus('ALL'); }}>Clear</button>}
            <span style={{ marginLeft: 'auto' }}><PermButton action="payment.record" className="btn-ghost" style={SM} onClick={() => setPayOpen(true)}><Receipt size={13} /> Record offline payment</PermButton></span>
          </div>
          <div className="card table-wrap">
            <table>
              <thead><tr><th>Payment</th><th>Client</th><th>Date</th><th style={{ textAlign: 'right' }}>Amount</th><th style={{ textAlign: 'right' }}>Credits received</th><th>Method</th><th>Status</th><th>Reference</th><th>Note</th><th>Actions</th></tr></thead>
              <tbody>
                {!can('payments.view') ? <EmptyRow cols={10} text="Not permitted for your role (payments.view)." /> : payRows.length === 0 ? <EmptyRow cols={10} text={payments.length === 0 ? 'No payments recorded yet.' : 'No payments match these filters.'} /> : payRows.map((p) => {
                  const c = getClient(p.clientId);
                  return (
                    <tr key={p.id}>
                      <td><Mono>{p.id}</Mono></td>
                      <td><ClientCell c={c} nav={nav} /></td>
                      <td style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{p.date}</td>
                      <td className="tnum" style={{ textAlign: 'right', fontWeight: 700 }}>{fmtMoney(p.amount)} <span style={{ fontSize: 11, color: '#9CA3AF', fontWeight: 600 }}>{p.currency}</span></td>
                      <td className="tnum" style={{ textAlign: 'right' }}>
                        {p.status === 'SUCCEEDED' ? <Credits n={p.credits} /> : <span style={{ color: '#9CA3AF' }}>{(p.credits || 0).toLocaleString('en-IN')} cr <span style={{ fontSize: 11 }}>· {p.status === 'REVERSED' ? 'reversed' : 'not issued'}</span></span>}
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>{p.method}{isOffline(p.method) && <span className="chip" style={{ background: '#FEF3C7', color: '#B45309', marginLeft: 6, padding: '2px 7px', fontSize: 11 }}>manual / offline</span>}</td>
                      <td><PaymentStatusBadge status={p.status} /></td>
                      <td><Mono>{p.reference || '—'}</Mono></td>
                      <td style={{ fontSize: 12.5, color: '#6B7280', maxWidth: 260 }}>{p.note || <span style={{ color: '#D1D5DB' }}>—</span>}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {p.status === 'FAILED' && <PermButton action="payment.record" className="btn-ghost" style={SM} onClick={() => onRetry(p)}><RefreshCw size={13} /> Retry &amp; issue credits</PermButton>}
                        {p.status === 'PENDING' && <PermButton action="payment.record" className="btn-success" style={SM} onClick={() => onRetry(p)}><Check size={13} /> Confirm received</PermButton>}
                        {p.status === 'SUCCEEDED' && <span style={{ fontSize: 12, color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => jumpToLedger(p.id)}>Ledger entry →</span>}
                        {p.status === 'REVERSED' && <span style={{ fontSize: 12, color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => jumpToLedger(p.id)}>View reversal →</span>}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ───────── RATE CARD ───────── */}
      {tab === 'ratecard' && (
        <div className="fade-in" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 3fr) minmax(0, 2fr)', gap: 18, alignItems: 'start' }}>
          <div className="card" style={{ overflow: 'hidden' }}>
            <div style={{ padding: '14px 18px', display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
              <Coins size={15} color="#6B7280" /><span style={{ fontSize: 15, fontWeight: 700 }}>Credit rate card — credits consumed per service unit</span><PendingChip>defaults · pending final values</PendingChip>
            </div>
            <div style={{ padding: '0 18px 12px', fontSize: 12.5, color: '#6B7280' }}>
              Credits are not charged per opportunity — they are consumed against actual services (Resume Analyser, assessment modules, AI Interview, Proctoring). Rate changes are audited and apply to future consumption only; existing ledger entries keep the rate captured at the time. {can('ratecard.edit') ? 'Edit a value and Save per row.' : `Editing requires ratecard.edit (Super / Finance) — your role (${roleName(currentAdmin.role)}) is read-only here.`} Also reachable from <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/admin/settings?tab=ratecard')}>Settings → Rate Card</span>.
            </div>
            <div className="table-wrap"><table>
              <thead><tr><th>Service</th><th>Unit</th><th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>Credits <PendingChip /></th><th style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>₹ equivalent · {fmtMoney(CURRENCY.perCredit)}/cr <PendingChip /></th><th style={{ textAlign: 'right' }} /></tr></thead>
              <tbody>
                {rateCard.length === 0 ? <EmptyRow cols={5} text="Rate card is empty — add modules from Platform → Modules." /> : rateCard.map((r) => <RateRow key={r.key} r={r} editable={can('ratecard.edit')} onSave={onSaveRate} />)}
              </tbody>
            </table></div>
          </div>

          {/* worked example */}
          <div className="card" style={{ padding: '16px 18px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}><Calculator size={15} color="#6D28D9" /><span style={{ fontSize: 15, fontWeight: 700 }}>Worked example — funding guidance</span></div>
            {!est ? <div style={{ fontSize: 13, color: '#9CA3AF' }}>No opportunity available to illustrate.</div> : (
              <>
                <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 12 }}>{example.title} · hiring target <b style={{ color: '#14212A' }}>{est.target}</b> · assessment {example.assessment?.version}</div>
                <ExampleLine label={`Resume-gate capacity · target × ${creditCfg.fundingResumeX ?? DEFAULTS.fundingResumeX}`} pending calc={`${est.resumeCap.toLocaleString('en-IN')} candidates × ${rateCard.find((r) => r.key === 'resume')?.credits || 0} cr`} value={fmtCr(est.resumeCredits)} />
                <ExampleLine label={`Full-evaluation capacity · target × ${creditCfg.fundingFullX ?? DEFAULTS.fundingFullX}`} pending calc={`${est.fullCap.toLocaleString('en-IN')} candidates × ${est.perCandidate} cr / candidate`} value={fmtCr(est.fullCredits)} />
                <div style={{ fontSize: 11.5, color: '#9CA3AF', margin: '2px 0 10px', lineHeight: 1.5 }}>
                  Per candidate = {(example.assessment?.modules || []).filter((m) => m.key !== 'resume').map((m) => `${rateCard.find((r) => r.key === m.key)?.name || m.key} ${rateCard.find((r) => r.key === m.key)?.credits || 0}`).concat([`Proctoring ${rateCard.find((r) => r.key === 'proctoring')?.credits || 0}`]).join(' + ')} = <b>{est.perCandidate} cr</b>
                </div>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', borderTop: '1px solid #E2E8F0', paddingTop: 10 }}>
                  <span style={{ fontSize: 13, fontWeight: 600 }}>Suggested available funding</span>
                  <span style={{ textAlign: 'right' }}><span className="tnum" style={{ fontSize: 20, fontWeight: 700 }}>{fmtCr(est.total)}</span><div style={{ fontSize: 11.5, color: '#9CA3AF' }}>≈ {fmtMoney(est.total * CURRENCY.perCredit)} at {fmtMoney(CURRENCY.perCredit)}/cr</div></span>
                </div>
                <div className="banner warn" style={{ marginTop: 14, marginBottom: 0, alignItems: 'flex-start' }}><Info size={16} style={{ flexShrink: 0, marginTop: 1 }} /><div><b>Funding guidance is a safety requirement, not a pre-charge</b> — credits are consumed only when services run. Underfunded opportunities show a warning to the client; sending is still allowed unless the wallet is blocked or negative.</div></div>
              </>
            )}
          </div>
        </div>
      )}

      {addOpen && <AddCreditsModal clients={clients} initialClient={addClient} onClose={() => setAddOpen(false)} onSubmit={submitAdd} />}
      {payOpen && <RecordPaymentModal clients={clients} initialClient={addClient || focusClient || ''} onClose={() => setPayOpen(false)} onSubmit={submitPayment} />}
      {gateNode}
      {toastNode}
    </>
  );
}

/* ═══════════ local helpers ═══════════ */

function SearchBox({ value, onChange, placeholder }) {
  return (
    <div style={{ position: 'relative' }}>
      <Search size={14} style={{ position: 'absolute', left: 10, top: 9, color: '#9CA3AF' }} />
      <input className="input" value={value} onChange={(e) => onChange(e.target.value)} placeholder={placeholder} style={{ width: 280, padding: '7px 10px 7px 30px', fontSize: 12.5 }} />
    </div>
  );
}

function ClientSelect({ clients, value, onChange }) {
  return (
    <select className="input" value={value} onChange={(e) => onChange(e.target.value)} style={{ width: 'auto', padding: '7px 10px', fontSize: 12.5 }}>
      <option value="ALL">All clients</option>
      {clients.map((c) => <option key={c.id} value={c.id}>{c.name} · {CLIENT_STATUS[c.status]?.label}</option>)}
    </select>
  );
}

/* client with BOTH badges (locked distinction: wallet state ≠ account status) */
function ClientCell({ c, nav }) {
  if (!c) return <span style={{ color: '#9CA3AF' }}>—</span>;
  const w = walletOf(c);
  return (
    <div>
      <span style={{ fontWeight: 600, color: '#056FD4', cursor: 'pointer' }} onClick={(e) => { e.stopPropagation(); nav('/admin/clients/' + c.id); }}>{c.name}</span>
      <div style={{ display: 'flex', gap: 5, marginTop: 4, flexWrap: 'wrap' }}><ClientStatusBadge status={c.status} /><WalletStateBadge state={w.state} /></div>
    </div>
  );
}

function TraceChain({ e }) {
  const parts = [e.oppTitle && `Opp: ${e.oppTitle}`, e.candidate && `Cand: ${e.candidate}`, e.module, e.usage, e.rate].filter(Boolean);
  if (!parts.length) return <span style={{ color: '#D1D5DB' }}>—</span>;
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 2, flexWrap: 'wrap' }}>
      {parts.map((p, i) => <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 2 }}>{i > 0 && <ChevronRight size={11} color="#9CA3AF" />}<span className="chip" style={{ background: '#F3F4F6', color: '#374151', padding: '2px 7px', fontSize: 11, whiteSpace: 'nowrap' }}>{p}</span></span>)}
    </div>
  );
}

function LedgerRowGroup({ e, c, open, onToggle, nav, onJumpLedger, onJumpPayments }) {
  return (
    <>
      <tr className="row" onClick={onToggle} style={open ? { background: '#F8FBFF' } : undefined}>
        <td style={{ color: '#9CA3AF', paddingRight: 0 }}>{open ? <ChevronDown size={14} /> : <ChevronRight size={14} />}</td>
        <td><Mono>{e.id}</Mono></td>
        <td style={{ color: '#6B7280', whiteSpace: 'nowrap', fontSize: 12.5 }}>{e.when}</td>
        <td><ClientCell c={c} nav={nav} /></td>
        <td><LedgerTypeBadge type={e.type} /></td>
        <td className="tnum" style={{ textAlign: 'right' }}>{e.type === 'RESERVE' ? <span style={{ color: '#9CA3AF', fontWeight: 600 }}>hold {(e.hold || 0).toLocaleString('en-IN')} cr</span> : <Credits n={e.credits} />}</td>
        <td className="tnum" style={{ textAlign: 'right', fontWeight: 600, color: e.balanceAfter < 0 ? '#B91C1C' : '#14212A' }}>{(e.balanceAfter || 0).toLocaleString('en-IN')} cr</td>
        <td><TraceChain e={e} /></td>
        <td style={{ fontSize: 12.5, maxWidth: 260 }}>
          {e.reason && <div style={{ color: '#374151' }}>{e.reason}</div>}
          {e.ref && <div><Mono>{e.ref}</Mono></div>}
          {e.note && <div style={{ color: '#6B7280' }}>{e.note}</div>}
          {!e.reason && !e.ref && !e.note && <span style={{ color: '#D1D5DB' }}>—</span>}
        </td>
        <td style={{ color: '#6B7280', whiteSpace: 'nowrap', fontSize: 12.5 }}>{e.actor}</td>
      </tr>
      {open && (
        <tr>
          <td colSpan={10} style={{ background: '#F8FAFC', padding: '14px 18px 16px' }}>
            <LedgerDetail e={e} c={c} nav={nav} onJumpLedger={onJumpLedger} onJumpPayments={onJumpPayments} />
          </td>
        </tr>
      )}
    </>
  );
}

function LedgerDetail({ e, c, nav, onJumpLedger, onJumpPayments }) {
  const t = LEDGER_TYPE[e.type] || {};
  const w = c ? walletOf(c) : null;
  const link = (label, fn) => <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }} onClick={(ev) => { ev.stopPropagation(); fn(); }}>{label} <ExternalLink size={11} /></span>;
  const refLink = e.ref ? (e.ref.startsWith('PAY-') ? link(e.ref, () => onJumpPayments(e.ref)) : e.ref.startsWith('JOB-') ? link(e.ref, () => nav('/admin/support?tab=jobs&job=' + e.ref)) : e.ref.startsWith('LX-') ? link(e.ref, () => onJumpLedger(e.ref)) : <Mono>{e.ref}</Mono>) : null;
  const fields = [
    ['Entry', <Mono>{e.id}</Mono>], ['When', e.when], ['Actor', e.actor],
    ['Client', c ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>{link(c.name, () => nav('/admin/clients/' + c.id))}<ClientStatusBadge status={c.status} /><WalletStateBadge state={w.state} /></span> : '—'],
    ['Type', <span>{t.label || e.type} <span style={{ color: '#6B7280', fontWeight: 400 }}>— {t.desc}</span></span>],
    ['Credits', e.type === 'RESERVE' ? `hold ${(e.hold || 0).toLocaleString('en-IN')} cr (no balance change)` : <Credits n={e.credits} />],
    ['Balance after', <span className="tnum" style={{ color: e.balanceAfter < 0 ? '#B91C1C' : undefined }}>{(e.balanceAfter || 0).toLocaleString('en-IN')} cr</span>],
    ['Opportunity', e.oppTitle ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{e.oppTitle} <Mono>{e.oppId}</Mono> {link('usage', () => nav(`/admin/usage?client=${e.clientId}&opp=${e.oppId}`))}</span> : '—'],
    ['Candidate', e.candidate || '—'], ['Module', e.module || '—'], ['Usage', e.usage || '—'], ['Rate', e.rate || '—'],
    ['Reserve ref', e.reserveRef ? link(e.reserveRef, () => onJumpLedger(e.reserveRef)) : '—'],
    ['Reference', refLink || '—'], ['Reason', e.reason || '—'], ['Note', e.note || '—'],
  ];
  const chain = [['Client', c?.name], ['Opportunity', e.oppTitle], ['Candidate', e.candidate], ['Module', e.module], ['Usage', e.usage], ['Rate', e.rate], ['Credits', e.type === 'RESERVE' ? `hold ${e.hold || 0}` : `${e.credits > 0 ? '+' : ''}${e.credits}`]];
  return (
    <div onClick={(ev) => ev.stopPropagation()} style={{ cursor: 'default' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', marginBottom: 12 }}>
        <span className="eyebrow" style={{ marginRight: 4 }}>Trace</span>
        {chain.map(([k, v], i) => <span key={k} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>{i > 0 && <ChevronRight size={12} color="#9CA3AF" />}<span style={{ background: v ? '#fff' : '#F3F4F6', border: '1px solid #E2E8F0', borderRadius: 6, padding: '3px 8px', fontSize: 11.5 }}><span style={{ color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', fontSize: 9.5, letterSpacing: .4, marginRight: 5 }}>{k}</span>{v || <span style={{ color: '#C4C9D2' }}>n/a</span>}</span></span>)}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: '8px 18px' }}>
        {fields.map(([k, v]) => <div key={k} style={{ fontSize: 12.5, display: 'flex', gap: 8, alignItems: 'baseline', minWidth: 0 }}><span style={{ color: '#9CA3AF', flexShrink: 0, width: 92 }}>{k}</span><span style={{ fontWeight: 600, minWidth: 0, overflowWrap: 'anywhere' }}>{v}</span></div>)}
      </div>
      <div style={{ marginTop: 12, fontSize: 12, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 6 }}><Lock size={12} /> Immutable entry — to correct it, post a Refund / Manual adjustment reversal from the client's wallet; the original stays on record.</div>
    </div>
  );
}

function RateRow({ r, editable, onSave }) {
  const [v, setV] = useState(String(r.credits));
  useEffect(() => { setV(String(r.credits)); }, [r.credits]);
  const n = Math.max(0, Number(v) || 0);
  const dirty = n !== r.credits;
  return (
    <tr>
      <td><span style={{ fontWeight: 600 }}>{r.name}</span> <Mono>{r.key}</Mono></td>
      <td style={{ color: '#6B7280' }}>{r.unit}</td>
      <td style={{ textAlign: 'right' }}>
        {editable
          ? <input className="input tnum" type="number" min={0} value={v} onChange={(e) => setV(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter' && dirty) onSave(r.key, n); }} style={{ width: 96, padding: '6px 10px', textAlign: 'right', fontSize: 13, display: 'inline-block' }} />
          : <b className="tnum">{r.credits} cr</b>}
      </td>
      <td className="tnum" style={{ textAlign: 'right', color: '#6B7280' }}>{fmtMoney(n * CURRENCY.perCredit)}</td>
      <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
        <PermButton action="ratecard.edit" className="btn-ghost" style={SM} disabled={!dirty} title={dirty ? `Save ${r.credits} → ${n} cr (audited)` : 'No change'} onClick={() => onSave(r.key, n)}><Check size={13} /> Save</PermButton>
      </td>
    </tr>
  );
}

function ExampleLine({ label, pending, calc, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 10, padding: '7px 0', borderTop: '1px solid #F3F4F6', fontSize: 13 }}>
      <div><div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>{label}{pending && <PendingChip />}</div><div style={{ fontSize: 11.5, color: '#9CA3AF', marginTop: 2 }}>{calc}</div></div>
      <span className="tnum" style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{value}</span>
    </div>
  );
}

/* ── Add credits (Purchase / Admin grant) — spec §04 §07 ── */
function AddCreditsModal({ clients, initialClient, onClose, onSubmit }) {
  const eligible = clients.filter((c) => ADD_ELIGIBLE.includes(c.status));
  const [clientId, setClientId] = useState(eligible.some((c) => c.id === initialClient) ? initialClient : (eligible[0]?.id || ''));
  const [credits, setCredits] = useState('');
  const [type, setType] = useState('PURCHASE');
  const [method, setMethod] = useState('Razorpay link');
  const [reference, setReference] = useState('');
  const [reason, setReason] = useState('');
  const c = eligible.find((x) => x.id === clientId);
  const w = c ? walletOf(c) : null;
  const n = Math.floor(Number(credits) || 0);
  const money = n * CURRENCY.perCredit;
  const after = w ? w.balance + n : 0;
  const ok = !!c && n > 0 && (type === 'PURCHASE' || reason.trim().length >= 4);
  return (
    <Modal title="Add credits" onClose={onClose} width={580} footer={<>
      <button className="btn-ghost" onClick={onClose}>Cancel</button>
      <button className="btn-primary" disabled={!ok} onClick={() => onSubmit({ clientId, credits: n, type, method, reference: reference.trim(), reason: reason.trim() })}><Plus size={15} /> {type === 'PURCHASE' ? 'Record purchase' : 'Grant credits'}{n > 0 ? ` · +${n.toLocaleString('en-IN')} cr` : ''}</button>
    </>}>
      <label className="field-label">Client <span className="req">*</span></label>
      {eligible.length === 0 ? <div className="banner warn" style={{ marginBottom: 0 }}><AlertTriangle size={15} /> No eligible clients — only Active, Suspended and Invite-pending organizations can receive credits.</div> : (
        <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          {eligible.map((x) => { const xw = walletOf(x); return <option key={x.id} value={x.id}>{x.name} — {CLIENT_STATUS[x.status]?.label} · {WALLET_STATE[xw.state]?.label} · {fmtCr(xw.balance)}</option>; })}
        </select>
      )}
      {c && w && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', marginTop: 8, fontSize: 12.5, color: '#6B7280' }}>
          <ClientStatusBadge status={c.status} /><WalletStateBadge state={w.state} />
          <span>balance <b className="tnum" style={{ color: w.balance < 0 ? '#B91C1C' : '#14212A' }}>{fmtCr(w.balance)}</b> · reserved {fmtCr(w.reserved)} · available {fmtCr(w.available)} · last top-up {w.lastTopUp || 'never'}</span>
        </div>
      )}
      <div className="hint">Offboarding / deactivated clients cannot receive credits — remaining credits settle per commercial policy.</div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
        <div>
          <label className="field-label">Credits <span className="req">*</span></label>
          <input className="input tnum" type="number" min={1} step={100} value={credits} onChange={(e) => setCredits(e.target.value)} placeholder="e.g. 5000" />
        </div>
        <div>
          <label className="field-label">Type</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className={'radio-card' + (type === 'PURCHASE' ? ' active' : '')} onClick={() => setType('PURCHASE')}><Banknote size={14} /> Purchase</div>
            <div className={'radio-card' + (type === 'ADMIN_GRANT' ? ' active' : '')} onClick={() => setType('ADMIN_GRANT')}><HandCoins size={14} /> Admin grant</div>
          </div>
        </div>
      </div>

      {type === 'PURCHASE' ? (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 14 }}>
          <div>
            <label className="field-label">Payment method</label>
            <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{PURCHASE_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
          </div>
          <div>
            <label className="field-label">Invoice / payment reference</label>
            <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="INV-2090 · UTR · Razorpay id" />
          </div>
          <div style={{ gridColumn: '1 / -1', display: 'flex', alignItems: 'center', gap: 10, background: '#F8FAFC', border: '1px solid #EEF2F7', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: '#374151' }}>
            <Banknote size={15} color="#15803D" style={{ flexShrink: 0 }} />
            <div>Amount <b className="tnum">{fmtMoney(money)}</b> at {fmtMoney(CURRENCY.perCredit)} / credit <PendingChip /> — creates a <b>Succeeded</b> payment record (money domain) and a <b>Purchase</b> ledger entry (wallet domain).{isOffline(method) && ' Flagged manual / offline.'}</div>
          </div>
        </div>
      ) : (
        <div style={{ marginTop: 14 }}>
          <label className="field-label">Reason <span className="req">*</span></label>
          <textarea className="input" rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Promotional / trial credits · goodwill for incident · pilot allocation…" style={{ resize: 'vertical' }} />
          <div className="hint">Grants are free allocations — no payment record is created. The reason is written to the ledger entry and the audit log with your identity.</div>
        </div>
      )}

      {w && n > 0 && (w.balance < 0
        ? <div className="banner warn" style={{ marginTop: 14, marginBottom: 0, alignItems: 'flex-start' }}><AlertTriangle size={16} style={{ flexShrink: 0, marginTop: 1 }} /><div><b>Top-up clears outstanding debt first.</b> {fmtCr(w.outstanding)} outstanding → balance after top-up <b className="tnum">{fmtCr(after)}</b>{after < 0 ? ' — still negative; new paid evaluations stay blocked until the debt is cleared.' : ' — debt cleared; new evaluations may start again.'}</div></div>
        : <div style={{ marginTop: 14, fontSize: 12.5, color: '#6B7280', display: 'flex', alignItems: 'center', gap: 8 }}><Check size={14} color="#15803D" /> Balance after: <b className="tnum" style={{ color: '#14212A' }}>{fmtCr(after)}</b> · available {fmtCr(Math.max(0, after - (w.reserved || 0)))}{w.frozen && <span style={{ color: '#B45309' }}> · wallet is frozen — unfreeze to allow new paid usage</span>}</div>)}
    </Modal>
  );
}

/* ── Record offline payment — spec §07 billing records (manual / offline) ── */
function RecordPaymentModal({ clients, initialClient, onClose, onSubmit }) {
  const eligible = clients.filter((c) => ADD_ELIGIBLE.includes(c.status));
  const [clientId, setClientId] = useState(eligible.some((c) => c.id === initialClient) ? initialClient : (eligible[0]?.id || ''));
  const [amount, setAmount] = useState('');
  const [method, setMethod] = useState('Bank transfer (offline)');
  const [reference, setReference] = useState('');
  const [status, setStatus] = useState('SUCCEEDED');
  const c = eligible.find((x) => x.id === clientId);
  const w = c ? walletOf(c) : null;
  const amt = Number(amount) || 0;
  const credits = Math.round(amt / CURRENCY.perCredit);
  const ok = !!c && amt > 0 && reference.trim().length > 0;
  return (
    <Modal title="Record offline payment" onClose={onClose} width={560} footer={<>
      <button className="btn-ghost" onClick={onClose}>Cancel</button>
      <button className={status === 'SUCCEEDED' ? 'btn-success' : 'btn-primary'} disabled={!ok} onClick={() => onSubmit({ clientId, amount: amt, method, reference: reference.trim(), status })}><Receipt size={15} /> {status === 'SUCCEEDED' ? `Record & issue ${credits.toLocaleString('en-IN')} cr` : 'Record as pending'}</button>
    </>}>
      <label className="field-label">Client <span className="req">*</span></label>
      {eligible.length === 0 ? <div className="banner warn" style={{ marginBottom: 0 }}><AlertTriangle size={15} /> No eligible clients.</div> : (
        <select className="input" value={clientId} onChange={(e) => setClientId(e.target.value)}>
          {eligible.map((x) => <option key={x.id} value={x.id}>{x.name} — {CLIENT_STATUS[x.status]?.label} · {fmtCr(walletOf(x).balance)}</option>)}
        </select>
      )}
      {c && w && <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 8, fontSize: 12.5, color: '#6B7280' }}><ClientStatusBadge status={c.status} /><WalletStateBadge state={w.state} /><span>balance <b className="tnum" style={{ color: w.balance < 0 ? '#B91C1C' : '#14212A' }}>{fmtCr(w.balance)}</b> · {c.billing?.currency || 'INR'}</span></div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14, marginTop: 16 }}>
        <div>
          <label className="field-label">Amount ({CURRENCY.symbol}) <span className="req">*</span></label>
          <input className="input tnum" type="number" min={1} step={1000} value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="e.g. 100000" />
        </div>
        <div>
          <label className="field-label">Method</label>
          <select className="input" value={method} onChange={(e) => setMethod(e.target.value)}>{OFFLINE_METHODS.map((m) => <option key={m} value={m}>{m}</option>)}</select>
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="field-label">Invoice / payment reference <span className="req">*</span></label>
          <input className="input" value={reference} onChange={(e) => setReference(e.target.value)} placeholder="INV-2090 · UTR / cheque no." />
        </div>
        <div style={{ gridColumn: '1 / -1' }}>
          <label className="field-label">Status</label>
          <div style={{ display: 'flex', gap: 8 }}>
            <div className={'radio-card' + (status === 'SUCCEEDED' ? ' active' : '')} onClick={() => setStatus('SUCCEEDED')}><Check size={14} /> Succeeded — issue credits now</div>
            <div className={'radio-card' + (status === 'PENDING' ? ' active' : '')} onClick={() => setStatus('PENDING')}><Lock size={14} /> Pending — awaiting confirmation</div>
          </div>
        </div>
      </div>
      <div style={{ marginTop: 14, display: 'flex', alignItems: 'flex-start', gap: 10, background: '#F8FAFC', border: '1px solid #EEF2F7', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: '#374151' }}>
        <Banknote size={15} color="#15803D" style={{ flexShrink: 0, marginTop: 1 }} />
        <div>
          <b className="tnum">{fmtMoney(amt)}</b> → <b className="tnum">{credits.toLocaleString('en-IN')} credits</b> at {fmtMoney(CURRENCY.perCredit)} / credit <PendingChip />{isOffline(method) && <span className="chip" style={{ background: '#FEF3C7', color: '#B45309', marginLeft: 6, padding: '2px 7px', fontSize: 11 }}>manual / offline</span>}
          <div style={{ color: '#6B7280', marginTop: 4 }}>{status === 'SUCCEEDED' ? 'A Succeeded payment (money domain) and a Purchase ledger entry (wallet domain) are created together.' + (w && w.balance < 0 ? ` Top-up clears the ${fmtCr(w.outstanding)} outstanding debt first.` : '') : 'Only the payment record is created. Credits are issued to the wallet when you press "Confirm received" on the Payments tab.'}</div>
        </div>
      </div>
    </Modal>
  );
}

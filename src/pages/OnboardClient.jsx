import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, ArrowLeft, Building2, User, Wallet, ClipboardList, Lock, Mail, Info, Hash, ShieldCheck, Copy, Receipt, Sparkles, Ban, Landmark } from 'lucide-react';
import { useApp, CURRENCY, DEFAULTS, walletOf, fmtCr, fmtMoney, roleName } from '../store.jsx';
import { ClientStatusBadge, WalletStateBadge, PendingChip, PermButton, useToast, Mono } from '../components/admin/ui.jsx';

/* Onboard client — spec §02 (sales-led acquisition · organization creation minimum info · system actions on create),
   §03 (new org starts INVITE_PENDING), §06 (wallet created at 0 unless an initial allocation is recorded). */

const STEPS = [
  { key: 'company', label: 'Company', icon: Building2 },
  { key: 'owner', label: 'Primary owner', icon: User },
  { key: 'commercial', label: 'Commercial / internal', icon: Wallet },
  { key: 'review', label: 'Review & create', icon: ClipboardList },
];
const SALES_FLOW = ['Company discovers Cuba', 'Reads cost guidance', 'Contacts Sales', 'Deal agreed', 'Admin creates organization', 'Owner invited'];
const COUNTRIES = ['India', 'United Arab Emirates', 'United States', 'United Kingdom', 'Singapore', 'Other'];
const INDUSTRIES = ['E-commerce', 'SaaS', 'Healthcare', 'BPO / Support', 'Fintech', 'EdTech', 'Logistics', 'Retail', 'Manufacturing', 'Hospitality'];
const CURRENCIES = ['INR', 'USD', 'AED'];
const PAY_METHODS = ['Bank transfer (offline)', 'Razorpay link', 'Card'];
const SALES_OWNERS = ['Rahul Bose (AE)', 'Anita Desai (AE)'];
const ALLOC = [
  { key: 'purchase', label: 'Purchase', sub: 'Invoice / offline payment', icon: Receipt, ledger: 'PURCHASE' },
  { key: 'grant', label: 'Admin grant', sub: 'Promo / test credits', icon: Sparkles, ledger: 'ADMIN_GRANT' },
  { key: 'none', label: 'None', sub: 'Wallet starts at 0', icon: Ban, ledger: null },
];
const EMPTY = { name: '', legalName: '', country: 'India', website: '', industry: '', ownerName: '', ownerEmail: '', ownerPhone: '', ownerDesignation: '', gstin: '', billingAddress: '', currency: 'INR', initialCredits: '', initialType: 'none', paymentMethod: 'Bank transfer (offline)', paymentRef: '', initialReason: '', salesOwner: '', notes: '' };
const emailOk = (e) => /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test((e || '').trim());
const FREE_MAIL = ['gmail.com', 'yahoo.com', 'outlook.com', 'hotmail.com', 'icloud.com'];
const isFreeMail = (e) => FREE_MAIL.includes(((e || '').split('@')[1] || '').toLowerCase());
const num = (n) => (Number(n) || 0).toLocaleString('en-IN');

export default function OnboardClient() {
  const nav = useNavigate();
  const { can, currentAdmin, onboardClient, getClient } = useApp();
  const [toast, toastNode] = useToast();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState(EMPTY);
  const [done, setDone] = useState(null);
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));

  /* page-level gate: read-only roles see a notice, never a hidden page */
  if (!can('client.create')) return <ReadOnlyNotice role={roleName(currentAdmin.role)} onBack={() => nav('/admin/clients')} />;

  const credits = form.initialType === 'none' ? 0 : Math.max(0, Math.floor(Number(form.initialCredits) || 0));
  const alloc = ALLOC.find((a) => a.key === form.initialType) || ALLOC[2];
  const valid = [
    !!form.name.trim(),
    !!form.ownerName.trim() && emailOk(form.ownerEmail),
    form.initialType === 'none' || (credits > 0 && (form.initialType !== 'grant' || form.initialReason.trim().length >= 4)),
    true,
  ];
  const canNext = valid[step];
  const allValid = valid.every(Boolean);

  const systemActions = [
    { icon: Hash, t: 'Unique Organization / Tenant ID generated', s: 'org_xxxxxx — stamped on every ledger, payment and audit entry' },
    { icon: Wallet, t: credits > 0 ? `Credit wallet created with balance ${fmtCr(credits)}` : 'Credit wallet created with balance 0', s: credits > 0 ? `One immutable ${alloc.ledger} ledger entry (+${num(credits)} cr)${form.initialType === 'purchase' ? ' and a payment record' : ''}` : `Low-balance threshold ${num(DEFAULTS.lowBalanceThreshold)} cr · overdraft limit ${num(DEFAULTS.overdraftLimit)} cr (defaults, adjustable per client)` },
    { icon: User, t: 'Primary owner created as Invite Pending', s: form.ownerEmail || 'owner email' },
    { icon: Mail, t: 'Invitation email sent', s: 'Owner activates → account becomes ACTIVE (resend / revoke from client detail)' },
    { icon: ShieldCheck, t: 'Audit-log entry written', s: `Actor: ${currentAdmin.name} · ${roleName(currentAdmin.role)}` },
  ];

  const create = () => {
    const payload = {
      ...form, name: form.name.trim(), ownerEmail: form.ownerEmail.trim(), initialCredits: credits,
      paymentMethod: form.initialType === 'purchase' ? form.paymentMethod : '', paymentRef: form.initialType === 'purchase' ? form.paymentRef.trim() : '',
      initialReason: form.initialType === 'grant' ? form.initialReason.trim() : '',
    };
    const id = onboardClient(payload);
    setDone(id);
    toast(`Organization created · invite sent to ${payload.ownerEmail}`);
  };

  /* ── success screen ── */
  if (done) {
    const c = getClient(done);
    const w = walletOf(c);
    return (
      <div style={{ maxWidth: 680, margin: '30px auto' }}>
        <div className="card fade-in" style={{ padding: '30px 32px' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 20 }}>
            <div className="avatar" style={{ width: 54, height: 54, background: '#DCFCE7', color: '#15803D', flexShrink: 0 }}><Check size={26} /></div>
            <div>
              <h2 style={{ fontSize: 20, fontWeight: 700, margin: 0 }}>Organization created</h2>
              <div style={{ fontSize: 13, color: '#6B7280', marginTop: 3 }}>{c?.name || form.name} — tenant provisioned, wallet opened, primary owner invited.</div>
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12, marginBottom: 18 }}>
            <Fact label="Tenant ID"><span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}><Mono>{c?.tenantId || '—'}</Mono><Copy size={12} color="#9CA3AF" style={{ cursor: 'pointer' }} onClick={() => { try { navigator.clipboard?.writeText(c?.tenantId || ''); } catch { /* ignore */ } toast('Tenant ID copied'); }} /></span></Fact>
            <Fact label="Wallet balance"><div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}><span className="tnum" style={{ fontWeight: 700 }}>{fmtCr(w.balance)}</span><WalletStateBadge state={w.state} /></div></Fact>
            <Fact label="Account status"><ClientStatusBadge status={c?.status || 'INVITE_PENDING'} /></Fact>
            <Fact label="Owner email"><span style={{ fontSize: 13, wordBreak: 'break-all' }}>{c?.owner?.email || form.ownerEmail}</span></Fact>
          </div>

          <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
            <div className="eyebrow" style={{ marginBottom: 8 }}>System actions completed</div>
            {systemActions.map((a, i) => (
              <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '6px 0', borderTop: i ? '1px solid #F3F4F6' : 'none', fontSize: 13 }}>
                <Check size={15} color="#15803D" style={{ flexShrink: 0, marginTop: 2 }} />
                <div><div style={{ fontWeight: 600 }}>{a.t}</div><div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{a.s}</div></div>
              </div>
            ))}
          </div>

          <div className="banner info" style={{ marginBottom: 20 }}>
            <Info size={16} style={{ flexShrink: 0 }} />
            <div>Once the owner activates, the client becomes <b>Active</b> — even with 0 credits. They can explore, set up the team and create drafts; paid evaluation is controlled by wallet rules.</div>
          </div>

          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end', flexWrap: 'wrap' }}>
            <button className="btn-ghost" onClick={() => nav('/admin/clients')}>Back to clients</button>
            <button className="btn-primary" onClick={() => nav('/admin/clients/' + done)}>Open client <ArrowRight size={15} /></button>
          </div>
        </div>
        {toastNode}
      </div>
    );
  }

  /* ── wizard ── */
  return (
    <div style={{ maxWidth: 900, margin: '0 auto' }}>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
        <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/admin/clients')}>Clients</span> › Onboard client
      </div>
      <div style={{ marginBottom: 18 }}>
        <div style={{ fontSize: 20, fontWeight: 700 }}>Onboard client</div>
        <div style={{ fontSize: 13, color: '#6B7280', marginTop: 2 }}>Sales-led onboarding — create the organization, open its credit wallet and invite the primary owner. No plans, no platform fee.</div>
      </div>

      {/* stepper */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 22 }}>
        {STEPS.map((s, i) => (
          <div key={s.key} style={{ display: 'contents' }}>
            <div onClick={() => i < step && setStep(i)} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, cursor: i < step ? 'pointer' : 'default' }}>
              <div className={'step-circle' + (i === step ? ' active' : i < step ? ' done' : '')}>{i < step ? <Check size={15} /> : i + 1}</div>
              <span style={{ fontSize: 12, fontWeight: 600, color: i === step ? '#056FD4' : i < step ? '#059669' : '#9CA3AF', whiteSpace: 'nowrap' }}>{s.label}</span>
            </div>
            {i < STEPS.length - 1 && <div className={'step-conn' + (i < step ? ' done' : '')} />}
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '24px 26px' }}>
        {step === 0 && <CompanyStep form={form} set={set} />}
        {step === 1 && <OwnerStep form={form} set={set} />}
        {step === 2 && <CommercialStep form={form} set={set} credits={credits} />}
        {step === 3 && <ReviewStep form={form} credits={credits} alloc={alloc} actions={systemActions} valid={valid} goTo={setStep} />}

        {/* footer nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, marginTop: 24, paddingTop: 18, borderTop: '1px solid #F3F4F6', flexWrap: 'wrap' }}>
          <button className="btn-ghost" onClick={() => (step === 0 ? nav('/admin/clients') : setStep(step - 1))}><ArrowLeft size={15} /> {step === 0 ? 'Cancel' : 'Back'}</button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            {!canNext && <span style={{ fontSize: 12, color: '#9CA3AF' }}>Fill the required fields to continue</span>}
            {step < STEPS.length - 1
              ? <button className="btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue <ArrowRight size={15} /></button>
              : <PermButton action="client.create" className="btn-success" disabled={!allValid} onClick={create}><Mail size={15} /> Create organization &amp; send invite</PermButton>}
          </div>
        </div>
      </div>
      {toastNode}
    </div>
  );
}

/* ═══════════ steps ═══════════ */
function CompanyStep({ form, set }) {
  return (
    <>
      {/* sales-led flow strip (spec §02) — Admin enters at "creates organization" */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', background: '#F8FAFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', marginBottom: 20 }}>
        <span className="eyebrow" style={{ marginRight: 4 }}>Sales-led</span>
        {SALES_FLOW.map((s, i) => {
          const here = i === 4; const ahead = i > 4;
          return (
            <span key={s} style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <span className="chip" style={{ fontSize: 11.5, background: here ? '#056FD4' : ahead ? '#fff' : '#EFF6FF', color: here ? '#fff' : ahead ? '#9CA3AF' : '#1E40AF', border: `1px solid ${here ? '#056FD4' : ahead ? '#E2E8F0' : '#BFDBFE'}` }}>
                {!here && !ahead && <Check size={11} />}{s}{here && <span style={{ fontSize: 10, opacity: 0.85 }}>· you are here</span>}
              </span>
              {i < SALES_FLOW.length - 1 && <ArrowRight size={12} color="#9CA3AF" />}
            </span>
          );
        })}
      </div>

      <SectionTitle icon={Building2} title="Company" sub="Minimum organization information (spec §02). Only the company name is required to create the tenant." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <F label="Company name" req><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Globex Retail" autoFocus /></F>
        <F label="Legal name" hint="Defaults to the company name if left blank"><input className="input" value={form.legalName} onChange={(e) => set('legalName', e.target.value)} placeholder="e.g. Globex Retail Pvt Ltd" /></F>
        <F label="Country"><select className="input" value={form.country} onChange={(e) => set('country', e.target.value)}>{COUNTRIES.map((c) => <option key={c}>{c}</option>)}</select></F>
        <F label="Website"><input className="input" value={form.website} onChange={(e) => set('website', e.target.value)} placeholder="globex.com" /></F>
        <F label="Industry"><input className="input" list="onboard-industries" value={form.industry} onChange={(e) => set('industry', e.target.value)} placeholder="e.g. Retail / BPO" /><datalist id="onboard-industries">{INDUSTRIES.map((i) => <option key={i} value={i} />)}</datalist></F>
      </div>
    </>
  );
}

function OwnerStep({ form, set }) {
  const bad = form.ownerEmail && !emailOk(form.ownerEmail);
  const free = !bad && isFreeMail(form.ownerEmail);
  return (
    <>
      <SectionTitle icon={User} title="Primary owner" sub="Created as an Invite Pending user. They activate the workspace, then manage the team and opportunities." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <F label="Name" req><input className="input" value={form.ownerName} onChange={(e) => set('ownerName', e.target.value)} placeholder="e.g. Priya Nair" autoFocus /></F>
        <F label="Work email" req hint={bad ? 'Enter a valid email address' : free ? 'Looks like a personal mailbox — a work email is recommended' : 'The invitation is sent here'} hintColor={bad ? '#B91C1C' : free ? '#B45309' : undefined}>
          <input className="input" type="email" value={form.ownerEmail} onChange={(e) => set('ownerEmail', e.target.value)} placeholder="hr@company.com" style={bad ? { borderColor: '#FCA5A5' } : undefined} />
        </F>
        <F label="Phone"><input className="input" value={form.ownerPhone} onChange={(e) => set('ownerPhone', e.target.value)} placeholder="+91 98xxx xxxxx" /></F>
        <F label="Designation"><input className="input" value={form.ownerDesignation} onChange={(e) => set('ownerDesignation', e.target.value)} placeholder="e.g. Head of Talent Acquisition" /></F>
      </div>
      <div className="banner info" style={{ marginTop: 18, marginBottom: 0 }}>
        <Mail size={16} style={{ flexShrink: 0 }} />
        <div>Status on create: <b>Invite pending</b>. The invite can be re-sent or revoked from the client page. The account becomes <b>Active</b> only when the owner activates — not when credits are added.</div>
      </div>
    </>
  );
}

function CommercialStep({ form, set, credits }) {
  const isINR = form.currency === 'INR';
  return (
    <>
      <SectionTitle icon={Landmark} title="Billing details" sub="Money accounting (payments) is a separate domain from wallet accounting (credits)." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16, marginBottom: 22 }}>
        <F label="GSTIN" hint="15 characters · optional outside India"><input className="input" value={form.gstin} onChange={(e) => set('gstin', e.target.value.toUpperCase())} placeholder="29AABCF1234A1Z5" maxLength={15} style={{ fontFamily: 'ui-monospace, Menlo, monospace' }} /></F>
        <F label="Currency"><select className="input" value={form.currency} onChange={(e) => set('currency', e.target.value)}>{CURRENCIES.map((c) => <option key={c}>{c}</option>)}</select></F>
        <div style={{ gridColumn: '1 / -1' }}><F label="Billing address"><textarea className="input" rows={2} value={form.billingAddress} onChange={(e) => set('billingAddress', e.target.value)} placeholder="Street, city, state, PIN" style={{ resize: 'vertical' }} /></F></div>
      </div>

      <SectionTitle icon={Wallet} title="Initial credit allocation" sub="The wallet is created with balance 0 by default. Any initial allocation is posted as an immutable ledger entry on create." />
      <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginBottom: 14 }}>
        {ALLOC.map((a) => {
          const on = form.initialType === a.key; const Icon = a.icon;
          return (
            <div key={a.key} onClick={() => set('initialType', a.key)} style={{ flex: '1 1 200px', display: 'flex', alignItems: 'center', gap: 10, padding: '12px 14px', border: `1.5px solid ${on ? '#056FD4' : '#E2E8F0'}`, background: on ? '#F8FBFF' : '#fff', borderRadius: 10, cursor: 'pointer' }}>
              <span style={{ width: 16, height: 16, borderRadius: '50%', border: `2px solid ${on ? '#056FD4' : '#CBD5E1'}`, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{on && <span style={{ width: 8, height: 8, borderRadius: '50%', background: '#056FD4' }} />}</span>
              <Icon size={16} color={on ? '#056FD4' : '#9CA3AF'} />
              <div><div style={{ fontSize: 13.5, fontWeight: 600, color: on ? '#056FD4' : '#14212A' }}>{a.label}</div><div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{a.sub}</div></div>
            </div>
          );
        })}
      </div>

      {form.initialType !== 'none' && (
        <div className="fade-in" style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '14px 16px', marginBottom: 14, background: '#FAFAFA' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
            <F label="Credits" req hint={credits > 0 ? (isINR ? <>≈ {fmtMoney(credits * CURRENCY.perCredit)} at {CURRENCY.symbol}{CURRENCY.perCredit}/credit<PendingChip /></> : <>Money value recorded in {form.currency} · conversion<PendingChip /></>) : 'Whole credits, greater than 0'}>
              <input className="input" type="number" min={1} step={1} value={form.initialCredits} onChange={(e) => set('initialCredits', e.target.value)} placeholder="e.g. 5000" />
            </F>
            {form.initialType === 'purchase' && <>
              <F label="Payment method"><select className="input" value={form.paymentMethod} onChange={(e) => set('paymentMethod', e.target.value)}>{PAY_METHODS.map((m) => <option key={m}>{m}</option>)}</select></F>
              <F label="Payment reference" hint="Invoice / UTR / gateway ID — auto-generated if blank"><input className="input" value={form.paymentRef} onChange={(e) => set('paymentRef', e.target.value)} placeholder="INV-2091 / UTR…" /></F>
            </>}
            {form.initialType === 'grant' && (
              <div style={{ gridColumn: '1 / -1' }}>
                <F label="Reason for grant" req hint="Written to the ledger entry and the audit log (min 4 characters)">
                  <textarea className="input" rows={2} value={form.initialReason} onChange={(e) => set('initialReason', e.target.value)} placeholder="e.g. Pilot credits agreed in the deal · 30-day evaluation" style={{ resize: 'vertical' }} />
                </F>
              </div>
            )}
          </div>
          <div style={{ fontSize: 12, color: '#6B7280', marginTop: 10, display: 'flex', gap: 6, alignItems: 'center', flexWrap: 'wrap' }}>
            <Receipt size={13} color="#9CA3AF" /> Posts as <b style={{ color: '#374151' }}>{form.initialType === 'purchase' ? 'PURCHASE' : 'ADMIN_GRANT'}</b> (+{num(credits)} cr){form.initialType === 'purchase' && <> and creates a <b style={{ color: '#374151' }}>payment record</b>{form.paymentMethod.includes('offline') ? ' marked manual / offline' : ''}</>}.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 14, flexWrap: 'wrap', fontSize: 12.5, color: '#6B7280', background: '#F8FAFF', border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 14px', marginBottom: 22 }}>
        <span style={{ fontWeight: 600, color: '#374151' }}>Wallet defaults on create</span>
        <span>Low-balance threshold <b className="tnum">{num(DEFAULTS.lowBalanceThreshold)} cr</b><PendingChip /></span>
        <span>Overdraft limit <b className="tnum">{num(DEFAULTS.overdraftLimit)} cr</b><PendingChip /></span>
        <span style={{ color: '#9CA3AF' }}>Adjust per client later from the wallet card.</span>
      </div>

      <SectionTitle icon={ClipboardList} title="Internal" sub="Visible to Cuba Admins only." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 16 }}>
        <F label="Sales / account owner"><input className="input" list="onboard-sales" value={form.salesOwner} onChange={(e) => set('salesOwner', e.target.value)} placeholder="e.g. Rahul Bose (AE)" /><datalist id="onboard-sales">{SALES_OWNERS.map((s) => <option key={s} value={s} />)}</datalist></F>
        <div style={{ gridColumn: '1 / -1' }}><F label="Internal notes"><textarea className="input" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} placeholder="Deal context, expected volumes, special terms…" style={{ resize: 'vertical' }} /></F></div>
      </div>
    </>
  );
}

function ReviewStep({ form, credits, alloc, actions, valid, goTo }) {
  const allocText = form.initialType === 'none' ? 'None — wallet starts at 0'
    : form.initialType === 'purchase' ? `+${num(credits)} cr · Purchase · ${form.paymentMethod}${form.paymentRef ? ' · ref ' + form.paymentRef : ''}`
      : `+${num(credits)} cr · Admin grant · ${form.initialReason || '—'}`;
  const sections = [
    { i: 0, title: 'Company', icon: Building2, rows: [['Company name', form.name], ['Legal name', form.legalName || form.name], ['Country', form.country], ['Website', form.website], ['Industry', form.industry]] },
    { i: 1, title: 'Primary owner', icon: User, rows: [['Name', form.ownerName], ['Work email', form.ownerEmail], ['Phone', form.ownerPhone], ['Designation', form.ownerDesignation]] },
    { i: 2, title: 'Commercial / internal', icon: Wallet, rows: [['GSTIN', form.gstin], ['Billing address', form.billingAddress], ['Currency', form.currency], ['Initial credits', allocText], ['Sales / account owner', form.salesOwner], ['Internal notes', form.notes]] },
  ];
  return (
    <>
      <SectionTitle icon={ClipboardList} title="Review & create" sub="Check the details, then create the organization. Everything below is auditable and can be edited from the client page later." />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18, alignItems: 'start' }}>
        {/* summary table */}
        <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
          <table>
            <tbody>
              {sections.map((sec) => {
                const Icon = sec.icon;
                return [
                  <tr key={sec.title}>
                    <td colSpan={2} style={{ background: '#FAFAFA', padding: '8px 14px', borderTop: sec.i ? '1px solid #E2E8F0' : 'none' }}>
                      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                        <span className="eyebrow" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: valid[sec.i] ? '#9CA3AF' : '#B91C1C' }}><Icon size={12} /> {sec.title}</span>
                        <span style={{ fontSize: 12, color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => goTo(sec.i)}>Edit</span>
                      </div>
                    </td>
                  </tr>,
                  ...sec.rows.map(([k, v]) => (
                    <tr key={sec.title + k}>
                      <td style={{ color: '#6B7280', fontSize: 12.5, padding: '8px 14px', width: '40%', verticalAlign: 'top' }}>{k}</td>
                      <td style={{ fontWeight: 600, fontSize: 13, padding: '8px 14px', color: v ? '#14212A' : '#C0C4CC', wordBreak: 'break-word' }}>{v || '—'}</td>
                    </tr>
                  )),
                ];
              })}
            </tbody>
          </table>
        </div>

        {/* what happens on create */}
        <div>
          <div style={{ border: '1.5px solid #BFDBFE', background: '#F8FBFF', borderRadius: 10, padding: '14px 16px' }}>
            <div style={{ fontSize: 13.5, fontWeight: 700, marginBottom: 8, display: 'flex', alignItems: 'center', gap: 7 }}><ShieldCheck size={15} color="#056FD4" /> What happens on create</div>
            {actions.map((a, i) => {
              const Icon = a.icon;
              return (
                <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderTop: i ? '1px solid #E2E8F0' : 'none' }}>
                  <span style={{ width: 20, height: 20, borderRadius: '50%', background: '#056FD4', color: '#fff', fontSize: 11, fontWeight: 700, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0, marginTop: 1 }}>{i + 1}</span>
                  <div style={{ minWidth: 0 }}>
                    <div style={{ fontSize: 13, fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6 }}><Icon size={13} color="#6B7280" /> {a.t}</div>
                    <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 1 }}>{a.s}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div className="banner info" style={{ marginTop: 12, marginBottom: 0, alignItems: 'flex-start' }}>
            <Info size={16} style={{ flexShrink: 0, marginTop: 1 }} />
            <div>A client can become <b>ACTIVE with 0 credits</b> — they can explore, set up the team and create drafts; paid evaluation is controlled by wallet rules.</div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ═══════════ read-only gate ═══════════ */
function ReadOnlyNotice({ role, onBack }) {
  return (
    <div style={{ maxWidth: 640, margin: '40px auto' }}>
      <div className="card" style={{ padding: 32, textAlign: 'center' }}>
        <div className="avatar" style={{ width: 56, height: 56, background: '#F3F4F6', color: '#6B7280', margin: '0 auto 14px' }}><Lock size={24} /></div>
        <h2 style={{ fontSize: 19, fontWeight: 700, margin: '0 0 6px' }}>Onboarding is read-only for your role</h2>
        <p style={{ fontSize: 13.5, color: '#6B7280', margin: '0 0 16px', lineHeight: 1.55 }}>
          Creating an organization needs the <span className="kbd">client.create</span> permission (Super Admin or Operations Admin). You are signed in as <b>{role}</b>. Switch role from the header to try it, or ask an Operations Admin to onboard this client.
        </p>
        <div style={{ textAlign: 'left', border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 16px', marginBottom: 18, fontSize: 12.5, color: '#475569' }}>
          <div className="eyebrow" style={{ marginBottom: 6 }}>What onboarding does (spec §02)</div>
          {['Creates a unique Organization / Tenant ID', 'Creates the credit wallet with balance 0 (or an initial allocation)', 'Creates the primary owner as Invite Pending', 'Sends the invitation email', 'Writes an audit-log entry'].map((t, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, padding: '3px 0' }}><span style={{ color: '#9CA3AF', fontWeight: 700, width: 14 }}>{i + 1}</span>{t}</div>
          ))}
        </div>
        <button className="btn-ghost" onClick={onBack}><ArrowLeft size={15} /> Back to clients</button>
      </div>
    </div>
  );
}

/* ═══════════ small local components ═══════════ */
const F = ({ label, req, hint, hintColor, children }) => (
  <div>
    <label className="field-label">{label}{req && <span className="req"> *</span>}</label>
    {children}
    {hint && <div className="hint" style={hintColor ? { color: hintColor } : undefined}>{hint}</div>}
  </div>
);
const SectionTitle = ({ icon: Icon, title, sub }) => (
  <div style={{ marginBottom: 16 }}>
    <h2 style={{ fontSize: 16, fontWeight: 700, margin: '0 0 3px', display: 'flex', alignItems: 'center', gap: 8 }}>{Icon && <Icon size={16} color="#056FD4" />} {title}</h2>
    {sub && <div style={{ fontSize: 12.5, color: '#6B7280' }}>{sub}</div>}
  </div>
);
const Fact = ({ label, children }) => (
  <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '10px 12px', minWidth: 0 }}>
    <div className="eyebrow" style={{ marginBottom: 6 }}>{label}</div>
    <div style={{ fontSize: 13.5 }}>{children}</div>
  </div>
);

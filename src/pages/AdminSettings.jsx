import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Settings, Users, Shield, Coins, Receipt, Sliders, Bell, Lock, Plug, Server, UserPlus, Check, X, Info, ShieldAlert, ShieldCheck, ArrowRight, AlertTriangle, Hourglass, Languages, KeyRound, Plus, Wallet, History, Ban } from 'lucide-react';
import { useApp, ADMIN_ROLES, PERMISSIONS, HIGH_RISK, CRITICAL, NOTIF_CATEGORIES, NOTIF_SEVERITY, WALLET_STATE, CURRENCY, roleName, fmtCr, fmtMoney, initials } from '../store.jsx';
import { PendingChip, SeverityBadge, WalletStateBadge, useToast, Modal, PermButton, useTab, PageHeader, EmptyRow, Toggle, Mono } from '../components/admin/ui.jsx';

/* ═══════════ Settings — spec §18 (sections) · §14 (Admin RBAC) · §15 (notifications) · pending decisions ═══════════
   Locked distinction: Profile = personal Admin settings · Settings = Cuba platform settings.
   Only `settings.manage` (Super Admin) may change anything here; every other role sees the same page read-only.
   Every Save goes through updateSettings(section, patch) which writes a permanent audit entry. */

const TABS = [
  { key: 'general',       label: 'General',               icon: Settings, hint: 'Identity · contact · region' },
  { key: 'users',         label: 'Admin Users & Access',  icon: Users,    hint: 'Roles · RBAC matrix' },
  { key: 'security',      label: 'Security',              icon: Shield,   hint: 'MFA · re-auth · dual approval' },
  { key: 'credits',       label: 'Credits & Billing',     icon: Coins,    hint: 'Wallet defaults' },
  { key: 'ratecard',      label: 'Rate Card',             icon: Receipt,  hint: 'Credits per service' },
  { key: 'evaluation',    label: 'Evaluation Defaults',   icon: Sliders,  hint: 'Thresholds · languages' },
  { key: 'notifications', label: 'Notifications',         icon: Bell,     hint: 'Channels · routing' },
  { key: 'privacy',       label: 'Data & Privacy',        icon: Lock,     hint: 'Retention · legal hold' },
  { key: 'integrations',  label: 'Integrations',          icon: Plug,     hint: 'Providers summary' },
  { key: 'system',        label: 'System Configuration',  icon: Server,   hint: 'Limits · maintenance' },
];

const ROLE_SHORT = { super: 'Super', ops: 'Ops', finance: 'Finance', support: 'Support', compliance: 'Compliance', analyst: 'Analyst' };

/* human labels for permission actions (spec §14: action-level, not page-level) */
const ACTION_LABELS = {
  'client.create': 'Create / onboard client', 'client.edit': 'Edit client details', 'client.invite': 'Invite client owner', 'client.suspend': 'Suspend client', 'client.reinstate': 'Reinstate client',
  'client.offboard': 'Start offboarding', 'client.export': 'Export client data', 'wallet.addCredits': 'Add credits (purchase / grant)', 'wallet.refund': 'Refund credits', 'wallet.adjust': 'Manual credit adjustment',
  'wallet.overdraft': 'Change overdraft limit', 'wallet.threshold': 'Set low-balance threshold', 'wallet.freeze': 'Freeze / unfreeze wallet', 'ratecard.edit': 'Edit rate card', 'payment.record': 'Record payment',
  'usage.pause': 'Pause client usage', 'job.recover': 'Recover failed job', 'job.reverseCredits': 'Reverse credits (failed job)', 'module.manage': 'Manage modules', 'module.emergency': 'Emergency module pause',
  'integration.manage': 'Manage integrations', 'compliance.manage': 'Manage compliance', 'compliance.legalHold': 'Apply / release legal hold', 'settings.manage': 'Manage platform settings', 'admin.manage': 'Manage admin users',
  'impersonate': 'Impersonate client workspace',
};
const MATRIX_ACTIONS = ['client.create', 'client.suspend', 'client.offboard', 'wallet.addCredits', 'wallet.refund', 'wallet.adjust', 'wallet.overdraft', 'ratecard.edit', 'job.recover', 'job.reverseCredits', 'module.emergency', 'compliance.legalHold', 'settings.manage', 'impersonate'];

const TIMEZONES = ['Asia/Kolkata', 'Asia/Singapore', 'Asia/Dubai', 'Europe/London', 'America/New_York', 'UTC'];
const REGIONS = ['India (ap-south-1)', 'Singapore (ap-southeast-1)', 'EU — Ireland (eu-west-1)', 'US — Virginia (us-east-1)'];
const STORAGE_REGIONS = ['ap-south-1', 'ap-southeast-1', 'eu-west-1', 'us-east-1'];
const PROCTORING_OPTIONS = ['camera + mic + tab-switch', 'camera + tab-switch', 'tab-switch only', 'off (not recommended)'];
const LANG_SUGGESTIONS = ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Marathi', 'Bengali', 'Malayalam', 'Gujarati', 'Punjabi', 'Odia'];

const WALLET_MEANING = {
  HEALTHY: 'Available credits are above the low-balance threshold.',
  LOW_BALANCE: 'Available ≤ threshold — client and Finance are alerted; nothing is blocked yet.',
  ZERO: 'Balance is 0 — client stays ACTIVE; new paid evaluations wait for a top-up while running work continues.',
  OVERDRAFT: 'Platform covered a shortfall so a running evaluation could finish; the next top-up clears the debt first.',
  BLOCKED_FOR_NEW_USAGE: 'Wallet frozen by Admin (or beyond overdraft limit) — new paid usage blocked while existing work completes.',
};
const SEVERITY_MEANING = {
  INFO: 'Awareness only — no action needed (e.g. client invited, zero balance reached).',
  WARNING: 'Action recommended soon (low balance, score pending, fairness flag).',
  CRITICAL: 'Act now — money, a running candidate or compliance is at risk.',
  RESOLVED: 'Closes an earlier alert (debt cleared, job recovered, incident over).',
};

/* the spec's "Pending / To Be Finalized Later" list, mapped to where the placeholder lives */
const PENDING_ITEMS = [
  { text: 'Exact low-balance thresholds', tab: 'credits', where: 'Credits & Billing' },
  { text: 'Exact default overdraft limits and approval rules', tab: 'credits', where: 'Credits & Billing · Security' },
  { text: 'Exact credit conversion / rate values for each service', tab: 'ratecard', where: 'Rate Card' },
  { text: 'Final opportunity funding rule and whether any reserve model is used', tab: 'credits', where: 'Credits & Billing' },
  { text: 'Exact application-cap defaults relative to hiring target', tab: 'credits', where: 'Funding multipliers' },
  { text: 'Remaining-credit settlement / refund rules during offboarding', to: '/admin/clients', where: 'Client → Offboarding' },
  { text: 'Country / legal-specific retention durations', tab: 'privacy', where: 'Data & Privacy' },
  { text: 'Permanent deletion timing and backup deletion strategy', tab: 'privacy', where: 'Data & Privacy' },
  { text: 'Which sensitive Admin actions require dual approval', tab: 'security', where: 'Security' },
  { text: 'Exact client-specific module access policy', to: '/admin/platform?tab=modules', where: 'Platform → Modules' },
  { text: 'Final integration / provider choices', to: '/admin/platform?tab=integrations', where: 'Platform → Integrations' },
  { text: 'Final Admin IA after end-to-end flow validation', where: 'Admin IA (spec §19)' },
];

const num = (n) => (Number(n) || 0).toLocaleString('en-IN');
const clone = (o) => JSON.parse(JSON.stringify(o));

/* local draft of a settings section: edit freely, Save writes through updateSettings (audited), Reset discards */
function useDraft(initial) {
  const [draft, setDraft] = useState(() => clone(initial));
  const set = (k, v) => setDraft((d) => ({ ...d, [k]: v }));
  const dirty = JSON.stringify(draft) !== JSON.stringify(initial);
  const reset = () => setDraft(clone(initial));
  return { draft, set, setDraft, dirty, reset };
}

/* ═══════════════════════════════ page ═══════════════════════════════ */
export default function AdminSettings() {
  const nav = useNavigate();
  const { can, currentAdmin } = useApp();
  const [tab, setTab] = useTab(TABS, 'general');
  const [show, toastNode] = useToast();
  const ro = !can('settings.manage');
  const p = { ro, show, nav, setTab };

  return (
    <>
      <PageHeader title="Settings" sub="Cuba platform settings — Profile is personal Admin settings; Settings is the platform"
        right={<span className="chip" style={{ background: '#F3F4F6', color: '#475569' }}><ShieldCheck size={13} /> {currentAdmin.name} · {roleName(currentAdmin.role)}</span>} />

      {ro && (
        <div className="banner warn"><Lock size={16} style={{ flexShrink: 0 }} />
          <div><b>Read-only for your role.</b> Platform settings can only be changed by a Super Admin (<Mono>settings.manage</Mono>). Controls stay visible so you can see how Cuba is configured, but they are disabled.</div>
        </div>
      )}

      <div style={{ display: 'grid', gridTemplateColumns: '220px minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        {/* settings sidebar (URL-synced via ?tab=) */}
        <div className="card" style={{ padding: 8, position: 'sticky', top: 72 }}>
          {TABS.map((t) => { const on = t.key === tab; const Icon = t.icon; return (
            <button key={t.key} onClick={() => setTab(t.key)}
              style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', background: on ? '#EFF6FF' : 'transparent', border: 'none', borderLeft: `3px solid ${on ? '#056FD4' : 'transparent'}`, borderRadius: 8, padding: '9px 10px', cursor: 'pointer', color: on ? '#056FD4' : '#374151' }}>
              <Icon size={16} style={{ flexShrink: 0, color: on ? '#056FD4' : '#9CA3AF' }} />
              <span style={{ minWidth: 0 }}>
                <span style={{ display: 'block', fontSize: 13, fontWeight: on ? 700 : 600, lineHeight: 1.2 }}>{t.label}</span>
                <span style={{ display: 'block', fontSize: 10.5, color: on ? '#3B82F6' : '#9CA3AF', marginTop: 2, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{t.hint}</span>
              </span>
            </button>
          ); })}
          <div style={{ margin: '10px 10px 4px', paddingTop: 10, borderTop: '1px solid #F3F4F6', fontSize: 11, color: '#9CA3AF', lineHeight: 1.45 }}>
            Looking for your own name, password or MFA? That is <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/profile')}>Profile</span> (personal), not Settings.
          </div>
        </div>

        {/* right panel */}
        <div style={{ minWidth: 0 }}>
          {tab === 'general' && <GeneralPanel {...p} />}
          {tab === 'users' && <UsersPanel {...p} />}
          {tab === 'security' && <SecurityPanel {...p} />}
          {tab === 'credits' && <CreditsPanel {...p} />}
          {tab === 'ratecard' && <RateCardPanel {...p} />}
          {tab === 'evaluation' && <EvaluationPanel {...p} />}
          {tab === 'notifications' && <NotificationsPanel {...p} />}
          {tab === 'privacy' && <PrivacyPanel {...p} />}
          {tab === 'integrations' && <IntegrationsPanel {...p} />}
          {tab === 'system' && <SystemPanel {...p} />}
        </div>
      </div>

      <PendingCard setTab={setTab} nav={nav} />
      {toastNode}
    </>
  );
}

/* ═══════════════════════════════ GENERAL ═══════════════════════════════ */
function GeneralPanel({ ro, show }) {
  const { settings, updateSettings } = useApp();
  const { draft, set, dirty, reset } = useDraft(settings.general);
  return (
    <Panel icon={Settings} title="General" sub="Platform identity and contact defaults shown across Cuba Admin and the client portal.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Platform name"><input className="input" disabled={ro} value={draft.platformName} onChange={(e) => set('platformName', e.target.value)} /></Field>
        <Field label="Operator company" hint='Appears as the small "by …" tag in the client portal.'><input className="input" disabled={ro} value={draft.company} onChange={(e) => set('company', e.target.value)} /></Field>
        <Field label="Support email" hint="Shown to clients in Support and used as the sender for system emails."><input className="input" type="email" disabled={ro} value={draft.supportEmail} onChange={(e) => set('supportEmail', e.target.value)} /></Field>
        <Field label="Timezone" hint="Used for audit timestamps and scheduled reports.">
          <select className="input" disabled={ro} value={draft.timezone} onChange={(e) => set('timezone', e.target.value)}>{[draft.timezone, ...TIMEZONES].filter((v, i, a) => a.indexOf(v) === i).map((z) => <option key={z}>{z}</option>)}</select>
        </Field>
        <Field label="Region (data residency)" hint="Where tenant data and evaluation media are stored." span>
          <select className="input" disabled={ro} value={draft.region} onChange={(e) => set('region', e.target.value)}>{[draft.region, ...REGIONS].filter((v, i, a) => a.indexOf(v) === i).map((z) => <option key={z}>{z}</option>)}</select>
        </Field>
      </div>
      <div className="banner info" style={{ marginTop: 16, marginBottom: 0 }}><Info size={15} style={{ flexShrink: 0 }} /><div>Branding is <b>Cuba</b> everywhere — Admin is "Cuba Admin", the client portal is "Cuba" with a small "by {draft.company || 'Reboo8'}" tag.</div></div>
      <SaveBar dirty={dirty} ro={ro} onReset={reset} onSave={() => { updateSettings('general', draft); show('General settings saved · audit entry written'); }} />
    </Panel>
  );
}

/* ═══════════════════════════════ ADMIN USERS & ACCESS (spec §14) ═══════════════════════════════ */
function UsersPanel({ show }) {
  const { adminUsers, currentAdmin, inviteAdmin, deactivateAdmin, setAdminRole, settings, can } = useApp();
  const [invite, setInvite] = useState(null);
  const [deact, setDeact] = useState(null);
  const canManage = can('admin.manage');
  const active = adminUsers.filter((u) => u.status !== 'DEACTIVATED');
  const dual = settings.security?.dualApproval || [];
  const STATUS = { ACTIVE: ['#DCFCE7', '#15803D', 'Active'], INVITED: ['#DBEAFE', '#1E40AF', 'Invited'], DEACTIVATED: ['#F3F4F6', '#6B7280', 'Deactivated'] };
  const safeguard = (a) => (CRITICAL.includes(a) || dual.includes(a)) ? ['#FEE2E2', '#B91C1C', 're-auth / 2nd approval'] : HIGH_RISK.includes(a) ? ['#FEF3C7', '#B45309', 'reason + audit'] : null;
  const inviteOk = invite && invite.name.trim().length >= 2 && /\S+@\S+\.\S+/.test(invite.email);

  return (
    <>
      <Panel icon={Users} title="Admin Users & Access" sub={`${active.length} active admin users · ${ADMIN_ROLES.length} predefined roles`}
        right={<PermButton action="admin.manage" className="btn-primary" onClick={() => setInvite({ name: '', email: '', role: 'analyst' })}><UserPlus size={15} /> Invite admin</PermButton>}>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Admin</th><th>Role</th><th>Status</th><th>MFA</th><th>Last active</th><th></th></tr></thead>
            <tbody>
              {adminUsers.length === 0 ? <EmptyRow cols={6} text="No admin users yet — invite the first one." /> : adminUsers.map((u) => {
                const [bg, fg, label] = STATUS[u.status] || STATUS.ACTIVE; const off = u.status === 'DEACTIVATED'; const me = u.id === currentAdmin.id;
                return (
                  <tr key={u.id} style={{ opacity: off ? 0.6 : 1 }}>
                    <td>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <div className="avatar" style={{ width: 32, height: 32, background: off ? '#F3F4F6' : '#E0EDFF', color: off ? '#9CA3AF' : '#056FD4', fontSize: 11.5 }}>{initials(u.name)}</div>
                        <div><div style={{ fontWeight: 600, fontSize: 13.5 }}>{u.name} {me && <span className="badge" style={{ background: '#EFF6FF', color: '#056FD4', marginLeft: 4 }}>you</span>}</div><div style={{ fontSize: 12, color: '#6B7280' }}>{u.email}</div></div>
                      </div>
                    </td>
                    <td>
                      <select className="input" style={{ padding: '6px 10px', fontSize: 12.5, minWidth: 170 }} disabled={!canManage || off} value={u.role} title={!canManage ? 'Not permitted for your role (admin.manage)' : undefined}
                        onChange={(e) => { setAdminRole(u.id, e.target.value); show(`${u.name} → ${roleName(e.target.value)}`); }}>
                        {ADMIN_ROLES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
                      </select>
                    </td>
                    <td><span className="badge" style={{ background: bg, color: fg }}>{label}</span></td>
                    <td>{u.mfa ? <span style={{ color: '#15803D', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><Check size={14} /> on</span> : <span style={{ color: '#B45309', fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 4 }}><X size={14} /> off</span>}</td>
                    <td style={{ color: '#6B7280', fontSize: 12.5, whiteSpace: 'nowrap' }}>{u.lastActive}</td>
                    <td style={{ textAlign: 'right' }}>
                      {off ? <span style={{ fontSize: 11.5, color: '#9CA3AF', display: 'inline-flex', alignItems: 'center', gap: 4 }}><History size={12} /> history retained</span>
                        : <PermButton action="admin.manage" className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5, color: '#B91C1C' }} disabled={me} title={me ? 'You cannot deactivate yourself' : undefined} onClick={() => setDeact(u)}><Ban size={13} /> Deactivate</PermButton>}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 14 }}>
          <Note icon={Lock}><b>Locked for V1:</b> predefined roles only — custom Admin roles come later.</Note>
          <Note icon={History}><b>Historical actions remain</b> in the audit log even if an Admin user is deactivated.</Note>
        </div>
      </Panel>

      <Panel icon={ShieldCheck} title="Roles & permissions (RBAC matrix)" sub="Permissions are action-level, not only page-level. Read-only roles still see every page — the controls are disabled, not hidden.">
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10, marginBottom: 16 }}>
          {ADMIN_ROLES.map((r) => { const n = adminUsers.filter((u) => u.role === r.id && u.status !== 'DEACTIVATED').length; const me = r.id === currentAdmin.role; return (
            <div key={r.id} style={{ border: `1px solid ${me ? '#BFDBFE' : '#E2E8F0'}`, background: me ? '#F8FBFF' : '#fff', borderRadius: 10, padding: '10px 12px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 6 }}><span style={{ fontSize: 13, fontWeight: 700 }}>{r.name}</span><span className="badge" style={{ background: '#F3F4F6', color: '#6B7280' }}>{n}</span></div>
              <div style={{ fontSize: 11.5, color: '#6B7280', marginTop: 3 }}>{r.desc}</div>
            </div>
          ); })}
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Action</th>{ADMIN_ROLES.map((r) => <th key={r.id} style={{ textAlign: 'center', background: r.id === currentAdmin.role ? '#EFF6FF' : undefined, color: r.id === currentAdmin.role ? '#056FD4' : undefined }}>{ROLE_SHORT[r.id] || r.name}</th>)}<th>Safeguard</th></tr></thead>
            <tbody>
              {MATRIX_ACTIONS.length === 0 ? <EmptyRow cols={ADMIN_ROLES.length + 2} /> : MATRIX_ACTIONS.map((a) => { const sg = safeguard(a); return (
                <tr key={a}>
                  <td><div style={{ fontWeight: 600, fontSize: 13 }}>{ACTION_LABELS[a] || a}</div><Mono>{a}</Mono></td>
                  {ADMIN_ROLES.map((r) => { const ok = (PERMISSIONS[a] || []).includes(r.id); return <td key={r.id} style={{ textAlign: 'center', background: r.id === currentAdmin.role ? '#F8FBFF' : undefined }}>{ok ? <Check size={15} color="#15803D" strokeWidth={3} /> : <span style={{ color: '#D1D5DB', fontWeight: 700 }}>–</span>}</td>; })}
                  <td>{sg ? <span className="badge" style={{ background: sg[0], color: sg[1], whiteSpace: 'nowrap' }}>{sg[2]}</span> : <span style={{ color: '#9CA3AF', fontSize: 12 }}>—</span>}</td>
                </tr>
              ); })}
            </tbody>
          </table>
        </div>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 14, marginTop: 12, fontSize: 12, color: '#6B7280', alignItems: 'center' }}>
          <span><span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}>reason + audit</span> high-risk: reason is mandatory and written to the permanent audit log</span>
          <span><span className="badge" style={{ background: '#FEE2E2', color: '#B91C1C' }}>re-auth / 2nd approval</span> critical: additionally re-authenticate (MFA / password) and, when configured, a second admin approves</span>
        </div>
      </Panel>

      {invite && (
        <Modal title="Invite admin user" onClose={() => setInvite(null)}
          footer={<><button className="btn-ghost" onClick={() => setInvite(null)}>Cancel</button><PermButton action="admin.manage" className="btn-primary" disabled={!inviteOk} onClick={() => { inviteAdmin(invite.name.trim(), invite.email.trim(), invite.role); show(`Invite sent to ${invite.email.trim()} · ${roleName(invite.role)}`); setInvite(null); }}><UserPlus size={15} /> Send invite</PermButton></>}>
          <div style={{ display: 'grid', gap: 14 }}>
            <Field label={<>Full name <span className="req">*</span></>}><input className="input" autoFocus value={invite.name} onChange={(e) => setInvite({ ...invite, name: e.target.value })} placeholder="e.g. Meera Krishnan" /></Field>
            <Field label={<>Work email <span className="req">*</span></>}><input className="input" type="email" value={invite.email} onChange={(e) => setInvite({ ...invite, email: e.target.value })} placeholder="name@cuba.reboo8.com" /></Field>
            <Field label="Role" hint={ADMIN_ROLES.find((r) => r.id === invite.role)?.desc}>
              <select className="input" value={invite.role} onChange={(e) => setInvite({ ...invite, role: e.target.value })}>{ADMIN_ROLES.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}</select>
            </Field>
            <div className="banner info" style={{ margin: 0 }}><Info size={14} style={{ flexShrink: 0 }} /><div>The user appears as <b>Invited</b> until they accept. MFA is enforced on first sign-in{settings.security?.mfaForCritical ? ' and before any critical action' : ''}.</div></div>
          </div>
        </Modal>
      )}

      {deact && (
        <Modal title={`Deactivate ${deact.name}?`} onClose={() => setDeact(null)} width={460}
          footer={<><button className="btn-ghost" onClick={() => setDeact(null)}>Cancel</button><PermButton action="admin.manage" className="btn-primary" style={{ background: '#DC2626' }} onClick={() => { deactivateAdmin(deact.id); show(`${deact.name} deactivated · history retained`); setDeact(null); }}><Ban size={15} /> Deactivate</PermButton></>}>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.55 }}>
            <p style={{ margin: '0 0 10px' }}>{deact.email} ({roleName(deact.role)}) will lose access immediately and any active sessions end.</p>
            <div className="banner info" style={{ margin: 0 }}><History size={14} style={{ flexShrink: 0 }} /><div><b>Historical actions remain.</b> Everything this admin did stays in the audit log with their identity — deactivation never rewrites history.</div></div>
          </div>
        </Modal>
      )}
    </>
  );
}

/* ═══════════════════════════════ SECURITY (spec §14 safeguards) ═══════════════════════════════ */
function SecurityPanel({ ro, show }) {
  const { settings, updateSettings } = useApp();
  const { draft, set, dirty, reset } = useDraft(settings.security);
  const dual = draft.dualApproval || [];
  const toggleDual = (a) => set('dualApproval', dual.includes(a) ? dual.filter((x) => x !== a) : [...dual, a]);
  return (
    <Panel icon={Shield} title="Security" sub="Authentication and approval safeguards for Admin actions — the seatbelt, not the steering wheel.">
      <ToggleRow label="MFA / re-authentication for critical actions" desc="Critical actions ask the admin to re-enter their password (or MFA) before confirming — offboarding, manual adjustments, overdraft limits." on={!!draft.mfaForCritical} onClick={() => set('mfaForCritical', !draft.mfaForCritical)} disabled={ro} />
      <ToggleRow label="IP allow-list for Admin sign-in" desc="Restrict the Admin portal to approved office / VPN ranges. Client portal is unaffected." on={!!draft.ipAllowlist} onClick={() => set('ipAllowlist', !draft.ipAllowlist)} disabled={ro} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <Field label="Re-authentication window (minutes)" hint="How long a re-auth stays valid for further critical actions."><input className="input" type="number" min={1} disabled={ro} value={draft.reauthMinutes} onChange={(e) => set('reauthMinutes', Number(e.target.value) || 0)} /></Field>
        <Field label="Admin session timeout (minutes)" hint="Idle sessions are signed out automatically."><input className="input" type="number" min={5} disabled={ro} value={draft.sessionTimeoutMin} onChange={(e) => set('sessionTimeoutMin', Number(e.target.value) || 0)} /></Field>
      </div>

      <div style={{ marginTop: 20 }}>
        <div className="section-title" style={{ display: 'flex', alignItems: 'center', marginBottom: 4 }}><KeyRound size={15} style={{ marginRight: 7, color: '#6D28D9' }} /> Dual approval — second admin must approve<PendingChip /></div>
        <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 10 }}>Which sensitive actions need a second approver is still to be finalised. Every action below already requires a <b>reason + audit</b>; <span className="badge" style={{ background: '#FEE2E2', color: '#B91C1C' }}>critical</span> ones always re-authenticate. Ticking an action here adds the second-approval step.</div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
          {HIGH_RISK.map((a) => { const on = dual.includes(a); return (
            <label key={a} style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '8px 10px', border: `1px solid ${on ? '#DDD6FE' : '#F3F4F6'}`, background: on ? '#F5F3FF' : '#fff', borderRadius: 8, fontSize: 13, cursor: ro ? 'not-allowed' : 'pointer', opacity: ro ? 0.7 : 1 }}>
              <input type="checkbox" checked={on} disabled={ro} onChange={() => toggleDual(a)} style={{ accentColor: '#6D28D9' }} />
              <span style={{ flex: 1, fontWeight: 600 }}>{ACTION_LABELS[a] || a}</span>
              {CRITICAL.includes(a) && <span className="badge" style={{ background: '#FEE2E2', color: '#B91C1C' }}>critical</span>}
            </label>
          ); })}
        </div>
      </div>
      <SaveBar dirty={dirty} ro={ro} onReset={reset} onSave={() => { updateSettings('security', draft); show('Security settings saved · audit entry written'); }} />
    </Panel>
  );
}

/* ═══════════════════════════════ CREDITS & BILLING DEFAULTS (spec §04–§06) ═══════════════════════════════ */
function CreditsPanel({ ro, show, nav }) {
  const { settings, updateSettings } = useApp();
  const { draft, set, dirty, reset } = useDraft(settings.credits);
  const n = (k) => (e) => set(k, Number(e.target.value) || 0);
  const ex = 10;
  return (
    <>
      <Panel icon={Coins} title="Credits & Billing defaults" sub="Platform-wide defaults applied to every new client wallet. Per-client overrides live on the client detail page (wallet card)."
        right={<button className="btn-ghost" onClick={() => nav('/admin/credits?tab=wallets')}><Wallet size={15} /> Wallets</button>}>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          <Field label="Wallet currency" pending hint="Money accounting (payments) is a separate table from credit accounting (ledger).">
            <select className="input" disabled={ro} value={draft.currency} onChange={(e) => set('currency', e.target.value)}>{['INR', 'USD', 'AED', 'SGD'].map((c) => <option key={c}>{c}</option>)}</select>
          </Field>
          <Field label={`${CURRENCY.symbol} per credit`} pending hint={`1 credit = ${fmtMoney(draft.perCredit)} · payments convert to credits at this rate`}><input className="input" type="number" min={1} disabled={ro} value={draft.perCredit} onChange={n('perCredit')} /></Field>
          <Field label="Default low-balance threshold (credits)" pending hint="Wallet turns LOW BALANCE when available ≤ threshold; client and Finance are alerted."><input className="input" type="number" min={0} disabled={ro} value={draft.lowBalanceThreshold} onChange={n('lowBalanceThreshold')} /></Field>
          <Field label="Default overdraft limit (credits)" pending hint="Governs whether NEW work may start — never used to stop a running evaluation."><input className="input" type="number" min={0} disabled={ro} value={draft.overdraftLimit} onChange={n('overdraftLimit')} /></Field>
          <Field label="Funding guidance — resume-gate multiplier (×)" pending hint="Resume-gate capacity = hiring target × this."><input className="input" type="number" min={1} disabled={ro} value={draft.fundingResumeX} onChange={n('fundingResumeX')} /></Field>
          <Field label="Funding guidance — full-evaluation multiplier (×)" pending hint="Full-evaluation capacity = hiring target × this."><input className="input" type="number" min={1} disabled={ro} value={draft.fundingFullX} onChange={n('fundingFullX')} /></Field>
        </div>
        <div style={{ marginTop: 10 }}>
          <ToggleRow label="Reserve model — hold credits before a paid module starts" pending desc="A RESERVE entry protects credits before an interview / attempt begins; SETTLEMENT consumes actual usage and releases the rest. Off = plain consumption on completion." on={!!draft.reserveModel} onClick={() => set('reserveModel', !draft.reserveModel)} disabled={ro} />
        </div>
        <div style={{ background: '#F8FAFF', border: '1px solid #EEF2F7', borderRadius: 10, padding: '12px 14px', marginTop: 14, fontSize: 12.5, color: '#374151', lineHeight: 1.55 }}>
          <b>Example</b> · a {ex}-position opportunity → resume-gate capacity <b>{num(ex * draft.fundingResumeX)} candidates</b>, full-evaluation capacity <b>{num(ex * draft.fundingFullX)} candidates</b>. Funding guidance is a <b>safety requirement, not a pre-charge</b> — credits are consumed only when services actually run.
        </div>
        <SaveBar dirty={dirty} ro={ro} onReset={reset} onSave={() => { updateSettings('credits', draft); show('Credits & Billing defaults saved · audit entry written'); }} />
      </Panel>

      <Panel icon={Wallet} title="Wallet states & rules (locked)" sub="Wallet state is separate from client account status — low / zero / overdraft are never account statuses.">
        <div style={{ display: 'grid', gap: 8 }}>
          {Object.keys(WALLET_STATE).map((s) => (
            <div key={s} style={{ display: 'grid', gridTemplateColumns: '170px 1fr', gap: 12, alignItems: 'center', padding: '8px 0', borderBottom: '1px solid #F3F4F6', fontSize: 12.5, color: '#374151' }}>
              <div><WalletStateBadge state={s} /></div><div>{WALLET_MEANING[s]}</div>
            </div>
          ))}
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 14 }}>
          {['A client may be ACTIVE with zero credits.', 'Running candidate evaluations never stop because the balance reaches zero.', 'Billing may block the NEXT paid evaluation — never interrupt a running one.', 'Negative balance exists only to protect in-progress work; the next top-up clears the debt first.', 'The ledger is immutable — corrections are reversal entries.', 'Every consumption traces Client → Opportunity → Candidate → Module → Usage → Rate → Credits.'].map((r) => (
            <div key={r} style={{ display: 'flex', gap: 8, fontSize: 12.5, color: '#374151' }}><Check size={14} color="#15803D" style={{ flexShrink: 0, marginTop: 2 }} /> {r}</div>
          ))}
        </div>
      </Panel>
    </>
  );
}

/* ═══════════════════════════════ RATE CARD (link + read-only preview) ═══════════════════════════════ */
function RateCardPanel({ nav }) {
  const { rateCard, settings, can } = useApp();
  const per = settings.credits?.perCredit || CURRENCY.perCredit;
  return (
    <Panel icon={Receipt} title="Rate Card" sub="Credits consumed per service unit. The rate card is finance-owned and edited in Credits & Billing → Rate Card (every change is audited)."
      right={<button className="btn-primary" onClick={() => nav('/admin/credits?tab=ratecard')}>Open Rate Card <ArrowRight size={15} /></button>}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', background: '#F8FAFF', border: '1px solid #EEF2F7', borderRadius: 10, marginBottom: 14, fontSize: 12.5, color: '#374151' }}>
        <Info size={15} color="#056FD4" style={{ flexShrink: 0 }} />
        <div>Read-only preview. Editing requires <Mono>ratecard.edit</Mono> (Super / Finance){can('ratecard.edit') ? ' — you have it.' : ' — not granted to your role.'} All values are placeholders until the exact credit conversion per service is finalised.</div>
      </div>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Service</th><th>Unit</th><th style={{ textAlign: 'right' }}>Credits</th><th style={{ textAlign: 'right' }}>≈ {CURRENCY.symbol} per unit</th></tr></thead>
          <tbody>
            {rateCard.length === 0 ? <EmptyRow cols={4} text="Rate card is empty." /> : rateCard.map((r) => (
              <tr key={r.key}>
                <td><div style={{ fontWeight: 600 }}>{r.name}</div><Mono>{r.key}</Mono></td>
                <td style={{ color: '#6B7280' }}>{r.unit}</td>
                <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><span className="tnum" style={{ fontWeight: 700 }}>{fmtCr(r.credits)}</span><PendingChip /></td>
                <td style={{ textAlign: 'right', color: '#6B7280' }} className="tnum">{fmtMoney(r.credits * per)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </Panel>
  );
}

/* ═══════════════════════════════ EVALUATION DEFAULTS ═══════════════════════════════ */
function EvaluationPanel({ ro, show }) {
  const { settings, updateSettings } = useApp();
  const { draft, set, dirty, reset } = useDraft(settings.evaluation);
  const [lang, setLang] = useState('');
  const langs = draft.interviewLanguages || [];
  const addLang = (v) => { const x = (v ?? lang).trim(); if (!x || langs.includes(x)) return; set('interviewLanguages', [...langs, x]); setLang(''); };
  const removeLang = (x) => set('interviewLanguages', langs.filter((l) => l !== x));
  const suggestions = LANG_SUGGESTIONS.filter((l) => !langs.includes(l));
  return (
    <Panel icon={Sliders} title="Evaluation Defaults" sub="Seed values for new opportunities. Admin controls what is offered; the client decides how it is used inside each opportunity.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <Field label="Default resume-fit threshold (%)" pending hint="Candidates below this are soft-rejected into the pool (rescue possible)."><input className="input" type="number" min={0} max={100} disabled={ro} value={draft.defaultFitThreshold} onChange={(e) => set('defaultFitThreshold', Number(e.target.value) || 0)} /></Field>
        <Field label="Default module pass mark (%)" pending hint="Starting gate for MCQ / Written / SJT; clients tune per module."><input className="input" type="number" min={0} max={100} disabled={ro} value={draft.defaultPassPct} onChange={(e) => set('defaultPassPct', Number(e.target.value) || 0)} /></Field>
        <Field label="Max retakes per module" hint="Retakes granted after a technical failure (Support → Failed Jobs) never count against this."><input className="input" type="number" min={0} disabled={ro} value={draft.maxRetakes} onChange={(e) => set('maxRetakes', Number(e.target.value) || 0)} /></Field>
        <Field label="Candidate link expiry (days)" hint="Expired invites can be extended from Failed Jobs / Support."><input className="input" type="number" min={1} disabled={ro} value={draft.linkExpiryDays} onChange={(e) => set('linkExpiryDays', Number(e.target.value) || 0)} /></Field>
        <Field label="Proctoring default" span hint="Applied to new assessments; evidence retention follows Data & Privacy.">
          <select className="input" disabled={ro} value={draft.proctoringDefault} onChange={(e) => set('proctoringDefault', e.target.value)}>{[draft.proctoringDefault, ...PROCTORING_OPTIONS].filter((v, i, a) => a.indexOf(v) === i).map((o) => <option key={o}>{o}</option>)}</select>
        </Field>
      </div>
      <div style={{ marginTop: 16 }}>
        <label className="field-label" style={{ display: 'flex', alignItems: 'center', gap: 6 }}><Languages size={14} /> Interview languages <span style={{ fontWeight: 500, color: '#9CA3AF' }}>· {langs.length}</span></label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, minHeight: 34, padding: 8, border: '1px solid #E2E8F0', borderRadius: 8, background: ro ? '#F9FAFB' : '#fff' }}>
          {langs.length === 0 && <span style={{ fontSize: 12.5, color: '#9CA3AF', padding: '4px 2px' }}>No languages — the AI interviewer needs at least one.</span>}
          {langs.map((l) => (
            <span key={l} className="skill-chip">{l}{!ro && <X size={12} style={{ cursor: 'pointer' }} onClick={() => removeLang(l)} />}</span>
          ))}
        </div>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <input className="input" disabled={ro} value={lang} onChange={(e) => setLang(e.target.value)} onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addLang(); } }} placeholder="Add a language and press Enter" style={{ flex: 1 }} />
          <button className="btn-ghost" disabled={ro || !lang.trim()} onClick={() => addLang()}><Plus size={14} /> Add</button>
        </div>
        {!ro && suggestions.length > 0 && <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8, alignItems: 'center' }}><span style={{ fontSize: 11.5, color: '#9CA3AF' }}>Suggestions:</span>{suggestions.map((l) => <button key={l} className="filter-btn" style={{ padding: '3px 10px', fontSize: 11.5 }} onClick={() => addLang(l)}>+ {l}</button>)}</div>}
        <div className="hint">Clients pick from this list per opportunity; the same list drives the Language module and candidate-facing UI.</div>
      </div>
      <SaveBar dirty={dirty} ro={ro} onReset={reset} onSave={() => { updateSettings('evaluation', draft); show('Evaluation defaults saved · audit entry written'); }} />
    </Panel>
  );
}

/* ═══════════════════════════════ NOTIFICATIONS (spec §15) ═══════════════════════════════ */
function NotificationsPanel({ ro, show }) {
  const { settings, updateSettings } = useApp();
  const { draft, setDraft, dirty, reset } = useDraft(settings.notifications);
  const ch = draft.channels || {};
  const routing = draft.routing || {};
  const setChannel = (k, v) => setDraft((d) => ({ ...d, channels: { ...(d.channels || {}), [k]: v } }));
  const toggleRoute = (role, cat) => setDraft((d) => { const cur = (d.routing || {})[role] || []; return { ...d, routing: { ...(d.routing || {}), [role]: cur.includes(cat) ? cur.filter((c) => c !== cat) : [...cur, cat] } }; });
  const later = <span className="badge" style={{ background: '#F3F4F6', color: '#6B7280', marginLeft: 8 }}>later</span>;
  return (
    <Panel icon={Bell} title="Notifications" sub="Event-driven, severity-based, role-routed and actionable. Every alert links to the screen where the action happens.">
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 22 }}>
        <div>
          <div className="section-title">Channels</div>
          <ToggleRow label="In-app (bell)" desc="Always available; badge counts unread for your role." on={!!ch.inApp} onClick={() => setChannel('inApp', !ch.inApp)} disabled={ro} />
          <ToggleRow label="Email" desc="Digest for INFO / WARNING, immediate for CRITICAL." on={!!ch.email} onClick={() => setChannel('email', !ch.email)} disabled={ro} />
          <ToggleRow label="Slack" tag={later} desc="Selected CRITICAL cases only." on={!!ch.slack} disabled />
          <ToggleRow label="Microsoft Teams" tag={later} desc="Selected CRITICAL cases only." on={false} disabled />
          <ToggleRow label="SMS" tag={later} desc="Selected CRITICAL cases only." on={!!ch.sms} disabled />
          <ToggleRow label="WhatsApp" tag={later} desc="Selected CRITICAL cases only." on={!!ch.whatsapp} disabled />
        </div>
        <div>
          <div className="section-title">Severity</div>
          {Object.keys(NOTIF_SEVERITY).map((s) => (
            <div key={s} style={{ display: 'grid', gridTemplateColumns: '90px 1fr', gap: 10, alignItems: 'start', padding: '9px 0', borderBottom: '1px solid #F3F4F6', fontSize: 12.5, color: '#374151' }}><div><SeverityBadge severity={s} /></div><div>{SEVERITY_MEANING[s]}</div></div>
          ))}
          <div className="banner dark" style={{ marginTop: 14, marginBottom: 0, alignItems: 'flex-start' }}><Info size={15} style={{ flexShrink: 0, marginTop: 1 }} /><div><b>Principle:</b> alerts include enough context to act — client, amount, candidate, job ID and a link — never just "something failed".</div></div>
        </div>
      </div>

      <div className="section-title" style={{ marginTop: 22 }}>Routing — role → categories</div>
      <div style={{ fontSize: 12.5, color: '#6B7280', marginBottom: 10 }}>Finance receives finance alerts, Support receives support events, Compliance receives compliance events, and Super Admin receives every critical cross-platform alert.</div>
      <div className="table-wrap">
        <table>
          <thead><tr><th style={{ width: 200 }}>Role</th><th>Categories</th></tr></thead>
          <tbody>
            {ADMIN_ROLES.length === 0 ? <EmptyRow cols={2} /> : ADMIN_ROLES.map((r) => { const cur = routing[r.id] || []; return (
              <tr key={r.id}>
                <td><div style={{ fontWeight: 600, fontSize: 13 }}>{r.name}</div><div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{r.desc}</div></td>
                <td>
                  {r.id === 'super' ? (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
                      <span className="filter-btn active" style={{ background: '#14212A', borderColor: '#14212A', cursor: 'default' }}><ShieldAlert size={12} /> CRITICAL (all categories)</span>
                      <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>fixed — Super Admin always receives every critical alert</span>
                    </div>
                  ) : (
                    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                      {NOTIF_CATEGORIES.map((c) => { const on = cur.includes(c); return <button key={c} className={'filter-btn' + (on ? ' active' : '')} disabled={ro} style={{ padding: '4px 10px', fontSize: 11.5, opacity: ro && !on ? 0.5 : 1 }} onClick={() => toggleRoute(r.id, c)}>{on && <Check size={11} />}{c}</button>; })}
                      {cur.length === 0 && <span style={{ fontSize: 11.5, color: '#9CA3AF', alignSelf: 'center' }}>no routed alerts</span>}
                    </div>
                  )}
                </td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
      <SaveBar dirty={dirty} ro={ro} onReset={reset} onSave={() => { updateSettings('notifications', draft); show('Notification settings saved · audit entry written'); }} />
    </Panel>
  );
}

/* ═══════════════════════════════ DATA & PRIVACY (spec §11 · §12) ═══════════════════════════════ */
function PrivacyPanel({ ro, show, nav }) {
  const { settings, updateSettings, setRetention } = useApp();
  const pv = settings.privacy;
  const retention = pv.retention || [];
  const { draft, set, dirty, reset } = useDraft({ legalHoldDefault: pv.legalHoldDefault, anonymiseAfterRetention: pv.anonymiseAfterRetention, backupDeletionDays: pv.backupDeletionDays });
  const fromStore = () => Object.fromEntries(retention.map((r) => [r.category, r.days]));
  const [days, setDays] = useState(fromStore);
  const changed = retention.filter((r) => Number(days[r.category]) !== r.days);
  const save = () => {
    changed.forEach((r) => setRetention(r.category, Number(days[r.category]) || 0));
    if (dirty) updateSettings('privacy', draft);
    show(`Data & privacy saved${changed.length ? ` · ${changed.length} retention change${changed.length > 1 ? 's' : ''}` : ''} · audit entry written`);
  };
  return (
    <Panel icon={Lock} title="Data & Privacy" sub="Retention per data category, legal hold and deletion behaviour. Deletion / anonymisation is the last offboarding step."
      right={<button className="btn-ghost" onClick={() => nav('/admin/compliance?tab=requests')}>Data requests <ArrowRight size={15} /></button>}>
      <div className="table-wrap">
        <table>
          <thead><tr><th>Data category</th><th style={{ width: 160 }}>Retention (days)</th><th>Legal hold</th><th>Note</th></tr></thead>
          <tbody>
            {retention.length === 0 ? <EmptyRow cols={4} text="No retention rules configured." /> : retention.map((r) => { const d = Number(days[r.category]); const edited = d !== r.days; return (
              <tr key={r.category}>
                <td style={{ fontWeight: 600 }}>{r.category}</td>
                <td>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input className="input" type="number" min={0} disabled={ro} value={days[r.category] ?? ''} onChange={(e) => setDays({ ...days, [r.category]: e.target.value })} style={{ padding: '6px 10px', fontSize: 13, borderColor: edited ? '#F59E0B' : undefined }} />
                    <PendingChip />
                  </div>
                </td>
                <td>{r.legalHoldable ? <span className="badge" style={{ background: '#EDE9FE', color: '#6D28D9' }}>can be held</span> : <span style={{ color: '#9CA3AF' }}>—</span>}</td>
                <td style={{ color: '#6B7280', fontSize: 12.5 }}>{r.note || (r.category.includes('Biometric') ? 'Delete at the earliest' : '—')}</td>
              </tr>
            ); })}
          </tbody>
        </table>
      </div>
      <div style={{ marginTop: 12 }}>
        <ToggleRow label="Legal hold by default on new offboardings" desc="When on, deletion waits for Compliance to release the hold explicitly. Otherwise holds are applied per request (disputes, chargebacks)." on={!!draft.legalHoldDefault} onClick={() => set('legalHoldDefault', !draft.legalHoldDefault)} disabled={ro} />
        <ToggleRow label="Anonymise instead of hard-delete after retention" desc="Keeps aggregate analytics and fairness monitoring intact while removing personal identifiers." on={!!draft.anonymiseAfterRetention} onClick={() => set('anonymiseAfterRetention', !draft.anonymiseAfterRetention)} disabled={ro} />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 14 }}>
        <Field label="Backup deletion lag (days)" pending hint="How long backups may still contain data that was deleted from live systems."><input className="input" type="number" min={0} disabled={ro} value={draft.backupDeletionDays} onChange={(e) => set('backupDeletionDays', Number(e.target.value) || 0)} /></Field>
      </div>
      <div className="banner warn" style={{ marginTop: 14, marginBottom: 0, alignItems: 'flex-start' }}><Hourglass size={15} style={{ flexShrink: 0, marginTop: 1 }} /><div><b>Pending:</b> country / legal-specific retention durations, and permanent-deletion timing + backup deletion strategy. Values above are placeholders until finalised.</div></div>
      <SaveBar dirty={dirty || changed.length > 0} ro={ro} onReset={() => { reset(); setDays(fromStore()); }} onSave={save} />
    </Panel>
  );
}

/* ═══════════════════════════════ INTEGRATIONS (link + summary) ═══════════════════════════════ */
function IntegrationsPanel({ nav }) {
  const { integrations } = useApp();
  const DOT = { CONNECTED: ['#15803D', 'Connected'], DEGRADED: ['#B45309', 'Degraded'], DISCONNECTED: ['#B91C1C', 'Disconnected'], NOT_CONFIGURED: ['#9CA3AF', 'Not configured'] };
  const count = (s) => integrations.filter((i) => i.status === s).length;
  const groups = [{ key: 'platform', title: 'Platform / internal', items: integrations.filter((i) => i.group === 'platform') }, { key: 'client', title: 'Client-facing / future', items: integrations.filter((i) => i.group === 'client') }];
  return (
    <Panel icon={Plug} title="Integrations" sub="Provider abstraction — providers are never hard-coded into business logic; each category has a primary and (optionally) a fallback."
      right={<button className="btn-primary" onClick={() => nav('/admin/platform?tab=integrations')}>Manage integrations <ArrowRight size={15} /></button>}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 16 }}>
        {Object.entries(DOT).map(([k, [c, l]]) => (
          <div key={k} className="kpi" style={{ padding: '12px 14px' }}><div className="eyebrow">{l}</div><div className="num" style={{ fontSize: 24, color: c }}>{count(k)}</div><div className="bar" style={{ background: c }} /></div>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        {groups.map((g) => (
          <div key={g.key}>
            <div className="section-title" style={{ fontSize: 13.5 }}>{g.title} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>· {g.items.length}</span></div>
            {g.items.length === 0 ? <div style={{ fontSize: 12.5, color: '#9CA3AF', padding: '10px 0' }}>Nothing configured.</div> : g.items.map((i) => { const [c, l] = DOT[i.status] || DOT.NOT_CONFIGURED; return (
              <div key={i.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderBottom: '1px solid #F3F4F6', fontSize: 12.5 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: c, flexShrink: 0 }} />
                <span style={{ color: '#6B7280', width: 150, flexShrink: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.category}</span>
                <span style={{ fontWeight: 600, flex: 1, minWidth: 0, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{i.name}</span>
                {i.role && <span className="badge" style={{ background: i.role === 'primary' ? '#EFF6FF' : '#F3F4F6', color: i.role === 'primary' ? '#056FD4' : '#6B7280' }}>{i.role}</span>}
                <span style={{ color: c, fontSize: 11.5, fontWeight: 600, whiteSpace: 'nowrap' }}>{l}</span>
              </div>
            ); })}
          </div>
        ))}
      </div>
      <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 12 }}>Connect / disconnect, enable / disable, test connection, rotate credentials and primary / fallback selection all live in Platform → Integrations (<Mono>integration.manage</Mono>). Final provider choices are still pending.</div>
    </Panel>
  );
}

/* ═══════════════════════════════ SYSTEM CONFIGURATION ═══════════════════════════════ */
function SystemPanel({ ro, show }) {
  const { settings, updateSettings } = useApp();
  const { draft, set, dirty, reset } = useDraft(settings.system);
  return (
    <Panel icon={Server} title="System Configuration" sub="Runtime limits and operational switches. Version is read-only and set by the deployment pipeline.">
      <ToggleRow label="Maintenance mode" tag={draft.maintenanceMode ? <span className="badge" style={{ background: '#FEE2E2', color: '#B91C1C', marginLeft: 8 }}>ON</span> : null}
        desc="Blocks new sign-ins and new evaluations across all clients. Running candidate evaluations finish safely — nothing is scored as a candidate failure." on={!!draft.maintenanceMode} onClick={() => set('maintenanceMode', !draft.maintenanceMode)} disabled={ro} />
      {draft.maintenanceMode && !settings.system.maintenanceMode && <div className="banner danger" style={{ marginTop: 12, marginBottom: 0 }}><AlertTriangle size={15} style={{ flexShrink: 0 }} /><div>Maintenance mode will take effect on Save and notify every Admin role as <b>CRITICAL</b>. In-progress interviews and attempts are never interrupted.</div></div>}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginTop: 16 }}>
        <Field label="API rate limit" hint="Per client tenant; bursts above this are queued, not dropped."><input className="input" disabled={ro} value={draft.apiRateLimit} onChange={(e) => set('apiRateLimit', e.target.value)} /></Field>
        <Field label="Max concurrent AI interviews" hint="Platform-wide ceiling; new interviews wait in a queue beyond it."><input className="input" type="number" min={1} disabled={ro} value={draft.maxConcurrentInterviews} onChange={(e) => set('maxConcurrentInterviews', Number(e.target.value) || 0)} /></Field>
        <Field label="Storage region" hint="Evaluation media (audio / video / proctoring evidence).">
          <select className="input" disabled={ro} value={draft.storageRegion} onChange={(e) => set('storageRegion', e.target.value)}>{[draft.storageRegion, ...STORAGE_REGIONS].filter((v, i, a) => a.indexOf(v) === i).map((z) => <option key={z}>{z}</option>)}</select>
        </Field>
        <Field label="Platform version" hint="Read-only."><div className="input" style={{ background: '#F9FAFB', color: '#6B7280' }}><Mono>{draft.version}</Mono></div></Field>
      </div>
      <SaveBar dirty={dirty} ro={ro} onReset={reset} onSave={() => { updateSettings('system', draft); show(draft.maintenanceMode && !settings.system.maintenanceMode ? 'Maintenance mode ON · admins notified' : 'System configuration saved · audit entry written'); }} />
    </Panel>
  );
}

/* ═══════════════════════════════ PENDING / TO BE FINALISED ═══════════════════════════════ */
function PendingCard({ setTab, nav }) {
  const go = (it) => { if (it.tab) setTab(it.tab); else if (it.to) nav(it.to); };
  return (
    <div className="card" style={{ padding: '18px 22px', marginTop: 18 }}>
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12, marginBottom: 12 }}>
        <div className="icon-box" style={{ width: 36, height: 36, background: '#FEF3C7', color: '#B45309' }}><Hourglass size={17} /></div>
        <div>
          <div style={{ fontSize: 15.5, fontWeight: 700 }}>Pending / to be finalised <span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 500 }}>· {PENDING_ITEMS.length} items from the product spec</span></div>
          <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 2 }}>Placeholders for these are marked <PendingChip /> across the portal. Nothing here blocks day-to-day use; each becomes a locked decision once agreed.</div>
        </div>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '6px 18px' }}>
        {PENDING_ITEMS.map((it, i) => (
          <div key={i} onClick={() => go(it)} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, padding: '8px 10px', borderRadius: 8, cursor: it.tab || it.to ? 'pointer' : 'default', border: '1px solid #F3F4F6' }}>
            <span style={{ width: 16, height: 16, border: '1.5px solid #D1D5DB', borderRadius: 4, flexShrink: 0, marginTop: 1 }} />
            <div style={{ minWidth: 0 }}>
              <div style={{ fontSize: 13, color: '#374151' }}>{it.text}</div>
              <div style={{ fontSize: 11, color: it.tab || it.to ? '#056FD4' : '#9CA3AF', marginTop: 2, fontWeight: 600 }}>{it.where}{(it.tab || it.to) && ' →'}</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* ═══════════════════════════════ local layout helpers ═══════════════════════════════ */
function Panel({ icon: Icon, title, sub, right, children }) {
  return (
    <div className="card fade-in" style={{ padding: '20px 22px', marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', gap: 12, marginBottom: 16, flexWrap: 'wrap' }}>
        <div style={{ display: 'flex', gap: 12, alignItems: 'flex-start', minWidth: 0 }}>
          {Icon && <div className="icon-box" style={{ width: 36, height: 36 }}><Icon size={17} /></div>}
          <div style={{ minWidth: 0 }}><div style={{ fontSize: 15.5, fontWeight: 700 }}>{title}</div>{sub && <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 2, lineHeight: 1.45 }}>{sub}</div>}</div>
        </div>
        {right && <div style={{ display: 'flex', gap: 8, flexShrink: 0 }}>{right}</div>}
      </div>
      {children}
    </div>
  );
}

function Field({ label, pending, hint, children, span }) {
  return (
    <div style={span ? { gridColumn: '1 / -1' } : undefined}>
      <label className="field-label" style={{ display: 'flex', alignItems: 'center' }}>{label}{pending && <PendingChip />}</label>
      {children}
      {hint && <div className="hint">{hint}</div>}
    </div>
  );
}

function ToggleRow({ label, desc, on, onClick, disabled, pending, tag }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 14, padding: '11px 0', borderBottom: '1px solid #F3F4F6' }}>
      <div style={{ minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, display: 'flex', alignItems: 'center', flexWrap: 'wrap' }}>{label}{pending && <PendingChip />}{tag}</div>
        {desc && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 2, lineHeight: 1.45 }}>{desc}</div>}
      </div>
      <Toggle on={on} onClick={onClick} disabled={disabled} />
    </div>
  );
}

function SaveBar({ dirty, ro, onSave, onReset, label = 'Save changes' }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', gap: 10, marginTop: 18, paddingTop: 14, borderTop: '1px solid #F3F4F6' }}>
      {ro ? <span style={{ marginRight: 'auto', fontSize: 12, color: '#9CA3AF', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Lock size={12} /> Read-only for your role</span>
        : dirty ? <span className="badge" style={{ background: '#FEF3C7', color: '#B45309', marginRight: 'auto' }}>Unsaved changes</span>
        : <span style={{ marginRight: 'auto', fontSize: 12, color: '#9CA3AF' }}>Saving writes an audit entry with your identity.</span>}
      <button className="btn-ghost" disabled={!dirty || ro} onClick={onReset}>Reset</button>
      <PermButton action="settings.manage" className="btn-primary" disabled={!dirty} onClick={onSave}><Check size={15} /> {label}</PermButton>
    </div>
  );
}

function Note({ icon: Icon, children }) {
  return <div style={{ display: 'flex', gap: 9, alignItems: 'flex-start', background: '#F8FAFF', border: '1px solid #EEF2F7', borderRadius: 10, padding: '10px 12px', fontSize: 12.5, color: '#374151', lineHeight: 1.45 }}><Icon size={14} color="#056FD4" style={{ flexShrink: 0, marginTop: 2 }} /><div>{children}</div></div>;
}

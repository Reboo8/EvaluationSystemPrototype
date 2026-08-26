import { useState, Fragment } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plug, Plus, Pause, Play, X, KeyRound, Star, PowerOff, Activity, ArrowRight, Info, Globe, Layers, Server, Puzzle, AlertTriangle, ShieldCheck, Receipt, Bell, Boxes } from 'lucide-react';
import { useApp, MODULE_STATE, ROLLOUT_STAGES, CLIENT_STATUS, WALLET_STATE, walletOf, fmtMoney } from '../store.jsx';
import { ModuleStateBadge, PendingChip, useToast, Modal, useReasonGate, PermButton, useTab, Tabs, PageHeader, Kpi, EmptyRow, Toggle, Mono } from '../components/admin/ui.jsx';

/* ═══════════ Platform — spec §10 (module management) + §17 (integrations) ═══════════
   Admin controls WHAT Cuba offers (state · rollout · client access · rate · emergency pause);
   the client controls HOW an allowed capability is used inside an opportunity. */

const STAGE_COLORS = { Internal: ['#F3F4F6', '#6B7280'], Beta: ['#EDE9FE', '#6D28D9'], 'Selected Clients': ['#FEF3C7', '#B45309'], GA: ['#DCFCE7', '#15803D'] };
const STATE_MEANING = {
  ACTIVE:     'Generally available. Every client can add it to an opportunity; usage is billed at the rate card.',
  BETA:       'Available only to clients granted access (or to everyone once rollout reaches GA). Behaviour may still change.',
  DISABLED:   'Hidden from every client. Nothing new can start; history and past results are preserved.',
  DEPRECATED: 'Not selectable for new opportunities and shown greyed in the client catalog. Running work finishes safely.',
};
const ADMIN_CONTROLS = [
  ['Enable / disable modules globally', 'State column — ACTIVE · BETA · DISABLED · DEPRECATED.'],
  ['Provide selected-client access', 'Grant or revoke per client while a module is in Beta / Selected Clients.'],
  ['Manage global defaults and safe boundaries', 'Safe defaults column; clients tune within them per opportunity.'],
  ['Control rollout', 'Internal → Beta → Selected Clients → GA.'],
  ['Emergency disable / pause for new attempts', 'Reason-gated and audited; running attempts are never interrupted.'],
  ['Manage the credit rate card associated with modules', 'Credit rate column; the full card lives under Credits & Billing.'],
];
const SCORING_OPTIONS = ['AI rubric', 'auto', 'rule + AI', 'test cases', 'model', 'CV ensemble', 'manual'];
const INT_STATUS = {
  CONNECTED:      { label: 'Connected',      bg: '#DCFCE7', fg: '#15803D' },
  DEGRADED:       { label: 'Degraded',       bg: '#FEF3C7', fg: '#B45309' },
  DISCONNECTED:   { label: 'Disconnected',   bg: '#F3F4F6', fg: '#6B7280' },
  NOT_CONFIGURED: { label: 'Not configured', bg: '#FFFFFF', fg: '#9CA3AF', dashed: true },
};
const SM = { padding: '5px 10px', fontSize: 12 };

export default function AdminPlatform() {
  const nav = useNavigate();
  const { modules, integrations } = useApp();
  const TABS = [{ key: 'modules', label: 'Modules', count: modules.length }, { key: 'integrations', label: 'Integrations', count: integrations.length }];
  const [tab, setTab] = useTab(TABS);
  const [toast, toastNode] = useToast();
  const [addOpen, setAddOpen] = useState(false);

  return (
    <>
      <PageHeader title="Platform" sub="Admin controls what Cuba offers; the client controls how an allowed capability is used within an opportunity"
        right={tab === 'modules' ? (
          <>
            <button className="btn-ghost" onClick={() => nav('/admin/credits?tab=ratecard')}><Receipt size={15} /> Open rate card</button>
            <PermButton action="module.manage" className="btn-primary" onClick={() => setAddOpen(true)}><Plus size={15} /> Add module</PermButton>
          </>
        ) : (
          <button className="btn-ghost" onClick={() => nav('/admin/settings?tab=notifications')}><Bell size={15} /> Notification channels</button>
        )} />
      <Tabs tabs={TABS} active={tab} onChange={setTab} />
      {tab === 'modules' ? <ModulesTab toast={toast} /> : <IntegrationsTab toast={toast} />}
      {addOpen && <AddModuleModal onClose={() => setAddOpen(false)} toast={toast} />}
      {toastNode}
    </>
  );
}

/* ═══════════════════════════ MODULES (spec §10) ═══════════════════════════ */
function ModulesTab({ toast }) {
  const { modules, rateCard } = useApp();
  const [ask, gateNode] = useReasonGate();
  const counts = modules.reduce((a, m) => ({ ...a, [m.state]: (a[m.state] || 0) + 1 }), {});
  const pausedCount = modules.filter((m) => m.paused).length;
  const rateOf = (key) => rateCard.find((r) => r.key === key);

  return (
    <>
      {/* KPIs */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 14, marginBottom: 18 }}>
        <Kpi label="Active" value={counts.ACTIVE || 0} color="#15803D" bar="#15803D" sub="available to every client" />
        <Kpi label="Beta" value={counts.BETA || 0} color="#6D28D9" bar="#6D28D9" sub="selected-client access" />
        <Kpi label="Disabled" value={counts.DISABLED || 0} color="#6B7280" bar="#9CA3AF" sub="hidden from all clients" />
        <Kpi label="Deprecated" value={counts.DEPRECATED || 0} color="#C2410C" bar="#C2410C" sub="no new opportunities" />
        <Kpi label="Paused" value={pausedCount} color={pausedCount ? '#B45309' : '#14212A'} bar={pausedCount ? '#F59E0B' : '#E2E8F0'} sub="emergency · new attempts blocked" />
      </div>

      {pausedCount > 0 && (
        <div className="banner warn"><AlertTriangle size={16} style={{ flexShrink: 0 }} /><div><b>{pausedCount} module{pausedCount > 1 ? 's' : ''} paused for new attempts</b> — {modules.filter((m) => m.paused).map((m) => m.name).join(', ')}. Clients see a "new attempts paused" flag in the Assessment Builder; attempts already running finish normally.</div></div>
      )}

      {/* rollout legend strip */}
      <div className="card" style={{ padding: '12px 18px', marginBottom: 18, display: 'flex', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        <span className="eyebrow" style={{ marginRight: 4 }}>Rollout</span>
        {ROLLOUT_STAGES.map((s, i) => {
          const n = modules.filter((m) => m.rollout === s).length; const [bg, fg] = STAGE_COLORS[s] || STAGE_COLORS.Internal;
          return (
            <Fragment key={s}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: bg, color: fg, borderRadius: 8, padding: '6px 12px', fontSize: 12.5, fontWeight: 700 }}>{s}<span className="badge" style={{ background: '#fff', color: fg }}>{n}</span></span>
              {i < ROLLOUT_STAGES.length - 1 && <ArrowRight size={14} color="#9CA3AF" />}
            </Fragment>
          );
        })}
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#6B7280' }}>Promote stage by stage · GA makes a module available to every client.</span>
      </div>

      {/* catalog table */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ padding: '14px 18px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 15, fontWeight: 700, display: 'inline-flex', alignItems: 'center', gap: 8 }}><Boxes size={16} color="#056FD4" /> Module catalog</span>
          <span style={{ fontSize: 12, color: '#9CA3AF' }}>{modules.length} modules · every change here is written to the audit log</span>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Module</th><th>Scoring</th><th>State</th><th>Rollout</th><th>Client access</th>
                <th style={{ whiteSpace: 'nowrap' }}>Credit rate <PendingChip /></th>
                <th>Safe defaults</th><th>Emergency</th>
              </tr>
            </thead>
            <tbody>
              {modules.length === 0 ? <EmptyRow cols={8} text="No modules in the catalog yet — add one to start a rollout." />
                : modules.map((m) => <ModuleRow key={m.key} m={m} rate={rateOf(m.key)} ask={ask} toast={toast} />)}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 18px', borderTop: '1px solid #F3F4F6', fontSize: 12, color: '#6B7280', display: 'flex', gap: 8, alignItems: 'flex-start' }}>
          <Info size={13} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>What clients see: <b>Active</b> modules and <b>Beta</b> ones they were granted; <b>Disabled</b> is hidden; <b>Deprecated</b> is greyed out; paused modules are flagged "new attempts paused". Rate card values are placeholders until pricing is finalised.</span>
        </div>
      </div>

      {/* explainers */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18, alignItems: 'start' }}>
        <div className="card" style={{ padding: '18px 20px' }}>
          <h2 className="section-title">Module states</h2>
          {Object.keys(MODULE_STATE).map((k, i, arr) => (
            <div key={k} style={{ display: 'flex', gap: 12, alignItems: 'flex-start', padding: '9px 0', borderBottom: i < arr.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
              <div style={{ width: 96, flexShrink: 0 }}><ModuleStateBadge state={k} /></div>
              <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>{STATE_MEANING[k]}</div>
            </div>
          ))}
        </div>
        <div className="card" style={{ padding: '18px 20px' }}>
          <h2 className="section-title">Admin controls</h2>
          {ADMIN_CONTROLS.map(([t, d], i) => (
            <div key={t} style={{ display: 'flex', gap: 10, alignItems: 'flex-start', padding: '7px 0', borderBottom: i < ADMIN_CONTROLS.length - 1 ? '1px solid #F3F4F6' : 'none' }}>
              <ShieldCheck size={15} color="#15803D" style={{ flexShrink: 0, marginTop: 2 }} />
              <div><div style={{ fontSize: 13, fontWeight: 600 }}>{t}</div><div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{d}</div></div>
            </div>
          ))}
          <div style={{ marginTop: 12, background: '#F8FAFF', border: '1px solid #DBEAFE', borderRadius: 8, padding: '9px 12px', fontSize: 12.5, color: '#1E40AF' }}><b>Boundary:</b> Admin controls what Cuba offers. Client controls how an allowed capability is used within an opportunity.</div>
        </div>
      </div>
      {gateNode}
    </>
  );
}

function ModuleRow({ m, rate, ask, toast }) {
  const { clients, nameOf, can, setModuleState, setModuleRollout, grantModuleAccess, revokeModuleAccess, pauseModule, unpauseModule } = useApp();
  const [granting, setGranting] = useState(false);
  const manage = can('module.manage');
  const dim = m.state === 'DISABLED' || m.state === 'DEPRECATED';
  const ga = m.rollout === 'GA';
  const access = m.clientAccess || [];
  const grantable = clients.filter((c) => !access.includes(c.id) && !['DELETED', 'DEACTIVATED', 'RETENTION'].includes(c.status));
  const clientTitle = (c) => `${c.name} · ${CLIENT_STATUS[c.status]?.label || c.status} · wallet ${WALLET_STATE[walletOf(c).state]?.label || ''}`;

  return (
    <tr style={{ background: m.paused ? '#FFFBEB' : undefined }}>
      <td style={{ borderLeft: m.paused ? '3px solid #F59E0B' : '3px solid transparent' }}>
        <div style={{ fontWeight: 600, color: dim ? '#9CA3AF' : '#14212A' }}>{m.name}</div>
        <div style={{ display: 'flex', gap: 6, alignItems: 'center', marginTop: 2, flexWrap: 'wrap' }}>
          <Mono>{m.key} · {m.version}</Mono>
          {m.paused && <span className="chip" style={{ background: '#FEF3C7', color: '#B45309', padding: '2px 8px', fontSize: 11 }}><Pause size={11} /> New attempts paused</span>}
        </div>
      </td>
      <td style={{ color: '#6B7280', fontSize: 12.5, whiteSpace: 'nowrap' }}>{m.scoring}</td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <ModuleStateBadge state={m.state} />
        <MiniSelect value={m.state} disabled={!manage} title="Change module state" options={Object.entries(MODULE_STATE).map(([k, s]) => [k, s.label])}
          onChange={(v) => { setModuleState(m.key, v); toast(`${m.name} → ${MODULE_STATE[v]?.label || v}`); }} />
      </td>
      <td style={{ whiteSpace: 'nowrap' }}>
        <span className="badge" style={{ background: (STAGE_COLORS[m.rollout] || STAGE_COLORS.Internal)[0], color: (STAGE_COLORS[m.rollout] || STAGE_COLORS.Internal)[1] }}>{m.rollout}</span>
        <MiniSelect value={m.rollout} disabled={!manage} title="Change rollout stage" options={ROLLOUT_STAGES.map((s) => [s, s])}
          onChange={(v) => { setModuleRollout(m.key, v); toast(`${m.name} rollout → ${v}`); }} />
      </td>
      <td>
        {ga ? (
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontSize: 12.5, color: '#15803D', fontWeight: 600, whiteSpace: 'nowrap' }}><Globe size={13} /> All clients</span>
        ) : (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, alignItems: 'center', maxWidth: 280 }}>
            {access.length === 0 && !granting && <span style={{ fontSize: 12, color: '#9CA3AF' }}>{m.rollout === 'Internal' ? 'Internal only' : 'No clients yet'}</span>}
            {access.map((cid) => { const c = clients.find((x) => x.id === cid); return (
              <span key={cid} className="chip" title={c ? clientTitle(c) : cid} style={{ background: '#EDE9FE', color: '#6D28D9', padding: '3px 8px', fontSize: 11.5 }}>
                {nameOf(cid)}
                {manage && <X size={11} style={{ cursor: 'pointer' }} title="Revoke access" onClick={() => { revokeModuleAccess(m.key, cid); toast(`Revoked ${m.name} for ${nameOf(cid)}`); }} />}
              </span>
            ); })}
            {granting ? (
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                <select className="input" autoFocus defaultValue="" style={{ width: 'auto', padding: '3px 8px', fontSize: 12 }}
                  onChange={(e) => { const id = e.target.value; if (id) { grantModuleAccess(m.key, id); toast(`Granted ${m.name} to ${nameOf(id)}`); } setGranting(false); }}>
                  <option value="">Choose client…</option>
                  {grantable.map((c) => <option key={c.id} value={c.id}>{c.name} — {CLIENT_STATUS[c.status]?.label || c.status} · {WALLET_STATE[walletOf(c).state]?.label}</option>)}
                </select>
                <X size={13} color="#9CA3AF" style={{ cursor: 'pointer' }} onClick={() => setGranting(false)} />
              </span>
            ) : (
              <PermButton action="module.manage" className="btn-ghost" style={{ padding: '3px 8px', fontSize: 11.5 }} disabled={grantable.length === 0} title="Grant selected-client access" onClick={() => setGranting(true)}><Plus size={11} /> Grant</PermButton>
            )}
          </div>
        )}
      </td>
      <td><RateCell m={m} rate={rate} toast={toast} /></td>
      <td style={{ color: '#6B7280', fontSize: 12.5, maxWidth: 220 }}>{m.defaults || '—'}</td>
      <td style={{ whiteSpace: 'nowrap' }}>
        {m.paused ? (
          <PermButton action="module.emergency" className="btn-success" style={SM}
            onClick={() => ask({ action: 'module.emergency', title: `Resume new attempts — ${m.name}`, confirmLabel: 'Resume', body: 'New attempts for this module will be accepted again for every client that can use it. Attempts already running were never interrupted.' },
              () => { unpauseModule(m.key); toast(`${m.name}: new attempts resumed`); })}><Play size={12} /> Resume</PermButton>
        ) : (
          <PermButton action="module.emergency" className="btn-ghost" style={{ ...SM, color: '#B45309', borderColor: '#FDE68A' }} disabled={m.state === 'DISABLED'} title={m.state === 'DISABLED' ? 'Disabled modules cannot start attempts' : 'Emergency: block new attempts'}
            onClick={() => ask({ action: 'module.emergency', title: `Pause new attempts — ${m.name}`, confirmLabel: 'Pause new attempts', danger: true, body: 'Emergency pause blocks NEW attempts of this module across all clients. Attempts already in progress finish safely — a technical control is never a candidate failure.' },
              (reason) => { pauseModule(m.key, reason); toast(`${m.name}: new attempts paused`); })}><Pause size={12} /> Pause new attempts</PermButton>
        )}
      </td>
    </tr>
  );
}

function RateCell({ m, rate, toast }) {
  const { can, setRate } = useApp();
  const editable = can('ratecard.edit');
  const [draft, setDraft] = useState(null);
  if (!rate) return <span style={{ fontSize: 12, color: '#9CA3AF' }}>No rate yet</span>;
  const commit = () => { if (draft === null) return; const n = Number(draft); if (Number.isFinite(n) && n >= 0 && n !== rate.credits) { setRate(m.key, n); toast(`${rate.name}: ${n} cr ${rate.unit}`); } setDraft(null); };
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
        <input className="input tnum" type="number" min={0} value={draft ?? rate.credits} disabled={!editable} title={!editable ? 'Not permitted for your role (ratecard.edit)' : 'Credits per unit — Enter to save'}
          onChange={(e) => setDraft(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); if (e.key === 'Escape') setDraft(null); }}
          style={{ width: 66, padding: '4px 8px', fontSize: 12.5, fontWeight: 700, textAlign: 'right', opacity: editable ? 1 : 0.7 }} />
        <span style={{ fontSize: 12, color: '#6B7280' }}>cr</span>
      </div>
      <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2, whiteSpace: 'nowrap' }}>{rate.unit}</div>
    </div>
  );
}

function AddModuleModal({ onClose, toast }) {
  const { addModule } = useApp();
  const [name, setName] = useState('');
  const [scoring, setScoring] = useState('AI rubric');
  const ok = name.trim().length >= 3;
  const submit = () => { if (!ok) return; addModule(name.trim(), scoring); toast(`${name.trim()} added — Beta · Internal`); onClose(); };
  return (
    <Modal title="Add module" onClose={onClose} width={480}
      footer={<><button className="btn-ghost" onClick={onClose}>Cancel</button><button className="btn-primary" disabled={!ok} onClick={submit}><Plus size={14} /> Add module</button></>}>
      <div className="banner info" style={{ alignItems: 'flex-start', marginBottom: 14 }}><Info size={15} style={{ flexShrink: 0, marginTop: 2 }} /><div>New modules land as <b>Beta</b> in the <b>Internal</b> rollout stage with a placeholder rate of 5 cr / attempt<PendingChip />. Promote them Internal → Beta → Selected Clients → GA from the catalog table.</div></div>
      <label className="field-label">Module name <span className="req">*</span></label>
      <input className="input" autoFocus value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Case Study" onKeyDown={(e) => e.key === 'Enter' && submit()} />
      <label className="field-label" style={{ marginTop: 12 }}>Scoring</label>
      <select className="input" value={scoring} onChange={(e) => setScoring(e.target.value)}>{SCORING_OPTIONS.map((s) => <option key={s} value={s}>{s}</option>)}</select>
      <div className="hint">Scoring method is informational for the prototype; safe defaults can be edited once the module ships.</div>
    </Modal>
  );
}

/* ═══════════════════════════ INTEGRATIONS (spec §17) ═══════════════════════════ */
function IntegrationsTab({ toast }) {
  const { integrations, disconnectIntegration } = useApp();
  const [disc, setDisc] = useState(null);
  const byStatus = (s) => integrations.filter((i) => i.status === s);
  const connected = byStatus('CONNECTED').length, degraded = byStatus('DEGRADED'), notConfigured = byStatus('NOT_CONFIGURED').length, disconnected = byStatus('DISCONNECTED').length;
  const monthlyCost = integrations.reduce((a, i) => a + (i.health?.cost || 0), 0);
  const platform = integrations.filter((i) => i.group === 'platform');
  const client = integrations.filter((i) => i.group === 'client');
  const fallbackFor = (p) => integrations.find((x) => x.id !== p.id && x.category === p.category && x.group === p.group && (x.status === 'CONNECTED' || x.status === 'DEGRADED'));

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        <Kpi label="Connected" value={connected} color="#15803D" bar="#15803D" sub="healthy providers" />
        <Kpi label="Degraded" value={degraded.length} color={degraded.length ? '#B45309' : '#14212A'} bar={degraded.length ? '#F59E0B' : '#E2E8F0'} sub="test or promote the fallback" />
        <Kpi label="Not configured" value={notConfigured} color="#6B7280" bar="#9CA3AF" sub={`${disconnected} disconnected · client-facing later`} />
        <Kpi label="Monthly cost" value={fmtMoney(monthlyCost)} size={22} bar="#056FD4" sub="sum of provider costs · per month" />
      </div>

      {degraded.length > 0 && (
        <div className="banner warn"><AlertTriangle size={16} style={{ flexShrink: 0 }} /><div><b>{degraded.map((d) => `${d.name} (${d.category})`).join(', ')} degraded</b> — error rate {degraded.map((d) => `${d.health?.errorRate ?? '—'}%`).join(', ')}. Test the connection or set the fallback as primary; business logic keeps running through the abstraction.</div></div>
      )}

      <IntegrationSection icon={Server} title="Platform / internal" sub="Providers Cuba itself depends on — each sits behind a provider interface with primary / fallback routing" list={platform} toast={toast} onDisconnect={setDisc} />
      <IntegrationSection icon={Puzzle} title="Client-facing / future" sub="Exposed to client workspaces later — ATS, HRMS, webhooks, SSO, calendar and automation" list={client} toast={toast} onDisconnect={setDisc} />

      <div className="banner dark" style={{ alignItems: 'flex-start' }}>
        <Layers size={16} style={{ flexShrink: 0, marginTop: 2 }} />
        <div><b>Providers are never hardcoded into business logic — replacing a provider must be possible.</b> Every category above is an abstraction with primary / fallback routing; swapping SendGrid for SES or Groq for Claude is a configuration change, not a code change. Later channels — Slack, Teams, SMS, WhatsApp — plug into the same abstraction for selected notification cases (Settings → Notifications).</div>
      </div>

      {disc && (
        <Modal title={`Disconnect ${disc.name}?`} onClose={() => setDisc(null)} width={460}
          footer={<><button className="btn-ghost" onClick={() => setDisc(null)}>Cancel</button><button className="btn-primary" style={{ background: '#DC2626' }} onClick={() => { disconnectIntegration(disc.id); toast(`${disc.name} disconnected`); setDisc(null); }}><PowerOff size={14} /> Disconnect</button></>}>
          <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.55 }}>
            <p style={{ margin: '0 0 10px' }}><b>{disc.name}</b> will be removed from <b>{disc.category}</b> routing and disabled. {fallbackFor(disc) ? <>Traffic fails over to <b>{fallbackFor(disc).name}</b>.</> : 'No fallback is connected for this category — the capability is unavailable until another provider is connected.'}</p>
            <p style={{ margin: 0, color: '#6B7280', fontSize: 12.5 }}>Not a high-risk action: no reason is required, but the change is written to the audit log with your identity. Reconnect any time.</p>
          </div>
        </Modal>
      )}
    </>
  );
}

function IntegrationSection({ icon: Icon, title, sub, list, toast, onDisconnect }) {
  const categories = list.reduce((acc, i) => { (acc[i.category] = acc[i.category] || []).push(i); return acc; }, {});
  const names = Object.keys(categories);
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <span className="icon-box" style={{ width: 34, height: 34, borderRadius: 8 }}><Icon size={17} /></span>
        <div><div style={{ fontSize: 15, fontWeight: 700 }}>{title} <span className="badge" style={{ background: '#F3F4F6', color: '#6B7280', marginLeft: 6 }}>{list.length}</span></div><div style={{ fontSize: 12.5, color: '#6B7280' }}>{sub}</div></div>
      </div>
      {names.length === 0 ? (
        <div className="card" style={{ padding: 26, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No integrations in this group yet.</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 14 }}>
          {names.map((cat) => (
            <div key={cat} className="card" style={{ padding: '14px 16px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontSize: 13.5, fontWeight: 700 }}>{cat}</span>
                <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>{categories[cat].length} provider{categories[cat].length > 1 ? 's' : ''}</span>
              </div>
              {categories[cat].map((p, i) => <ProviderRow key={p.id} p={p} first={i === 0} toast={toast} onDisconnect={onDisconnect} />)}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function ProviderRow({ p, first, toast, onDisconnect }) {
  const { can, toggleIntegration, testIntegration, rotateCredentials, setPrimaryIntegration, connectIntegration } = useApp();
  const manage = can('integration.manage');
  const live = p.status === 'CONNECTED' || p.status === 'DEGRADED';
  const h = p.health;
  return (
    <div style={{ padding: '10px 0', borderTop: first ? 'none' : '1px solid #F3F4F6' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontWeight: 600, fontSize: 13.5 }}>{p.name}</span>
        {p.role && <RoleChip role={p.role} />}
        <IntStatusBadge status={p.status} />
        <span style={{ marginLeft: 'auto', display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: '#6B7280' }} title={!manage ? 'Not permitted for your role (integration.manage)' : !live ? 'Connect first' : p.enabled ? 'Disable' : 'Enable'}>
          {p.enabled ? 'Enabled' : 'Disabled'}
          <Toggle on={!!p.enabled} disabled={!manage || !live} onClick={() => { toggleIntegration(p.id); toast(`${p.name} ${p.enabled ? 'disabled' : 'enabled'}`); }} />
        </span>
      </div>
      {h ? (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 8, marginTop: 8 }}>
          <Metric label="Latency" value={`${(h.latencyMs || 0).toLocaleString('en-IN')} ms`} tone={h.latencyMs > 1500 ? 'warn' : ''} />
          <Metric label="Error rate" value={`${h.errorRate ?? 0}%`} tone={h.errorRate > 5 ? 'danger' : ''} />
          <Metric label="Usage" value={h.usage || '—'} />
          <Metric label="Cost" value={`${fmtMoney(h.cost)} / mo`} />
        </div>
      ) : (
        <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 6 }}>{p.note ? p.note + ' · ' : ''}no health data until connected.</div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, marginTop: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 11.5, color: '#9CA3AF' }}>Last tested {p.lastTested || '—'} · credentials rotated {p.rotated || '—'}</span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {live && <PermButton action="integration.manage" style={SM} onClick={() => { const ok = testIntegration(p.id); toast(ok ? `${p.name}: connection OK` : `${p.name}: degraded — check provider status`); }}><Activity size={12} /> Test connection</PermButton>}
          {live && <PermButton action="integration.manage" style={SM} onClick={() => { rotateCredentials(p.id); toast(`${p.name}: credentials rotated`); }}><KeyRound size={12} /> Rotate credentials</PermButton>}
          {live && p.role !== 'primary' && <PermButton action="integration.manage" style={SM} onClick={() => { setPrimaryIntegration(p.id); toast(`${p.name} is now primary for ${p.category}`); }}><Star size={12} /> Set as primary</PermButton>}
          {live
            ? <PermButton action="integration.manage" style={{ ...SM, color: '#B91C1C' }} onClick={() => onDisconnect(p)}><PowerOff size={12} /> Disconnect</PermButton>
            : <PermButton action="integration.manage" className="btn-primary" style={SM} onClick={() => { connectIntegration(p.id); toast(`${p.name} connected as primary for ${p.category}`); }}><Plug size={12} /> Connect</PermButton>}
        </div>
      </div>
    </div>
  );
}

/* ── small local helpers ── */
const MiniSelect = ({ value, options, onChange, disabled, title }) => (
  <div>
    <select className="input" value={value} disabled={disabled} title={disabled ? 'Not permitted for your role (module.manage)' : title} onChange={(e) => onChange(e.target.value)}
      style={{ width: 'auto', padding: '3px 8px', fontSize: 12, fontWeight: 600, marginTop: 5, opacity: disabled ? 0.6 : 1, cursor: disabled ? 'not-allowed' : 'pointer' }}>
      {options.map(([k, l]) => <option key={k} value={k}>{l}</option>)}
    </select>
  </div>
);
const IntStatusBadge = ({ status }) => { const s = INT_STATUS[status] || { label: status, bg: '#F3F4F6', fg: '#6B7280' }; return <span className="badge" style={{ background: s.bg, color: s.fg, border: s.dashed ? '1px dashed #D1D5DB' : '1px solid transparent' }}>{s.label}</span>; };
const RoleChip = ({ role }) => { const primary = role === 'primary'; return <span className="chip" style={{ background: primary ? '#EFF6FF' : '#F3F4F6', color: primary ? '#1E40AF' : '#475569', padding: '2px 8px', fontSize: 11 }}>{primary ? <Star size={10} /> : null}{primary ? 'Primary' : 'Fallback'}</span>; };
const Metric = ({ label, value, tone }) => (
  <div style={{ background: tone === 'danger' ? '#FEF2F2' : tone === 'warn' ? '#FFFBEB' : '#F8FAFC', borderRadius: 8, padding: '6px 9px', minWidth: 0 }}>
    <div className="eyebrow" style={{ fontSize: 9.5 }}>{label}</div>
    <div className="tnum" style={{ fontSize: 12.5, fontWeight: 700, color: tone === 'danger' ? '#B91C1C' : tone === 'warn' ? '#B45309' : '#14212A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }} title={String(value)}>{value}</div>
  </div>
);

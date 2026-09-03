import { useState, useMemo, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Download, ShieldCheck, FileText, Scale, History, Lock, Plus, Play, Fingerprint, Brain, ListChecks, AlertTriangle, CheckCircle2, Search, ArrowRight, Info, RefreshCw, FileCheck2, Sliders, Clock, X, Eye, Ban, Database } from 'lucide-react';
import { useApp, roleName, walletOf, weightedScore, initials, nowStamp } from '../store.jsx';
import { ClientStatusBadge, WalletStateBadge, PendingChip, useToast, Modal, useReasonGate, PermButton, useTab, Tabs, PageHeader, Kpi, EmptyRow, Row, Toggle, Mono } from '../components/admin/ui.jsx';

/* Audit & Compliance — spec §11 (audit log · evaluation provenance · human override · compliance capabilities)
   + §12 retention table (data categories requiring a retention policy, legal hold).
   Tabs: audit | consent | requests | provenance | overrides | fairness  (?tab=… ; ?cand=ID deep-links a candidate's provenance ; ?client=clX pre-filters the audit log)
   Core principle: every important decision must be explainable, reproducible and traceable. */

const TABS = [
  { key: 'audit', label: 'Audit log' },
  { key: 'consent', label: 'Consent' },
  { key: 'requests', label: 'Data requests' },
  { key: 'provenance', label: 'Provenance' },
  { key: 'overrides', label: 'Overrides' },
  { key: 'fairness', label: 'Fairness' },
];

/* the 11 audited action types from spec §11, each mapped to how it shows up in the live audit log */
const AUDITED = [
  { label: 'Client create / suspend / offboard', match: (a) => a.category === 'Client' },
  { label: 'Credits add / deduct / refund', match: (a) => a.category === 'Credits' },
  { label: 'Opportunity changes', match: (a) => a.category === 'Opportunity' },
  { label: 'Assessment configuration changes', match: (a) => a.category === 'Assessment config' },
  { label: 'Threshold / weight changes', match: (a) => /threshold|weight/i.test(a.action || '') },
  { label: 'Candidate score / decision', match: (a) => a.category === 'Scoring' },
  { label: 'Recruiter overrides', match: (a) => a.category === 'Override' },
  { label: 'Retake / reset actions', match: (a) => a.category === 'Recovery' },
  { label: 'Admin impersonation', match: (a) => a.category === 'Impersonation' || /impersonat/i.test(a.action || '') },
  { label: 'Module changes', match: (a) => a.category === 'Module' },
  { label: 'Data export / delete requests', match: (a) => a.category === 'Data request' },
];

const CAT_COLORS = {
  Client: ['#DCFCE7', '#15803D'], Credits: ['#EFF6FF', '#1E40AF'], Scoring: ['#EDE9FE', '#6D28D9'], Override: ['#FEF3C7', '#B45309'],
  Recovery: ['#FFEDD5', '#C2410C'], Impersonation: ['#FEE2E2', '#B91C1C'], 'Data request': ['#EDE9FE', '#6D28D9'], Module: ['#E0F2FE', '#0369A1'],
  Integration: ['#E0F2FE', '#0369A1'], Settings: ['#F3F4F6', '#374151'], 'Assessment config': ['#DBEAFE', '#1E40AF'], Support: ['#DBEAFE', '#1E40AF'], Opportunity: ['#DBEAFE', '#1E40AF'],
};
const REQ_TYPE = { ACCESS: ['#DBEAFE', '#1E40AF', 'Access'], CORRECTION: ['#FEF3C7', '#B45309', 'Correction'], DELETION: ['#FEE2E2', '#B91C1C', 'Deletion'], EXPORT: ['#EDE9FE', '#6D28D9', 'Export'] };
const REQ_STATUS = { PENDING: ['#FEF3C7', '#B45309', 'Pending'], IN_PROGRESS: ['#DBEAFE', '#1E40AF', 'In progress'], FULFILLED: ['#DCFCE7', '#15803D', 'Fulfilled'], REJECTED: ['#F3F4F6', '#6B7280', 'Rejected'] };
const NEXT_STATUS = { PENDING: 'IN_PROGRESS', IN_PROGRESS: 'FULFILLED' };
const THRESHOLD_LABELS = { minExperienceYears: 'Min experience (yrs)', minEducation: 'Min education', minCefrLevel: 'Min CEFR level', minTypingWpm: 'Min typing WPM', minTypingAccuracy: 'Min typing accuracy %', minAssessmentScore: 'Min assessment score', minInterviewScore: 'Min interview score' };
const FOUR_FIFTHS = 0.8;

const num = (n) => (Number(n) || 0).toLocaleString('en-IN');
const roleLabel = (r) => (r === 'system' ? 'System' : r === 'client' ? 'Client user' : roleName(r));
const csvCell = (v) => '"' + String(v ?? '').replace(/"/g, '""') + '"';

export default function AdminCompliance() {
  const { auditLog, dataRequests, overrides, fairness, currentAdmin, can } = useApp();
  const [tab, setTab, params] = useTab(TABS);
  const [show, toastNode] = useToast();
  const [ask, gateNode] = useReasonGate();
  const openReq = dataRequests.filter((r) => r.status === 'PENDING' || r.status === 'IN_PROGRESS').length;
  const flagged = fairness.filter((f) => f.status === 'FLAG').length;
  const counts = { audit: auditLog.length, requests: openReq || null, overrides: overrides.length, fairness: flagged || null };
  const tabs = TABS.map((t) => ({ ...t, count: counts[t.key] ?? null }));
  const manage = can('compliance.manage');

  return (
    <>
      <PageHeader
        title="Audit & Compliance"
        sub="Every important decision must be explainable, reproducible and traceable"
        right={<span className="chip" title="Action-level RBAC (spec §14): read-only roles see disabled controls, never hidden pages" style={{ background: manage ? '#F0FDF4' : '#F3F4F6', color: manage ? '#15803D' : '#6B7280', border: `1px solid ${manage ? '#BBF7D0' : '#E2E8F0'}` }}><ShieldCheck size={13} /> {roleName(currentAdmin.role)} · {manage ? 'can manage' : 'read-only'}</span>}
      />
      <Tabs tabs={tabs} active={tab} onChange={setTab} />
      {tab === 'audit' && <AuditTab show={show} ask={ask} params={params} />}
      {tab === 'consent' && <ConsentTab />}
      {tab === 'requests' && <RequestsTab show={show} ask={ask} />}
      {tab === 'provenance' && <ProvenanceTab show={show} params={params} />}
      {tab === 'overrides' && <OverridesTab />}
      {tab === 'fairness' && <FairnessTab show={show} />}
      {gateNode}
      {toastNode}
    </>
  );
}

/* ═══════════════════════════ AUDIT LOG ═══════════════════════════ */
function AuditTab({ show, ask, params }) {
  const { auditLog, clients, nameOf, addAudit } = useApp();
  const [cat, setCat] = useState(params.get('category') || 'ALL');
  const [clientF, setClientF] = useState(params.get('client') || 'ALL');
  const [roleF, setRoleF] = useState('ALL');
  const [preset, setPreset] = useState(null);
  const [q, setQ] = useState(params.get('q') || '');
  const cats = useMemo(() => Array.from(new Set(auditLog.map((a) => a.category))).sort(), [auditLog]);
  const roles = useMemo(() => Array.from(new Set(auditLog.map((a) => a.role).filter(Boolean))), [auditLog]);
  const s = q.trim().toLowerCase();
  const list = auditLog.filter((a) =>
    (cat === 'ALL' || a.category === cat) &&
    (clientF === 'ALL' || a.clientId === clientF) &&
    (roleF === 'ALL' || a.role === roleF) &&
    (preset == null || AUDITED[preset].match(a)) &&
    (!s || [a.id, a.actor, a.action, a.resource, a.reason].some((v) => (v || '').toLowerCase().includes(s))));
  const filtered = cat !== 'ALL' || clientF !== 'ALL' || roleF !== 'ALL' || preset != null || !!s;
  const reset = () => { setCat('ALL'); setClientF('ALL'); setRoleF('ALL'); setPreset(null); setQ(''); };
  const withReason = auditLog.filter((a) => a.reason).length;

  /* client.export is HIGH_RISK → reason gate; the export itself becomes an audit entry */
  const exportCsv = () => ask({ action: 'client.export', title: 'Export audit log (CSV)', confirmLabel: 'Export CSV', body: `${list.length} ${list.length === 1 ? 'entry' : 'entries'} (current filter) will be exported. The export itself is recorded in the audit log with your identity.` }, (reason) => {
    const head = ['ID', 'When', 'Actor', 'Role', 'Category', 'Action', 'Resource', 'Client', 'Reason'];
    const rows = list.map((a) => [a.id, a.when, a.actor, roleLabel(a.role), a.category, a.action, a.resource, a.clientId ? nameOf(a.clientId) : '', a.reason || '']);
    const csv = [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\n');
    try {
      const url = URL.createObjectURL(new Blob([csv], { type: 'text/csv' }));
      const el = document.createElement('a'); el.href = url; el.download = 'cuba-audit-log.csv'; document.body.appendChild(el); el.click(); el.remove(); URL.revokeObjectURL(url);
    } catch { /* download blocked — the audit entry is still written */ }
    addAudit('Data request', `Audit log export generated (${list.length} rows)`, 'Audit log', { reason });
    show(`Audit log exported · ${list.length} rows`);
  });

  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18, alignItems: 'start' }}>
      <div style={{ minWidth: 0 }}>
        {/* filters */}
        <div className="card" style={{ padding: '12px 14px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <div style={{ position: 'relative', flex: '1 1 220px', maxWidth: 420 }}>
              <Search size={15} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
              <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search actor, action, resource, reason or ID…" style={{ paddingLeft: 34, paddingRight: q ? 32 : 14 }} />
              {q && <X size={14} color="#9CA3AF" style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer' }} onClick={() => setQ('')} />}
            </div>
            <select className="input" value={clientF} onChange={(e) => setClientF(e.target.value)} style={{ width: 'auto', minWidth: 150 }}>
              <option value="ALL">All clients</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
            <select className="input" value={roleF} onChange={(e) => setRoleF(e.target.value)} style={{ width: 'auto', minWidth: 150 }}>
              <option value="ALL">All actors / roles</option>
              {roles.map((r) => <option key={r} value={r}>{roleLabel(r)}</option>)}
            </select>
            <span style={{ fontSize: 12.5, color: '#6B7280', whiteSpace: 'nowrap' }}>{list.length} of {auditLog.length}</span>
            {filtered && <button type="button" className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={reset}><X size={13} /> Clear</button>}
            <span style={{ flex: 1 }} />
            <PermButton action="client.export" onClick={exportCsv} title="High-risk: a reason is required and the export is itself audited"><Download size={14} /> Export CSV</PermButton>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            <span className="eyebrow" style={{ marginRight: 4 }}>Category</span>
            <button type="button" className={'filter-btn' + (cat === 'ALL' ? ' active' : '')} onClick={() => setCat('ALL')}>All</button>
            {cats.map((c) => (
              <button key={c} type="button" className={'filter-btn' + (cat === c ? ' active' : '')} onClick={() => setCat(cat === c ? 'ALL' : c)}>
                {c} <span className="tnum" style={{ opacity: 0.7 }}>{auditLog.filter((a) => a.category === c).length}</span>
              </button>
            ))}
          </div>
        </div>

        {/* table */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>When</th><th>Actor</th><th>Category</th><th>Action</th><th>Resource</th><th>Reason</th></tr></thead>
              <tbody>
                {list.length === 0 ? <EmptyRow cols={6} text={filtered ? 'No audit entries match the current filter.' : 'No audit entries yet.'} /> : list.map((a) => (
                  <tr key={a.id}>
                    <td style={{ whiteSpace: 'nowrap', color: '#6B7280', fontSize: 12.5 }}>{a.when}<div><Mono>{a.id}</Mono></div></td>
                    <td><div style={{ fontWeight: 600 }}>{a.actor}</div><div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{roleLabel(a.role)}</div></td>
                    <td><CategoryChip cat={a.category} /></td>
                    <td style={{ fontWeight: 500 }}>{a.action}</td>
                    <td><div>{a.resource}</div>{a.clientId && <div style={{ marginTop: 4 }}><ClientCell id={a.clientId} inline /></div>}</td>
                    <td style={{ color: '#6B7280', fontSize: 12.5 }}>{a.reason || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* explainer */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
        <Card title="What is audited" icon={ListChecks} sub="Spec §11 — permanently traceable actions. Click one to filter.">
          {AUDITED.map((it, i) => {
            const n = auditLog.filter(it.match).length; const on = preset === i;
            return (
              <div key={it.label} onClick={() => setPreset(on ? null : i)} style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '7px 8px', margin: '0 -8px', borderRadius: 8, cursor: 'pointer', background: on ? '#EFF6FF' : 'transparent', fontSize: 12.5 }}>
                <CheckCircle2 size={13} color={n ? '#16A34A' : '#D1D5DB'} style={{ flexShrink: 0 }} />
                <span style={{ flex: 1, color: on ? '#056FD4' : '#374151', fontWeight: on ? 600 : 500 }}>{it.label}</span>
                <span className="badge tnum" style={{ background: on ? '#DBEAFE' : '#F3F4F6', color: on ? '#1E40AF' : '#6B7280' }}>{n}</span>
              </div>
            );
          })}
        </Card>
        <Card title="Audit guarantees" icon={Lock}>
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>
            <li>Append-only — entries are never edited or deleted; corrections are new events.</li>
            <li>Every entry carries actor + role, timestamp, resource and client context.</li>
            <li>High-risk actions require a reason ({withReason} of {auditLog.length} entries carry one); critical actions add re-authentication.</li>
            <li>Impersonation, exports and deletions also surface in the sensitive-access audit (Data requests tab).</li>
          </ul>
        </Card>
      </div>
    </div>
  );
}

/* ═══════════════════════════ CONSENT ═══════════════════════════ */
function ConsentTab() {
  const { consentVersions } = useApp();
  const total = consentVersions.reduce((a, v) => a + (v.signed || 0), 0);
  const cur = consentVersions.find((v) => v.current);
  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        <Kpi label="Current version" value={cur?.version || '—'} sub={cur ? `effective ${cur.effective}` : 'no current version'} bar="#056FD4" />
        <Kpi label="Signed on current" value={num(cur?.signed)} sub="candidates" bar="#16A34A" />
        <Kpi label="All consents on record" value={num(total)} sub={`${consentVersions.length} version${consentVersions.length === 1 ? '' : 's'}`} />
        <Kpi label="Evidence per consent" value="4 fields" size={22} sub="version · timestamp · identity · device" />
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {consentVersions.length === 0 && <div className="card" style={{ padding: 26, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No consent versions published.</div>}
          {consentVersions.map((v) => (
            <div key={v.version} className="card" style={{ padding: '16px 18px', display: 'flex', gap: 14, alignItems: 'flex-start', border: v.current ? '1.5px solid #056FD4' : undefined }}>
              <div className="icon-box" style={{ background: v.current ? '#E0EDFF' : '#F3F4F6', color: v.current ? '#056FD4' : '#9CA3AF' }}><FileCheck2 size={19} /></div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 15, fontWeight: 700 }}>Consent {v.version}</span>
                  {v.current ? <span className="badge" style={{ background: '#DCFCE7', color: '#15803D' }}>current</span> : <span className="badge" style={{ background: '#F3F4F6', color: '#6B7280' }}>superseded</span>}
                  <span style={{ fontSize: 12.5, color: '#6B7280' }}><Clock size={12} style={{ verticalAlign: -2 }} /> effective {v.effective}</span>
                </div>
                <div style={{ fontSize: 13, color: '#374151', marginTop: 5 }}>{v.summary}</div>
              </div>
              <div style={{ textAlign: 'right', flexShrink: 0 }}>
                <div className="num tnum" style={{ fontSize: 22, margin: 0 }}>{num(v.signed)}</div>
                <div className="eyebrow">signed</div>
              </div>
            </div>
          ))}
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <Card title="Consent-version tracking" icon={Fingerprint}>
            <div style={{ fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>
              Each candidate attempt stores the <b>consent version signed at the moment of evaluation</b>, not the latest one. Publishing a new version never re-labels old attempts — candidates evaluated under {consentVersions.filter((v) => !v.current).map((v) => v.version).join(' / ') || 'earlier versions'} keep that evidence, and it is shown in the candidate's provenance (Integrity → consent version).
            </div>
          </Card>
          <Card title="Consent evidence captured" icon={FileText}>
            {[['Version + clause hash', 'which text the candidate agreed to'], ['Timestamp', 'when it was accepted'], ['Identity', 'face-match / login used at acceptance'], ['Device + locale', 'browser, IP region, language shown']].map(([k, v], i, arr) => <Row key={k} k={k} v={<span style={{ fontWeight: 500, color: '#6B7280', fontSize: 12.5 }}>{v}</span>} last={i === arr.length - 1} />)}
          </Card>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════ DATA REQUESTS · RETENTION · ACCESS AUDIT ═══════════════════════════ */
function RequestsTab({ show, ask }) {
  const { dataRequests, clients, can, nameOf, setDataRequestStatus, toggleLegalHold, addDataRequest, settings, setRetention, auditLog } = useApp();
  const nav = useNavigate();
  const manage = can('compliance.manage');
  const canHold = can('compliance.legalHold');
  const [statusF, setStatusF] = useState('ALL');
  const [modal, setModal] = useState(false);
  const blank = { type: 'ACCESS', subject: '', clientId: clients[0]?.id || '' };
  const [form, setForm] = useState(blank);

  const pending = dataRequests.filter((r) => r.status === 'PENDING').length;
  const inProgress = dataRequests.filter((r) => r.status === 'IN_PROGRESS').length;
  const onHold = dataRequests.filter((r) => r.legalHold).length;
  const fulfilled = dataRequests.filter((r) => r.status === 'FULFILLED').length;
  const list = dataRequests.filter((r) => statusF === 'ALL' || (statusF === 'HOLD' ? r.legalHold : r.status === statusF));

  const advance = (r) => { const nx = NEXT_STATUS[r.status]; if (!nx) return; setDataRequestStatus(r.id, nx); show(`${r.id} → ${REQ_STATUS[nx][2]}`); };
  const reject = (r) => { setDataRequestStatus(r.id, 'REJECTED'); show(`${r.id} rejected`); };
  /* compliance.legalHold is HIGH_RISK → reason gate on apply and on release */
  const hold = (r) => ask({
    action: 'compliance.legalHold', title: `${r.legalHold ? 'Release' : 'Apply'} legal hold — ${r.id}`, confirmLabel: r.legalHold ? 'Release hold' : 'Apply hold', danger: !r.legalHold,
    body: `${r.subject} · ${nameOf(r.clientId)}. ${r.legalHold ? 'Releasing the hold lets deletion and retention expiry proceed for this subject.' : 'While on hold, deletion requests and retention expiry cannot remove this subject’s data (spec §12, step 8).'}`,
  }, (reason) => { toggleLegalHold(r.id, reason); show(`Legal hold ${r.legalHold ? 'released' : 'applied'} · ${r.id}`); });
  const submit = () => { if (!form.subject.trim() || !form.clientId) return; const id = addDataRequest(form.type, form.subject.trim(), form.clientId); setModal(false); setForm(blank); show(`${id} logged · ${REQ_TYPE[form.type][2]} request`); };

  const access = auditLog.filter((a) => /impersonat/i.test(a.action || '') || a.category === 'Data request');
  const retention = settings.privacy?.retention || [];
  const filters = [['ALL', 'All', dataRequests.length], ['PENDING', 'Pending', pending], ['IN_PROGRESS', 'In progress', inProgress], ['FULFILLED', 'Fulfilled', fulfilled], ['HOLD', 'On legal hold', onHold]];

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        <Kpi label="Pending" value={pending} color={pending ? '#B45309' : '#14212A'} sub="awaiting triage" bar={pending ? '#F59E0B' : undefined} />
        <Kpi label="In progress" value={inProgress} color="#1E40AF" sub="being fulfilled" bar="#056FD4" />
        <Kpi label="On legal hold" value={onHold} color={onHold ? '#B91C1C' : '#14212A'} sub="deletion / expiry blocked" bar={onHold ? '#DC2626' : undefined} />
        <Kpi label="Fulfilled" value={fulfilled} color="#15803D" sub="closed with evidence" bar="#16A34A" />
      </div>

      {/* requests table */}
      <div className="card" style={{ overflow: 'hidden', marginBottom: 18 }}>
        <div style={{ padding: '12px 16px', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap', borderBottom: '1px solid #F3F4F6' }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, marginRight: 6 }}>Data-subject & export requests</span>
          {filters.map(([k, l, n]) => <button key={k} type="button" className={'filter-btn' + (statusF === k ? ' active' : '')} onClick={() => setStatusF(k)}>{l} <span className="tnum" style={{ opacity: 0.7 }}>{n}</span></button>)}
          <span style={{ flex: 1 }} />
          <PermButton action="compliance.manage" className="btn-primary" onClick={() => setModal(true)}><Plus size={14} /> Log request</PermButton>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Request</th><th>Type</th><th>Subject</th><th>Client</th><th>Requested</th><th>Due</th><th>Status</th><th>Legal hold</th><th style={{ textAlign: 'right' }}>Actions</th></tr></thead>
            <tbody>
              {list.length === 0 ? <EmptyRow cols={9} text={statusF === 'ALL' ? 'No data requests logged.' : 'No requests in this state.'} /> : list.map((r) => (
                <tr key={r.id}>
                  <td><Mono>{r.id}</Mono></td>
                  <td><Pill m={REQ_TYPE} k={r.type} /></td>
                  <td style={{ fontWeight: 600 }}>{r.subject}</td>
                  <td><ClientCell id={r.clientId} /></td>
                  <td style={{ color: '#6B7280', whiteSpace: 'nowrap' }}>{r.requested}</td>
                  <td style={{ color: r.status === 'PENDING' || r.status === 'IN_PROGRESS' ? '#B45309' : '#6B7280', whiteSpace: 'nowrap' }}>{r.due}</td>
                  <td><Pill m={REQ_STATUS} k={r.status} /></td>
                  <td>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <Toggle on={!!r.legalHold} disabled={!canHold} onClick={() => hold(r)} />
                      {r.legalHold && <Lock size={13} color="#B91C1C" />}
                    </div>
                    {r.legalHold && r.holdReason && <div style={{ fontSize: 11.5, color: '#B91C1C', marginTop: 4, maxWidth: 200 }}>{r.holdReason}</div>}
                  </td>
                  <td style={{ textAlign: 'right', whiteSpace: 'nowrap' }}><ReqActions r={r} onAdvance={advance} onReject={reject} /></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ padding: '10px 16px', borderTop: '1px solid #F3F4F6', fontSize: 12, color: '#6B7280', display: 'flex', gap: 8, alignItems: 'center' }}>
          <Info size={13} /> Lifecycle: Pending → In progress → Fulfilled (or Rejected). A deletion request cannot be fulfilled while its subject is on legal hold. Every transition is written to the audit log. {!manage && <b>Your role is read-only here.</b>}
        </div>
      </div>

      {/* retention (§12) + sensitive access audit */}
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        <Card title="Retention controls" icon={Database} sub="Spec §12 — data categories requiring a retention policy" flush
          right={<span style={{ fontSize: 12, color: '#056FD4', fontWeight: 600, cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => nav('/admin/settings?tab=privacy')}>Data & Privacy settings →</span>}>
          <div className="table-wrap">
            <table>
              <thead><tr><th>Data category</th><th>Retention <PendingChip>days · default · pending</PendingChip></th><th>Legal hold</th><th>Note</th></tr></thead>
              <tbody>
                {retention.length === 0 ? <EmptyRow cols={4} text="No retention policy configured." /> : retention.map((r) => (
                  <RetentionRow key={r.category} r={r} manage={manage} onSave={(d) => { setRetention(r.category, d); show(`Retention: ${r.category} → ${d} days`); }} />
                ))}
              </tbody>
            </table>
          </div>
          <div style={{ padding: '10px 16px', borderTop: '1px solid #F3F4F6', fontSize: 12, color: '#6B7280', display: 'flex', gap: 14, flexWrap: 'wrap' }}>
            <span>Legal hold by default: <b>{settings.privacy?.legalHoldDefault ? 'on' : 'off'}</b></span>
            <span>Anonymise after retention: <b>{settings.privacy?.anonymiseAfterRetention ? 'yes' : 'no'}</b></span>
            <span>Backups purged after: <b>{settings.privacy?.backupDeletionDays ?? '—'} days</b></span>
            <span>Country-specific durations <PendingChip>pending</PendingChip></span>
          </div>
        </Card>

        <Card title="Access audit — sensitive candidate records" icon={Eye} sub="Impersonation, exports, deletions and access requests touching candidate data" flush
          right={<span className="badge" style={{ background: '#F3F4F6', color: '#6B7280' }}>{access.length}</span>}>
          {access.length === 0 ? <div style={{ padding: 22, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No sensitive access recorded.</div> : access.map((a, i) => (
            <div key={a.id} style={{ display: 'flex', gap: 10, padding: '10px 16px', borderTop: i === 0 ? 'none' : '1px solid #F3F4F6', fontSize: 12.5, alignItems: 'flex-start' }}>
              <div style={{ width: 118, flexShrink: 0, color: '#6B7280', fontSize: 12 }}>{a.when}</div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div><b>{a.actor}</b> <span style={{ color: '#9CA3AF' }}>({roleLabel(a.role)})</span> — {a.action}</div>
                <div style={{ color: '#6B7280' }}>{a.resource}{a.reason ? ` · reason: ${a.reason}` : ''}</div>
              </div>
              <CategoryChip cat={a.category} />
            </div>
          ))}
        </Card>
      </div>

      {modal && (
        <Modal title="Log data-subject request" onClose={() => setModal(false)} width={480}
          footer={<><button className="btn-ghost" onClick={() => setModal(false)}>Cancel</button><button className="btn-primary" disabled={!form.subject.trim() || !form.clientId} onClick={submit}><Plus size={14} /> Log request</button></>}>
          <label className="field-label">Request type</label>
          <select className="input" value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })}>
            {Object.entries(REQ_TYPE).map(([k, v]) => <option key={k} value={k}>{v[2]}{k === 'EXPORT' ? ' (client data export)' : ' (data subject)'}</option>)}
          </select>
          <label className="field-label" style={{ marginTop: 12 }}>Subject <span className="req">*</span></label>
          <input className="input" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="candidate #5120 · or the client name for an export" />
          <label className="field-label" style={{ marginTop: 12 }}>Client</label>
          <select className="input" value={form.clientId} onChange={(e) => setForm({ ...form, clientId: e.target.value })}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <div className="hint">Due in 30 days · starts as Pending · written to the audit log with your identity.</div>
        </Modal>
      )}
    </>
  );
}

function ReqActions({ r, onAdvance, onReject }) {
  const nx = NEXT_STATUS[r.status];
  if (!nx) return <span style={{ fontSize: 12, color: '#9CA3AF' }}>closed</span>;
  const blocked = r.type === 'DELETION' && r.legalHold && nx === 'FULFILLED';
  return (
    <span style={{ display: 'inline-flex', gap: 6 }}>
      <PermButton action="compliance.manage" className={nx === 'FULFILLED' ? 'btn-success' : 'btn-primary'} style={{ padding: '6px 12px', fontSize: 12.5 }} disabled={blocked} title={blocked ? 'Legal hold blocks deletion — release the hold first' : `Advance to ${REQ_STATUS[nx][2]}`} onClick={() => onAdvance(r)}>
        {nx === 'FULFILLED' ? <><CheckCircle2 size={13} /> Mark fulfilled</> : <><ArrowRight size={13} /> Start</>}
      </PermButton>
      <PermButton action="compliance.manage" style={{ padding: '6px 10px', fontSize: 12.5, color: '#B91C1C' }} title="Reject request" onClick={() => onReject(r)}><Ban size={13} /></PermButton>
    </span>
  );
}

function RetentionRow({ r, manage, onSave }) {
  const [d, setD] = useState(String(r.days));
  useEffect(() => { setD(String(r.days)); }, [r.days]);
  const commit = () => { const n = Math.max(0, Number(d) || 0); if (n !== r.days) onSave(n); else setD(String(r.days)); };
  return (
    <tr>
      <td style={{ fontWeight: 600 }}>{r.category}</td>
      <td>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <input className="input tnum" type="number" min={0} value={d} disabled={!manage} title={manage ? 'Edit and press Enter (or blur) to save — audited' : 'Not permitted for your role (compliance.manage)'} onChange={(e) => setD(e.target.value)} onBlur={commit} onKeyDown={(e) => { if (e.key === 'Enter') e.target.blur(); }} style={{ width: 88, padding: '6px 10px' }} />
          <span style={{ fontSize: 12, color: '#6B7280' }}>days</span>
        </div>
      </td>
      <td>{r.legalHoldable ? <span className="badge" style={{ background: '#FEF3C7', color: '#B45309' }}><Lock size={11} /> holdable</span> : <span className="badge" style={{ background: '#F3F4F6', color: '#6B7280' }}>no</span>}</td>
      <td style={{ color: '#6B7280', fontSize: 12.5 }}>{r.note || '—'}</td>
    </tr>
  );
}

/* ═══════════════════════════ PROVENANCE ═══════════════════════════ */
function ProvenanceTab({ show, params }) {
  const { opportunities, getCandidates, provenanceFor, addAudit, overrides, currentClientId } = useApp();
  const nav = useNavigate();
  const paramCand = params.get('cand');
  const oppOf = (cid) => opportunities.find((o) => getCandidates(o.id).some((c) => c.id === cid));
  const [oppId, setOppId] = useState(() => (paramCand && oppOf(paramCand)?.id) || opportunities[0]?.id || '');
  const [candId, setCandId] = useState(paramCand || '');
  useEffect(() => { if (!paramCand) return; const o = oppOf(paramCand); if (o) { setOppId(o.id); setCandId(paramCand); } }, [paramCand]); // eslint-disable-line react-hooks/exhaustive-deps

  const opp = opportunities.find((o) => o.id === oppId);
  const cands = getCandidates(oppId);
  const cand = cands.find((c) => c.id === candId) || cands[0];
  const prov = opp && cand ? provenanceFor(opp, cand) : null;
  const events = overrides.filter((o) => o.oppId === oppId && cand && o.candidate === cand.name);
  const weighted = cand && prov ? weightedScore(cand, prov.weights) : 0;
  const pick = (cid) => { setCandId(cid); nav(`/admin/compliance?tab=provenance&cand=${cid}`, { replace: true }); };
  /* attribute the record to the client that owns it, not to whoever the portal is currently scoped to */
  const ownerOf = (oid) => overrides.find((o) => o.oppId === oid)?.clientId || currentClientId;
  const ownerId = ownerOf(oppId);
  const reproduce = () => {
    addAudit('Scoring', 'Reproduction requested', `${cand.name} · ${opp.title}`, { clientId: ownerOf(oppId), ref: prov.assessmentVersion });
    show(`Re-run scheduled with original config ${prov.assessmentVersion}`);
  };

  return (
    <>
      <div className="banner info"><Info size={16} style={{ flexShrink: 0 }} /><span><b>Every candidate result must be reproducible later using its original configuration.</b> Assessment version, rubric, weights, thresholds, model + prompt versions and proctoring evidence are frozen with the result — re-runs compare against it, they never overwrite it.</span></div>
      <div style={{ display: 'grid', gridTemplateColumns: '300px minmax(0, 1fr)', gap: 18, alignItems: 'start' }}>
        {/* picker */}
        <div className="card" style={{ overflow: 'hidden' }}>
          <div style={{ padding: '14px 16px', borderBottom: '1px solid #F3F4F6' }}>
            <label className="field-label">Opportunity</label>
            <select className="input" value={oppId} onChange={(e) => setOppId(e.target.value)}>
              {opportunities.length === 0 && <option value="">No opportunities</option>}
              {opportunities.map((o) => <option key={o.id} value={o.id}>{o.title} · asmt {o.assessment?.version || 'v1'}</option>)}
            </select>
            {opp && <div style={{ marginTop: 10 }}><ClientCell id={ownerId} inline /></div>}
          </div>
          <div className="eyebrow" style={{ padding: '10px 16px 4px' }}>Candidates · {cands.length}</div>
          {cands.length === 0 ? <div style={{ padding: 22, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No scored candidates for this opportunity.</div> : cands.map((c) => {
            const on = cand?.id === c.id;
            return (
              <div key={c.id} onClick={() => pick(c.id)} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '9px 16px', cursor: 'pointer', background: on ? '#EFF6FF' : 'transparent', borderLeft: `3px solid ${on ? '#056FD4' : 'transparent'}` }}>
                <div className="avatar" style={{ width: 30, height: 30, background: on ? '#DBEAFE' : '#F3F4F6', color: on ? '#1E40AF' : '#6B7280', fontSize: 11 }}>{initials(c.name)}</div>
                <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 13, fontWeight: on ? 700 : 600 }}>{c.name}</div><div style={{ fontSize: 11.5, color: '#9CA3AF' }}><Mono>{c.id}</Mono> · cleared {c.clearedAt}</div></div>
                <span className="tnum" style={{ fontSize: 13, fontWeight: 700, color: '#056FD4' }}>{weightedScore(c, opp?.assessment?.weights || [])}</span>
              </div>
            );
          })}
        </div>

        {/* provenance panel */}
        {!prov ? <div className="card" style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>Select an opportunity and a candidate to view provenance.</div> : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
            <div className="card" style={{ padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14, flexWrap: 'wrap' }}>
              <div className="avatar" style={{ width: 46, height: 46, background: '#E0EDFF', color: '#056FD4', fontSize: 15 }}>{initials(cand.name)}</div>
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontSize: 17, fontWeight: 700, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>{cand.name} <Mono>{cand.id}</Mono></div>
                <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 2 }}>{opp.title} · evaluated {prov.evaluatedAt} · consent {prov.consentVersion}</div>
              </div>
              <div style={{ textAlign: 'right' }}><div className="eyebrow">Weighted score</div><div className="num tnum" style={{ fontSize: 26, margin: 0, color: '#056FD4' }}>{weighted}</div></div>
              <PermButton action="compliance.manage" className="btn-primary" onClick={reproduce} title="Schedules a re-run with the frozen configuration; the result is compared, never overwritten"><RefreshCw size={14} /> Reproduce result</PermButton>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)', gap: 14, alignItems: 'start' }}>
              <Card title="Assessment" icon={Sliders} sub="Version · rubric · weights · thresholds">
                <Row k="Assessment version" v={<Mono>{prov.assessmentVersion}</Mono>} />
                <Row k="Rubric version" v={<Mono>{prov.rubricVersion}</Mono>} last />
                <div className="eyebrow" style={{ margin: '12px 0 4px' }}>Rank weights → sub-scores</div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 52px 52px', gap: 8, fontSize: 10.5, color: '#9CA3AF', fontWeight: 700, textTransform: 'uppercase', letterSpacing: 0.4, padding: '4px 0' }}><span>Dimension</span><span style={{ textAlign: 'right' }}>Weight</span><span style={{ textAlign: 'right' }}>Score</span></div>
                {prov.weights.length === 0 ? <div style={{ fontSize: 12.5, color: '#9CA3AF', padding: '6px 0' }}>No rank weights configured.</div> : prov.weights.map((w) => {
                  const sc = cand.scores?.[w.label];
                  return (
                    <div key={w.label} style={{ display: 'grid', gridTemplateColumns: '1fr 52px 52px', gap: 8, alignItems: 'center', padding: '6px 0', borderTop: '1px solid #F3F4F6', fontSize: 12.5 }}>
                      <span>{w.label}</span>
                      <span className="tnum" style={{ color: '#6B7280', textAlign: 'right' }}>{w.w}%</span>
                      <span className="tnum" style={{ fontWeight: 700, textAlign: 'right' }}>{sc ?? '—'}</span>
                    </div>
                  );
                })}
                <div className="eyebrow" style={{ margin: '12px 0 4px' }}>Thresholds / criteria</div>
                {Object.entries(prov.thresholds).length === 0 ? <div style={{ fontSize: 12.5, color: '#9CA3AF', padding: '6px 0' }}>No thresholds recorded.</div> : Object.entries(prov.thresholds).map(([k, v], i, arr) => <Row key={k} k={THRESHOLD_LABELS[k] || k} v={v === '' || v == null ? '—' : String(v)} last={i === arr.length - 1} />)}
                <div className="eyebrow" style={{ margin: '12px 0 4px' }}>Module gates</div>
                {(opp.assessment?.modules || []).length === 0 ? <div style={{ fontSize: 12.5, color: '#9CA3AF', padding: '6px 0' }}>No modules.</div> : (opp.assessment?.modules || []).map((m, i, arr) => <Row key={m.key} k={<span style={{ textTransform: 'capitalize' }}>{m.key}</span>} v={<span style={{ fontWeight: 500, fontSize: 12.5 }}>{m.gate || '—'}</span>} last={i === arr.length - 1} />)}
              </Card>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, minWidth: 0 }}>
                <Card title="AI" icon={Brain} sub={`Model · prompt / rule version · evaluated ${prov.evaluatedAt}`} flush>
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Pipeline</th><th>Model</th><th>Ver</th><th>Prompt</th></tr></thead>
                      <tbody>
                        {prov.models.length === 0 ? <EmptyRow cols={4} text="No model versions recorded." /> : prov.models.map((m) => (
                          <tr key={m.pipeline}><td style={{ fontWeight: 600 }}>{m.pipeline}</td><td>{m.model}</td><td><Mono>{m.version}</Mono></td><td><Mono>{m.prompt}</Mono></td></tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </Card>
                <Card title="Integrity" icon={Fingerprint} sub="Proctoring configuration · evidence · identity · consent">
                  <Row k="Proctoring config" v={prov.proctoring.config} />
                  <Row k="Evidence" v={prov.proctoring.evidence} />
                  <Row k="Identity" v={prov.proctoring.identity} />
                  <Row k="Consent version" v={prov.consentVersion} />
                  <Row k="Integrity score" v={cand.scores?.Integrity ?? '—'} last />
                </Card>
              </div>
            </div>

            <Card title="Human override events" icon={History} sub="Original automated decision is preserved; each override is a separate traceable event with actor + reason" flush
              right={<span className="badge" style={{ background: events.length ? '#FEF3C7' : '#F3F4F6', color: events.length ? '#B45309' : '#6B7280' }}>{events.length}</span>}>
              {events.length === 0 ? <div style={{ padding: 18, textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No human overrides — the automated result stands.</div> : events.map((o, i) => (
                <div key={o.id} style={{ display: 'flex', gap: 12, alignItems: 'center', padding: '10px 16px', borderTop: i === 0 ? 'none' : '1px solid #F3F4F6', fontSize: 12.5, flexWrap: 'wrap' }}>
                  <span style={{ color: '#6B7280', width: 118, flexShrink: 0 }}>{o.when}</span>
                  <span className="chip" style={{ background: '#F3F4F6', color: '#374151', border: '1px dashed #D1D5DB' }}>{o.original}</span>
                  <ArrowRight size={13} color="#9CA3AF" />
                  <span className="chip" style={{ background: '#FEF3C7', color: '#B45309' }}>{o.override}</span>
                  <span style={{ flex: 1, minWidth: 160, color: '#6B7280' }}><b style={{ color: '#14212A' }}>{o.actor}</b> — {o.reason}</span>
                </div>
              ))}
            </Card>
          </div>
        )}
      </div>
    </>
  );
}

/* ═══════════════════════════ OVERRIDES ═══════════════════════════ */
function OverridesTab() {
  const { overrides, clients, getCandidates } = useApp();
  const nav = useNavigate();
  const [clientF, setClientF] = useState('ALL');
  const list = overrides.filter((o) => clientF === 'ALL' || o.clientId === clientF);
  const candIdOf = (o) => getCandidates(o.oppId).find((c) => c.name === o.candidate)?.id;
  return (
    <>
      <div className="banner info"><Scale size={16} style={{ flexShrink: 0 }} /><span><b>Original automated decision is preserved; override is a separate traceable event</b> with actor and reason. Overrides never rewrite a score — they sit beside it in the audit log and in the candidate's provenance.</span></div>
      <div className="card" style={{ overflow: 'hidden' }}>
        <div style={{ padding: '12px 16px', display: 'flex', gap: 10, alignItems: 'center', borderBottom: '1px solid #F3F4F6', flexWrap: 'wrap' }}>
          <span style={{ fontSize: 14.5, fontWeight: 700, flex: 1 }}>Human overrides <span style={{ color: '#9CA3AF', fontWeight: 600, fontSize: 13 }}>[{list.length}]</span></span>
          <select className="input" value={clientF} onChange={(e) => setClientF(e.target.value)} style={{ width: 'auto', minWidth: 160 }}>
            <option value="ALL">All clients</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>When</th><th>Client</th><th>Opportunity</th><th>Candidate</th><th>Original automated decision</th><th>Human override</th><th>Actor</th><th>Reason</th></tr></thead>
            <tbody>
              {list.length === 0 ? <EmptyRow cols={8} text="No human overrides recorded." /> : list.map((o) => {
                const cid = candIdOf(o);
                return (
                  <tr key={o.id}>
                    <td style={{ whiteSpace: 'nowrap', color: '#6B7280', fontSize: 12.5 }}>{o.when}<div><Mono>{o.id}</Mono></div></td>
                    <td><ClientCell id={o.clientId} /></td>
                    <td>{o.oppTitle}</td>
                    <td style={{ fontWeight: 600 }}>{o.candidate}{cid
                      ? <div style={{ fontSize: 11.5, color: '#056FD4', cursor: 'pointer', fontWeight: 600, marginTop: 2 }} onClick={() => nav(`/admin/compliance?tab=provenance&cand=${cid}`)}>Provenance →</div>
                      : <div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 2 }} title="This client's candidate records are not held in this workspace, so the frozen configuration cannot be replayed here.">Provenance not captured for this client</div>}</td>
                    <td><span className="chip" style={{ background: '#F3F4F6', color: '#374151', border: '1px dashed #D1D5DB' }}>{o.original}</span><div style={{ fontSize: 11, color: '#9CA3AF', marginTop: 3 }}>preserved</div></td>
                    <td><span className="chip" style={{ background: '#FEF3C7', color: '#B45309' }}>{o.override}</span></td>
                    <td style={{ fontSize: 12.5 }}>{o.actor}</td>
                    <td style={{ color: '#6B7280', fontSize: 12.5 }}>{o.reason || '—'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </>
  );
}

/* ═══════════════════════════ FAIRNESS ═══════════════════════════ */
function FairnessTab({ show }) {
  const { fairness, addAudit, nameOf } = useApp();
  const [ran, setRan] = useState({});
  const pass = fairness.filter((f) => f.status === 'PASS').length;
  const flagged = fairness.length - pass;
  const run = (f) => { addAudit('Scoring', 'Fairness audit run', `${f.oppTitle} · ${nameOf(f.clientId)}`, { clientId: f.clientId }); setRan((r) => ({ ...r, [f.oppId]: nowStamp() })); show(`Fairness audit run · ${f.oppTitle} — ratio ${f.ratio.toFixed(2)} · ${f.status}`); };
  const runAll = () => { const t = nowStamp(); fairness.forEach((f) => addAudit('Scoring', 'Fairness audit run', `${f.oppTitle} · ${nameOf(f.clientId)}`, { clientId: f.clientId })); setRan(Object.fromEntries(fairness.map((f) => [f.oppId, t]))); show(`Fairness audit run on ${fairness.length} opportunit${fairness.length === 1 ? 'y' : 'ies'}`); };

  return (
    <>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 14, marginBottom: 18 }}>
        <Kpi label="Opportunities monitored" value={fairness.length} sub="selection-rate audit per opportunity" />
        <Kpi label="Pass" value={pass} color="#15803D" bar="#16A34A" sub="impact ratio ≥ 0.80" />
        <Kpi label="Flagged" value={flagged} color={flagged ? '#B45309' : '#14212A'} bar={flagged ? '#F59E0B' : undefined} sub="below the 4/5ths threshold" />
        <Kpi label="Rule threshold" value={FOUR_FIFTHS.toFixed(2)} size={22} sub="4/5ths (80%) rule · advisory" />
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 14.5, fontWeight: 700, flex: 1 }}>Bias / fairness monitoring</span>
        <PermButton action="compliance.manage" onClick={runAll} disabled={fairness.length === 0}><RefreshCw size={14} /> Run all audits</PermButton>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 18, alignItems: 'start' }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {fairness.length === 0 && <div className="card" style={{ padding: 26, textAlign: 'center', color: '#9CA3AF', fontSize: 13, gridColumn: '1 / -1' }}>No fairness audits yet.</div>}
          {fairness.map((f) => {
            const flag = f.status === 'FLAG';
            const maxRate = Math.max(...f.groups.map((g) => g.rate), 0);
            return (
              <div key={f.oppId} className="card" style={{ padding: '16px 18px', borderTop: `3px solid ${flag ? '#F59E0B' : '#16A34A'}` }}>
                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{f.oppTitle}</div>
                    <div style={{ marginTop: 6 }}><ClientCell id={f.clientId} inline /></div>
                  </div>
                  <span className="badge" style={flag ? { background: '#FEF3C7', color: '#B45309' } : { background: '#DCFCE7', color: '#15803D' }}>{flag ? <><AlertTriangle size={11} /> FLAG</> : <><CheckCircle2 size={11} /> PASS</>}</span>
                </div>
                <div style={{ marginTop: 14, display: 'flex', flexDirection: 'column', gap: 9 }}>
                  {f.groups.map((g) => {
                    const best = g.rate === maxRate;
                    return (
                      <div key={g.name}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12.5, marginBottom: 4 }}><span style={{ fontWeight: 600 }}>{g.name}</span><span className="tnum" style={{ color: '#6B7280' }}>{Math.round(g.rate * 100)}% selected{best ? ' · reference' : ''}</span></div>
                        <div className="progress-track"><div style={{ width: Math.round(g.rate * 100) + '%', height: '100%', borderRadius: 10, background: best ? '#056FD4' : flag ? '#F59E0B' : '#60A5FA' }} /></div>
                      </div>
                    );
                  })}
                </div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 14, padding: '10px 12px', background: flag ? '#FFFBEB' : '#F0FDF4', borderRadius: 8, fontSize: 12.5, color: flag ? '#92400E' : '#166534' }}>
                  <Scale size={14} />
                  <span style={{ flex: 1 }}>Impact ratio <b className="tnum">{f.ratio.toFixed(2)}</b> {flag ? '<' : '≥'} {FOUR_FIFTHS.toFixed(2)} · 4/5ths rule</span>
                </div>
                {f.note && <div style={{ marginTop: 8, fontSize: 12.5, color: '#B45309', display: 'flex', gap: 6 }}><AlertTriangle size={13} style={{ flexShrink: 0, marginTop: 2 }} /> {f.note}</div>}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginTop: 14, gap: 10, flexWrap: 'wrap' }}>
                  <span style={{ fontSize: 12, color: '#9CA3AF' }}><Clock size={12} style={{ verticalAlign: -2 }} /> last run {ran[f.oppId] || f.lastRun}</span>
                  <PermButton action="compliance.manage" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={() => run(f)}><Play size={13} /> Run audit now</PermButton>
                </div>
              </div>
            );
          })}
        </div>
        <Card title="How bias monitoring works" icon={Scale}>
          <ol style={{ margin: 0, paddingLeft: 18, fontSize: 12.5, color: '#374151', lineHeight: 1.6 }}>
            <li><b>Selection rate</b> per group = candidates advanced ÷ candidates evaluated, per opportunity.</li>
            <li><b>Impact ratio</b> = lowest group rate ÷ highest group rate (the reference bar).</li>
            <li>Ratio ≥ {FOUR_FIFTHS.toFixed(2)} → <b>PASS</b>; below → <b>FLAG</b> for review (4/5ths rule).</li>
            <li>Group attributes are optional, self-declared, and <b>never used in scoring</b> — only in monitoring.</li>
            <li>Flags are advisory: the platform never changes a decision automatically; the client reviews the gate that drives the gap.</li>
            <li>Every run is written to the audit log (category Scoring).</li>
          </ol>
        </Card>
      </div>
    </>
  );
}

/* ═══════════════════════════ local helpers ═══════════════════════════ */
/* client name + the two SEPARATE badges (account status · wallet state) — locked spec distinction */
function ClientCell({ id, inline }) {
  const { getClient } = useApp();
  const nav = useNavigate();
  const c = getClient(id);
  if (!c) return <span style={{ color: '#9CA3AF', fontSize: 12.5 }}>—</span>;
  const w = walletOf(c);
  return (
    <div style={{ display: 'flex', alignItems: inline ? 'center' : 'flex-start', flexDirection: inline ? 'row' : 'column', gap: inline ? 6 : 4, flexWrap: 'wrap' }}>
      <span style={{ fontSize: inline ? 12 : 13, fontWeight: 600, color: '#056FD4', cursor: 'pointer', whiteSpace: 'nowrap' }} onClick={() => nav('/admin/clients/' + c.id)} title="Open client">{c.name}</span>
      <span style={{ display: 'inline-flex', gap: 4, flexWrap: 'wrap' }} title="Account status · wallet state (tracked separately)"><ClientStatusBadge status={c.status} /><WalletStateBadge state={w.state} /></span>
    </div>
  );
}
const CategoryChip = ({ cat }) => { const [bg, fg] = CAT_COLORS[cat] || ['#F3F4F6', '#374151']; return <span className="chip" style={{ background: bg, color: fg, fontSize: 11.5, padding: '3px 9px', whiteSpace: 'nowrap' }}>{cat}</span>; };
const Pill = ({ m, k }) => { const [bg, fg, l] = m[k] || ['#F3F4F6', '#6B7280', k]; return <span className="badge" style={{ background: bg, color: fg }}>{l}</span>; };
const Card = ({ title, sub, icon: Icon, right, children, flush, style }) => (
  <div className="card" style={{ overflow: 'hidden', minWidth: 0, ...style }}>
    <div style={{ display: 'flex', alignItems: 'center', gap: 9, padding: '13px 16px', borderBottom: '1px solid #F3F4F6' }}>
      {Icon && <Icon size={16} color="#056FD4" style={{ flexShrink: 0 }} />}
      <div style={{ flex: 1, minWidth: 0 }}><div style={{ fontSize: 14.5, fontWeight: 700 }}>{title}</div>{sub && <div style={{ fontSize: 12, color: '#6B7280', marginTop: 1 }}>{sub}</div>}</div>
      {right}
    </div>
    <div style={flush ? undefined : { padding: '12px 16px' }}>{children}</div>
  </div>
);

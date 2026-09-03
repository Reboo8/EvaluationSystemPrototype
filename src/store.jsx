import { createContext, useContext, useState, useEffect, useMemo } from 'react';

/* ═══════════════════════════════════════════════════════════════════════════
   Cuba client store — in-memory with localStorage persistence for templates, invites, pool and rank lists.

   Two worlds share this store:
     • CLIENT portal  (Shell.jsx)      — scoped to `currentClientId` (Northstar Group, or the impersonated client)
     • ADMIN portal   (AdminShell.jsx) — Cuba platform operator control plane

   Commercial model (locked): sales-led + credit wallet. NO subscription plans.
     wallet   = { balance, reserved, overdraftLimit, lowBalanceThreshold, frozen, lastTopUp }
     ledger   = immutable credit movements (never edited; corrections are reversal entries)
     payments = money domain (₹), separate from credits
     rateCard = credits per service unit (placeholder values — "default · pending")

   Exports (pure):  BRAND CURRENCY DEFAULTS CLIENT_STATUS WALLET_STATE LEDGER_TYPE TICKET_STATUS CASE_TYPES
                    MODULE_STATE ROLLOUT_STAGES ADMIN_ROLES PERMISSIONS HIGH_RISK CRITICAL RECOVERY_ACTIONS JOB_KINDS
                    DATA_CATEGORIES NOTIF_CATEGORIES ROLE_CATALOG
                    walletOf walletStateOf canStartPaidWork estimateFunding fmtCr fmtMoney initials weightedScore ranked
   Context (useApp): see the Provider value at the bottom of this file.
   ═══════════════════════════════════════════════════════════════════════════ */

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

/* ──────────────────────────── constants ──────────────────────────── */
export const BRAND = { product: 'Cuba', company: 'Reboo8', tagline: 'Candidate Evaluation & Rank Scoring' };
export const CURRENCY = { code: 'INR', symbol: '₹', perCredit: 10 }; // 1 credit = ₹10 — default · pending

export const DEFAULTS = {
  lowBalanceThreshold: 500,   // credits — default · pending
  overdraftLimit: 1000,       // credits — default · pending
  fundingResumeX: 50,         // resume-gate capacity = hiring target × 50 — default · pending
  fundingFullX: 10,           // full-evaluation capacity = hiring target × 10 — default · pending
};

export const fmtCr = (n) => `${(Number(n) || 0).toLocaleString('en-IN')} cr`;
export const fmtMoney = (n) => `${CURRENCY.symbol}${(Number(n) || 0).toLocaleString('en-IN')}`;
export const initials = (n = '') => n.split(' ').filter(Boolean).map((w) => w[0]).slice(0, 2).join('').toUpperCase();

/* ──────────────────────────── candidate invites + resume gate (shared by the portal and the candidate run-time) ────────────────────────────
   The assessment LINK is the candidate's entry: time-bound, resumable, one attempt. It is issued only after the resume gate passes. */
export const hashNum = (str) => { let h = 2166136261; const t = String(str); for (let i = 0; i < t.length; i++) { h ^= t.charCodeAt(i); h = Math.imul(h, 16777619); } h ^= h >>> 16; h = Math.imul(h, 0x45d9f3b); h ^= h >>> 16; return h >>> 0; };
export const fmtDate = (ms) => { try { return new Date(Number(ms)).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }); } catch { return '—'; } };
export const fmtDateTime = (ms) => { try { const d = new Date(Number(ms)); return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' }) + ', ' + d.toLocaleTimeString('en-IN', { hour: 'numeric', minute: '2-digit' }); } catch { return '—'; } };
export const INVITE_STATUS = {
  SENT:        { label: 'Link sent',    bg: '#DBEAFE', fg: '#1E40AF' },
  OPENED:      { label: 'Opened',       bg: '#EDE9FE', fg: '#6D28D9' },
  IN_PROGRESS: { label: 'In progress',  bg: '#FEF3C7', fg: '#B45309' },
  SUBMITTED:   { label: 'Submitted',    bg: '#DCFCE7', fg: '#15803D' },
  EXPIRED:     { label: 'Expired',      bg: '#F3F4F6', fg: '#6B7280' },
  RENEWED:     { label: 'Link replaced', bg: '#F3F4F6', fg: '#6B7280' },
  ABANDONED:   { label: 'Withdrew',     bg: '#FEE2E2', fg: '#B91C1C' },
  DECLINED:    { label: 'Declined',     bg: '#F3F4F6', fg: '#6B7280' },
};
export const INVITE_SOURCE = { email: 'Invited by email', careers: 'Applied on careers page', sourced: 'Sourced resume', rescue: 'Rescued from pool', retake: 'Retake', preview: 'Preview' };
export const isInviteExpired = (inv) => !!inv && !['SUBMITTED', 'DECLINED', 'ABANDONED', 'RENEWED', 'EXPIRED'].includes(inv.status) && Date.now() > (Number(inv.expiresAt) || 0);
export const inviteStatusOf = (inv) => (isInviteExpired(inv) ? 'EXPIRED' : inv?.status || 'SENT');
export const inviteUrl = (token) => `${window.location.origin}${window.location.pathname}#/a/${token}`;
export const careersUrl = (oppId) => `${window.location.origin}${window.location.pathname}#/careers/${oppId}`;
export const nameFromEmail = (e = '') => {
  const local = String(e).trim().split('@')[0] || '';
  const parts = local.split(/[._\-+]+/).filter(Boolean).map((x) => x.replace(/\d+$/, '')).filter(Boolean);
  return (parts.length ? parts : [local]).map((x) => x[0].toUpperCase() + x.slice(1).toLowerCase()).join(' ') || 'Candidate';
};
export const emailFromName = (n = '') => String(n).replace(/^Dr\.?\s*/i, '').toLowerCase().replace(/[^a-z ]/g, '').trim().replace(/\s+/g, '.') + '@email.com';
const DEFAULT_RESUME_PARAMS = [{ label: 'Skills match', weight: 50, min: 0 }, { label: 'Work experience', weight: 50, min: 0 }];

/* The resume gate. Pure: (opportunity, applicant) → { fit, pass, reason, threshold, params, matched, missing }.
   Reads the resume module exactly as the builder saves it — weighted parameters, per-parameter minimum, pass threshold,
   must-have skills + knockout. Skill match is a real text match when resume text is available; everything else is a
   stable per-applicant score (same applicant → same verdict), so the analyser can be swapped in later without UI changes. */
export function screenResume(opp, { name = '', email = '', resumeText = '' } = {}, { fitThreshold = 60 } = {}) {
  const m = (opp?.assessment?.modules || []).find((x) => x.key === 'resume') || {};
  const params = (m.resumeParams && m.resumeParams.length ? m.resumeParams : DEFAULT_RESUME_PARAMS);
  const gateNum = parseInt((/(\d{2,3})/.exec(m.gate || '') || [])[1], 10);
  const threshold = Number(m.passThreshold) || (gateNum >= 30 && gateNum <= 100 ? gateNum : 0) || fitThreshold;
  const must = (m.skills && m.skills.length ? m.skills : (opp?.skills || []).slice(0, 3)).filter(Boolean);
  const seed = `${name}|${email}`.toLowerCase();
  const text = String(resumeText || '').toLowerCase();
  const hasText = text.length > 80;
  const hits = must.map((skill) => ({ skill, found: hasText ? text.includes(String(skill).toLowerCase()) : (hashNum(seed + '|' + skill) % 100) >= 7 }));
  const matched = hits.filter((h) => h.found).map((h) => h.skill);
  const missing = hits.filter((h) => !h.found).map((h) => h.skill);
  const scored = params.map((p) => {
    const isSkills = /skill/i.test(p.label) && must.length > 0;
    const score = isSkills ? Math.round((matched.length / must.length) * 100) : 48 + (hashNum(seed + '|' + p.label) % 49);
    return { label: p.label, weight: Number(p.weight) || 0, min: Number(p.min) || 0, score };
  });
  const totalW = scored.reduce((a, b) => a + b.weight, 0) || 100;
  const fit = Math.round(scored.reduce((a, b) => a + b.weight * b.score, 0) / totalW);
  const knockout = (m.knockout ?? true) && missing.length > 0;
  const belowMin = scored.filter((p) => p.min > 0 && p.score < p.min);
  const pass = !knockout && belowMin.length === 0 && fit >= threshold;
  const reason = knockout ? `Missing must-have: ${missing[0]}`
    : belowMin.length ? `${belowMin[0].label} below minimum (${belowMin[0].score} < ${belowMin[0].min})`
    : fit < threshold ? `Below fit threshold (${threshold})` : undefined;
  return { fit, pass, reason, threshold, params: scored, matched, missing };
}

export const CLIENT_STATUS = {
  INVITE_PENDING: { label: 'Invite pending', bg: '#DBEAFE', fg: '#1E40AF', desc: 'Organization exists; primary owner has not activated yet.' },
  ACTIVE:         { label: 'Active',         bg: '#DCFCE7', fg: '#15803D', desc: 'Owner activated. Can use the portal and create drafts — 0 credits does not deactivate.' },
  SUSPENDED:      { label: 'Suspended',      bg: '#FEE2E2', fg: '#B91C1C', desc: 'Temporary administrative block. Data preserved, new activity restricted.' },
  OFFBOARDING:    { label: 'Offboarding',    bg: '#FFEDD5', fg: '#C2410C', desc: 'Permanent closure initiated. New work stops; running work finishes safely.' },
  DEACTIVATED:    { label: 'Deactivated',    bg: '#F3F4F6', fg: '#6B7280', desc: 'Workspace closed; export provided; retention period pending.' },
  RETENTION:      { label: 'Retention',      bg: '#EDE9FE', fg: '#6D28D9', desc: 'Data held for the configured retention period (legal hold may apply).' },
  DELETED:        { label: 'Deleted / anonymised', bg: '#F3F4F6', fg: '#9CA3AF', desc: 'Eligible personal data deleted or anonymised.' },
};

export const WALLET_STATE = {
  HEALTHY:                { label: 'Healthy',         bg: '#DCFCE7', fg: '#15803D' },
  LOW_BALANCE:            { label: 'Low balance',     bg: '#FEF3C7', fg: '#B45309' },
  ZERO:                   { label: 'Zero balance',    bg: '#F3F4F6', fg: '#6B7280' },
  OVERDRAFT:              { label: 'Overdraft',       bg: '#FEE2E2', fg: '#B91C1C' },
  BLOCKED_FOR_NEW_USAGE:  { label: 'Blocked (new usage)', bg: '#14212A', fg: '#FFFFFF' },
};

export const LEDGER_TYPE = {
  PURCHASE:          { label: 'Purchase',          sign: +1, bg: '#DCFCE7', fg: '#15803D', desc: 'Client buys credits' },
  ADMIN_GRANT:       { label: 'Admin grant',       sign: +1, bg: '#EDE9FE', fg: '#6D28D9', desc: 'Manual / free allocation by Admin' },
  CONSUMPTION:       { label: 'Consumption',       sign: -1, bg: '#EFF6FF', fg: '#1E40AF', desc: 'Actual service usage' },
  RESERVE:           { label: 'Reserve / hold',    sign: 0,  bg: '#FEF3C7', fg: '#B45309', desc: 'Credits protected before a paid module starts' },
  SETTLEMENT:        { label: 'Settlement',        sign: -1, bg: '#E0F2FE', fg: '#0369A1', desc: 'Consume actual usage, release unused reserve' },
  RESERVE_RELEASED:  { label: 'Hold released',     sign: 0,  bg: '#F1F5F9', fg: '#475569', desc: 'Held credits returned unused — the module never ran' },
  REFUND:            { label: 'Refund / reversal', sign: +1, bg: '#DCFCE7', fg: '#15803D', desc: 'Reverse invalid / system-failure charge' },
  OVERDRAFT:         { label: 'Overdraft',         sign: -1, bg: '#FEE2E2', fg: '#B91C1C', desc: 'Platform covers shortfall so a running evaluation can finish' },
  MANUAL_ADJUSTMENT: { label: 'Manual adjustment', sign: 0,  bg: '#F3F4F6', fg: '#374151', desc: 'Exceptional accounting correction (reason required)' },
  PAYMENT_REVERSAL:  { label: 'Payment reversal',  sign: -1, bg: '#FEE2E2', fg: '#B91C1C', desc: 'Chargeback or external reversal' },
};

export const TICKET_STATUS = {
  OPEN:              { label: 'Open',              bg: '#DBEAFE', fg: '#1E40AF' },
  IN_PROGRESS:       { label: 'In progress',       bg: '#FEF3C7', fg: '#B45309' },
  WAITING_ON_CLIENT: { label: 'Waiting on client', bg: '#EDE9FE', fg: '#6D28D9' },
  RESOLVED:          { label: 'Resolved',          bg: '#DCFCE7', fg: '#15803D' },
  CLOSED:            { label: 'Closed',            bg: '#F3F4F6', fg: '#6B7280' },
};
export const TICKET_FLOW = ['OPEN', 'IN_PROGRESS', 'WAITING_ON_CLIENT', 'RESOLVED', 'CLOSED'];

// Typical support cases (spec §09). Candidate issues reach Cuba via the client (Candidate → Client Support → Cuba Admin).
export const CASE_TYPES = [
  { value: 'assessment_crash',     label: 'Assessment crash',                 group: 'candidate' },
  { value: 'interview_failed',     label: 'Interview failed to start',        group: 'candidate' },
  { value: 'false_proctoring',     label: 'False proctoring violation',       group: 'candidate' },
  { value: 'resume_stuck',         label: 'Resume analysis stuck / failed',   group: 'candidate' },
  { value: 'result_missing',       label: 'Result not generated',             group: 'candidate' },
  { value: 'identity_failure',     label: 'Identity verification failure',    group: 'candidate' },
  { value: 'invite_expired',       label: 'Expired candidate invite',         group: 'candidate' },
  { value: 'credits_missing',      label: 'Payment succeeded but credits missing', group: 'billing' },
  { value: 'credit_dispute',       label: 'Wrong credit deduction dispute',   group: 'billing' },
  { value: 'account_access',       label: 'Account & access',                 group: 'account' },
  { value: 'other',                label: 'Other',                            group: 'other' },
];
export const caseLabel = (v) => (CASE_TYPES.find((c) => c.value === v) || {}).label || v;

export const MODULE_STATE = {
  ACTIVE:     { label: 'Active',     bg: '#DCFCE7', fg: '#15803D' },
  BETA:       { label: 'Beta',       bg: '#EDE9FE', fg: '#6D28D9' },
  DISABLED:   { label: 'Disabled',   bg: '#F3F4F6', fg: '#6B7280' },
  DEPRECATED: { label: 'Deprecated', bg: '#FFEDD5', fg: '#C2410C' },
};
export const ROLLOUT_STAGES = ['Internal', 'Beta', 'Selected Clients', 'GA'];

export const ADMIN_ROLES = [
  { id: 'super',      name: 'Super Admin',             desc: 'Full platform control' },
  { id: 'ops',        name: 'Operations Admin',        desc: 'Clients, usage, support, failed evaluations' },
  { id: 'finance',    name: 'Finance Admin',           desc: 'Payments, credits, refunds, ledger, balances' },
  { id: 'support',    name: 'Support Admin',           desc: 'Tickets and operational recovery' },
  { id: 'compliance', name: 'Compliance / Audit Admin', desc: 'Audit, consent, privacy, retention, fairness' },
  { id: 'analyst',    name: 'Read-only / Analyst',     desc: 'Dashboard, analytics and reports only' },
];
export const roleName = (id) => (ADMIN_ROLES.find((r) => r.id === id) || {}).name || id;

/* action-level permissions (spec §14: permissions are action-level, not only page-level) */
export const PERMISSIONS = {
  'client.create':        ['super', 'ops'],
  'client.edit':          ['super', 'ops'],
  'client.invite':        ['super', 'ops', 'support'],
  'client.suspend':       ['super', 'ops'],
  'client.reinstate':     ['super', 'ops'],
  'client.offboard':      ['super'],
  'client.export':        ['super', 'ops', 'compliance'],
  'wallet.addCredits':    ['super', 'finance'],
  'wallet.refund':        ['super', 'finance'],
  'wallet.adjust':        ['super', 'finance'],
  'wallet.overdraft':     ['super', 'finance'],
  'wallet.threshold':     ['super', 'finance', 'ops'],
  'wallet.freeze':        ['super', 'finance', 'ops'],
  'ratecard.edit':        ['super', 'finance'],
  'payment.record':       ['super', 'finance'],
  'usage.pause':          ['super', 'ops'],
  'usage.view':           ['super', 'ops', 'finance', 'support', 'compliance', 'analyst'],
  'ledger.view':          ['super', 'finance', 'ops', 'compliance', 'analyst'],
  'payments.view':        ['super', 'finance', 'analyst'],
  'ticket.manage':        ['super', 'ops', 'support'],
  'ticket.view':          ['super', 'ops', 'support', 'compliance', 'analyst'],
  'job.recover':          ['super', 'ops', 'support'],
  'job.reverseCredits':   ['super', 'finance', 'support'],
  'module.manage':        ['super', 'ops'],
  'module.emergency':     ['super', 'ops'],
  'integration.manage':   ['super', 'ops'],
  'compliance.view':      ['super', 'compliance', 'ops', 'analyst'],
  'compliance.manage':    ['super', 'compliance'],
  'compliance.legalHold': ['super', 'compliance'],
  'settings.manage':      ['super'],
  'admin.manage':         ['super'],
  'impersonate':          ['super', 'ops', 'support'],
  'analytics.view':       ['super', 'ops', 'finance', 'support', 'compliance', 'analyst'],
};
/* high-risk → reason + audit; critical → additionally re-authentication / second approval (spec §14) */
export const HIGH_RISK = ['client.suspend', 'client.offboard', 'wallet.refund', 'wallet.adjust', 'wallet.overdraft', 'wallet.freeze', 'module.emergency', 'job.reverseCredits', 'impersonate', 'compliance.legalHold', 'usage.pause', 'client.export'];
export const CRITICAL = ['client.offboard', 'wallet.adjust', 'wallet.overdraft'];

export const RECOVERY_ACTIONS = [
  { key: 'retry',    label: 'Retry processing' },
  { key: 'resend',   label: 'Resend link' },
  { key: 'extend',   label: 'Extend expiry' },
  { key: 'reset',    label: 'Reset attempt' },
  { key: 'retake',   label: 'Allow retake' },
  { key: 'resume',   label: 'Resume evaluation' },
  { key: 'reverse',  label: 'Reverse credits', perm: 'job.reverseCredits' },
  { key: 'escalate', label: 'Escalate' },
];
export const JOB_KINDS = {
  RESUME_PARSE_FAILED:  { label: 'Failed resume parsing',   color: '#C2410C' },
  STUCK_ASSESSMENT:     { label: 'Stuck assessment',        color: '#B45309' },
  STUCK_INTERVIEW:      { label: 'Stuck AI interview',      color: '#B45309' },
  AI_PROVIDER_FAILURE:  { label: 'AI provider failure',     color: '#B91C1C' },
  PENDING_SCORE:        { label: 'Pending score generation', color: '#1E40AF' },
  NOTIFICATION_FAILURE: { label: 'Notification / email failure', color: '#6D28D9' },
};

export const DATA_CATEGORIES = ['Resume / Profile', 'Assessment Answers', 'Interview Transcript', 'Audio / Video', 'Proctoring Evidence', 'Identity / Biometric Data', 'Scores / Reports'];
export const NOTIF_CATEGORIES = ['Client / Account', 'Credits & Billing', 'Evaluation / Operations', 'Support', 'Compliance / Security', 'Platform'];
export const NOTIF_SEVERITY = {
  INFO:     { label: 'Info',     color: '#056FD4', bg: '#EFF6FF' },
  WARNING:  { label: 'Warning',  color: '#D97706', bg: '#FFFBEB' },
  CRITICAL: { label: 'Critical', color: '#DC2626', bg: '#FEF2F2' },
  RESOLVED: { label: 'Resolved', color: '#16A34A', bg: '#F0FDF4' },
};

/* ──────────────────────────── pure wallet helpers ──────────────────────────── */
export function walletStateOf(w) {
  if (!w) return 'ZERO';
  if (w.frozen) return 'BLOCKED_FOR_NEW_USAGE';
  if (w.balance < 0) return 'OVERDRAFT';
  const available = w.balance - (w.reserved || 0);
  if (w.balance === 0) return 'ZERO';
  if (available <= (w.lowBalanceThreshold ?? DEFAULTS.lowBalanceThreshold)) return 'LOW_BALANCE';
  return 'HEALTHY';
}
/* derived wallet view: balance / reserved / available / outstanding / overdraftLimit / state */
export function walletOf(client) {
  const w = client?.wallet || { balance: 0, reserved: 0, overdraftLimit: DEFAULTS.overdraftLimit, lowBalanceThreshold: DEFAULTS.lowBalanceThreshold, frozen: false, lastTopUp: null };
  const available = Math.max(0, w.balance - (w.reserved || 0));
  const outstanding = w.balance < 0 ? -w.balance : 0;
  return { ...w, available, outstanding, state: walletStateOf(w) };
}
/* Billing may block the NEXT paid evaluation; never a running one. Overdraft limit governs whether new work may start. */
export function canStartPaidWork(client, cost = 0) {
  const w = walletOf(client);
  if (client?.status !== 'ACTIVE') return { ok: false, reason: `Account is ${CLIENT_STATUS[client?.status]?.label || client?.status} — new evaluations cannot start.` };
  if (client?.paused) return { ok: false, reason: 'Usage temporarily paused by Cuba Admin.' };
  if (w.frozen) return { ok: false, reason: 'Wallet is frozen — new paid usage is blocked until Cuba Admin unfreezes it.' };
  if (w.balance < 0) return { ok: false, reason: `Outstanding balance of ${fmtCr(w.outstanding)}. Top up to clear the debt before new evaluations start.` };
  if (w.available - cost < -w.overdraftLimit) return { ok: false, reason: `Needs ~${fmtCr(cost)} but only ${fmtCr(w.available)} available (overdraft limit ${fmtCr(w.overdraftLimit)}).` };
  return { ok: true, reason: '' };
}
/* Funding guidance (spec §04): a safety requirement, NOT a pre-charge. */
export function estimateFunding(opp, rateCard, settings) {
  const s = settings?.credits || DEFAULTS;
  const target = Number(opp?.requiredPositions) || 0;
  const rate = (k) => (rateCard || []).find((r) => r.key === k)?.credits || 0;
  const resumeCap = target * (s.fundingResumeX ?? DEFAULTS.fundingResumeX);
  const fullCap = target * (s.fundingFullX ?? DEFAULTS.fundingFullX);
  const mods = (opp?.assessment?.modules || []).filter((m) => m.key !== 'resume');
  const perCandidate = mods.reduce((a, m) => a + rate(m.key), 0) + rate('proctoring');
  const resumeCredits = resumeCap * rate('resume');
  const fullCredits = fullCap * perCandidate;
  return { target, resumeCap, fullCap, perCandidate, resumeCredits, fullCredits, total: resumeCredits + fullCredits };
}

/* weighted score derived from a candidate's sub-scores + the opportunity's rank weights */
export function weightedScore(cand, weights) {
  if (!weights?.length || !cand?.scores) return cand?.weighted ?? 0;
  const total = weights.reduce((a, w) => a + (Number(w.w) || 0), 0) || 100;
  const sum = weights.reduce((a, w) => a + (Number(w.w) || 0) * (Number(cand.scores[w.label]) || 0), 0);
  return Math.round((sum / total) * 10) / 10;
}
export function ranked(cands, weights) {
  return [...cands].sort((a, b) => weightedScore(b, weights) - weightedScore(a, weights));
}

/* ──────────────────────────── ids / clock (defined before the seeds need them) ──────────────────────────── */
const POOL_NAMES = ['Aarav Kulkarni', 'Meera Sundaram', 'Kabir Anand', 'Nandini Rao', 'Yash Trivedi', 'Zoya Farooqui', 'Devansh Mehta', 'Pallavi Joshi', 'Rehan Malik', 'Shreya Ghosh', 'Aditya Rane', 'Kavya Nambiar', 'Nikhil Bose', 'Tanvi Deshpande', 'Rohan Iyer', 'Ishaan Verma'];
let poolNameSeq = 0;
let nextOppId = 3;
let nextClientSeq = 8;
let auditSeq = 120;
let ledgerSeq = 10262;
let paySeq = 3041;
let ticketSeq = 1064;
let jobSeq = 8812;
let drSeq = 221;
let ovSeq = 3;
let ntSeq = 13;
const rnd = () => Math.random().toString(36).slice(2, 7);
export const nowStamp = () => { try { const d = new Date(); return d.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).replace(/ /g, ' ') + ' ' + d.toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit', hour12: false }); } catch { return 'just now'; } };
export const todayStamp = () => { try { return new Date().toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }); } catch { return 'today'; } };

/* ──────────────────────────── provenance builder (spec §11 reproducibility) ────────────────────────────
   Pure snapshot of the config a candidate was scored under, taken from the opportunity's CURRENT state.
   It is called ONCE per candidate — at scoring time (recordCandidateResult) or at module init for the
   seeds — and stored on the row as `row.provenance`, so later assessment edits can never rewrite history. */
const buildProvenance = (opp, cand) => ({
  assessmentVersion: `asmt_${opp?.id}.${opp?.assessment?.version || 'v1'}`,
  rubricVersion: `rubric.${opp?.assessment?.version || 'v1'}`,
  weights: (opp?.assessment?.weights || []).map((w) => ({ ...w })),
  thresholds: { ...(opp?.criteria || {}) },
  models: [
    { pipeline: 'Resume match', model: 'embeddings', version: 'v1.3', prompt: 'p-rm-07' },
    { pipeline: 'Assessment scoring', model: 'llama-3.3-70b', version: 'v2.1', prompt: 'p-as-12' },
    { pipeline: 'Interview asker', model: 'llama-3.3-70b', version: 'v3.0', prompt: 'p-iv-19' },
    { pipeline: 'Interview judge', model: 'claude (separate judge)', version: 'v3.0', prompt: 'p-jd-05' },
  ],
  evaluatedAt: (cand?.clearedAt || todayStamp()) + ' 16:42',
  proctoring: { config: 'camera + mic + tab-switch', evidence: '12 snapshots · 0 flags', identity: 'face match 0.97 · consent v3' },
  consentVersion: 'v3',
});

/* ──────────────────────────── opportunities / candidates ──────────────────────────── */
const SEED_OPPS = [
  {
    id: '1', clientId: 'cl1', title: 'Software Developer', status: 'OPEN', location: 'Delhi, India', workMode: 'On-site',
    roleType: 'Full-time', department: 'SaaS / Tech', requiredPositions: 10, cleared: 6, inPipeline: 23,
    funnel: { applied: 120, screening: 84, assessment: 41, interview: 18, cleared: 6 },
    closingDate: '2026-09-30', openedDate: '2026-08-04',
    skills: ['JavaScript', 'ReactJs', 'NodeJs', 'ExpressJs', 'DSA', 'MongoDB', 'Mongoose'],
    languages: ['English', 'Hindi'],
    jobDescription: 'We are looking for a Software Developer passionate about building scalable, user-friendly applications — developing and maintaining web apps and backend services, writing clean reusable code, and collaborating across the team.',
    criteria: { minExperienceYears: 3, minEducation: "Graduate (Bachelor's)", minCefrLevel: 'C1', minTypingWpm: 40, minTypingAccuracy: 90, minAssessmentScore: 80, minInterviewScore: 80 },
    assessment: {
      version: 'v3',
      modules: [
        { key: 'resume', skills: ['JavaScript', 'NodeJs', 'MongoDB', 'DSA'], nQ: 0, rubric: ['Skill match vs JD', 'Relevant experience'], gate: 'Fit ≥ 60 · knockout if must-have missing', weight: 10 },
        { key: 'coding', skills: ['JavaScript', 'DSA'], nQ: 2, rubric: ['Correctness', 'Problem solving', 'Code quality'], gate: 'Reject <60 · Review 60–69 · Advance ≥70', weight: 30 },
        { key: 'written', skills: ['NodeJs', 'MongoDB'], nQ: 5, rubric: ['Domain knowledge', 'Written communication'], gate: 'Advance ≥ 60', weight: 20 },
        { key: 'interview', skills: ['JavaScript', 'NodeJs', 'System design'], nQ: 12, rubric: ['Domain', 'Communication', 'Composure'], gate: 'Advance ≥ 65', weight: 30, languages: ['English', 'Hindi'] },
        { key: 'typing', skills: [], nQ: 0, rubric: [], gate: '40 WPM · 90% accuracy (gate only)', weight: 0 },
      ],
      weights: [{ label: 'Coding', w: 30 }, { label: 'AI Interview', w: 30 }, { label: 'Written', w: 20 }, { label: 'Resume-fit', w: 10 }, { label: 'Integrity', w: 10 }],
    },
  },
  {
    id: '2', clientId: 'cl1', title: 'Customer Support (Tech)', status: 'OPEN', location: 'Remote', workMode: 'Remote',
    roleType: 'Full-time', department: 'Operations', requiredPositions: 50, cleared: 31, inPipeline: 64,
    funnel: { applied: 500, screening: 310, assessment: 150, interview: 70, cleared: 31 },
    closingDate: '2026-09-15', openedDate: '2026-07-28',
    skills: ['Communication', 'Active Listening', 'Problem Solving', 'English', 'Hindi', 'CRM'],
    languages: ['English', 'Hindi'],
    jobDescription: 'We are hiring Tech Customer-Support Agents to help customers resolve issues with empathy and speed across chat and voice.',
    criteria: { minExperienceYears: 0, minEducation: 'Any', minCefrLevel: 'B2', minTypingWpm: 30, minTypingAccuracy: 90, minAssessmentScore: 60, minInterviewScore: 60 },
    assessment: {
      version: 'v2',
      modules: [
        { key: 'resume', skills: ['Communication', 'English', 'Problem Solving'], nQ: 0, rubric: ['Skill match vs JD'], gate: 'Fit ≥ 50 · knockout if no English', weight: 0 },
        { key: 'language', skills: ['Speaking', 'Listening', 'Reading', 'Writing'], nQ: 0, rubric: ['Fluency', 'Comprehension'], gate: 'CEFR ≥ B2', weight: 30, languages: ['English', 'Hindi'] },
        { key: 'typing', skills: [], nQ: 0, rubric: [], gate: '30 WPM · 90% accuracy', weight: 5 },
        { key: 'sjt', skills: ['Customer handling', 'Policy'], nQ: 6, rubric: ['Judgement', 'Empathy'], gate: 'Advance ≥ 60', weight: 20 },
        { key: 'simulation', skills: ['Live chat'], nQ: 1, rubric: ['Resolution', 'Tone'], gate: 'Advance ≥ 60', weight: 20 },
        { key: 'interview', skills: ['Communication', 'Empathy'], nQ: 8, rubric: ['Communication', 'Composure'], gate: 'Advance ≥ 60', weight: 15, languages: ['English', 'Hindi', 'Tamil'] },
      ],
      weights: [{ label: 'Language', w: 30 }, { label: 'SJT', w: 20 }, { label: 'Simulation', w: 20 }, { label: 'AI Interview', w: 15 }, { label: 'Integrity', w: 10 }, { label: 'Typing', w: 5 }],
    },
  },
  {
    id: '3', clientId: 'cl1', title: 'General Physician', status: 'OPEN', location: 'Bangalore', workMode: 'On-site',
    roleType: 'Full-time', department: 'Healthcare', requiredPositions: 8, cleared: 3, inPipeline: 12,
    funnel: { applied: 90, screening: 34, assessment: 20, interview: 9, cleared: 3 },
    closingDate: '2026-09-05', openedDate: '2026-07-30',
    skills: ['MBBS', 'Medical Council Registration', 'Internal Medicine', 'Patient Communication'],
    languages: ['English', 'Kannada', 'Hindi'],
    jobDescription: 'Seeking General Physicians (MBBS + valid registration) for internal medicine and patient care.',
    criteria: { minExperienceYears: 1, minEducation: "Graduate (Bachelor's)", minCefrLevel: 'B2', minTypingWpm: 0, minTypingAccuracy: 0, minAssessmentScore: 70, minInterviewScore: 65 },
    assessment: {
      version: 'v1',
      modules: [
        { key: 'resume', skills: ['MBBS', 'License', 'Internal Medicine'], nQ: 0, rubric: ['Credential check'], gate: 'Hard knockout if MBBS/license missing · Fit ≥ 65', weight: 0 },
        { key: 'mcq', skills: ['Internal Medicine', 'Diagnostics', 'Pharmacology'], nQ: 30, rubric: ['Accuracy'], gate: 'Advance ≥ 70', weight: 35 },
        { key: 'sjt', skills: ['Clinical judgement', 'Ethics'], nQ: 8, rubric: ['Diagnosis', 'Safety', 'Ethics'], gate: 'Advance ≥ 70', weight: 30 },
        { key: 'interview', skills: ['Communication', 'Bedside manner', 'Ethics'], nQ: 10, rubric: ['Communication', 'Composure', 'Ethics'], gate: 'Advance ≥ 65', weight: 20, languages: ['English', 'Kannada', 'Hindi'] },
      ],
      weights: [{ label: 'Medical Knowledge', w: 35 }, { label: 'Clinical Judgement', w: 30 }, { label: 'AI Interview', w: 20 }, { label: 'Integrity', w: 15 }],
    },
  },
];

/* Raw seed rows. `weighted` values here are provisional — they are recomputed below from each
   opportunity's actual rank weights so the number on screen can never diverge from the formula. */
const RAW_SEED_CANDIDATES = {
  '1': [
    { id: 'c1', name: 'Arjun Mehta', weighted: 81.2, cefr: 'C1', wpm: 61, exp: '3 yrs', clearedAt: '22 Aug 2026', scores: { Coding: 88, 'AI Interview': 80, Written: 74, 'Resume-fit': 82, Integrity: 98 } },
    { id: 'c2', name: 'Priya Sharma', weighted: 78.9, cefr: 'C1', wpm: 52, exp: '4 yrs', clearedAt: '22 Aug 2026', scores: { Coding: 82, 'AI Interview': 76, Written: 71, 'Resume-fit': 78, Integrity: 95 } },
    { id: 'c3', name: 'Sneha Reddy', weighted: 77.4, cefr: 'B2', wpm: 48, exp: '5 yrs', clearedAt: '21 Aug 2026', scores: { Coding: 80, 'AI Interview': 79, Written: 70, 'Resume-fit': 75, Integrity: 96 } },
    { id: 'c4', name: 'Karan Singh', weighted: 74.8, cefr: 'B2', wpm: 55, exp: '2 yrs', clearedAt: '21 Aug 2026', scores: { Coding: 79, 'AI Interview': 72, Written: 73, 'Resume-fit': 71, Integrity: 94 } },
    /* Divya's AI Interview score is PENDING (judge backlog · JOB-8811 · 80 cr held on LX-10261) — her
       weighted score is computed over the modules she actually has until the score lands. */
    { id: 'c5', name: 'Divya Nair', weighted: 73.2, cefr: 'C1', wpm: 44, exp: '3 yrs', clearedAt: '20 Aug 2026', scores: { Coding: 71, Written: 69, 'Resume-fit': 80, Integrity: 97 }, pending: { module: 'AI Interview', jobId: 'JOB-8811' } },
    { id: 'c6', name: 'Rohit Verma', weighted: 71.5, cefr: 'B2', wpm: 50, exp: '4 yrs', clearedAt: '20 Aug 2026', scores: { Coding: 74, 'AI Interview': 70, Written: 68, 'Resume-fit': 73, Integrity: 92 } },
  ],
  '2': [
    { id: 'd1', name: 'Rahul Verma', weighted: 78.6, cefr: 'B2', wpm: 38, exp: '1 yr', clearedAt: '21 Aug 2026', scores: { Language: 78, SJT: 80, Simulation: 76, 'AI Interview': 79, Integrity: 96, Typing: 82 } },
    { id: 'd2', name: 'Aisha Khan', weighted: 76.2, cefr: 'C1', wpm: 41, exp: '2 yrs', clearedAt: '21 Aug 2026', scores: { Language: 82, SJT: 74, Simulation: 72, 'AI Interview': 77, Integrity: 95, Typing: 88 } },
    { id: 'd3', name: 'Vikram Das', weighted: 72.9, cefr: 'B2', wpm: 35, exp: '6 mo', clearedAt: '20 Aug 2026', scores: { Language: 71, SJT: 76, Simulation: 70, 'AI Interview': 73, Integrity: 94, Typing: 79 } },
    { id: 'd4', name: 'Fatima Sheikh', weighted: 71.1, cefr: 'B2', wpm: 44, exp: '1 yr', clearedAt: '19 Aug 2026', scores: { Language: 70, SJT: 72, Simulation: 71, 'AI Interview': 70, Integrity: 93, Typing: 90 } },
  ],
  '3': [
    { id: 'e1', name: 'Dr. Ananya Iyer', weighted: 82.5, cefr: 'C1', wpm: 0, exp: '3 yrs', clearedAt: '22 Aug 2026', scores: { 'Medical Knowledge': 78, 'Clinical Judgement': 82, 'AI Interview': 80, Integrity: 97 } },
    { id: 'e2', name: 'Dr. Rohan Pillai', weighted: 79.8, cefr: 'C1', wpm: 0, exp: '5 yrs', clearedAt: '21 Aug 2026', scores: { 'Medical Knowledge': 81, 'Clinical Judgement': 78, 'AI Interview': 76, Integrity: 95 } },
    { id: 'e3', name: 'Dr. Kavya Menon', weighted: 76.4, cefr: 'B2', wpm: 0, exp: '2 yrs', clearedAt: '20 Aug 2026', scores: { 'Medical Knowledge': 74, 'Clinical Judgement': 79, 'AI Interview': 74, Integrity: 96 } },
  ],
};

/* Snapshot pass at module init (spec §11): every seeded candidate gets
   (a) `weighted` recomputed from the opportunity's rank weights — filtered to the score labels the row
       actually has, so a pending module (Divya) is weighted over what exists instead of counting as 0;
   (b) a `provenance` object frozen from the opportunity's CURRENT (seed) config, so editing an
       assessment later cannot rewrite a seeded candidate's history either. */
const SEED_CANDIDATES = Object.fromEntries(Object.entries(RAW_SEED_CANDIDATES).map(([oppId, list]) => {
  const opp = SEED_OPPS.find((o) => o.id === oppId);
  return [oppId, list.map((c) => {
    const present = (opp?.assessment?.weights || []).filter((w) => c.scores?.[w.label] != null);
    return { ...c, weighted: weightedScore(c, present), provenance: buildProvenance(opp, c) };
  })];
}));

const SEED_POOL = {
  '1': [
    { id: 'p1', name: 'Priya Sharma', fit: 78, pass: true },
    { id: 'p2', name: 'Arjun Mehta', fit: 82, pass: true },
    { id: 'p3', name: 'Meena Iyer', fit: 58, pass: false, reason: 'Missing must-have: Node.js' },
    { id: 'p4', name: 'Sahil Gupta', fit: 41, pass: false, reason: 'Below fit threshold (60)' },
    { id: 'p5', name: 'Neha Patil', fit: 55, pass: false, reason: 'Skill not detected (resume formatting)' },
  ],
  '2': [
    { id: 'q1', name: 'Rahul Verma', fit: 64, pass: true },
    { id: 'q2', name: 'Sana Ali', fit: 71, pass: true },
    { id: 'q3', name: 'Manoj Kumar', fit: 38, pass: false, reason: 'No English proficiency detected' },
    { id: 'q4', name: 'Deepa Rao', fit: 52, pass: false, reason: 'Below fit threshold (50)' },
  ],
  '3': [
    { id: 'r1', name: 'Dr. Ananya Iyer', fit: 81, pass: true },
    { id: 'r2', name: 'Dr. Imran Q.', fit: 49, pass: false, reason: 'Valid registration not found' },
    { id: 'r3', name: 'Dr. S. Banerjee', fit: 55, pass: false, reason: 'License number entered wrong (rescue?)' },
  ],
};

/* ──────────────────────────── ADMIN: clients (tenants) ──────────────────────────── */
const OFFBOARDING_STEPS = [
  { key: 'initiate', label: 'Initiate offboarding with reason' },
  { key: 'stop', label: 'Stop new opportunities / evaluations / users' },
  { key: 'drain', label: 'Let running candidate evaluations complete safely' },
  { key: 'clear', label: 'Clear pending work, scoring, support, negative balance & payment issues' },
  { key: 'settle', label: 'Settle remaining credits per commercial policy' },
  { key: 'export', label: 'Provide eligible client data export' },
  { key: 'retention', label: 'Enter configured retention period' },
  { key: 'hold', label: 'Apply legal hold when required' },
  { key: 'purge', label: 'Delete / anonymise eligible personal data after retention' },
];

const mkWallet = (balance, reserved = 0, extra = {}) => ({ balance, reserved, overdraftLimit: DEFAULTS.overdraftLimit, lowBalanceThreshold: DEFAULTS.lowBalanceThreshold, frozen: false, lastTopUp: null, ...extra });
const mkUsage = (o = {}) => ({ candidates: 0, evaluations: 0, resumeAnalyses: 0, assessmentAttempts: 0, assessmentCompletions: 0, interviews: 0, interviewMinutes: 0, proctoringSessions: 0, failed: 0, creditsConsumed: 0, ...o });

const SEED_CLIENTS = [
  { id: 'cl1', tenantId: 'org_7f3a9c', name: 'Northstar Group', legalName: 'Northstar Group Pvt Ltd', country: 'India', website: 'northstargroup.com', industry: 'Technology & Services',
    owner: { name: 'Priya Nair', email: 'hr@northstargroup.com', phone: '+91 98450 11223', designation: 'Head of Talent Acquisition' },
    billing: { currency: 'INR', gstin: '29AABCF1234A1Z5', address: 'Bengaluru, KA' }, salesOwner: 'Rahul Bose (AE)', notes: 'Enterprise deal · quarterly credit purchases.',
    status: 'ACTIVE', since: '12 May 2026', wallet: mkWallet(12400, 800, { lastTopUp: '12 Aug 2026' }),
    usage: mkUsage({ candidates: 310, evaluations: 78, resumeAnalyses: 310, assessmentAttempts: 95, assessmentCompletions: 88, interviews: 24, interviewMinutes: 460, proctoringSessions: 88, failed: 3, creditsConsumed: 8400 }),
    oppsOpen: 3, seats: 6, moduleAccess: ['simulation'], paused: false, flags: [] },
  { id: 'cl2', tenantId: 'org_2b81de', name: 'Acme Cloud', legalName: 'Acme Cloud Technologies Ltd', country: 'India', website: 'acme.io', industry: 'SaaS',
    owner: { name: 'Neha Kapoor', email: 'talent@acme.io', phone: '+91 99000 45678', designation: 'VP People' },
    billing: { currency: 'INR', gstin: '27AAACA9876B1Z2', address: 'Pune, MH' }, salesOwner: 'Rahul Bose (AE)', notes: 'High-volume support hiring; asked for ATS webhook.',
    status: 'ACTIVE', since: '03 Apr 2026', wallet: mkWallet(58900, 2400, { overdraftLimit: 5000, lowBalanceThreshold: 2000, lastTopUp: '20 Aug 2026' }),
    usage: mkUsage({ candidates: 1220, evaluations: 300, resumeAnalyses: 1220, assessmentAttempts: 355, assessmentCompletions: 325, interviews: 103, interviewMinutes: 1905, proctoringSessions: 325, failed: 6, creditsConsumed: 42000 }),
    oppsOpen: 9, seats: 14, moduleAccess: ['simulation'], paused: false, flags: ['spike'] },
  { id: 'cl3', tenantId: 'org_9e44b0', name: 'Meridian Hospitals', legalName: 'Meridian Healthcare Pvt Ltd', country: 'India', website: 'meridian.health', industry: 'Healthcare',
    owner: { name: 'Dr. Sunil Rao', email: 'careers@meridian.health', phone: '+91 98860 77001', designation: 'Medical Director' },
    billing: { currency: 'INR', gstin: '29AACCM4455C1Z9', address: 'Bengaluru, KA' }, salesOwner: 'Anita Desai (AE)', notes: 'Pilot for physician hiring.',
    status: 'ACTIVE', since: '18 Jun 2026', wallet: mkWallet(420, 0, { lastTopUp: '02 Jul 2026' }),
    usage: mkUsage({ candidates: 210, evaluations: 44, resumeAnalyses: 210, assessmentAttempts: 52, assessmentCompletions: 49, interviews: 30, interviewMinutes: 540, proctoringSessions: 49, failed: 2, creditsConsumed: 5980 }),
    oppsOpen: 2, seats: 3, moduleAccess: [], paused: false, flags: [] },
  { id: 'cl4', tenantId: 'org_51c7aa', name: 'Zentro BPO', legalName: 'Zentro Business Services LLP', country: 'India', website: 'zentro.com', industry: 'BPO / Support',
    owner: { name: 'Karthik Menon', email: 'ops@zentro.com', phone: '+91 90000 12121', designation: 'Ops Head' },
    billing: { currency: 'INR', gstin: '33AAEFZ1122D1Z4', address: 'Chennai, TN' }, salesOwner: 'Anita Desai (AE)', notes: 'Started with promo credits; evaluating.',
    status: 'ACTIVE', since: '25 Jun 2026', wallet: mkWallet(0, 0, { lastTopUp: '25 Jun 2026' }),
    usage: mkUsage({ candidates: 320, evaluations: 60, resumeAnalyses: 320, assessmentAttempts: 70, assessmentCompletions: 60, interviews: 0, interviewMinutes: 0, proctoringSessions: 60, failed: 1, creditsConsumed: 2000 }),
    oppsOpen: 3, seats: 2, moduleAccess: [], paused: false, flags: [] },
  { id: 'cl5', tenantId: 'org_c0d3e1', name: 'NovaPay', legalName: 'NovaPay Fintech Pvt Ltd', country: 'India', website: 'novapay.in', industry: 'Fintech',
    owner: { name: 'Ritika Jain', email: 'people@novapay.in', phone: '+91 98100 33445', designation: 'HR Business Partner' },
    billing: { currency: 'INR', gstin: '07AAGCN6677E1Z1', address: 'Gurugram, HR' }, salesOwner: 'Rahul Bose (AE)', notes: 'Card payment failed twice in Aug.',
    status: 'ACTIVE', since: '14 Mar 2026', wallet: mkWallet(-1850, 0, { lastTopUp: '28 Jul 2026' }),
    usage: mkUsage({ candidates: 200, evaluations: 50, resumeAnalyses: 200, assessmentAttempts: 58, assessmentCompletions: 54, interviews: 18, interviewMinutes: 330, proctoringSessions: 54, failed: 3, creditsConsumed: 6850 }),
    oppsOpen: 4, seats: 5, moduleAccess: [], paused: false, flags: [] },
  { id: 'cl6', tenantId: 'org_ab12f9', name: 'BrightLearn', legalName: 'BrightLearn Education Pvt Ltd', country: 'India', website: 'brightlearn.co', industry: 'EdTech',
    owner: { name: 'Amit Saxena', email: 'hr@brightlearn.co', phone: '+91 98200 55667', designation: 'Head HR' },
    billing: { currency: 'INR', gstin: '', address: 'Mumbai, MH' }, salesOwner: 'Anita Desai (AE)', notes: 'Deal signed 20 Aug; owner yet to activate.',
    status: 'INVITE_PENDING', since: '20 Aug 2026', invitedAt: '20 Aug 2026', wallet: mkWallet(0, 0),
    usage: mkUsage(), oppsOpen: 0, seats: 0, moduleAccess: [], paused: false, flags: [] },
  { id: 'cl7', tenantId: 'org_6d0e22', name: 'Orbit Logistics', legalName: 'Orbit Logistics Pvt Ltd', country: 'India', website: 'orbitlogi.com', industry: 'Logistics',
    owner: { name: 'Sameer Khan', email: 'talent@orbitlogi.com', phone: '+91 97000 88990', designation: 'TA Lead' },
    billing: { currency: 'INR', gstin: '24AABCO3344F1Z7', address: 'Ahmedabad, GJ' }, salesOwner: 'Rahul Bose (AE)', notes: 'Chargeback raised on PAY-3028.',
    status: 'SUSPENDED', statusReason: 'Payment chargeback under review', suspendedAt: '19 Aug 2026', since: '02 Feb 2026', wallet: mkWallet(2600, 0, { frozen: true, lastTopUp: '11 Jul 2026' }),
    usage: mkUsage({ candidates: 96, evaluations: 22, resumeAnalyses: 96, assessmentAttempts: 27, assessmentCompletions: 25, interviews: 8, interviewMinutes: 145, proctoringSessions: 25, failed: 2, creditsConsumed: 2900 }),
    oppsOpen: 2, seats: 4, moduleAccess: [], paused: false, flags: [] },
  { id: 'cl8', tenantId: 'org_e4f5a6', name: 'Helix Retail', legalName: 'Helix Retail Ventures Ltd', country: 'India', website: 'helixretail.in', industry: 'Retail',
    owner: { name: 'Pooja Bhat', email: 'hr@helixretail.in', phone: '+91 96000 11223', designation: 'HR Manager' },
    billing: { currency: 'INR', gstin: '29AAHCH2211G1Z3', address: 'Bengaluru, KA' }, salesOwner: 'Anita Desai (AE)', notes: 'Client requested closure after hiring freeze.',
    status: 'OFFBOARDING', statusReason: 'Client-requested closure (hiring freeze)', since: '10 Jan 2026', wallet: mkWallet(310, 0, { lastTopUp: '05 May 2026' }),
    offboarding: { reason: 'Client-requested closure (hiring freeze)', startedAt: '15 Aug 2026', steps: OFFBOARDING_STEPS.map((s, i) => ({ ...s, done: i < 3 })) },
    usage: mkUsage({ candidates: 105, evaluations: 23, resumeAnalyses: 105, assessmentAttempts: 28, assessmentCompletions: 26, interviews: 6, interviewMinutes: 110, proctoringSessions: 26, failed: 1, creditsConsumed: 3100 }),
    oppsOpen: 0, seats: 3, moduleAccess: [], paused: true, flags: [] },
];

/* ──────────────────────────── ADMIN: rate card (credits per unit) ──────────────────────────── */
const SEED_RATE_CARD = [
  { key: 'resume',      name: 'Resume Analyser',   unit: 'per candidate',  credits: 2 },
  { key: 'mcq',         name: 'MCQ',               unit: 'per attempt',    credits: 5 },
  { key: 'written',     name: 'Written',           unit: 'per attempt',    credits: 8 },
  { key: 'coding',      name: 'Coding',            unit: 'per attempt',    credits: 15 },
  { key: 'sjt',         name: 'SJT',               unit: 'per attempt',    credits: 6 },
  { key: 'typing',      name: 'Typing',            unit: 'per attempt',    credits: 1 },
  { key: 'language',    name: 'Language',          unit: 'per attempt',    credits: 10 },
  { key: 'interview',   name: 'AI Interview',      unit: 'per interview',  credits: 80 },
  { key: 'proctoring',  name: 'Proctoring',        unit: 'per session',    credits: 5 },
  { key: 'personality', name: 'Personality',       unit: 'per attempt',    credits: 6 },
  { key: 'simulation',  name: 'Simulation',        unit: 'per attempt',    credits: 12 },
  { key: 'computer',    name: 'Computer Literacy', unit: 'per attempt',    credits: 3 },
];

/* ──────────────────────────── ADMIN: ledger (immutable) + payments (money) ──────────────────────────── */
// Every consumption traces Client → Opportunity → Candidate → Module → Usage → Rate → Credits
const L = (id, when, clientId, type, credits, balanceAfter, extra = {}) => ({ id, when, clientId, type, credits, balanceAfter, actor: 'System', ...extra });
const SEED_LEDGER = [
  L('LX-10262', '26 Aug 2026 09:41', 'cl1', 'SETTLEMENT', -74, 12400, { oppId: '1', oppTitle: 'Software Developer', candidate: 'Karan Singh', module: 'AI Interview', usage: '1 interview · 18 min', rate: '80 cr / interview', note: '74 used · 6 released', reserveRef: 'LX-10255' }),
  L('LX-10261', '26 Aug 2026 09:12', 'cl1', 'RESERVE', 0, 12474, { oppId: '1', oppTitle: 'Software Developer', candidate: 'Divya Nair', module: 'AI Interview', usage: 'hold before start', rate: '80 cr / interview', hold: 80 }),
  L('LX-10260', '26 Aug 2026 08:55', 'cl2', 'CONSUMPTION', -15, 58900, { oppId: 'a2', oppTitle: 'Backend Engineer', candidate: 'Ishaan Roy', module: 'Coding', usage: '1 attempt', rate: '15 cr / attempt' }),
  L('LX-10259', '25 Aug 2026 18:20', 'cl5', 'OVERDRAFT', -80, -1850, { oppId: 'n1', oppTitle: 'Risk Analyst', candidate: 'Tanvi Shah', module: 'AI Interview', usage: '1 interview · 21 min', rate: '80 cr / interview', note: 'Platform covered shortfall so a running interview could finish' }),
  L('LX-10258', '25 Aug 2026 17:02', 'cl5', 'CONSUMPTION', -5, -1770, { oppId: 'n1', oppTitle: 'Risk Analyst', candidate: 'Tanvi Shah', module: 'Proctoring', usage: '1 session', rate: '5 cr / session' }),
  L('LX-10257', '25 Aug 2026 15:44', 'cl3', 'CONSUMPTION', -80, 420, { oppId: '3', oppTitle: 'General Physician', candidate: 'Dr. Kavya Menon', module: 'AI Interview', usage: '1 interview · 24 min', rate: '80 cr / interview' }),
  L('LX-10256', '25 Aug 2026 11:30', 'cl1', 'REFUND', 80, 12474, { oppId: '1', oppTitle: 'Software Developer', candidate: 'Rohit Verma', module: 'AI Interview', reason: 'AI provider timeout — technical failure, not candidate failure', actor: 'Support Admin', ref: 'JOB-8807' }),
  L('LX-10255', '25 Aug 2026 10:05', 'cl1', 'RESERVE', 0, 12394, { oppId: '1', oppTitle: 'Software Developer', candidate: 'Karan Singh', module: 'AI Interview', usage: 'hold before start', rate: '80 cr / interview', hold: 80 }),
  L('LX-10254', '24 Aug 2026 16:10', 'cl4', 'CONSUMPTION', -2, 0, { oppId: 'z1', oppTitle: 'Chat Support Agent', candidate: 'Lakshmi P.', module: 'Resume Analyser', usage: '1 candidate', rate: '2 cr / candidate', note: 'Balance reached zero — new paid evaluations paused' }),
  L('LX-10253', '23 Aug 2026 12:00', 'cl7', 'PAYMENT_REVERSAL', -3000, 2600, { reason: 'Chargeback on PAY-3028', ref: 'PAY-3028', actor: 'Finance Admin' }),
  L('LX-10252', '22 Aug 2026 09:00', 'cl2', 'MANUAL_ADJUSTMENT', 500, 58915, { reason: 'Goodwill credit for Aug 19 latency incident', actor: 'Finance Admin' }),
  L('LX-10251', '20 Aug 2026 10:30', 'cl2', 'PURCHASE', 50000, 58415, { ref: 'PAY-3041', note: '₹5,00,000 · Razorpay', actor: 'System' }),
  L('LX-10250', '19 Aug 2026 14:12', 'cl1', 'CONSUMPTION', -8, 12394, { oppId: '1', oppTitle: 'Software Developer', candidate: 'Sneha Reddy', module: 'Written', usage: '1 attempt', rate: '8 cr / attempt' }),
  L('LX-10249', '12 Aug 2026 11:00', 'cl1', 'PURCHASE', 10000, 12402, { ref: 'PAY-3037', note: '₹1,00,000 · Bank transfer (offline)', actor: 'Finance Admin' }),
  L('LX-10248', '28 Jul 2026 16:40', 'cl5', 'PURCHASE', 5000, 5000, { ref: 'PAY-3031', note: '₹50,000 · Card', actor: 'System' }),
  L('LX-10247', '02 Jul 2026 10:00', 'cl3', 'PURCHASE', 6400, 6400, { ref: 'PAY-3024', note: '₹64,000 · Razorpay', actor: 'System' }),
  L('LX-10246', '25 Jun 2026 09:30', 'cl4', 'ADMIN_GRANT', 2000, 2000, { reason: 'Promotional / trial credits', actor: 'Super Admin' }),
  L('LX-10245', '11 Jul 2026 13:20', 'cl7', 'PURCHASE', 3000, 5600, { ref: 'PAY-3028', note: '₹30,000 · Card', actor: 'System' }),
];

const SEED_PAYMENTS = [
  { id: 'PAY-3041', clientId: 'cl2', date: '20 Aug 2026', amount: 500000, currency: 'INR', credits: 50000, method: 'Razorpay', status: 'SUCCEEDED', reference: 'INV-2081', note: '' },
  { id: 'PAY-3040', clientId: 'cl5', date: '18 Aug 2026', amount: 100000, currency: 'INR', credits: 10000, method: 'Card', status: 'FAILED', reference: 'INV-2079', note: 'Card declined (insufficient funds)' },
  { id: 'PAY-3039', clientId: 'cl5', date: '15 Aug 2026', amount: 100000, currency: 'INR', credits: 10000, method: 'Card', status: 'FAILED', reference: 'INV-2078', note: 'Issuer declined' },
  { id: 'PAY-3038', clientId: 'cl3', date: '14 Aug 2026', amount: 40000, currency: 'INR', credits: 4000, method: 'Bank transfer (offline)', status: 'PENDING', reference: 'INV-2077', note: 'Awaiting bank confirmation — credits not yet issued' },
  { id: 'PAY-3037', clientId: 'cl1', date: '12 Aug 2026', amount: 100000, currency: 'INR', credits: 10000, method: 'Bank transfer (offline)', status: 'SUCCEEDED', reference: 'INV-2075', note: 'Recorded manually by Finance' },
  { id: 'PAY-3031', clientId: 'cl5', date: '28 Jul 2026', amount: 50000, currency: 'INR', credits: 5000, method: 'Card', status: 'SUCCEEDED', reference: 'INV-2062', note: '' },
  { id: 'PAY-3028', clientId: 'cl7', date: '11 Jul 2026', amount: 30000, currency: 'INR', credits: 3000, method: 'Card', status: 'REVERSED', reference: 'INV-2055', note: 'Chargeback 23 Aug — credits reversed (LX-10253)' },
  { id: 'PAY-3024', clientId: 'cl3', date: '02 Jul 2026', amount: 64000, currency: 'INR', credits: 6400, method: 'Razorpay', status: 'SUCCEEDED', reference: 'INV-2049', note: '' },
];

/* ──────────────────────────── ADMIN: failed jobs / needs-attention queue ──────────────────────────── */
const SEED_JOBS = [
  { id: 'JOB-8812', clientId: 'cl2', oppId: 'a2', oppTitle: 'Backend Engineer', candidate: 'Ishaan Roy', kind: 'STUCK_INTERVIEW', module: 'AI Interview', detail: 'Room open 41 min, no audio frames after 12:04 — candidate connection dropped', since: '26 Aug 2026 12:04', creditsHeld: 80, status: 'OPEN', actions: [] },
  { id: 'JOB-8811', clientId: 'cl1', oppId: '1', oppTitle: 'Software Developer', candidate: 'Divya Nair', kind: 'PENDING_SCORE', module: 'AI Interview', detail: 'Judge model queue backlog — score not generated 22 min after call end', since: '26 Aug 2026 09:35', creditsHeld: 80, reserveRef: 'LX-10261', status: 'OPEN', actions: [] },
  { id: 'JOB-8810', clientId: 'cl3', oppId: '3', oppTitle: 'General Physician', candidate: 'Dr. Imran Q.', kind: 'RESUME_PARSE_FAILED', module: 'Resume Analyser', detail: 'Scanned PDF — OCR confidence 0.31, extraction failed', since: '25 Aug 2026 19:10', creditsHeld: 2, status: 'OPEN', actions: [] },
  { id: 'JOB-8809', clientId: 'cl5', oppId: 'n1', oppTitle: 'Risk Analyst', candidate: 'Tanvi Shah', kind: 'AI_PROVIDER_FAILURE', module: 'AI Interview', detail: 'Primary LLM provider 5xx for 6 min; fallback engaged late', since: '25 Aug 2026 18:02', creditsHeld: 80, status: 'OPEN', actions: [] },
  { id: 'JOB-8808', clientId: 'cl4', oppId: 'z1', oppTitle: 'Chat Support Agent', candidate: 'Lakshmi P.', kind: 'NOTIFICATION_FAILURE', module: 'Email', detail: 'Assessment link email bounced (mailbox full)', since: '24 Aug 2026 16:12', creditsHeld: 0, status: 'OPEN', actions: [] },
  { id: 'JOB-8807', clientId: 'cl1', oppId: '1', oppTitle: 'Software Developer', candidate: 'Rohit Verma', kind: 'AI_PROVIDER_FAILURE', module: 'AI Interview', detail: 'Provider timeout mid-interview', since: '25 Aug 2026 10:40', creditsHeld: 0, status: 'RECOVERED', actions: [{ key: 'reverse', when: '25 Aug 2026 11:30', by: 'Support Admin' }, { key: 'retake', when: '25 Aug 2026 11:31', by: 'Support Admin' }] },
  { id: 'JOB-8806', clientId: 'cl2', oppId: 'a1', oppTitle: 'Support Agent (Voice)', candidate: 'Meera S.', kind: 'STUCK_ASSESSMENT', module: 'SJT', detail: 'Tab closed at Q4/6; attempt locked', since: '24 Aug 2026 13:00', creditsHeld: 6, status: 'ESCALATED', actions: [{ key: 'escalate', when: '24 Aug 2026 15:10', by: 'Support Admin' }] },
];

/* ──────────────────────────── tickets (shared by client Support + admin desk) ──────────────────────────── */
const SEED_TICKETS = [
  { id: 'TKT-1064', clientId: 'cl2', subject: 'Candidate interview failed to start (Ishaan Roy)', caseType: 'interview_failed', priority: 'Urgent', status: 'OPEN', createdAt: '26 Aug 2026', updated: '26 Aug 2026', oppTitle: 'Backend Engineer', candidate: 'Ishaan Roy', raisedBy: 'client',
    messages: [{ from: 'client', text: 'Candidate reports the interview room opened but the AI never spoke. He waited 10 minutes.', timestamp: '26 Aug 2026 · 12:20 PM' }] },
  { id: 'TKT-1063', clientId: 'cl5', subject: 'Payment succeeded but credits missing', caseType: 'credits_missing', priority: 'Urgent', status: 'IN_PROGRESS', createdAt: '25 Aug 2026', updated: '26 Aug 2026', raisedBy: 'client',
    messages: [{ from: 'client', text: 'Our card payment of ₹1,00,000 shows as failed on your side but our bank debited it.', timestamp: '25 Aug 2026 · 4:10 PM' }, { from: 'support', text: 'We see two failed attempts (PAY-3039, PAY-3040). Finance is checking with the gateway for a pending capture.', timestamp: '26 Aug 2026 · 9:30 AM' }] },
  { id: 'TKT-1062', clientId: 'cl1', subject: 'False proctoring violation on Sneha Reddy', caseType: 'false_proctoring', priority: 'High', status: 'WAITING_ON_CLIENT', createdAt: '24 Aug 2026', updated: '25 Aug 2026', oppTitle: 'Software Developer', candidate: 'Sneha Reddy', raisedBy: 'client',
    messages: [{ from: 'client', text: 'Candidate flagged for "second person in frame" but she was alone — a poster on the wall.', timestamp: '24 Aug 2026 · 3:05 PM' }, { from: 'support', text: 'Reviewed the 3 snapshots — agree it is a poster. Could you confirm you want the integrity score restored to 100?', timestamp: '25 Aug 2026 · 10:15 AM' }] },
  { id: 'TKT-1061', clientId: 'cl3', subject: 'Resume analysis stuck for Dr. Imran Q.', caseType: 'resume_stuck', priority: 'Medium', status: 'OPEN', createdAt: '25 Aug 2026', updated: '25 Aug 2026', oppTitle: 'General Physician', candidate: 'Dr. Imran Q.', raisedBy: 'client',
    messages: [{ from: 'client', text: 'Resume shows "processing" since yesterday evening.', timestamp: '25 Aug 2026 · 7:30 PM' }] },
  { id: 'TKT-1058', clientId: 'cl1', subject: 'Wrong credit deduction — interview charged twice?', caseType: 'credit_dispute', priority: 'Medium', status: 'RESOLVED', createdAt: '22 Aug 2026', updated: '23 Aug 2026', oppTitle: 'Software Developer', candidate: 'Rohit Verma', raisedBy: 'client',
    messages: [{ from: 'client', text: 'Ledger shows a RESERVE and a CONSUMPTION for the same interview.', timestamp: '22 Aug 2026 · 11:00 AM' }, { from: 'support', text: 'A RESERVE is a hold, not a charge — the SETTLEMENT line consumed 74 and released 6. Net charge is one interview. Refund of 80 for the earlier failed attempt is on LX-10256.', timestamp: '23 Aug 2026 · 9:45 AM' }] },
  { id: 'TKT-1051', clientId: 'cl1', subject: 'Add a teammate as Recruiter', caseType: 'account_access', priority: 'Low', status: 'CLOSED', createdAt: '18 Aug 2026', updated: '19 Aug 2026', raisedBy: 'client',
    messages: [{ from: 'client', text: 'How do I invite a colleague with the Recruiter role?', timestamp: '18 Aug 2026 · 4:18 PM' }, { from: 'support', text: 'Profile → Team & roles → Invite teammate. Owners can assign Recruiter / Hiring Manager / Viewer.', timestamp: '19 Aug 2026 · 9:02 AM' }] },
];

/* ──────────────────────────── ADMIN: module catalog (what Cuba offers) ──────────────────────────── */
const SEED_MODULES = [
  { key: 'resume',      name: 'Resume Analyser',   scoring: 'rule + AI',              state: 'ACTIVE',     rollout: 'GA',               clientAccess: [], paused: false, version: 'v1.3', defaults: 'Fit threshold 50–70 · knockout on must-have' },
  { key: 'mcq',         name: 'MCQ',               scoring: 'auto',                   state: 'ACTIVE',     rollout: 'GA',               clientAccess: [], paused: false, version: 'v2.0', defaults: '10–40 questions · 60% pass' },
  { key: 'written',     name: 'Written',           scoring: 'AI rubric',              state: 'ACTIVE',     rollout: 'GA',               clientAccess: [], paused: false, version: 'v2.1', defaults: '3–8 questions · rubric ≥ 60' },
  { key: 'coding',      name: 'Coding',            scoring: 'test cases',             state: 'ACTIVE',     rollout: 'GA',               clientAccess: [], paused: false, version: 'v1.8', defaults: '1–3 problems · hidden tests' },
  { key: 'sjt',         name: 'SJT',               scoring: 'AI rubric',              state: 'ACTIVE',     rollout: 'GA',               clientAccess: [], paused: false, version: 'v1.4', defaults: '4–10 scenarios' },
  { key: 'typing',      name: 'Typing',            scoring: 'auto',                   state: 'ACTIVE',     rollout: 'GA',               clientAccess: [], paused: false, version: 'v1.0', defaults: 'WPM + accuracy gate' },
  { key: 'language',    name: 'Language',          scoring: 'auto + AI (CEFR)',       state: 'ACTIVE',     rollout: 'GA',               clientAccess: [], paused: false, version: 'v2.2', defaults: 'CEFR A2–C2 · 4 skills' },
  { key: 'interview',   name: 'AI Interview',      scoring: 'AI rubric · multilingual', state: 'ACTIVE',   rollout: 'GA',               clientAccess: [], paused: false, version: 'v3.0', defaults: '8–15 questions · 7 languages' },
  { key: 'proctoring',  name: 'Proctoring',        scoring: 'CV ensemble',            state: 'ACTIVE',     rollout: 'GA',               clientAccess: [], paused: false, version: 'v1.0', defaults: 'camera + mic + tab-switch' },
  { key: 'personality', name: 'Personality',       scoring: 'model',                  state: 'ACTIVE',     rollout: 'GA',               clientAccess: [], paused: false, version: 'v1.1', defaults: 'Big-5 · advisory only' },
  { key: 'simulation',  name: 'Simulation',        scoring: 'AI rubric',              state: 'BETA',       rollout: 'Selected Clients', clientAccess: ['cl1', 'cl2'], paused: false, version: 'v0.9', defaults: 'Live chat / roleplay' },
  { key: 'computer',    name: 'Computer Literacy', scoring: 'auto',                   state: 'ACTIVE',     rollout: 'GA',               clientAccess: [], paused: false, version: 'v1.0', defaults: 'Basic office tasks' },
  { key: 'custom',      name: 'Custom Questionnaire', scoring: 'manual',              state: 'DISABLED',   rollout: 'Internal',         clientAccess: [], paused: false, version: 'v0.2', defaults: '—' },
  { key: 'aptitude_v1', name: 'Aptitude (legacy v1)', scoring: 'auto',                state: 'DEPRECATED', rollout: 'GA',               clientAccess: [], paused: false, version: 'v1.0', defaults: 'Replaced by MCQ — no new opportunities' },
];

/* ──────────────────────────── ADMIN: integrations (provider abstraction) ──────────────────────────── */
const SEED_INTEGRATIONS = [
  { id: 'int_email',   group: 'platform', category: 'Email provider',     name: 'SendGrid',          role: 'primary',  status: 'CONNECTED',      enabled: true,  health: { latencyMs: 210, errorRate: 0.4, usage: '18.2k emails / mo', cost: 4200 },  lastTested: '26 Aug 2026 08:00', rotated: '01 Aug 2026' },
  { id: 'int_email2',  group: 'platform', category: 'Email provider',     name: 'Amazon SES',        role: 'fallback', status: 'CONNECTED',      enabled: true,  health: { latencyMs: 340, errorRate: 0.1, usage: '120 emails / mo',   cost: 60 },    lastTested: '26 Aug 2026 08:00', rotated: '01 Aug 2026' },
  { id: 'int_sms',     group: 'platform', category: 'SMS / WhatsApp',     name: 'Gupshup',           role: 'primary',  status: 'DEGRADED',       enabled: true,  health: { latencyMs: 1900, errorRate: 6.8, usage: '4.1k msgs / mo',  cost: 2900 },  lastTested: '26 Aug 2026 07:30', rotated: '15 Jul 2026' },
  { id: 'int_pay',     group: 'platform', category: 'Payment gateway',    name: 'Razorpay',          role: 'primary',  status: 'CONNECTED',      enabled: true,  health: { latencyMs: 480, errorRate: 1.2, usage: '₹9.4L / mo',      cost: 18800 }, lastTested: '25 Aug 2026 22:00', rotated: '10 Jun 2026' },
  { id: 'int_llm',     group: 'platform', category: 'LLM providers',      name: 'Groq (Llama 3.3 70B)', role: 'primary', status: 'CONNECTED',   enabled: true,  health: { latencyMs: 620, errorRate: 0.9, usage: '41M tokens / mo', cost: 61000 }, lastTested: '26 Aug 2026 09:00', rotated: '20 Aug 2026' },
  { id: 'int_llm2',    group: 'platform', category: 'LLM providers',      name: 'Anthropic Claude',  role: 'fallback', status: 'CONNECTED',      enabled: true,  health: { latencyMs: 1100, errorRate: 0.2, usage: '3.2M tokens / mo', cost: 14000 }, lastTested: '26 Aug 2026 09:00', rotated: '20 Aug 2026' },
  { id: 'int_stt',     group: 'platform', category: 'STT / TTS / Voice',  name: 'Sarvam AI',         role: 'primary',  status: 'CONNECTED',      enabled: true,  health: { latencyMs: 380, errorRate: 0.7, usage: '12.3k min / mo',  cost: 24600 }, lastTested: '26 Aug 2026 09:00', rotated: '05 Aug 2026' },
  { id: 'int_stt2',    group: 'platform', category: 'STT / TTS / Voice',  name: 'Deepgram',          role: 'fallback', status: 'CONNECTED',      enabled: true,  health: { latencyMs: 300, errorRate: 0.3, usage: '900 min / mo',    cost: 2100 },  lastTested: '26 Aug 2026 09:00', rotated: '05 Aug 2026' },
  { id: 'int_ocr',     group: 'platform', category: 'OCR',                name: 'EasyOCR (self-hosted)', role: 'primary', status: 'CONNECTED',  enabled: true,  health: { latencyMs: 2400, errorRate: 3.1, usage: '6.8k pages / mo', cost: 0 },     lastTested: '25 Aug 2026 20:00', rotated: '—' },
  { id: 'int_idv',     group: 'platform', category: 'Identity / proctoring vendor', name: 'HyperVerge', role: 'primary', status: 'CONNECTED',  enabled: true,  health: { latencyMs: 900, errorRate: 1.5, usage: '2.9k checks / mo', cost: 29000 }, lastTested: '26 Aug 2026 06:00', rotated: '12 Aug 2026' },
  { id: 'int_store',   group: 'platform', category: 'Storage / CDN / monitoring', name: 'S3 · CloudFront · Grafana', role: 'primary', status: 'CONNECTED', enabled: true, health: { latencyMs: 45, errorRate: 0.0, usage: '2.1 TB', cost: 21000 }, lastTested: '26 Aug 2026 09:00', rotated: '01 Jul 2026' },
  { id: 'int_ats',     group: 'client',   category: 'ATS',                name: 'Greenhouse',        role: null, status: 'NOT_CONFIGURED', enabled: false, health: null, lastTested: '—', rotated: '—', note: 'Client-facing · future' },
  { id: 'int_hrms',    group: 'client',   category: 'HRMS',               name: 'Darwinbox',         role: null, status: 'NOT_CONFIGURED', enabled: false, health: null, lastTested: '—', rotated: '—', note: 'Client-facing · future' },
  { id: 'int_webhook', group: 'client',   category: 'Webhooks',           name: 'Outbound webhooks', role: null, status: 'DISCONNECTED',   enabled: false, health: null, lastTested: '—', rotated: '—', note: 'Client-facing · future' },
  { id: 'int_sso',     group: 'client',   category: 'SSO',                name: 'SAML / OIDC',       role: null, status: 'NOT_CONFIGURED', enabled: false, health: null, lastTested: '—', rotated: '—', note: 'Client-facing · future' },
  { id: 'int_cal',     group: 'client',   category: 'Calendar / meeting tools', name: 'Google Calendar', role: null, status: 'NOT_CONFIGURED', enabled: false, health: null, lastTested: '—', rotated: '—', note: 'Client-facing · future' },
  { id: 'int_auto',    group: 'client',   category: 'Automation platforms', name: 'Zapier',          role: null, status: 'NOT_CONFIGURED', enabled: false, health: null, lastTested: '—', rotated: '—', note: 'Client-facing · future' },
];

/* ──────────────────────────── ADMIN: audit, compliance, provenance ──────────────────────────── */
const SEED_AUDIT = [
  { id: 'au120', when: '26 Aug 2026 09:41', actor: 'System', role: 'system', category: 'Credits', action: 'Settlement posted', resource: 'LX-10262 · Northstar Group', clientId: 'cl1' },
  { id: 'au119', when: '26 Aug 2026 09:12', actor: 'Northstar Group · Recruiter', role: 'client', category: 'Scoring', action: 'Candidate cleared', resource: 'Karan Singh · Software Developer', clientId: 'cl1' },
  { id: 'au118', when: '25 Aug 2026 18:20', actor: 'System', role: 'system', category: 'Credits', action: 'Overdraft used to finish running interview', resource: 'LX-10259 · NovaPay', clientId: 'cl5' },
  { id: 'au117', when: '25 Aug 2026 11:31', actor: 'Support Admin', role: 'support', category: 'Recovery', action: 'Allowed retake', resource: 'JOB-8807 · Rohit Verma', clientId: 'cl1', reason: 'Provider timeout — technical failure' },
  { id: 'au116', when: '25 Aug 2026 11:30', actor: 'Support Admin', role: 'support', category: 'Credits', action: 'Reversed credits (+80)', resource: 'JOB-8807 · Rohit Verma', clientId: 'cl1', reason: 'Provider timeout — technical failure' },
  { id: 'au115', when: '24 Aug 2026 17:05', actor: 'Northstar Group · Hiring Manager', role: 'client', category: 'Override', action: 'Human override: REVIEW → CLEARED', resource: 'Sneha Reddy · Software Developer', clientId: 'cl1', reason: 'Proctoring flag was a wall poster; verified by support' },
  { id: 'au114', when: '23 Aug 2026 12:00', actor: 'Finance Admin', role: 'finance', category: 'Credits', action: 'Payment reversal (−3,000)', resource: 'PAY-3028 · Orbit Logistics', clientId: 'cl7', reason: 'Chargeback' },
  { id: 'au113', when: '22 Aug 2026 09:00', actor: 'Finance Admin', role: 'finance', category: 'Credits', action: 'Manual adjustment (+500)', resource: 'Acme Cloud', clientId: 'cl2', reason: 'Goodwill for Aug 19 latency incident' },
  { id: 'au112', when: '20 Aug 2026 11:15', actor: 'Operations Admin', role: 'ops', category: 'Client', action: 'Created organization + invited owner', resource: 'BrightLearn', clientId: 'cl6' },
  { id: 'au111', when: '19 Aug 2026 16:40', actor: 'Super Admin', role: 'super', category: 'Client', action: 'Suspended client', resource: 'Orbit Logistics', clientId: 'cl7', reason: 'Payment chargeback under review' },
  { id: 'au110', when: '19 Aug 2026 16:41', actor: 'Super Admin', role: 'super', category: 'Credits', action: 'Wallet frozen', resource: 'Orbit Logistics', clientId: 'cl7', reason: 'Chargeback under review' },
  { id: 'au109', when: '18 Aug 2026 10:00', actor: 'Acme Cloud · Admin', role: 'client', category: 'Assessment config', action: 'Changed thresholds + weights', resource: 'Backend Engineer · asmt v4', clientId: 'cl2' },
  { id: 'au108', when: '15 Aug 2026 14:30', actor: 'Super Admin', role: 'super', category: 'Client', action: 'Started offboarding', resource: 'Helix Retail', clientId: 'cl8', reason: 'Client-requested closure (hiring freeze)' },
  { id: 'au107', when: '14 Aug 2026 09:20', actor: 'Operations Admin', role: 'ops', category: 'Module', action: 'Rollout → Selected Clients', resource: 'Simulation (beta)' },
  { id: 'au106', when: '12 Aug 2026 11:00', actor: 'Finance Admin', role: 'finance', category: 'Credits', action: 'Recorded offline payment + credits (+10,000)', resource: 'PAY-3037 · Northstar Group', clientId: 'cl1' },
  { id: 'au105', when: '10 Aug 2026 15:00', actor: 'Support Admin', role: 'support', category: 'Impersonation', action: 'Impersonated client workspace', resource: 'Meridian Hospitals', clientId: 'cl3', reason: 'Reproduce resume upload issue (TKT-1049)' },
  { id: 'au104', when: '08 Aug 2026 12:00', actor: 'Compliance Admin', role: 'compliance', category: 'Data request', action: 'Deletion request fulfilled', resource: 'candidate #4821 · Northstar Group', clientId: 'cl1' },
  { id: 'au103', when: '05 Aug 2026 10:00', actor: 'Super Admin', role: 'super', category: 'Integration', action: 'Set fallback provider', resource: 'LLM providers → Anthropic Claude' },
  { id: 'au102', when: '01 Aug 2026 09:00', actor: 'Super Admin', role: 'super', category: 'Settings', action: 'Updated low-balance default → 500 cr', resource: 'Settings · Credits & Billing' },
];

const SEED_DATA_REQUESTS = [
  { id: 'DR-221', type: 'DELETION',   subject: 'candidate #5012', clientId: 'cl2', requested: '25 Aug 2026', due: '24 Sep 2026', status: 'PENDING', legalHold: false },
  { id: 'DR-220', type: 'ACCESS',     subject: 'candidate #5104', clientId: 'cl5', requested: '24 Aug 2026', due: '23 Sep 2026', status: 'IN_PROGRESS', legalHold: false },
  { id: 'DR-219', type: 'EXPORT',     subject: 'Helix Retail (client export)', clientId: 'cl8', requested: '16 Aug 2026', due: '30 Aug 2026', status: 'IN_PROGRESS', legalHold: false },
  { id: 'DR-218', type: 'CORRECTION', subject: 'candidate #4990 (name spelling)', clientId: 'cl1', requested: '12 Aug 2026', due: '11 Sep 2026', status: 'FULFILLED', legalHold: false },
  { id: 'DR-217', type: 'DELETION',   subject: 'candidate #4821', clientId: 'cl1', requested: '20 Jul 2026', due: '19 Aug 2026', status: 'FULFILLED', legalHold: false },
  { id: 'DR-216', type: 'DELETION',   subject: 'candidate #4310 (Orbit)', clientId: 'cl7', requested: '18 Jul 2026', due: '17 Aug 2026', status: 'PENDING', legalHold: true, holdReason: 'Chargeback dispute — evidence retained' },
];
const SEED_CONSENT = [
  { version: 'v3', effective: '01 Aug 2026', summary: 'Adds AI-interview recording retention (180 days) + biometric identity check clause', signed: 3120, current: true },
  { version: 'v2', effective: '01 May 2026', summary: 'Adds proctoring evidence capture + candidate rights section', signed: 5840, current: false },
  { version: 'v1', effective: '15 Feb 2026', summary: 'Initial consent: assessment recording + data processing', signed: 2210, current: false },
];
const SEED_RETENTION = DATA_CATEGORIES.map((category, i) => ({ category, days: [365, 365, 180, 180, 90, 30, 730][i], legalHoldable: true, note: i === 5 ? 'Biometric: delete at earliest' : '' }));
const SEED_OVERRIDES = [
  { id: 'ov3', when: '24 Aug 2026 17:05', clientId: 'cl1', oppId: '1', oppTitle: 'Software Developer', candidate: 'Sneha Reddy', original: 'REVIEW (integrity 71)', override: 'CLEARED', actor: 'Northstar Group · Hiring Manager', reason: 'Proctoring flag was a wall poster; verified by support (TKT-1062)' },
  { id: 'ov2', when: '19 Aug 2026 10:20', clientId: 'cl2', oppId: 'a1', oppTitle: 'Support Agent (Voice)', candidate: 'Meera S.', original: 'REJECTED (SJT 58)', override: 'ADVANCED to interview', actor: 'Acme Cloud · Recruiter', reason: 'Strong prior BPO experience; SJT attempt interrupted (JOB-8806)' },
  { id: 'ov1', when: '02 Aug 2026 15:00', clientId: 'cl3', oppId: '3', oppTitle: 'General Physician', candidate: 'Dr. S. Banerjee', original: 'RESUME KNOCKOUT (license not found)', override: 'RESCUED to assessment', actor: 'Meridian · Owner', reason: 'License number typo — verified on council registry' },
];
const SEED_FAIRNESS = [
  { oppId: '1', oppTitle: 'Software Developer', clientId: 'cl1', groups: [{ name: 'Women', rate: 0.42 }, { name: 'Men', rate: 0.47 }], ratio: 0.89, status: 'PASS', lastRun: '24 Aug 2026' },
  { oppId: '2', oppTitle: 'Customer Support (Tech)', clientId: 'cl1', groups: [{ name: 'Hindi-first', rate: 0.51 }, { name: 'English-first', rate: 0.55 }], ratio: 0.93, status: 'PASS', lastRun: '24 Aug 2026' },
  { oppId: 'a1', oppTitle: 'Support Agent (Voice)', clientId: 'cl2', groups: [{ name: 'Age 40+', rate: 0.31 }, { name: 'Age <40', rate: 0.46 }], ratio: 0.67, status: 'FLAG', lastRun: '24 Aug 2026', note: 'Below 4/5ths — review typing-speed gate' },
];

/* ──────────────────────────── ADMIN: users, notifications, settings, analytics series ──────────────────────────── */
const SEED_ADMINS = [
  { id: 'ad1', name: 'Rajeev Kumar', email: 'rajeev@cuba.reboo8.com', role: 'super', status: 'ACTIVE', mfa: true, lastActive: '26 Aug 2026 09:50' },
  { id: 'ad2', name: 'Ops Bot / Nisha Verma', email: 'nisha@cuba.reboo8.com', role: 'ops', status: 'ACTIVE', mfa: true, lastActive: '26 Aug 2026 09:10' },
  { id: 'ad3', name: 'Farhan Ali', email: 'farhan@cuba.reboo8.com', role: 'finance', status: 'ACTIVE', mfa: true, lastActive: '25 Aug 2026 18:30' },
  { id: 'ad4', name: 'Sunita Rao', email: 'sunita@cuba.reboo8.com', role: 'support', status: 'ACTIVE', mfa: false, lastActive: '26 Aug 2026 08:40' },
  { id: 'ad5', name: 'Dev Mathur', email: 'dev@cuba.reboo8.com', role: 'compliance', status: 'ACTIVE', mfa: true, lastActive: '24 Aug 2026 16:00' },
  { id: 'ad6', name: 'Aarav Shah', email: 'aarav@cuba.reboo8.com', role: 'analyst', status: 'ACTIVE', mfa: false, lastActive: '22 Aug 2026 11:00' },
  { id: 'ad7', name: 'Leena Pillai', email: 'leena@cuba.reboo8.com', role: 'support', status: 'DEACTIVATED', mfa: true, lastActive: '30 Jul 2026' },
];

const N = (id, when, category, severity, title, detail, roles, to, extra = {}) => ({ id, when, category, severity, title, detail, roles, to, read: false, ...extra });
const SEED_NOTIFS = [
  N('nt1', '26 Aug 2026 12:06', 'Evaluation / Operations', 'CRITICAL', 'Stuck AI interview — Ishaan Roy (Acme Cloud)', 'No audio for 41 min · 80 cr on hold · JOB-8812. Resume or reset the attempt.', ['super', 'ops', 'support'], '/admin/support?tab=jobs'),
  N('nt2', '26 Aug 2026 09:36', 'Evaluation / Operations', 'WARNING', 'Score pending 22 min — Divya Nair (Northstar Group)', 'Judge queue backlog · JOB-8811. Retry processing if it exceeds 30 min.', ['super', 'ops', 'support'], '/admin/support?tab=jobs'),
  N('nt3', '25 Aug 2026 18:21', 'Credits & Billing', 'CRITICAL', 'NovaPay wallet negative: −1,850 cr', 'Overdraft used to finish a running interview. New paid evaluations blocked until top-up. 2 failed card payments this month.', ['super', 'finance'], '/admin/clients/cl5'),
  N('nt4', '25 Aug 2026 16:00', 'Credits & Billing', 'WARNING', 'Meridian Hospitals low balance: 420 cr', 'Below threshold 500 cr · ~5 interviews left. Last top-up 02 Jul.', ['super', 'finance', 'ops'], '/admin/clients/cl3'),
  N('nt5', '25 Aug 2026 16:10', 'Support', 'CRITICAL', 'Urgent ticket TKT-1063 — payment succeeded but credits missing', 'NovaPay · card debited, gateway shows failed. Finance checking pending capture.', ['super', 'support', 'finance'], '/admin/support'),
  N('nt6', '25 Aug 2026 09:00', 'Compliance / Security', 'WARNING', 'Deletion request DR-221 due 24 Sep', 'candidate #5012 · Acme Cloud · no legal hold.', ['super', 'compliance'], '/admin/compliance?tab=requests'),
  N('nt7', '24 Aug 2026 16:15', 'Credits & Billing', 'INFO', 'Zentro BPO reached zero balance', 'Client stays ACTIVE · new paid evaluations paused · running work unaffected.', ['super', 'finance', 'ops'], '/admin/clients/cl4'),
  N('nt8', '24 Aug 2026 09:00', 'Compliance / Security', 'WARNING', 'Fairness flag — Support Agent (Voice), Acme Cloud', 'Age 40+ selection ratio 0.67 (< 0.80). Review typing-speed gate.', ['super', 'compliance'], '/admin/compliance?tab=fairness'),
  N('nt9', '23 Aug 2026 12:01', 'Client / Account', 'INFO', 'Orbit Logistics chargeback processed', 'PAY-3028 reversed · −3,000 cr · account remains SUSPENDED.', ['super', 'finance', 'ops'], '/admin/clients/cl7'),
  N('nt10', '22 Aug 2026 08:30', 'Platform', 'WARNING', 'Gupshup (SMS/WhatsApp) degraded', 'Error rate 6.8% · latency 1.9 s · consider switching primary.', ['super', 'ops'], '/admin/platform?tab=integrations'),
  N('nt11', '20 Aug 2026 11:16', 'Client / Account', 'INFO', 'BrightLearn invited — awaiting activation', 'Owner hr@brightlearn.co · resend if no activation in 7 days.', ['super', 'ops'], '/admin/clients/cl6'),
  N('nt12', '19 Aug 2026 16:42', 'Platform', 'RESOLVED', 'LLM latency incident resolved', 'Groq p95 back to 620 ms · goodwill credits issued to Acme Cloud.', ['super', 'ops'], '/admin/platform?tab=integrations'),
  N('nt13', '18 Aug 2026 10:05', 'Evaluation / Operations', 'WARNING', 'Usage spike — Acme Cloud', '3.4× the 7-day average of interviews on 18 Aug. Auto-flagged; no action taken.', ['super', 'ops'], '/admin/usage'),
];

const SEED_SETTINGS = {
  general: { platformName: 'Cuba', company: 'Reboo8', supportEmail: 'support@cuba.reboo8.com', timezone: 'Asia/Kolkata', region: 'India (ap-south-1)' },
  credits: { currency: 'INR', perCredit: CURRENCY.perCredit, lowBalanceThreshold: DEFAULTS.lowBalanceThreshold, overdraftLimit: DEFAULTS.overdraftLimit, fundingResumeX: DEFAULTS.fundingResumeX, fundingFullX: DEFAULTS.fundingFullX, reserveModel: true },
  security: { mfaForCritical: true, reauthMinutes: 15, dualApproval: ['client.offboard', 'wallet.adjust'], sessionTimeoutMin: 60, ipAllowlist: false },
  evaluation: { defaultFitThreshold: 60, defaultPassPct: 60, interviewLanguages: ['English', 'Hindi', 'Tamil', 'Telugu', 'Kannada', 'Marathi', 'Bengali'], maxRetakes: 1, proctoringDefault: 'camera + mic + tab-switch', linkExpiryDays: 7 },
  notifications: { channels: { inApp: true, email: true, slack: false, sms: false, whatsapp: false }, routing: { finance: ['Credits & Billing'], support: ['Support', 'Evaluation / Operations'], compliance: ['Compliance / Security'], ops: ['Client / Account', 'Evaluation / Operations', 'Platform'], super: ['CRITICAL (all categories)'] } },
  privacy: { retention: SEED_RETENTION, legalHoldDefault: false, anonymiseAfterRetention: true, backupDeletionDays: 30 },
  system: { maintenanceMode: false, apiRateLimit: '600 req/min', maxConcurrentInterviews: 250, storageRegion: 'ap-south-1', version: 'cuba-2026.08.3' },
};

const SEED_SERIES = {
  months: ['Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug'],
  creditsSold:     [12000, 26000, 41000, 38000, 55000, 76400],
  creditsConsumed: [9800, 21000, 36500, 41200, 52800, 63900],
  candidates:      [640, 1310, 2020, 2480, 3150, 3900],
  interviews:      [110, 240, 390, 460, 560, 690],
  failures:        [9, 14, 19, 17, 22, 26],
  revenue:         [120000, 260000, 410000, 380000, 550000, 764000],
};

/* ──────────────────────────── ROLE CATALOG (client-side Create Opportunity presets) ──────────────────────────── */
const roleMod = (key, weight, opt = {}) => ({ key, skills: opt.skills || [], nQ: opt.nQ ?? (key === 'mcq' ? 20 : key === 'coding' ? 2 : key === 'interview' ? 10 : 5), rubric: opt.rubric || [], gate: opt.gate || 'Advance ≥ 60', weight, ...(opt.languages ? { languages: opt.languages } : {}) });
const rankW = (label, w) => ({ label, w });
const ENHI = ['English', 'Hindi'];

export const ROLE_CATALOG = [
  { id: 'it', name: 'IT & Engineering', roles: [
    { id: 'swe', title: 'Software Developer', department: 'SaaS / Tech', skills: ['JavaScript', 'Node.js', 'MongoDB', 'DSA'], languages: ENHI, jd: 'Build and maintain scalable web apps and backend services; write clean, reusable code and collaborate across the team.',
      assessment: { modules: [roleMod('resume', 0, { skills: ['JavaScript', 'Node.js'] }), roleMod('coding', 35, { skills: ['JavaScript', 'DSA'] }), roleMod('written', 20, { skills: ['Node.js', 'MongoDB'] }), roleMod('interview', 30, { skills: ['System design'], languages: ENHI }), roleMod('typing', 0)], weights: [rankW('Coding', 35), rankW('AI Interview', 30), rankW('Written', 20), rankW('Resume-fit', 5), rankW('Integrity', 10)] } },
    { id: 'fe', title: 'Frontend Developer', department: 'SaaS / Tech', skills: ['React', 'TypeScript', 'CSS', 'Accessibility'], languages: ENHI, jd: 'Craft responsive, accessible UIs in React; partner with design and back-end to ship polished features.',
      assessment: { modules: [roleMod('resume', 0), roleMod('coding', 35, { skills: ['React', 'JavaScript'] }), roleMod('written', 15), roleMod('interview', 30, { languages: ENHI }), roleMod('typing', 0)], weights: [rankW('Coding', 35), rankW('AI Interview', 30), rankW('Written', 15), rankW('Resume-fit', 10), rankW('Integrity', 10)] } },
    { id: 'devops', title: 'DevOps Engineer', department: 'SaaS / Tech', skills: ['AWS', 'Docker', 'Kubernetes', 'CI/CD'], languages: ENHI, jd: 'Own CI/CD, infrastructure-as-code and observability; keep deployments fast, safe and reliable.',
      assessment: { modules: [roleMod('resume', 0), roleMod('mcq', 30, { skills: ['Linux', 'Networking'] }), roleMod('written', 20), roleMod('interview', 40, { languages: ENHI })], weights: [rankW('MCQ', 30), rankW('AI Interview', 40), rankW('Written', 20), rankW('Integrity', 10)] } },
    { id: 'qa', title: 'QA Engineer', department: 'SaaS / Tech', skills: ['Test design', 'Selenium', 'API testing'], languages: ENHI, jd: 'Design and automate test suites; safeguard quality across releases.',
      assessment: { modules: [roleMod('resume', 0), roleMod('mcq', 30), roleMod('coding', 25, { skills: ['Automation'] }), roleMod('interview', 35, { languages: ENHI })], weights: [rankW('MCQ', 30), rankW('Coding', 25), rankW('AI Interview', 35), rankW('Integrity', 10)] } },
  ] },
  { id: 'cx', name: 'Customer Experience', roles: [
    { id: 'cs-voice', title: 'Customer Support (Voice)', department: 'Operations', skills: ['Communication', 'Active Listening', 'CRM'], languages: ['English', 'Hindi', 'Tamil'], jd: 'Resolve customer issues over voice with empathy and speed; meet quality and CSAT targets.',
      assessment: { modules: [roleMod('resume', 0), roleMod('language', 30, { languages: ['English', 'Hindi', 'Tamil'] }), roleMod('sjt', 20), roleMod('simulation', 20), roleMod('interview', 15, { languages: ['English', 'Hindi', 'Tamil'] }), roleMod('typing', 5)], weights: [rankW('Language', 30), rankW('SJT', 20), rankW('Simulation', 20), rankW('AI Interview', 15), rankW('Integrity', 10), rankW('Typing', 5)] } },
    { id: 'cs-chat', title: 'Customer Support (Chat)', department: 'Operations', skills: ['Written communication', 'Typing', 'CRM'], languages: ENHI, jd: 'Handle multiple chat conversations with clarity, accuracy and a helpful tone.',
      assessment: { modules: [roleMod('resume', 0), roleMod('language', 25), roleMod('typing', 15), roleMod('sjt', 20), roleMod('simulation', 25, { skills: ['Live chat'] }), roleMod('interview', 15, { languages: ENHI })], weights: [rankW('Simulation', 25), rankW('Language', 25), rankW('SJT', 20), rankW('Typing', 15), rankW('AI Interview', 15)] } },
    { id: 'tech-support', title: 'Technical Support', department: 'Operations', skills: ['Troubleshooting', 'Product knowledge', 'Communication'], languages: ENHI, jd: 'Diagnose and resolve technical issues; explain solutions clearly to non-technical users.',
      assessment: { modules: [roleMod('resume', 0), roleMod('mcq', 25), roleMod('sjt', 20), roleMod('simulation', 20), roleMod('interview', 25, { languages: ENHI }), roleMod('typing', 10)], weights: [rankW('MCQ', 25), rankW('Simulation', 20), rankW('SJT', 20), rankW('AI Interview', 25), rankW('Typing', 10)] } },
  ] },
  { id: 'health', name: 'Healthcare', roles: [
    { id: 'physician', title: 'General Physician', department: 'Healthcare', skills: ['MBBS', 'Internal Medicine', 'Patient Communication'], languages: ['English', 'Kannada', 'Hindi'], jd: 'Provide internal-medicine care and patient communication; MBBS + valid registration required.',
      assessment: { modules: [roleMod('resume', 0, { gate: 'Hard knockout if MBBS/license missing' }), roleMod('mcq', 35, { nQ: 30, skills: ['Internal Medicine', 'Pharmacology'] }), roleMod('sjt', 30, { skills: ['Clinical judgement', 'Ethics'] }), roleMod('interview', 20, { languages: ['English', 'Kannada', 'Hindi'] })], weights: [rankW('Medical Knowledge', 35), rankW('Clinical Judgement', 30), rankW('AI Interview', 20), rankW('Integrity', 15)] } },
    { id: 'nurse', title: 'Staff Nurse', department: 'Healthcare', skills: ['Nursing', 'Patient care', 'Vitals'], languages: ENHI, jd: 'Deliver bedside patient care, monitoring and documentation in a clinical setting.',
      assessment: { modules: [roleMod('resume', 0), roleMod('mcq', 35, { nQ: 25 }), roleMod('sjt', 30), roleMod('interview', 20, { languages: ENHI })], weights: [rankW('Clinical Knowledge', 35), rankW('Clinical Judgement', 30), rankW('AI Interview', 20), rankW('Integrity', 15)] } },
  ] },
  { id: 'design', name: 'Design', roles: [
    { id: 'uxui', title: 'UX/UI Designer', department: 'SaaS / Tech', skills: ['Figma', 'User research', 'Interaction design', 'Prototyping'], languages: ENHI, jd: 'Design intuitive product experiences end-to-end: research, flows, wireframes and polished UI.',
      assessment: { modules: [roleMod('resume', 0, { skills: ['Portfolio'] }), roleMod('written', 20, { skills: ['Design critique'] }), roleMod('sjt', 20, { skills: ['Design judgement'] }), roleMod('interview', 45, { skills: ['Portfolio walkthrough'], languages: ENHI })], weights: [rankW('Portfolio & Interview', 45), rankW('Design Judgement', 20), rankW('Written', 20), rankW('Resume-fit', 5), rankW('Integrity', 10)] } },
    { id: 'graphic', title: 'Graphic Designer', department: 'SaaS / Tech', skills: ['Adobe Suite', 'Typography', 'Branding'], languages: ENHI, jd: 'Produce on-brand visual assets across digital and print.',
      assessment: { modules: [roleMod('resume', 0, { skills: ['Portfolio'] }), roleMod('written', 15), roleMod('sjt', 20), roleMod('interview', 45, { languages: ENHI })], weights: [rankW('Portfolio & Interview', 45), rankW('Design Judgement', 20), rankW('Written', 15), rankW('Integrity', 20)] } },
  ] },
  { id: 'sales', name: 'Sales & Marketing', roles: [
    { id: 'sales-exec', title: 'Sales Executive', department: 'Sales', skills: ['Negotiation', 'CRM', 'Communication'], languages: ENHI, jd: 'Drive the sales pipeline from prospecting to close; consistently hit revenue targets.',
      assessment: { modules: [roleMod('resume', 0), roleMod('sjt', 25), roleMod('simulation', 30, { skills: ['Sales pitch'] }), roleMod('interview', 35, { languages: ENHI }), roleMod('language', 10)], weights: [rankW('Simulation', 30), rankW('AI Interview', 35), rankW('SJT', 25), rankW('Integrity', 10)] } },
    { id: 'content', title: 'Content Writer', department: 'Sales', skills: ['Writing', 'SEO', 'Editing'], languages: ['English'], jd: 'Create clear, engaging, SEO-aware content across formats.',
      assessment: { modules: [roleMod('resume', 0), roleMod('written', 55, { skills: ['Writing', 'SEO'] }), roleMod('language', 20), roleMod('interview', 25, { languages: ['English'] })], weights: [rankW('Written', 55), rankW('Language', 20), rankW('AI Interview', 25)] } },
  ] },
  { id: 'finops', name: 'Finance & Operations', roles: [
    { id: 'accountant', title: 'Accountant', department: 'Operations', skills: ['Accounting', 'Excel', 'Taxation'], languages: ENHI, jd: 'Manage books, reconciliations and compliance with accuracy.',
      assessment: { modules: [roleMod('resume', 0), roleMod('mcq', 40, { skills: ['Accounting', 'Taxation'] }), roleMod('written', 20), roleMod('interview', 25, { languages: ENHI }), roleMod('computer', 15)], weights: [rankW('MCQ', 40), rankW('AI Interview', 25), rankW('Written', 20), rankW('Computer Literacy', 15)] } },
    { id: 'ops-assoc', title: 'Operations Associate', department: 'Operations', skills: ['Process', 'Excel', 'Coordination'], languages: ENHI, jd: 'Keep day-to-day operations running: coordination, tracking and process execution.',
      assessment: { modules: [roleMod('resume', 0), roleMod('mcq', 25), roleMod('sjt', 25), roleMod('interview', 30, { languages: ENHI }), roleMod('computer', 20)], weights: [rankW('MCQ', 25), rankW('SJT', 25), rankW('AI Interview', 30), rankW('Computer Literacy', 20)] } },
  ] },
];

/* ──────────────────────────── saved assessment templates (persisted) ──────────────────────────── */
const TPL_KEY = 'cuba_assessment_templates';
const INV_KEY = 'cuba_invites';
/* Workspace persistence: everything a client creates (roles, config, links, candidates, credits, activity) lives in
   this browser's localStorage so a refresh never loses work. The schema stamp lets us discard stale shapes safely. */
const SCHEMA_KEY = 'cuba_schema'; const SCHEMA = '1';
const OPP_KEY = 'cuba_opportunities', CM_KEY = 'cuba_custom_modules', CLI_KEY = 'cuba_clients', LED_KEY = 'cuba_ledger', PAY_KEY = 'cuba_payments', AUD_KEY = 'cuba_audit', OVR_KEY = 'cuba_overrides', NOTIF_KEY = 'cuba_notifications';
try {
  if (localStorage.getItem(SCHEMA_KEY) !== SCHEMA) { [OPP_KEY, CM_KEY, CLI_KEY, LED_KEY, PAY_KEY, AUD_KEY, OVR_KEY, NOTIF_KEY].forEach((k) => localStorage.removeItem(k)); localStorage.setItem(SCHEMA_KEY, SCHEMA); }
} catch { /* storage unavailable — run in memory */ }
const loadList = (key, seed) => { try { const v = JSON.parse(localStorage.getItem(key)); return Array.isArray(v) ? v : seed; } catch { return seed; } };
const saveJson = (key, v) => { try { localStorage.setItem(key, JSON.stringify(v)); } catch { /* ignore */ } };
export const resetWorkspace = () => { try { Object.keys(localStorage).filter((k) => k.startsWith('cuba_')).forEach((k) => localStorage.removeItem(k)); } catch { /* ignore */ } window.location.reload(); };
const POOL_KEY = 'cuba_pool'; const CAND_KEY = 'cuba_candidates';
const loadMap = (key, seed) => { try { const v = JSON.parse(localStorage.getItem(key)); return v && typeof v === 'object' && !Array.isArray(v) ? v : seed; } catch { return seed; } };
const _roleAsmt = (catId, roleId) => { const c = ROLE_CATALOG.find((x) => x.id === catId); const r = c && c.roles.find((x) => x.id === roleId); return r ? r.assessment : { modules: [], weights: [] }; };
const SEED_TEMPLATES = [
  { id: 'tpl_seed_swe', name: 'Software Developer — standard', createdAt: 'Built-in', ..._roleAsmt('it', 'swe') },
  { id: 'tpl_seed_cx', name: 'Customer Support (Voice) — standard', createdAt: 'Built-in', ..._roleAsmt('cx', 'cs-voice') },
  { id: 'tpl_seed_doc', name: 'General Physician — standard', createdAt: 'Built-in', ..._roleAsmt('health', 'physician') },
];

/* ═══════════════════════════════ PROVIDER ═══════════════════════════════ */
export function AppProvider({ children }) {
  /* ── client-side product state (unchanged) ── */
  const [opportunities, setOpportunities] = useState(() => { const o = loadList(OPP_KEY, SEED_OPPS); nextOppId = Math.max(nextOppId, ...o.map((x) => parseInt(x.id, 10) || 0)); return o; });
  useEffect(() => saveJson(OPP_KEY, opportunities), [opportunities]);
  const [candidates, setCandidates] = useState(() => loadMap(CAND_KEY, SEED_CANDIDATES));
  useEffect(() => { try { localStorage.setItem(CAND_KEY, JSON.stringify(candidates)); } catch { /* ignore */ } }, [candidates]);
  const [pool, setPool] = useState(() => loadMap(POOL_KEY, SEED_POOL));
  useEffect(() => { try { localStorage.setItem(POOL_KEY, JSON.stringify(pool)); } catch { /* ignore */ } }, [pool]);
  const [customModules, setCustomModules] = useState(() => loadList(CM_KEY, []));
  useEffect(() => saveJson(CM_KEY, customModules), [customModules]);
  const [assessmentTemplates, setAssessmentTemplates] = useState(() => { try { const s = JSON.parse(localStorage.getItem(TPL_KEY)); return Array.isArray(s) && s.length ? s : SEED_TEMPLATES; } catch { return SEED_TEMPLATES; } });
  useEffect(() => { try { localStorage.setItem(TPL_KEY, JSON.stringify(assessmentTemplates)); } catch { /* ignore */ } }, [assessmentTemplates]);
  /* candidate invites persist so an assessment link survives a refresh (resumable) — everything else in the store is in-memory */
  const [invites, setInvites] = useState(() => { try { const v = JSON.parse(localStorage.getItem(INV_KEY)); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } });
  useEffect(() => { try { localStorage.setItem(INV_KEY, JSON.stringify(invites)); } catch { /* ignore */ } }, [invites]);

  /* ── admin / operator state ── */
  const [clients, setClients] = useState(() => loadList(CLI_KEY, SEED_CLIENTS));
  useEffect(() => saveJson(CLI_KEY, clients), [clients]);
  const [ledger, setLedger] = useState(() => loadList(LED_KEY, SEED_LEDGER));
  useEffect(() => saveJson(LED_KEY, ledger), [ledger]);
  const [payments, setPayments] = useState(() => loadList(PAY_KEY, SEED_PAYMENTS));
  useEffect(() => saveJson(PAY_KEY, payments), [payments]);
  const [rateCard, setRateCard] = useState(SEED_RATE_CARD);
  const [failedJobs, setFailedJobs] = useState(SEED_JOBS);
  const [tickets, setTickets] = useState(SEED_TICKETS);
  const [modules, setModules] = useState(SEED_MODULES);
  const [integrations, setIntegrations] = useState(SEED_INTEGRATIONS);
  const [auditLog, setAuditLog] = useState(() => loadList(AUD_KEY, SEED_AUDIT));
  useEffect(() => saveJson(AUD_KEY, auditLog), [auditLog]);
  const [dataRequests, setDataRequests] = useState(SEED_DATA_REQUESTS);
  const [consentVersions] = useState(SEED_CONSENT);
  const [overrides, setOverrides] = useState(() => loadList(OVR_KEY, SEED_OVERRIDES));
  useEffect(() => saveJson(OVR_KEY, overrides), [overrides]);
  const [fairness] = useState(SEED_FAIRNESS);
  const [notifications, setNotifications] = useState(() => loadList(NOTIF_KEY, SEED_NOTIFS));
  useEffect(() => saveJson(NOTIF_KEY, notifications), [notifications]);
  const [adminUsers, setAdminUsers] = useState(SEED_ADMINS);
  const [currentAdmin, setCurrentAdmin] = useState({ id: 'ad1', name: 'Rajeev Kumar', role: 'super' });
  const [settings, setSettings] = useState(SEED_SETTINGS);
  const perCredit = () => Number(settings.credits?.perCredit) || CURRENCY.perCredit;
  const [usageSeries] = useState(SEED_SERIES);
  const [impersonating, setImpersonating] = useState(null);
  const [clientTeam, setClientTeam] = useState([
    { id: 'u1', name: 'Priya Nair', email: 'hr@northstargroup.com', role: 'Owner', status: 'ACTIVE' },
    { id: 'u2', name: 'Rohan Desai', email: 'rohan.d@northstargroup.com', role: 'Recruiter', status: 'ACTIVE' },
    { id: 'u3', name: 'Meghna Iyer', email: 'meghna.i@northstargroup.com', role: 'Hiring Manager', status: 'ACTIVE' },
    { id: 'u4', name: 'Vikas Jain', email: 'vikas.j@northstargroup.com', role: 'Viewer', status: 'INVITED' },
  ]);

  /* ── RBAC helpers ── */
  const can = (action) => { const roles = PERMISSIONS[action]; return !roles || roles.includes(currentAdmin.role); };
  const requiresReason = (action) => HIGH_RISK.includes(action);
  const isCritical = (action) => CRITICAL.includes(action) || (settings.security.dualApproval || []).includes(action);
  const setCurrentRole = (roleId) => setCurrentAdmin((a) => { const u = adminUsers.find((x) => x.role === roleId && x.status === 'ACTIVE'); return { id: u?.id || a.id, name: u?.name || a.name, role: roleId }; });
  const actorLabel = () => roleName(currentAdmin.role);

  /* ── audit (permanent) ── */
  const addAudit = (category, action, resource, extra = {}) => setAuditLog((l) => [{ id: 'au' + (++auditSeq), when: nowStamp(), actor: extra.actor || actorLabel(), role: extra.role || currentAdmin.role, category, action, resource, ...extra }, ...l]);
  const notify = (category, severity, title, detail, roles, to) => setNotifications((l) => [N('nt' + (++ntSeq), nowStamp(), category, severity, title, detail, roles, to), ...l]);

  /* ── lookups ── */
  const getClient = (id) => clients.find((c) => c.id === id);
  const nameOf = (id) => getClient(id)?.name || '—';
  const patchClient = (id, fn) => setClients((l) => l.map((c) => (c.id === id ? { ...c, ...(typeof fn === 'function' ? fn(c) : fn) } : c)));
  const patchWallet = (id, fn) => patchClient(id, (c) => ({ wallet: { ...c.wallet, ...(typeof fn === 'function' ? fn(c.wallet, c) : fn) } }));

  /* ── ledger (append-only) ── */
  const postLedger = (clientId, type, credits, extra = {}) => {
    const c = getClient(clientId); if (!c) return null;
    const id = 'LX-' + (++ledgerSeq);
    /* The row object is kept by reference so `balanceAfter` can be re-derived inside the wallet
       updater below. That updater runs against the LATEST client state, which is what keeps the
       running-balance column reconciling even when several entries are posted in one batch. */
    /* `extra` carries the trace (opportunity / candidate / module / usage / rate); it must never
       be able to clobber the row's identity or amount, so it is spread FIRST. */
    const row = { ...extra, id, when: extra.when || nowStamp(), clientId, type, credits, balanceAfter: (c.wallet.balance || 0) + credits, actor: extra.actor || actorLabel() };
    setLedger((l) => [row, ...l]);
    patchClient(clientId, (cc) => {
      row.balanceAfter = (cc.wallet.balance || 0) + credits;
      return credits !== 0 ? { wallet: { ...cc.wallet, balance: row.balanceAfter } } : {};
    });
    return id;
  };

  /* ── clients: lifecycle ── */
  const onboardClient = (form) => {
    const id = 'cl' + (++nextClientSeq);
    const tenantId = 'org_' + rnd();
    const initial = Number(form.initialCredits) || 0;
    const client = {
      id, tenantId, name: form.name, legalName: form.legalName || form.name, country: form.country || 'India', website: form.website || '—', industry: form.industry || '—',
      owner: { name: form.ownerName || '—', email: form.ownerEmail, phone: form.ownerPhone || '—', designation: form.ownerDesignation || '—' },
      billing: { currency: form.currency || 'INR', gstin: form.gstin || '', address: form.billingAddress || '' }, salesOwner: form.salesOwner || '—', notes: form.notes || '',
      status: 'INVITE_PENDING', since: todayStamp(), invitedAt: todayStamp(), wallet: mkWallet(0, 0, { overdraftLimit: Number(settings.credits?.overdraftLimit) || DEFAULTS.overdraftLimit, lowBalanceThreshold: Number(settings.credits?.lowBalanceThreshold) || DEFAULTS.lowBalanceThreshold }), usage: mkUsage(), oppsOpen: 0, seats: 0, moduleAccess: [], paused: false, flags: [],
    };
    setClients((l) => [client, ...l]);
    addAudit('Client', 'Created organization + invited owner', form.name, { clientId: id });
    if (initial > 0) {
      const type = form.initialType === 'grant' ? 'ADMIN_GRANT' : 'PURCHASE';
      const lid = 'LX-' + (++ledgerSeq);
      const pid = type === 'PURCHASE' ? 'PAY-' + (++paySeq) : null;
      setLedger((l) => [{ id: lid, when: nowStamp(), clientId: id, type, credits: initial, balanceAfter: initial, actor: actorLabel(), ref: pid || undefined, reason: type === 'ADMIN_GRANT' ? (form.initialReason || 'Initial allocation at onboarding') : undefined, note: type === 'PURCHASE' ? `${fmtMoney(initial * perCredit())} · ${form.paymentMethod || 'Bank transfer (offline)'}` : undefined }, ...l]);
      if (pid) setPayments((l) => [{ id: pid, clientId: id, date: todayStamp(), amount: initial * perCredit(), currency: form.currency || 'INR', credits: initial, method: form.paymentMethod || 'Bank transfer (offline)', status: 'SUCCEEDED', reference: form.paymentRef || 'INV-' + (2081 + paySeq - 3041), note: 'Initial purchase at onboarding' }, ...l]);
      setClients((l) => l.map((c) => (c.id === id ? { ...c, wallet: { ...c.wallet, balance: initial, lastTopUp: todayStamp() } } : c)));
      addAudit('Credits', `${type === 'PURCHASE' ? 'Initial purchase' : 'Initial grant'} (+${initial.toLocaleString('en-IN')})`, form.name, { clientId: id });
    }
    notify('Client / Account', 'INFO', `${form.name} invited — awaiting activation`, `Owner ${form.ownerEmail} · resend if no activation in 7 days.`, ['super', 'ops'], '/admin/clients/' + id);
    return id;
  };
  const resendInvite = (id) => { patchClient(id, { inviteRevoked: false, invitedAt: todayStamp() }); addAudit('Client', 'Re-sent owner invite', nameOf(id), { clientId: id }); };
  const revokeInvite = (id) => { patchClient(id, { inviteRevoked: true }); addAudit('Client', 'Revoked owner invite', nameOf(id), { clientId: id }); };
  const activateClient = (id) => { patchClient(id, { status: 'ACTIVE', inviteRevoked: false, activatedAt: todayStamp() }); addAudit('Client', 'Owner activated account', nameOf(id), { clientId: id, actor: nameOf(id) + ' · Owner', role: 'client' }); };
  const suspendClient = (id, reason) => { patchClient(id, { status: 'SUSPENDED', statusReason: reason, suspendedAt: todayStamp() }); addAudit('Client', 'Suspended client', nameOf(id), { clientId: id, reason }); notify('Client / Account', 'WARNING', `${nameOf(id)} suspended`, reason, ['super', 'ops', 'finance'], '/admin/clients/' + id); };
  const reinstateClient = (id) => { patchClient(id, { status: 'ACTIVE', statusReason: '', suspendedAt: null }); addAudit('Client', 'Reinstated client', nameOf(id), { clientId: id }); };
  const startOffboarding = (id, reason) => {
    patchClient(id, { status: 'OFFBOARDING', statusReason: reason, paused: true, offboarding: { reason, startedAt: todayStamp(), steps: OFFBOARDING_STEPS.map((s, i) => ({ ...s, done: i < 2 })) } });
    addAudit('Client', 'Started offboarding', nameOf(id), { clientId: id, reason });
  };
  const completeOffboardingStep = (id, key) => {
    patchClient(id, (c) => {
      const steps = (c.offboarding?.steps || []).map((s) => (s.key === key ? { ...s, done: true } : s));
      const allDone = steps.every((s) => s.done);
      const status = allDone ? 'DELETED' : steps.find((s) => s.key === 'retention')?.done ? 'RETENTION' : steps.find((s) => s.key === 'export')?.done ? 'DEACTIVATED' : c.status;
      return { offboarding: { ...c.offboarding, steps }, status };
    });
    addAudit('Client', 'Offboarding step completed: ' + (OFFBOARDING_STEPS.find((s) => s.key === key)?.label || key), nameOf(id), { clientId: id });
  };
  const updateClient = (id, patch) => { patchClient(id, patch); addAudit('Client', 'Updated organization details', nameOf(id), { clientId: id }); };
  const exportClientData = (id, reason) => { addAudit('Data request', 'Client data export generated', nameOf(id), { clientId: id, reason }); };

  /* ── wallet actions (admin) ── */
  const addCredits = (clientId, credits, { type = 'PURCHASE', method = 'Bank transfer (offline)', reference = '', reason = '', amount } = {}) => {
    const c = getClient(clientId); if (!c || !(credits > 0)) return;
    const before = c.wallet.balance;
    const pid = type === 'PURCHASE' ? 'PAY-' + (++paySeq) : null;
    const money = amount ?? credits * perCredit();
    postLedger(clientId, type, credits, { ref: pid || reference || undefined, reason: type === 'ADMIN_GRANT' ? (reason || 'Manual grant') : undefined, note: type === 'PURCHASE' ? `${fmtMoney(money)} · ${method}${before < 0 ? ` · cleared debt of ${fmtCr(-before)} first` : ''}` : (before < 0 ? `cleared debt of ${fmtCr(-before)} first` : undefined) });
    if (pid) setPayments((l) => [{ id: pid, clientId, date: todayStamp(), amount: money, currency: c.billing?.currency || 'INR', credits, method, status: 'SUCCEEDED', reference: reference || 'INV-' + (2081 + paySeq - 3041), note: method.includes('offline') ? 'Recorded manually by Finance' : '' }, ...l]);
    patchWallet(clientId, { lastTopUp: todayStamp() });
    addAudit('Credits', `${type === 'PURCHASE' ? 'Recorded purchase' : 'Admin grant'} (+${credits.toLocaleString('en-IN')})`, c.name, { clientId, reason: reason || undefined });
    if (before < 0 && before + credits >= 0) notify('Credits & Billing', 'RESOLVED', `${c.name} debt cleared`, `Top-up of ${fmtCr(credits)} cleared ${fmtCr(-before)} outstanding · new evaluations may start.`, ['super', 'finance', 'ops'], '/admin/clients/' + clientId);
  };
  const refundCredits = (clientId, credits, reason, ref) => { const c = getClient(clientId); if (!c || !(credits > 0)) return; postLedger(clientId, 'REFUND', credits, { reason, ref }); addAudit('Credits', `Refunded credits (+${credits.toLocaleString('en-IN')})`, c.name, { clientId, reason }); };
  const manualAdjust = (clientId, credits, reason) => { const c = getClient(clientId); if (!c || !credits) return; postLedger(clientId, 'MANUAL_ADJUSTMENT', credits, { reason }); addAudit('Credits', `Manual adjustment (${credits > 0 ? '+' : ''}${credits.toLocaleString('en-IN')})`, c.name, { clientId, reason }); };
  const setOverdraftLimit = (clientId, limit, reason) => { patchWallet(clientId, { overdraftLimit: Math.max(0, Number(limit) || 0) }); addAudit('Credits', `Overdraft limit → ${fmtCr(limit)}`, nameOf(clientId), { clientId, reason }); };
  const setLowBalanceThreshold = (clientId, threshold) => { patchWallet(clientId, { lowBalanceThreshold: Math.max(0, Number(threshold) || 0) }); addAudit('Credits', `Low-balance threshold → ${fmtCr(threshold)}`, nameOf(clientId), { clientId }); };
  const freezeWallet = (clientId, reason) => { patchWallet(clientId, { frozen: true }); addAudit('Credits', 'Wallet frozen', nameOf(clientId), { clientId, reason }); };
  const unfreezeWallet = (clientId) => { patchWallet(clientId, { frozen: false }); addAudit('Credits', 'Wallet unfrozen', nameOf(clientId), { clientId }); };
  const recordPayment = (clientId, { amount, method = 'Bank transfer (offline)', reference = '', status = 'SUCCEEDED', issueCredits = true }) => {
    const c = getClient(clientId); if (!c) return;
    const credits = Math.round((Number(amount) || 0) / perCredit());
    if (status === 'SUCCEEDED' && issueCredits) { addCredits(clientId, credits, { type: 'PURCHASE', method, reference, amount: Number(amount) }); return; }
    setPayments((l) => [{ id: 'PAY-' + (++paySeq), clientId, date: todayStamp(), amount: Number(amount) || 0, currency: c.billing?.currency || 'INR', credits, method, status, reference, note: status === 'PENDING' ? 'Awaiting confirmation — credits not yet issued' : '' }, ...l]);
    addAudit('Credits', `Recorded ${status.toLowerCase()} payment ${fmtMoney(amount)}`, c.name, { clientId });
  };
  const retryPayment = (payId) => {
    const p = payments.find((x) => x.id === payId); if (!p) return;
    setPayments((l) => l.map((x) => (x.id === payId ? { ...x, status: 'SUCCEEDED', note: 'Recovered ' + todayStamp() } : x)));
    postLedger(p.clientId, 'PURCHASE', p.credits, { ref: p.id, note: `${fmtMoney(p.amount)} · ${p.method} · recovered` });
    patchWallet(p.clientId, { lastTopUp: todayStamp() });
    addAudit('Credits', `Payment recovered (+${p.credits.toLocaleString('en-IN')})`, `${p.id} · ${nameOf(p.clientId)}`, { clientId: p.clientId });
  };
  const setRate = (key, credits) => { setRateCard((l) => l.map((r) => (r.key === key ? { ...r, credits: Math.max(0, Number(credits) || 0) } : r))); addAudit('Settings', `Rate card: ${key} → ${credits} cr`, 'Rate Card'); };

  /* ── consumption hooks (used by client-side flows to keep the ledger truthful) ── */
  /* credits per unit for a service key, from the live rate card */
  const rateOf = (key) => (rateCard.find((r) => r.key === key)?.credits) || 0;

  /* RESERVE — protect credits before a paid module starts. Moves no credits; only holds them. */
  const reserveCredits = (clientId, ctx) => { const hold = ctx.hold || 0; const id = postLedger(clientId, 'RESERVE', 0, { ...ctx, usage: ctx.usage || 'hold before start', hold }); patchWallet(clientId, (w) => ({ reserved: (w.reserved || 0) + hold })); return id; };

  /* CONSUMPTION — actual usage. A running evaluation is NEVER refused: if the balance would go
     below zero the platform covers the shortfall and the entry is typed OVERDRAFT (locked rule §04). */
  const consumeCredits = (clientId, credits, ctx = {}) => {
    const c = getClient(clientId); if (!c || !(credits > 0)) return null;
    const type = (c.wallet.balance || 0) - credits < 0 ? 'OVERDRAFT' : 'CONSUMPTION';
    const id = postLedger(clientId, type, -credits, { ...ctx, note: type === 'OVERDRAFT' ? 'Platform covered shortfall so a running evaluation could finish' : ctx.note });
    patchClient(clientId, (cc) => ({ usage: { ...cc.usage, creditsConsumed: (cc.usage.creditsConsumed || 0) + credits } }));
    if (type === 'OVERDRAFT') notify('Credits & Billing', 'CRITICAL', `${c.name} wallet went negative`, `Overdraft used so a running evaluation could finish (${ctx.candidate || 'candidate'} · ${ctx.module || 'module'}). New paid evaluations are blocked until top-up.`, ['super', 'finance'], '/admin/clients/' + clientId);
    return id;
  };

  /* SETTLEMENT — consume the actual usage and release whatever was held (spec §05).
     Called when a reserved module finishes; `actual` may be less than the hold. */
  const settleReserve = (clientId, reserveId, actual, ctx = {}) => {
    const c = getClient(clientId); if (!c) return null;
    const res = ledger.find((e) => e.id === reserveId);
    const hold = res?.hold || ctx.hold || actual;
    const released = Math.max(0, hold - actual);
    const type = (c.wallet.balance || 0) - actual < 0 ? 'OVERDRAFT' : 'SETTLEMENT';
    const id = postLedger(clientId, type, -actual, { ...ctx, reserveRef: reserveId, note: type === 'OVERDRAFT' ? 'Platform covered shortfall so a running evaluation could finish' : `${actual} used · ${released} released` });
    patchWallet(clientId, (w) => ({ reserved: Math.max(0, (w.reserved || 0) - hold) }));
    patchClient(clientId, (cc) => ({ usage: { ...cc.usage, creditsConsumed: (cc.usage.creditsConsumed || 0) + actual } }));
    return id;
  };

  /* release a hold without consuming (candidate abandoned before the module ran).
     `holdHint` matters when the RESERVE was posted in the same batch: `ledger` is still the
     previous render's array, so without it the hold would be missed and stay stuck forever. */
  const releaseReserve = (clientId, reserveId, ctx = {}) => {
    const hint = typeof ctx === 'number' ? { hold: ctx } : (ctx || {});
    const res = ledger.find((e) => e.id === reserveId);
    const hold = res?.hold || Number(hint.hold) || 0;
    if (!hold) return;
    patchWallet(clientId, (w) => ({ reserved: Math.max(0, (w.reserved || 0) - hold) }));
    postLedger(clientId, 'RESERVE_RELEASED', 0, {
      oppId: res?.oppId ?? hint.oppId, oppTitle: res?.oppTitle ?? hint.oppTitle,
      candidate: res?.candidate ?? hint.candidate, module: res?.module ?? hint.module, rate: res?.rate ?? hint.rate,
      reserveRef: reserveId, hold: 0, usage: 'hold released — module never ran',
      note: `${hold} cr released · nothing consumed`,
    });
  };

  /* usage counters — separate from credit movement so neither double-counts the other */
  const recordUsage = (clientId, patch = {}) => patchClient(clientId, (c) => {
    const u = { ...c.usage };
    Object.entries(patch).forEach(([k, v]) => { u[k] = (u[k] || 0) + v; });
    return { usage: u };
  });

  /* a live technical failure joins the admin Needs-Attention queue (spec §09).
     A technical failure is never a candidate failure — credits held stay reversible. */
  const reportFailedJob = (clientId, kind, ctx = {}) => {
    const id = 'JOB-' + (++jobSeq);
    setFailedJobs((l) => [{ id, clientId, oppId: ctx.oppId, oppTitle: ctx.oppTitle, candidate: ctx.candidate || 'Candidate', kind, module: ctx.module || '—', detail: ctx.detail || '', since: nowStamp(), creditsHeld: ctx.creditsHeld || 0, status: 'OPEN', actions: [] }, ...l]);
    addAudit('Recovery', 'Failed job raised: ' + (JOB_KINDS[kind]?.label || kind), `${id} · ${ctx.candidate || 'candidate'}`, { clientId, actor: 'System', role: 'system' });
    notify('Evaluation / Operations', 'CRITICAL', `${JOB_KINDS[kind]?.label || kind} — ${ctx.candidate || 'candidate'}`, `${ctx.detail || ''} ${ctx.creditsHeld ? `· ${ctx.creditsHeld} cr on hold` : ''} · ${nameOf(clientId)}`.trim(), ['super', 'ops', 'support'], '/admin/support?tab=jobs');
    return id;
  };

  /* ── usage safety controls ── */
  const pauseClientUsage = (id, reason) => { patchClient(id, { paused: true }); addAudit('Client', 'Paused client usage', nameOf(id), { clientId: id, reason }); };
  const resumeClientUsage = (id) => { patchClient(id, { paused: false }); addAudit('Client', 'Resumed client usage', nameOf(id), { clientId: id }); };
  const acknowledgeSpike = (id) => { patchClient(id, (c) => ({ flags: (c.flags || []).filter((f) => f !== 'spike') })); addAudit('Client', 'Acknowledged usage spike', nameOf(id), { clientId: id }); };

  /* ── modules (what Cuba offers) ── */
  const setModuleState = (key, state) => { setModules((l) => l.map((m) => (m.key === key ? { ...m, state } : m))); addAudit('Module', `State → ${state}`, key); };
  const setModuleRollout = (key, rollout) => { setModules((l) => l.map((m) => (m.key === key ? { ...m, rollout } : m))); addAudit('Module', `Rollout → ${rollout}`, key); };
  const grantModuleAccess = (key, clientId) => { setModules((l) => l.map((m) => (m.key === key ? { ...m, clientAccess: Array.from(new Set([...(m.clientAccess || []), clientId])) } : m))); patchClient(clientId, (c) => ({ moduleAccess: Array.from(new Set([...(c.moduleAccess || []), key])) })); addAudit('Module', `Granted ${key} access`, nameOf(clientId), { clientId }); };
  const revokeModuleAccess = (key, clientId) => { setModules((l) => l.map((m) => (m.key === key ? { ...m, clientAccess: (m.clientAccess || []).filter((c) => c !== clientId) } : m))); patchClient(clientId, (c) => ({ moduleAccess: (c.moduleAccess || []).filter((k) => k !== key) })); addAudit('Module', `Revoked ${key} access`, nameOf(clientId), { clientId }); };
  const pauseModule = (key, reason) => { setModules((l) => l.map((m) => (m.key === key ? { ...m, paused: true } : m))); addAudit('Module', 'Emergency pause (new attempts)', key, { reason }); notify('Platform', 'CRITICAL', `${key} paused for new attempts`, reason, ['super', 'ops', 'support'], '/admin/platform'); };
  const unpauseModule = (key) => { setModules((l) => l.map((m) => (m.key === key ? { ...m, paused: false } : m))); addAudit('Module', 'Emergency pause lifted', key); };
  const addModule = (name, scoring) => { const key = 'mod_' + rnd(); setModules((l) => [...l, { key, name, scoring: scoring || 'AI rubric', state: 'BETA', rollout: 'Internal', clientAccess: [], paused: false, version: 'v0.1', defaults: '—' }]); setRateCard((l) => [...l, { key, name, unit: 'per attempt', credits: 5 }]); addAudit('Module', 'Added module (Internal / Beta)', name); return key; };
  /* module availability for a client: ACTIVE for all; BETA only when the client has access; DISABLED/DEPRECATED never for new use */
  const moduleAvailableFor = (key, clientId) => { const m = modules.find((x) => x.key === key); if (!m) return { ok: true }; if (m.state === 'ACTIVE') return { ok: !m.paused, note: m.paused ? 'New attempts paused by Cuba Admin' : '' }; if (m.state === 'BETA') { const has = (m.clientAccess || []).includes(clientId) || m.rollout === 'GA'; return { ok: has && !m.paused, note: has ? 'Beta' : 'Beta — not enabled for your organization' }; } return { ok: false, note: m.state === 'DEPRECATED' ? 'Deprecated — not available for new opportunities' : 'Disabled by Cuba Admin' }; };
  const availableCatalogFor = (clientId) => modules.map((m) => ({ ...m, availability: moduleAvailableFor(m.key, clientId) }));

  /* ── integrations ── */
  const patchIntegration = (id, fn) => setIntegrations((l) => l.map((i) => (i.id === id ? { ...i, ...(typeof fn === 'function' ? fn(i) : fn) } : i)));
  const toggleIntegration = (id) => { const i = integrations.find((x) => x.id === id); patchIntegration(id, (x) => ({ enabled: !x.enabled })); addAudit('Integration', `${i?.enabled ? 'Disabled' : 'Enabled'} integration`, i?.name || id); };
  const connectIntegration = (id) => { const i = integrations.find((x) => x.id === id); patchIntegration(id, { status: 'CONNECTED', enabled: true, role: 'primary', health: { latencyMs: 400, errorRate: 0, usage: '—', cost: 0 }, lastTested: nowStamp(), rotated: todayStamp() }); addAudit('Integration', 'Connected integration', i?.name || id); };
  const disconnectIntegration = (id) => { const i = integrations.find((x) => x.id === id); patchIntegration(id, { status: 'DISCONNECTED', enabled: false, role: null }); addAudit('Integration', 'Disconnected integration', i?.name || id); };
  const testIntegration = (id) => { const i = integrations.find((x) => x.id === id); const ok = i?.status !== 'DEGRADED' || Math.random() > 0.5; patchIntegration(id, (x) => ({ lastTested: nowStamp(), status: ok ? 'CONNECTED' : 'DEGRADED', health: x.health ? { ...x.health, latencyMs: ok ? Math.round((x.health.latencyMs || 300) * 0.9) : x.health.latencyMs } : x.health })); addAudit('Integration', `Tested connection · ${ok ? 'OK' : 'degraded'}`, i?.name || id); return ok; };
  const rotateCredentials = (id) => { const i = integrations.find((x) => x.id === id); patchIntegration(id, { rotated: todayStamp() }); addAudit('Integration', 'Rotated credentials', i?.name || id); };
  const setPrimaryIntegration = (id) => { const i = integrations.find((x) => x.id === id); if (!i) return; setIntegrations((l) => l.map((x) => (x.category === i.category && x.group === i.group ? { ...x, role: x.id === id ? 'primary' : (x.role ? 'fallback' : x.role) } : x))); addAudit('Integration', `Set primary provider → ${i.name}`, i.category); };

  /* ── tickets (client raises; admin works) ── */
  const addTicket = (clientId, { subject, caseType, priority = 'Medium', description, oppTitle, candidate }) => {
    const id = 'TKT-' + (++ticketSeq);
    setTickets((l) => [{ id, clientId, subject, caseType, priority, status: 'OPEN', createdAt: todayStamp(), updated: todayStamp(), oppTitle, candidate, raisedBy: 'client', messages: [{ from: 'client', text: description, timestamp: nowStamp() }] }, ...l]);
    if (priority === 'Urgent') notify('Support', 'CRITICAL', `Urgent ticket ${id} — ${subject}`, `${nameOf(clientId)} · ${caseLabel(caseType)}`, ['super', 'support', 'ops'], '/admin/support');
    return id;
  };
  const setTicketStatus = (id, status) => { setTickets((l) => l.map((t) => (t.id === id ? { ...t, status, updated: todayStamp() } : t))); addAudit('Support', `Ticket → ${TICKET_STATUS[status]?.label || status}`, id); };
  const replyTicket = (id, from, text) => setTickets((l) => l.map((t) => (t.id === id ? { ...t, updated: todayStamp(), status: from === 'support' && t.status === 'OPEN' ? 'IN_PROGRESS' : t.status, messages: [...t.messages, { from, text, timestamp: nowStamp() }] } : t)));
  const setTicketPriority = (id, priority) => setTickets((l) => l.map((t) => (t.id === id ? { ...t, priority } : t)));

  /* ── failed jobs / recovery (technical failure ≠ candidate failure) ── */
  const recoverJob = (id, actionKey, reason = '') => {
    const j = failedJobs.find((x) => x.id === id); if (!j) return;
    const label = RECOVERY_ACTIONS.find((a) => a.key === actionKey)?.label || actionKey;
    const terminal = actionKey === 'escalate' ? 'ESCALATED' : 'RECOVERED';
    setFailedJobs((l) => l.map((x) => (x.id === id ? { ...x, status: terminal, creditsHeld: actionKey === 'reverse' ? 0 : x.creditsHeld, actions: [...x.actions, { key: actionKey, when: nowStamp(), by: actorLabel(), reason }] } : x)));
    if (actionKey === 'reverse' && j.creditsHeld > 0) {
      const holdOpen = j.reserveRef && !ledger.some((e) => e.reserveRef === j.reserveRef && (e.type === 'SETTLEMENT' || e.type === 'RESERVE_RELEASED' || e.type === 'OVERDRAFT'));
      if (holdOpen) {
        /* the credits were only HELD, never consumed: release the hold — do not mint a refund on top of it */
        releaseReserve(j.clientId, j.reserveRef, { hold: j.creditsHeld, oppId: j.oppId, oppTitle: j.oppTitle, candidate: j.candidate, module: j.module });
      } else {
        postLedger(j.clientId, 'REFUND', j.creditsHeld, { oppId: j.oppId, oppTitle: j.oppTitle, candidate: j.candidate, module: j.module, reason: reason || 'Technical failure — not candidate failure', ref: j.id });
      }
    }
    addAudit('Recovery', label, `${j.id} · ${j.candidate}`, { clientId: j.clientId, reason: reason || undefined });
    if (terminal === 'RECOVERED') notify('Evaluation / Operations', 'RESOLVED', `${j.id} recovered — ${label}`, `${j.candidate} · ${j.oppTitle} · ${nameOf(j.clientId)}`, ['super', 'ops', 'support'], '/admin/support?tab=jobs');
  };

  /* ── compliance ── */
  const setDataRequestStatus = (id, status) => { const r = dataRequests.find((x) => x.id === id); setDataRequests((l) => l.map((x) => (x.id === id ? { ...x, status } : x))); addAudit('Data request', `${r?.type || 'Request'} → ${status}`, `${r?.subject || id}`, { clientId: r?.clientId }); };
  const toggleLegalHold = (id, reason) => { const r = dataRequests.find((x) => x.id === id); setDataRequests((l) => l.map((x) => (x.id === id ? { ...x, legalHold: !x.legalHold, holdReason: !x.legalHold ? reason : '' } : x))); addAudit('Data request', `${r?.legalHold ? 'Released' : 'Applied'} legal hold`, r?.subject || id, { clientId: r?.clientId, reason }); };
  const addDataRequest = (type, subject, clientId) => { const id = 'DR-' + (++drSeq); setDataRequests((l) => [{ id, type, subject, clientId, requested: todayStamp(), due: 'in 30 days', status: 'PENDING', legalHold: false }, ...l]); addAudit('Data request', `${type} request logged`, subject, { clientId }); return id; };
  const setRetention = (category, days) => { setSettings((s) => ({ ...s, privacy: { ...s.privacy, retention: s.privacy.retention.map((r) => (r.category === category ? { ...r, days: Number(days) || 0 } : r)) } })); addAudit('Settings', `Retention: ${category} → ${days} days`, 'Data & Privacy'); };
  const overrideDecision = (oppId, candId, candidateName, original, override, reason, actor = 'Northstar Group · Hiring Manager') => {
    const opp = opportunities.find((o) => o.id === oppId);
    const id = 'ov' + (++ovSeq);
    setOverrides((l) => [{ id, when: nowStamp(), clientId: currentClientId, oppId, oppTitle: opp?.title || oppId, candidate: candidateName, original, override, actor, reason }, ...l]);
    addAudit('Override', `Human override: ${original} → ${override}`, `${candidateName} · ${opp?.title || oppId}`, { clientId: currentClientId, reason, actor, role: 'client' });
    return id;
  };
  /* provenance for a candidate result (spec §11) */
  /* §11: a recorded candidate carries a provenance SNAPSHOT taken at scoring time; only a record without
     one (should not happen) falls back to the live configuration. Editing an assessment later never rewrites history. */
  const provenanceFor = (opp, cand) => cand?.provenance || buildProvenance(opp, cand);

  /* ── admin users ── */
  const inviteAdmin = (name, email, role) => { setAdminUsers((l) => [...l, { id: 'ad' + rnd(), name, email, role, status: 'INVITED', mfa: false, lastActive: '—' }]); addAudit('Settings', `Invited admin (${roleName(role)})`, email); };
  const deactivateAdmin = (id) => { const u = adminUsers.find((x) => x.id === id); setAdminUsers((l) => l.map((x) => (x.id === id ? { ...x, status: 'DEACTIVATED' } : x))); addAudit('Settings', 'Deactivated admin user (history retained)', u?.email || id); };
  const setAdminRole = (id, role) => { const u = adminUsers.find((x) => x.id === id); setAdminUsers((l) => l.map((x) => (x.id === id ? { ...x, role } : x))); addAudit('Settings', `Changed admin role → ${roleName(role)}`, u?.email || id); };

  /* ── notifications (role-routed) ── */
  const notificationsFor = (roleId = currentAdmin.role) => notifications.filter((n) => roleId === 'super' ? true : (n.roles || []).includes(roleId));
  const markNotificationRead = (id) => setNotifications((l) => l.map((n) => (n.id === id ? { ...n, read: true } : n)));
  const markAllNotificationsRead = () => setNotifications((l) => l.map((n) => ((currentAdmin.role === 'super' || (n.roles || []).includes(currentAdmin.role)) ? { ...n, read: true } : n)));

  /* ── settings ── */
  const updateSettings = (section, patch) => { setSettings((s) => ({ ...s, [section]: { ...s[section], ...patch } })); addAudit('Settings', `Updated ${section} settings`, 'Settings · ' + section); };

  /* ── global search (RBAC-aware) ── */
  const searchAll = (q) => {
    const s = (q || '').trim().toLowerCase(); if (!s) return [];
    const out = [];
    const hit = (str) => (str || '').toString().toLowerCase().includes(s);
    clients.forEach((c) => { if (hit(c.name) || hit(c.tenantId) || hit(c.owner?.email)) out.push({ type: 'Client', id: c.id, title: c.name, sub: `${CLIENT_STATUS[c.status]?.label} · ${WALLET_STATE[walletOf(c).state]?.label}`, to: '/admin/clients/' + c.id }); });
    opportunities.forEach((o) => { if (hit(o.title)) out.push({ type: 'Opportunity', id: o.id, title: o.title, sub: `Northstar Group · ${o.status}`, to: '/admin/usage?opp=' + o.id }); });
    Object.entries(candidates).forEach(([oid, list]) => list.forEach((c) => { if (hit(c.name)) out.push({ type: 'Candidate', id: c.id, title: c.name, sub: `${opportunities.find((o) => o.id === oid)?.title || oid} · weighted ${c.weighted}`, to: '/admin/compliance?tab=provenance&cand=' + c.id }); }));
    if (can('ticket.view')) tickets.forEach((t) => { if (hit(t.id) || hit(t.subject) || hit(t.candidate)) out.push({ type: 'Support Ticket', id: t.id, title: `${t.id} · ${t.subject}`, sub: `${nameOf(t.clientId)} · ${TICKET_STATUS[t.status]?.label}`, to: '/admin/support?ticket=' + t.id }); });
    if (can('ledger.view')) ledger.forEach((e) => { if (hit(e.id) || hit(e.candidate) || hit(e.ref)) out.push({ type: 'Credit Transaction', id: e.id, title: `${e.id} · ${LEDGER_TYPE[e.type]?.label} ${e.credits > 0 ? '+' : ''}${e.credits}`, sub: `${nameOf(e.clientId)}${e.candidate ? ' · ' + e.candidate : ''}`, to: '/admin/credits?tab=ledger&q=' + e.id }); });
    if (can('payments.view')) payments.forEach((p) => { if (hit(p.id) || hit(p.reference)) out.push({ type: 'Invoice / Payment', id: p.id, title: `${p.id} · ${fmtMoney(p.amount)}`, sub: `${nameOf(p.clientId)} · ${p.status}`, to: '/admin/credits?tab=payments&q=' + p.id }); });
    if (can('job.recover')) failedJobs.forEach((j) => { if (hit(j.id) || hit(j.candidate)) out.push({ type: 'Evaluation Attempt', id: j.id, title: `${j.id} · ${JOB_KINDS[j.kind]?.label}`, sub: `${j.candidate} · ${nameOf(j.clientId)}`, to: '/admin/support?tab=jobs&job=' + j.id }); });
    if (can('admin.manage')) adminUsers.forEach((u) => { if (hit(u.name) || hit(u.email)) out.push({ type: 'Admin User', id: u.id, title: u.name, sub: `${roleName(u.role)} · ${u.status}`, to: '/admin/settings?tab=users' }); });
    return out.slice(0, 40);
  };
  const COMMANDS = [
    { id: 'cmd_add', label: 'Add credits', perm: 'wallet.addCredits', to: '/admin/credits?tab=wallets&action=add' },
    { id: 'cmd_client', label: 'Create client', perm: 'client.create', to: '/admin/clients/new' },
    { id: 'cmd_failed', label: 'Open failed evaluations', perm: 'job.recover', to: '/admin/support?tab=jobs' },
    { id: 'cmd_neg', label: 'View negative wallets', perm: 'ledger.view', to: '/admin/credits?tab=wallets&filter=OVERDRAFT' },
    { id: 'cmd_queue', label: 'Open support queue', perm: 'ticket.view', to: '/admin/support' },
    { id: 'cmd_usage', label: 'Open usage report', perm: 'usage.view', to: '/admin/usage' },
    { id: 'cmd_audit', label: 'Open audit log', perm: 'compliance.view', to: '/admin/compliance' },
  ];
  const commandsFor = () => COMMANDS.filter((c) => can(c.perm));

  /* ── client-side scoping ── */
  const currentClientId = impersonating?.id || 'cl1';
  const currentClient = getClient(currentClientId) || clients[0];
  const clientWallet = walletOf(currentClient);
  const clientLedger = ledger.filter((e) => e.clientId === currentClientId);
  const clientPayments = payments.filter((p) => p.clientId === currentClientId);
  const clientTickets = tickets.filter((t) => t.clientId === currentClientId);
  const clientOverrides = overrides.filter((o) => o.clientId === currentClientId);
  const clientOpportunities = opportunities.filter((o) => (o.clientId || 'cl1') === currentClientId);
  const clientFailedJobs = failedJobs.filter((j) => j.clientId === currentClientId);
  const buyCredits = (credits, method = 'Razorpay') => { addCredits(currentClientId, credits, { type: 'PURCHASE', method }); };
  const raiseTicket = (data) => addTicket(currentClientId, data);
  const inviteTeammate = (name, email, role) => setClientTeam((l) => [...l, { id: 'u' + rnd(), name, email, role, status: 'INVITED' }]);
  const setClientLowBalanceThreshold = (n) => setLowBalanceThreshold(currentClientId, n);
  const clientEstimate = (opp) => estimateFunding(opp, rateCard, settings);
  const clientCanStart = (cost = 0) => canStartPaidWork(currentClient, cost);

  /* ── opportunities (unchanged API) ── */
  const addOpportunity = (form) => {
    const id = String(++nextOppId);
    const { assessment: preset, ...rest } = form;
    const defaultAssessment = {
      version: 'v1',
      modules: [
        { key: 'resume', skills: form.requiredSkills || [], nQ: 0, rubric: ['Skill match vs JD'], gate: 'Fit ≥ 50 · knockout if must-have missing', weight: 0 },
        { key: 'written', skills: form.requiredSkills || [], nQ: 5, rubric: ['Domain knowledge', 'Written communication'], gate: 'Advance ≥ 60', weight: 50 },
        { key: 'interview', skills: form.requiredSkills || [], nQ: 10, rubric: ['Domain', 'Communication', 'Composure'], gate: 'Advance ≥ 60', weight: 40, languages: (form.requiredLanguages && form.requiredLanguages.length ? form.requiredLanguages : ['English']) },
      ],
      weights: [{ label: 'Written', w: 50 }, { label: 'AI Interview', w: 40 }, { label: 'Integrity', w: 10 }],
    };
    const opp = {
      id, clientId: currentClientId, status: form.status || 'OPEN', cleared: 0, inPipeline: 0,
      funnel: { applied: 0, screening: 0, assessment: 0, interview: 0, cleared: 0 },
      openedDate: '2026-08-26', requiredPositions: Number(form.requiredPositions) || 0,
      ...rest, skills: form.requiredSkills || [], languages: form.requiredLanguages || [],
      criteria: { minExperienceYears: form.minExperienceYears, minEducation: form.minEducation, minCefrLevel: form.minCefrLevel, minTypingWpm: form.minTypingWpm, minTypingAccuracy: form.minTypingAccuracy, minAssessmentScore: form.minAssessmentScore, minInterviewScore: form.minInterviewScore },
      assessment: (preset && preset.modules && preset.modules.length) ? { version: 'v1', ...preset } : defaultAssessment,
    };
    setOpportunities((list) => [opp, ...list]);
    patchClient(currentClientId, (c) => ({ oppsOpen: (c.oppsOpen || 0) + 1 }));
    return id;
  };
  const getOpportunity = (id) => opportunities.find((o) => o.id === id);
  const getCandidates = (id) => candidates[id] || [];
  /* The pool is every person who entered the funnel for this role: resume-gate rows (from send / careers / sourcing)
     plus anyone who holds an assessment link the gate rows don't cover (rescues, retakes, renewed links).
     Each row carries the LATEST invite for that person, so the assessment status shown is never stale. */
  const getPool = (id) => {
    const invs = Object.values(invites).filter((i) => i.oppId === id && i.source !== 'preview' && i.status !== 'RENEWED').sort((a, b) => b.createdAt - a.createdAt);
    /* One person can hold several links (re-sent, rescued, retake). Show the one that says the most:
       the most advanced status wins (Submitted > In progress > Opened > Sent); a newer retake/renewed link supersedes it. */
    const W = { SUBMITTED: 4, IN_PROGRESS: 3, OPENED: 2, SENT: 1 };
    const better = (i, best) => {
      if (!best) return true;
      if ((i.source === 'retake' || i.renewedFrom) && i.createdAt > best.createdAt) return true;
      const wi = W[inviteStatusOf(i)] || 0, wb = W[inviteStatusOf(best)] || 0;
      return wi !== wb ? wi > wb : i.createdAt > best.createdAt;
    };
    const byEmail = new Map(); invs.forEach((i) => { const k = (i.email || '').toLowerCase(); if (k && better(i, byEmail.get(k))) byEmail.set(k, i); });
    const byToken = new Map(invs.map((i) => [i.token, i]));
    const rows = (pool[id] || []).map((r) => {
      const latest = (r.email && byEmail.get(r.email.toLowerCase())) || (r.inviteToken && byToken.get(r.inviteToken)) || null;
      return latest ? { ...r, inviteToken: latest.token, pass: r.pass || latest.source === 'rescue', rescued: r.rescued || latest.source === 'rescue' } : r;
    });
    const coveredEmails = new Set(rows.map((r) => (r.email || '').toLowerCase()).filter(Boolean));
    const coveredTokens = new Set(rows.map((r) => r.inviteToken).filter(Boolean));
    const extra = [];
    byEmail.forEach((i, k) => {
      if (coveredEmails.has(k) || coveredTokens.has(i.token)) return;
      extra.push({ id: 'inv_' + i.token, name: i.name || nameFromEmail(i.email), email: i.email, source: i.source, fit: Number(i.fit?.fit) || 0, pass: true, inviteToken: i.token, appliedAt: fmtDate(i.createdAt), rescued: i.source === 'rescue', ...(i.fit?.reason && i.source === 'rescue' ? { reason: i.fit.reason } : {}) });
    });
    return [...rows, ...extra];
  };
  /* ── candidate invites: the assessment LINK is the candidate's entry (time-bound, resumable, one attempt) ── */
  const linkDays = () => Number(settings?.evaluation?.linkExpiryDays) || 7;
  const fitThresholdDefault = () => Number(settings?.evaluation?.defaultFitThreshold) || 60;
  const createInvite = (oppId, { name = '', email = '', source = 'email', validDays, fit = null, attemptNo = 1, renewedFrom = null } = {}) => {
    const opp = opportunities.find((o) => o.id === oppId);
    const token = 'a' + rnd() + rnd();
    const now = Date.now();
    const inv = {
      token, oppId, oppTitle: opp?.title || '', clientId: opp?.clientId || currentClientId,
      name: String(name || '').trim(), email: String(email || '').trim().toLowerCase(), source, status: 'SENT',
      createdAt: now, expiresAt: now + (Number(validDays) || linkDays()) * 86400000,
      openedAt: null, startedAt: null, submittedAt: null,
      attemptNo, attemptsAllowed: 1 + (Number(settings?.evaluation?.maxRetakes) || 0),
      fit, attempt: null, outcome: null, renewedFrom, renewedTo: null,
    };
    /* a recruiter preview is throw-away: keep only the newest preview link per opportunity */
    setInvites((st) => { const next = { ...st }; if (source === 'preview') Object.values(st).forEach((x) => { if (x.source === 'preview' && x.oppId === oppId) delete next[x.token]; }); next[token] = inv; return next; });
    return inv;
  };
  const getInvite = (token) => (token && invites[token]) || null;
  const invitesFor = (oppId) => Object.values(invites).filter((i) => i.oppId === oppId && i.source !== 'preview').sort((a, b) => b.createdAt - a.createdAt);
  const patchInvite = (token, patch) => setInvites((st) => (st[token] ? { ...st, [token]: { ...st[token], ...(typeof patch === 'function' ? patch(st[token]) : patch) } } : st));
  const openInvite = (token) => patchInvite(token, (i) => (i.status === 'SENT' ? { status: 'OPENED', openedAt: Date.now() } : {}));
  const saveAttempt = (token, attemptPatch = {}) => patchInvite(token, (i) => (['SUBMITTED', 'ABANDONED', 'DECLINED'].includes(i.status) ? {} : { status: 'IN_PROGRESS', startedAt: i.startedAt || Date.now(), attempt: { ...(i.attempt || {}), ...attemptPatch, savedAt: Date.now() } }));
  const submitInvite = (token, outcome = null) => patchInvite(token, { status: 'SUBMITTED', submittedAt: Date.now(), outcome });
  const declineInvite = (token) => patchInvite(token, { status: 'DECLINED', declinedAt: Date.now() });
  const abandonInvite = (token) => patchInvite(token, { status: 'ABANDONED', abandonedAt: Date.now() });
  const renewInvite = (token) => {
    const old = invites[token]; if (!old) return null;
    const inv = createInvite(old.oppId, { name: old.name, email: old.email, source: old.source, fit: old.fit, attemptNo: old.attemptNo, renewedFrom: token });
    patchInvite(token, { status: 'RENEWED', renewedTo: inv.token });
    addAudit('Candidate', 'New assessment link issued', `${old.name || old.email} · ${old.oppTitle}`, { clientId: old.clientId, actor: 'System', role: 'system', reason: 'Previous link expired or was replaced' });
    return inv;
  };
  /* one applicant through the resume gate → pool row (+ link when they clear) */
  const screenApplicant = (opp, a, { preview = false } = {}) => {
    const screen = screenResume(opp, a, { fitThreshold: fitThresholdDefault() });
    const row = { id: 'pl_' + rnd(), name: a.name, email: a.email, source: a.source, fit: screen.fit, pass: screen.pass, appliedAt: todayStamp(), matched: screen.matched, missing: screen.missing, ...(screen.reason ? { reason: screen.reason } : {}) };
    let invite = null;
    if (screen.pass) { invite = createInvite(opp.id, { name: a.name, email: a.email, source: preview ? 'preview' : a.source, fit: screen }); row.inviteToken = invite.token; }
    return { screen, row, invite };
  };
  /* careers page: apply → resume gate → link (pass) or pool with a reason (soft reject) */
  const applyToOpportunity = (oppId, { name, email, phone = '', resumeName = '', resumeText = '', preview = false } = {}) => {
    const opp = opportunities.find((o) => o.id === oppId); if (!opp) return null;
    const { screen, row, invite } = screenApplicant(opp, { name, email, phone, resumeName, resumeText, source: 'careers' }, { preview });
    if (!preview) {
      const cid = opp.clientId || currentClientId;
      const r = rateOf('resume');
      if (r > 0) consumeCredits(cid, r, { oppId, oppTitle: opp.title, candidate: name, module: 'Resume Analyser', usage: '1 candidate', rate: `${r} cr / candidate` });
      recordUsage(cid, { candidates: 1, resumeAnalyses: 1 });
      setPool((p) => ({ ...p, [oppId]: [...(p[oppId] || []), row] }));
      setOpportunities((list) => list.map((o) => (o.id === oppId ? { ...o, inPipeline: (o.inPipeline || 0) + 1, funnel: { ...(o.funnel || {}), applied: (o.funnel?.applied || 0) + 1, screening: (o.funnel?.screening || 0) + (screen.pass ? 1 : 0) } } : o)));
      addAudit('Candidate', screen.pass ? 'Applied · cleared resume gate · link sent' : 'Applied · soft-rejected to pool', `${name} · ${opp.title}`, { clientId: cid, actor: 'System', role: 'system', reason: screen.reason });
    }
    return { screen, invite };
  };
  /* rescue from the pool = a recruiter override of the gate: issue the link, keep the original reason on record */
  const rescue = (oppId, candId) => {
    const row = (pool[oppId] || []).find((c) => c.id === candId);
    const opp = opportunities.find((o) => o.id === oppId);
    if (!row || !opp) return null;
    const inv = createInvite(oppId, { name: row.name, email: row.email || emailFromName(row.name), source: 'rescue', fit: { fit: row.fit, pass: true, reason: row.reason, rescued: true } });
    setPool((p) => ({ ...p, [oppId]: (p[oppId] || []).map((c) => (c.id === candId ? { ...c, pass: true, rescued: true, inviteToken: inv.token } : c)) }));
    addAudit('Override', 'Rescued from resume gate — assessment link sent', `${row.name} · ${opp.title}`, { clientId: opp.clientId || currentClientId, actor: `${currentClient?.name || 'Client'} · Recruiter`, role: 'client', reason: row.reason || 'Recruiter override' });
    return inv;
  };

  /* ── the PRODUCT outcome (not the money trail): a finished candidate lands on the client's Rank List ── */
  const recordCandidateResult = (oppId, { name, email = '', inviteToken = null, source = '', scores = {}, cefr = 'B2', wpm = 0, exp = '—', minutes = 0 } = {}) => {
    const opp = opportunities.find((o) => o.id === oppId); if (!opp) return null;
    const id = 'live_' + rnd();
    const base = { id, name: name || 'Candidate', email, inviteToken, source, cefr, wpm, exp, clearedAt: todayStamp(), scores: { ...scores }, minutes };
    const weights = (opp.assessment?.weights || []).filter((w) => base.scores[w.label] != null);
    const row = { ...base, weighted: weightedScore(base, weights), provenance: buildProvenance(opp, base) };
    setCandidates((c) => ({ ...c, [oppId]: [...(c[oppId] || []), row] }));
    setOpportunities((list) => list.map((o) => (o.id === oppId
      ? { ...o, cleared: (o.cleared || 0) + 1, funnel: { ...(o.funnel || {}), assessment: (o.funnel?.assessment || 0) + 1, interview: (o.funnel?.interview || 0) + 1, cleared: (o.funnel?.cleared || 0) + 1 } }
      : o)));
    addAudit('Scoring', 'Candidate cleared all stages', `${row.name} · ${opp.title}`, { clientId: opp.clientId || currentClientId, actor: 'System', role: 'system' });
    return id;
  };
  const addToPool = (oppId, { name, fit, pass, reason }) => {
    const id = 'pl_' + rnd();
    setPool((p) => ({ ...p, [oppId]: [...(p[oppId] || []), { id, name: name || 'Candidate', fit: Number(fit) || 0, pass: !!pass, ...(pass ? {} : { reason: reason || 'Below fit threshold' }) }] }));
    return id;
  };
  const updateAssessment = (id, assessment) => setOpportunities((list) => list.map((o) => (o.id === id ? { ...o, assessment: { ...assessment, version: 'v' + ((parseInt((o.assessment?.version || 'v1').slice(1), 10) || 1) + 1) } } : o)));
  const setOppStatus = (id, status) => setOpportunities((list) => list.map((o) => (o.id === id ? { ...o, status } : o)));
  /* Send Assessment: every applicant hits the resume gate NOW; those who clear get a link, the rest go to the pool with a reason */
  const sendAssessment = (id, { emails = [], sourced = 0, careerPage = false } = {}) => {
    const opp = opportunities.find((o) => o.id === id); if (!opp) return { invites: [], rows: [], passed: 0, rejected: 0 };
    const applicants = [
      ...emails.map((e) => ({ name: nameFromEmail(e), email: String(e).trim().toLowerCase(), source: 'email' })),
      ...Array.from({ length: Number(sourced) || 0 }, () => { const nm = POOL_NAMES[(poolNameSeq++) % POOL_NAMES.length]; return { name: nm, email: emailFromName(nm), source: 'sourced' }; }),
    ];
    const n = applicants.length;
    setOpportunities((list) => list.map((o) => (o.id === id ? { ...o, sent: true, careersPublished: !!careerPage || !!o.careersPublished, inPipeline: (o.inPipeline || 0) + n, funnel: { ...(o.funnel || {}), applied: (o.funnel?.applied || 0) + n } } : o)));
    if (!n) return { invites: [], rows: [], passed: 0, rejected: 0 };
    const cid = opp.clientId || currentClientId;
    const r = rateOf('resume');
    if (r > 0) consumeCredits(cid, n * r, { oppId: id, oppTitle: opp.title, candidate: `${n} applicants`, module: 'Resume Analyser', usage: `${n} candidates`, rate: `${r} cr / candidate` });
    recordUsage(cid, { candidates: n, resumeAnalyses: n });
    const made = [], rows = [];
    applicants.forEach((a) => { const { row, invite } = screenApplicant(opp, a); rows.push(row); if (invite) made.push(invite); });
    setPool((p) => ({ ...p, [id]: [...(p[id] || []), ...rows] }));
    setOpportunities((list) => list.map((o) => (o.id === id ? { ...o, funnel: { ...(o.funnel || {}), screening: (o.funnel?.screening || 0) + made.length } } : o)));
    addAudit('Candidate', `Assessment sent · ${n} screened · ${made.length} links issued`, opp.title, { clientId: cid, actor: `${currentClient?.name || 'Client'} · Recruiter`, role: 'client' });
    return { invites: made, rows, passed: made.length, rejected: rows.length - made.length };
  };
  const addCustomModule = (def) => { const key = 'custom_' + rnd(); setCustomModules((list) => [...list, { key, time: 'custom', custom: true, ...def }]); return key; };
  const saveTemplate = (name, modulesArr, weights) => { const id = 'tpl_' + rnd(); setAssessmentTemplates((l) => [{ id, name, createdAt: 'just now', modules: (modulesArr || []).map((m) => ({ ...m })), weights: (weights || []).map((w) => ({ ...w })) }, ...l]); return id; };
  const deleteTemplate = (id) => setAssessmentTemplates((l) => l.filter((t) => t.id !== id));

  /* ── derived admin aggregates (cheap, memoised) ── */
  const aggregates = useMemo(() => {
    const active = clients.filter((c) => c.status === 'ACTIVE');
    const wallets = clients.map((c) => ({ c, w: walletOf(c) }));
    return {
      activeClients: active.length,
      creditsSold: ledger.filter((e) => e.type === 'PURCHASE').reduce((a, e) => a + e.credits, 0),
      creditsConsumed: clients.reduce((a, c) => a + (c.usage?.creditsConsumed || 0), 0),
      outstanding: wallets.reduce((a, { w }) => a + w.outstanding, 0),
      revenue: payments.filter((p) => p.status === 'SUCCEEDED').reduce((a, p) => a + p.amount, 0),
      lowCredit: wallets.filter(({ c, w }) => c.status === 'ACTIVE' && (w.state === 'LOW_BALANCE' || w.state === 'ZERO')).map(({ c }) => c),
      negative: wallets.filter(({ w }) => w.state === 'OVERDRAFT').map(({ c }) => c),
      blocked: wallets.filter(({ w }) => w.state === 'BLOCKED_FOR_NEW_USAGE').map(({ c }) => c),
      openJobs: failedJobs.filter((j) => j.status === 'OPEN'),
      openTickets: tickets.filter((t) => t.status !== 'RESOLVED' && t.status !== 'CLOSED'),
      pendingRequests: dataRequests.filter((r) => r.status === 'PENDING' || r.status === 'IN_PROGRESS'),
      totalCandidates: clients.reduce((a, c) => a + (c.usage?.candidates || 0), 0),
      totalEvals: clients.reduce((a, c) => a + (c.usage?.evaluations || 0), 0),
      totalInterviews: clients.reduce((a, c) => a + (c.usage?.interviews || 0), 0),
      totalProctoring: clients.reduce((a, c) => a + (c.usage?.proctoringSessions || 0), 0),
      totalFailed: clients.reduce((a, c) => a + (c.usage?.failed || 0), 0),
      degradedIntegrations: integrations.filter((i) => i.status === 'DEGRADED'),
      /* live: an open RESERVE (no settlement / release / overdraft carrying its ref) IS an evaluation in flight */
      runningJobs: (() => { const closed = new Set(ledger.filter((e) => e.reserveRef).map((e) => e.reserveRef)); return ledger.filter((e) => e.type === 'RESERVE' && !closed.has(e.id)).length; })(),
      queued: failedJobs.filter((j) => j.status === 'OPEN' && (j.kind === 'PENDING_SCORE' || String(j.kind).startsWith('STUCK_'))).length,
      incidents: integrations.filter((i) => i.status === 'DEGRADED').length,
    };
  }, [clients, ledger, payments, failedJobs, tickets, dataRequests, integrations]);

  return (
    <AppCtx.Provider value={{
      resetWorkspace,
      /* client-side product */
      opportunities, clientOpportunities, addOpportunity, getOpportunity, getCandidates, getPool, rescue, recordCandidateResult, addToPool, updateAssessment, setOppStatus, sendAssessment, customModules, addCustomModule,
      assessmentTemplates, saveTemplate, deleteTemplate,
      invites, invitesFor, getInvite, createInvite, openInvite, saveAttempt, submitInvite, declineInvite, abandonInvite, renewInvite, applyToOpportunity,
      currentClientId, currentClient, clientWallet, clientLedger, clientPayments, clientTickets, clientOverrides, clientFailedJobs, clientTeam, inviteTeammate,
      buyCredits, raiseTicket, setClientLowBalanceThreshold, clientEstimate, clientCanStart, availableCatalogFor, moduleAvailableFor, provenanceFor, overrideDecision,
      impersonating, setImpersonating,
      /* admin: data */
      clients, getClient, nameOf, ledger, payments, rateCard, failedJobs, tickets, modules, integrations, auditLog, dataRequests, consentVersions, overrides, fairness,
      notifications, notificationsFor, markNotificationRead, markAllNotificationsRead, adminUsers, currentAdmin, setCurrentRole, settings, usageSeries, aggregates,
      /* admin: RBAC */
      can, requiresReason, isCritical,
      /* admin: actions */
      onboardClient, resendInvite, revokeInvite, activateClient, suspendClient, reinstateClient, startOffboarding, completeOffboardingStep, updateClient, exportClientData,
      addCredits, refundCredits, manualAdjust, setOverdraftLimit, setLowBalanceThreshold, freezeWallet, unfreezeWallet, recordPayment, retryPayment, setRate,
      rateOf, reserveCredits, consumeCredits, settleReserve, releaseReserve, recordUsage, reportFailedJob,
      pauseClientUsage, resumeClientUsage, acknowledgeSpike,
      setModuleState, setModuleRollout, grantModuleAccess, revokeModuleAccess, pauseModule, unpauseModule, addModule,
      toggleIntegration, connectIntegration, disconnectIntegration, testIntegration, rotateCredentials, setPrimaryIntegration,
      addTicket, setTicketStatus, replyTicket, setTicketPriority, recoverJob,
      setDataRequestStatus, toggleLegalHold, addDataRequest, setRetention,
      inviteAdmin, deactivateAdmin, setAdminRole, updateSettings, searchAll, commandsFor, addAudit,
      OFFBOARDING_STEPS,
    }}>
      {children}
    </AppCtx.Provider>
  );
}

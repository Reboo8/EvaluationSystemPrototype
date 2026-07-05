import { createContext, useContext, useState, useEffect } from 'react';

const AppCtx = createContext(null);
export const useApp = () => useContext(AppCtx);

/* weighted score derived from a candidate's sub-scores + the opportunity's rank weights,
   so the "Weighted" column is always consistent with the per-parameter columns next to it. */
export function weightedScore(cand, weights) {
  if (!weights?.length || !cand?.scores) return cand?.weighted ?? 0;
  const total = weights.reduce((a, w) => a + (Number(w.w) || 0), 0) || 100;
  const sum = weights.reduce((a, w) => a + (Number(w.w) || 0) * (Number(cand.scores[w.label]) || 0), 0);
  return Math.round((sum / total) * 10) / 10;
}

/* candidates ranked high→low by their (recomputed) weighted score */
export function ranked(cands, weights) {
  return [...cands].sort((a, b) => weightedScore(b, weights) - weightedScore(a, weights));
}

/* ── three fully-configured example opportunities (in-memory; resets on refresh) ── */
const SEED_OPPS = [
  {
    id: '1', title: 'Software Developer', status: 'OPEN', location: 'Delhi, India', workMode: 'On-site',
    roleType: 'Full-time', department: 'SaaS / Tech', requiredPositions: 10, cleared: 6, inPipeline: 23,
    funnel: { applied: 120, screening: 84, assessment: 41, interview: 18, cleared: 6 },
    closingDate: '2026-07-30', openedDate: '2026-06-24',
    skills: ['JavaScript', 'ReactJs', 'NodeJs', 'ExpressJs', 'DSA', 'MongoDB', 'Mongoose'],
    languages: ['English', 'Hindi'],
    jobDescription: 'We are looking for a Software Developer passionate about building scalable, user-friendly applications — developing and maintaining web apps and backend services, writing clean reusable code, and collaborating across the team.',
    criteria: { minExperienceYears: 3, minEducation: "Graduate (Bachelor's)", minCefrLevel: 'C1', minTypingWpm: 40, minTypingAccuracy: 90, minAssessmentScore: 80, minInterviewScore: 80 },
    assessment: {
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
    id: '2', title: 'Customer Support (Tech)', status: 'OPEN', location: 'Remote', workMode: 'Remote',
    roleType: 'Full-time', department: 'Operations', requiredPositions: 50, cleared: 31, inPipeline: 64,
    funnel: { applied: 500, screening: 310, assessment: 150, interview: 70, cleared: 31 },
    closingDate: '2026-08-15', openedDate: '2026-06-20',
    skills: ['Communication', 'Active Listening', 'Problem Solving', 'English', 'Hindi', 'CRM'],
    languages: ['English', 'Hindi'],
    jobDescription: 'Acme Cloud is hiring Tech Customer-Support Agents to help customers resolve issues with empathy and speed across chat and voice.',
    criteria: { minExperienceYears: 0, minEducation: 'Any', minCefrLevel: 'B2', minTypingWpm: 30, minTypingAccuracy: 90, minAssessmentScore: 60, minInterviewScore: 60 },
    assessment: {
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
    id: '3', title: 'General Physician', status: 'OPEN', location: 'Bangalore', workMode: 'On-site',
    roleType: 'Full-time', department: 'Healthcare', requiredPositions: 8, cleared: 3, inPipeline: 12,
    funnel: { applied: 90, screening: 34, assessment: 20, interview: 9, cleared: 3 },
    closingDate: '2026-08-05', openedDate: '2026-06-22',
    skills: ['MBBS', 'Medical Council Registration', 'Internal Medicine', 'Patient Communication'],
    languages: ['English', 'Kannada', 'Hindi'],
    jobDescription: 'Meridian Hospitals seeks General Physicians (MBBS + valid registration) for internal medicine and patient care.',
    criteria: { minExperienceYears: 1, minEducation: "Graduate (Bachelor's)", minCefrLevel: 'B2', minTypingWpm: 0, minTypingAccuracy: 0, minAssessmentScore: 70, minInterviewScore: 65 },
    assessment: {
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

// cleared candidates per opportunity — `scores` keyed by that opportunity's weight labels
const SEED_CANDIDATES = {
  '1': [
    { id: 'c1', name: 'Arjun Mehta', weighted: 81.2, cefr: 'C1', wpm: 61, exp: '3 yrs', clearedAt: '27 Jun 2026', scores: { Coding: 88, 'AI Interview': 80, Written: 74, 'Resume-fit': 82, Integrity: 98 } },
    { id: 'c2', name: 'Priya Sharma', weighted: 78.9, cefr: 'C1', wpm: 52, exp: '4 yrs', clearedAt: '27 Jun 2026', scores: { Coding: 82, 'AI Interview': 76, Written: 71, 'Resume-fit': 78, Integrity: 95 } },
    { id: 'c3', name: 'Sneha Reddy', weighted: 77.4, cefr: 'B2', wpm: 48, exp: '5 yrs', clearedAt: '26 Jun 2026', scores: { Coding: 80, 'AI Interview': 79, Written: 70, 'Resume-fit': 75, Integrity: 96 } },
    { id: 'c4', name: 'Karan Singh', weighted: 74.8, cefr: 'B2', wpm: 55, exp: '2 yrs', clearedAt: '26 Jun 2026', scores: { Coding: 79, 'AI Interview': 72, Written: 73, 'Resume-fit': 71, Integrity: 94 } },
    { id: 'c5', name: 'Divya Nair', weighted: 73.2, cefr: 'C1', wpm: 44, exp: '3 yrs', clearedAt: '25 Jun 2026', scores: { Coding: 71, 'AI Interview': 78, Written: 69, 'Resume-fit': 80, Integrity: 97 } },
    { id: 'c6', name: 'Rohit Verma', weighted: 71.5, cefr: 'B2', wpm: 50, exp: '4 yrs', clearedAt: '25 Jun 2026', scores: { Coding: 74, 'AI Interview': 70, Written: 68, 'Resume-fit': 73, Integrity: 92 } },
  ],
  '2': [
    { id: 'd1', name: 'Rahul Verma', weighted: 78.6, cefr: 'B2', wpm: 38, exp: '1 yr', clearedAt: '26 Jun 2026', scores: { Language: 78, SJT: 80, Simulation: 76, 'AI Interview': 79, Integrity: 96, Typing: 82 } },
    { id: 'd2', name: 'Aisha Khan', weighted: 76.2, cefr: 'C1', wpm: 41, exp: '2 yrs', clearedAt: '26 Jun 2026', scores: { Language: 82, SJT: 74, Simulation: 72, 'AI Interview': 77, Integrity: 95, Typing: 88 } },
    { id: 'd3', name: 'Vikram Das', weighted: 72.9, cefr: 'B2', wpm: 35, exp: '6 mo', clearedAt: '25 Jun 2026', scores: { Language: 71, SJT: 76, Simulation: 70, 'AI Interview': 73, Integrity: 94, Typing: 79 } },
    { id: 'd4', name: 'Fatima Sheikh', weighted: 71.1, cefr: 'B2', wpm: 44, exp: '1 yr', clearedAt: '24 Jun 2026', scores: { Language: 70, SJT: 72, Simulation: 71, 'AI Interview': 70, Integrity: 93, Typing: 90 } },
  ],
  '3': [
    { id: 'e1', name: 'Dr. Ananya Iyer', weighted: 82.5, cefr: 'C1', wpm: 0, exp: '3 yrs', clearedAt: '27 Jun 2026', scores: { 'Medical Knowledge': 78, 'Clinical Judgement': 82, 'AI Interview': 80, Integrity: 97 } },
    { id: 'e2', name: 'Dr. Rohan Pillai', weighted: 79.8, cefr: 'C1', wpm: 0, exp: '5 yrs', clearedAt: '26 Jun 2026', scores: { 'Medical Knowledge': 81, 'Clinical Judgement': 78, 'AI Interview': 76, Integrity: 95 } },
    { id: 'e3', name: 'Dr. Kavya Menon', weighted: 76.4, cefr: 'B2', wpm: 0, exp: '2 yrs', clearedAt: '25 Jun 2026', scores: { 'Medical Knowledge': 74, 'Clinical Judgement': 79, 'AI Interview': 74, Integrity: 96 } },
  ],
};

// resume-gate pool per opportunity (passed + soft-rejected)
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

/* ════════════ ADMIN / OPERATOR CONTROL PLANE (in-memory) ════════════ */
export const PLANS = [
  { id: 'starter', name: 'Starter', price: 15000, oppLimit: 3, evalLimit: 50, seats: 2,
    features: ['Resume gate + JD match', 'MCQ · Written · Typing', 'AI Interview — 1 language', 'Rank list', 'Email support'] },
  { id: 'growth', name: 'Growth', price: 45000, oppLimit: 15, evalLimit: 200, seats: 8, popular: true,
    features: ['Everything in Starter', 'All test modules', 'Multilingual AI Interview', 'Rank + Compare + Pool', 'Career page + embed/widget', 'Priority support'] },
  { id: 'enterprise', name: 'Enterprise', price: null, oppLimit: Infinity, evalLimit: Infinity, seats: Infinity,
    features: ['Everything in Growth', 'Unlimited opportunities & evals', 'Custom modules + SSO', 'Dedicated CSM + SLA', 'Bias-audit reports', 'Audit logs + data residency'] },
];
export const planOf = (id) => PLANS.find((p) => p.id === id) || PLANS[0];

/* usage-derived limit + revenue helpers — single source of truth so KPIs, alerts,
   badges and bars stay consistent after any plan change / reinstate */
export const evalLimitReached = (c) => { const lim = planOf(c.plan).evalLimit; return lim !== Infinity && c.evalsUsed >= lim; };
export const isServing = (c) => c.status !== 'INVITED' && c.status !== 'SUSPENDED';
export const clientMrr = (c) => (isServing(c) ? (c.mrr ?? planOf(c.plan).price ?? 0) : 0);
const reached = (evalsUsed, planId) => { const lim = planOf(planId).evalLimit; return lim !== Infinity && evalsUsed >= lim; };

const SEED_CLIENTS = [
  { id: 'cl1', name: 'Flipkart', industry: 'E-commerce', contact: 'hr@flipkart.com', admin: 'Flipkart Admin', plan: 'growth', evalsUsed: 47, oppsOpen: 3, seatsUsed: 6, status: 'ACTIVE', billing: 'CURRENT', since: 'May 2026', mrr: 45000 },
  { id: 'cl2', name: 'Acme Cloud', industry: 'SaaS', contact: 'talent@acme.io', admin: 'Acme TA', plan: 'enterprise', evalsUsed: 312, oppsOpen: 9, seatsUsed: 14, status: 'ACTIVE', billing: 'CURRENT', since: 'Apr 2026', mrr: 120000 },
  { id: 'cl3', name: 'Meridian Hospitals', industry: 'Healthcare', contact: 'careers@meridian.health', admin: 'Meridian HR', plan: 'growth', evalsUsed: 12, oppsOpen: 2, seatsUsed: 3, status: 'ACTIVE', billing: 'CURRENT', since: 'Jun 2026', mrr: 45000 },
  { id: 'cl4', name: 'Zentro BPO', industry: 'BPO / Support', contact: 'ops@zentro.com', admin: 'Zentro Ops', plan: 'starter', evalsUsed: 50, oppsOpen: 3, seatsUsed: 2, status: 'LIMIT', billing: 'CURRENT', since: 'Jun 2026', mrr: 15000 },
  { id: 'cl5', name: 'NovaPay', industry: 'Fintech', contact: 'people@novapay.in', admin: 'Nova People', plan: 'growth', evalsUsed: 88, oppsOpen: 4, seatsUsed: 5, status: 'PAST_DUE', billing: 'FAILED', since: 'Mar 2026', mrr: 45000 },
  { id: 'cl6', name: 'BrightLearn', industry: 'EdTech', contact: 'hr@brightlearn.co', admin: 'Bright HR', plan: 'starter', evalsUsed: 0, oppsOpen: 0, seatsUsed: 0, status: 'INVITED', billing: 'NONE', since: 'Jun 2026', mrr: 0 },
];

const SEED_INVOICES = [
  { id: 'INV-2041', clientId: 'cl2', amount: 120000, date: '01 Jun 2026', status: 'PAID' },
  { id: 'INV-2042', clientId: 'cl1', amount: 45000, date: '05 Jun 2026', status: 'PAID' },
  { id: 'INV-2043', clientId: 'cl3', amount: 45000, date: '08 Jun 2026', status: 'PAID' },
  { id: 'INV-2044', clientId: 'cl5', amount: 45000, date: '03 Jun 2026', status: 'FAILED' },
  { id: 'INV-2045', clientId: 'cl4', amount: 15000, date: '10 Jun 2026', status: 'PENDING' },
];

const SEED_TICKETS = [
  { id: 'TKT-1060', clientId: 'cl5', subject: 'Invoice payment failed — card declined', priority: 'Urgent', status: 'OPEN', updated: '27 Jun 2026' },
  { id: 'TKT-1058', clientId: 'cl3', subject: 'Add a teammate as Recruiter', priority: 'Low', status: 'OPEN', updated: '27 Jun 2026' },
  { id: 'TKT-1051', clientId: 'cl1', subject: 'Candidate stuck on hardware check', priority: 'High', status: 'IN_PROGRESS', updated: '26 Jun 2026' },
  { id: 'TKT-1043', clientId: 'cl2', subject: 'REST API rate-limit question', priority: 'Medium', status: 'RESOLVED', updated: '25 Jun 2026' },
];

const SEED_ERASURE = [
  { id: 'er2', subject: 'candidate #5012', clientId: 'cl2', requested: '27 Jun 2026', status: 'PENDING' },
  { id: 'er1', subject: 'candidate #4821', clientId: 'cl1', requested: '26 Jun 2026', status: 'FULFILLED' },
];

const SEED_CATALOG = [
  { key: 'resume', name: 'Resume / JD Screen', scoring: 'rule + AI', enabled: true },
  { key: 'written', name: 'Written', scoring: 'AI rubric', enabled: true },
  { key: 'mcq', name: 'MCQ / Objective', scoring: 'auto', enabled: true },
  { key: 'coding', name: 'Coding', scoring: 'test cases', enabled: true },
  { key: 'sjt', name: 'Situational Judgement', scoring: 'AI rubric', enabled: true },
  { key: 'language', name: 'Language / CEFR', scoring: 'auto + AI', enabled: true },
  { key: 'personality', name: 'Personality', scoring: 'model', enabled: true },
  { key: 'typing', name: 'Typing', scoring: 'auto', enabled: true },
  { key: 'computer', name: 'Computer Literacy', scoring: 'auto', enabled: true },
  { key: 'interview', name: 'AI Interview', scoring: 'AI rubric · multilingual', enabled: true },
  { key: 'simulation', name: 'Simulation', scoring: 'AI rubric', enabled: true },
  { key: 'custom', name: 'Custom Questionnaire', scoring: 'manual', enabled: false },
];

const SEED_AUDIT = [
  { when: '27 Jun 14:02', actor: 'Flipkart · Recruiter', action: 'Advanced candidate', resource: 'Priya Sharma' },
  { when: '27 Jun 13:40', actor: 'Flipkart · Admin', action: 'Changed thresholds', resource: 'Software Developer' },
  { when: '27 Jun 11:15', actor: 'Operator', action: 'Onboarded client', resource: 'Meridian Hospitals' },
  { when: '26 Jun 18:50', actor: 'System', action: 'Erasure request fulfilled', resource: 'candidate #4821' },
];

/* ════════════ ROLE CATALOG — category (sector) → role templates ════════════
   Picking a role in Create Opportunity prefills title/skills/languages/JD + a tailored
   assessment (modules + rank weights). Weights per role total 100. */
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

/* ════════════ SAVED ASSESSMENT TEMPLATES (client-saved, persisted) ════════════ */
const TPL_KEY = 'reboo8_assessment_templates';
const _roleAsmt = (catId, roleId) => { const c = ROLE_CATALOG.find((x) => x.id === catId); const r = c && c.roles.find((x) => x.id === roleId); return r ? r.assessment : { modules: [], weights: [] }; };
const SEED_TEMPLATES = [
  { id: 'tpl_seed_swe', name: 'Software Developer — standard', createdAt: 'Built-in', ..._roleAsmt('it', 'swe') },
  { id: 'tpl_seed_cx', name: 'Customer Support (Voice) — standard', createdAt: 'Built-in', ..._roleAsmt('cx', 'cs-voice') },
  { id: 'tpl_seed_doc', name: 'General Physician — standard', createdAt: 'Built-in', ..._roleAsmt('health', 'physician') },
];

let nextId = 3;
let nextClientId = 6;
let auditSeq = 100;

export function AppProvider({ children }) {
  const [opportunities, setOpportunities] = useState(SEED_OPPS);
  const [candidates] = useState(SEED_CANDIDATES);
  const [pool, setPool] = useState(SEED_POOL);
  const [customModules, setCustomModules] = useState([]);

  /* ── admin / operator state ── */
  const [clients, setClients] = useState(SEED_CLIENTS);
  const [invoices, setInvoices] = useState(SEED_INVOICES);
  const [tickets, setTickets] = useState(SEED_TICKETS);
  const [erasures, setErasures] = useState(SEED_ERASURE);
  const [catalog, setCatalog] = useState(SEED_CATALOG);
  const [auditLog, setAuditLog] = useState(SEED_AUDIT.map((a, i) => ({ id: 'seed' + i, ...a })));
  const [catalogPublishedAt, setCatalogPublishedAt] = useState(null);
  const [impersonating, setImpersonating] = useState(null);
  const [assessmentTemplates, setAssessmentTemplates] = useState(() => { try { const s = JSON.parse(localStorage.getItem(TPL_KEY)); return Array.isArray(s) && s.length ? s : SEED_TEMPLATES; } catch { return SEED_TEMPLATES; } });
  useEffect(() => { try { localStorage.setItem(TPL_KEY, JSON.stringify(assessmentTemplates)); } catch { /* ignore */ } }, [assessmentTemplates]);
  const saveTemplate = (name, modules, weights) => { const id = 'tpl_' + Math.random().toString(36).slice(2, 7); setAssessmentTemplates((l) => [{ id, name, createdAt: 'just now', modules: (modules || []).map((m) => ({ ...m })), weights: (weights || []).map((w) => ({ ...w })) }, ...l]); return id; };
  const deleteTemplate = (id) => setAssessmentTemplates((l) => l.filter((t) => t.id !== id));

  const addAudit = (action, resource) => setAuditLog((l) => [{ id: 'au' + (++auditSeq), when: 'just now', actor: 'Operator', action, resource }, ...l]);

  const getClient = (id) => clients.find((c) => c.id === id);
  const onboardClient = ({ name, industry, contact, admin, planId }) => {
    const id = 'cl' + String(++nextClientId);
    setClients((list) => [{ id, name, industry: industry || '—', contact: contact || '—', admin: admin || '—', plan: planId || 'starter', evalsUsed: 0, oppsOpen: 0, seatsUsed: 0, status: 'INVITED', billing: 'NONE', since: 'Jun 2026' }, ...list]);
    addAudit('Onboarded client', name);
    return id;
  };
  const activateClient = (id) => setClients((l) => l.map((c) => (c.id === id ? { ...c, status: 'ACTIVE', billing: 'CURRENT' } : c)));
  const resendInvite = (id) => { const c = getClient(id); if (c) addAudit('Resent invite', c.name); };
  const changeClientPlan = (id, planId) => {
    setClients((l) => l.map((c) => {
      if (c.id !== id) return c;
      const status = (c.status === 'ACTIVE' || c.status === 'LIMIT') ? (reached(c.evalsUsed, planId) ? 'LIMIT' : 'ACTIVE') : c.status;
      return { ...c, plan: planId, mrr: planOf(planId).price ?? c.mrr, status };
    }));
    const c = getClient(id); if (c) addAudit('Changed plan → ' + planOf(planId).name, c.name);
  };
  const setClientStatus = (id, status) => {
    setClients((l) => l.map((c) => {
      if (c.id !== id) return c;
      const next = status === 'ACTIVE' ? (reached(c.evalsUsed, c.plan) ? 'LIMIT' : 'ACTIVE') : status;
      return { ...c, status: next };
    }));
    const c = getClient(id); if (c) addAudit(status === 'SUSPENDED' ? 'Suspended client' : 'Reinstated client', c.name);
  };
  const retryPayment = (invId) => {
    setInvoices((l) => l.map((i) => (i.id === invId ? { ...i, status: 'PAID' } : i)));
    const inv = invoices.find((i) => i.id === invId);
    if (inv) {
      setClients((l) => l.map((c) => {
        if (c.id !== inv.clientId) return c;
        const status = (c.status === 'PAST_DUE' || c.status === 'SUSPENDED') ? (reached(c.evalsUsed, c.plan) ? 'LIMIT' : 'ACTIVE') : c.status;
        return { ...c, billing: 'CURRENT', status };
      }));
      addAudit('Payment recovered', inv.id);
    }
  };
  const toggleCatalogModule = (key) => setCatalog((l) => l.map((m) => (m.key === key ? { ...m, enabled: !m.enabled } : m)));
  const addCatalogModule = (name, scoring) => setCatalog((l) => [...l, { key: 'cat_' + Math.random().toString(36).slice(2, 7), name, scoring: scoring || 'AI rubric', enabled: true }]);
  const publishCatalog = () => { setCatalogPublishedAt('just now'); addAudit('Published catalog to all clients', `${catalog.filter((m) => m.enabled).length} modules`); };
  const resolveTicket = (id) => setTickets((l) => l.map((t) => (t.id === id ? { ...t, status: 'RESOLVED', updated: 'just now' } : t)));
  const fulfillErasure = (id) => { setErasures((l) => l.map((e) => (e.id === id ? { ...e, status: 'FULFILLED' } : e))); const e = erasures.find((x) => x.id === id); if (e) addAudit('Erasure request fulfilled', e.subject); };

  const addOpportunity = (form) => {
    const id = String(++nextId);
    const { assessment: preset, ...rest } = form;
    const defaultAssessment = {
      modules: [
        { key: 'resume', skills: form.requiredSkills || [], nQ: 0, rubric: ['Skill match vs JD'], gate: 'Fit ≥ 50 · knockout if must-have missing', weight: 0 },
        { key: 'written', skills: form.requiredSkills || [], nQ: 5, rubric: ['Domain knowledge', 'Written communication'], gate: 'Advance ≥ 60', weight: 50 },
        { key: 'interview', skills: form.requiredSkills || [], nQ: 10, rubric: ['Domain', 'Communication', 'Composure'], gate: 'Advance ≥ 60', weight: 40, languages: (form.requiredLanguages && form.requiredLanguages.length ? form.requiredLanguages : ['English']) },
      ],
      weights: [{ label: 'Written', w: 50 }, { label: 'AI Interview', w: 40 }, { label: 'Integrity', w: 10 }],
    };
    const opp = {
      id,
      status: form.status || 'OPEN',
      cleared: 0,
      inPipeline: 0,
      funnel: { applied: 0, screening: 0, assessment: 0, interview: 0, cleared: 0 },
      openedDate: '2026-06-28',
      requiredPositions: Number(form.requiredPositions) || 0,
      ...rest,
      skills: form.requiredSkills || [],
      languages: form.requiredLanguages || [],
      criteria: {
        minExperienceYears: form.minExperienceYears, minEducation: form.minEducation,
        minCefrLevel: form.minCefrLevel, minTypingWpm: form.minTypingWpm, minTypingAccuracy: form.minTypingAccuracy,
        minAssessmentScore: form.minAssessmentScore, minInterviewScore: form.minInterviewScore,
      },
      assessment: (preset && preset.modules && preset.modules.length) ? preset : defaultAssessment,
    };
    setOpportunities((list) => [opp, ...list]);
    return id;
  };

  const getOpportunity = (id) => opportunities.find((o) => o.id === id);
  const getCandidates = (id) => candidates[id] || [];
  const getPool = (id) => pool[id] || [];
  const rescue = (oppId, candId) =>
    setPool((p) => ({ ...p, [oppId]: (p[oppId] || []).map((c) => (c.id === candId ? { ...c, pass: true, rescued: true } : c)) }));
  const updateAssessment = (id, assessment) =>
    setOpportunities((list) => list.map((o) => (o.id === id ? { ...o, assessment } : o)));
  const setOppStatus = (id, status) =>
    setOpportunities((list) => list.map((o) => (o.id === id ? { ...o, status } : o)));
  const sendAssessment = (id, addedApplicants = 0) =>
    setOpportunities((list) => list.map((o) => (o.id === id
      ? { ...o, sent: true, inPipeline: (o.inPipeline || 0) + addedApplicants, funnel: { ...(o.funnel || {}), applied: (o.funnel?.applied || 0) + addedApplicants, screening: (o.funnel?.screening || 0) + addedApplicants } }
      : o)));
  const addCustomModule = (def) => {
    const key = 'custom_' + Math.random().toString(36).slice(2, 7);
    setCustomModules((list) => [...list, { key, time: 'custom', custom: true, ...def }]);
    return key;
  };

  return (
    <AppCtx.Provider value={{
      opportunities, addOpportunity, getOpportunity, getCandidates, getPool, rescue, updateAssessment, setOppStatus, sendAssessment, customModules, addCustomModule,
      clients, getClient, onboardClient, activateClient, resendInvite, changeClientPlan, setClientStatus,
      invoices, retryPayment, tickets, resolveTicket, erasures, fulfillErasure,
      catalog, toggleCatalogModule, addCatalogModule, publishCatalog, catalogPublishedAt, auditLog,
      impersonating, setImpersonating,
      assessmentTemplates, saveTemplate, deleteTemplate,
    }}>
      {children}
    </AppCtx.Provider>
  );
}

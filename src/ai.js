// Real AI via Groq's OpenAI-compatible API, with a simulated fallback when no key is set.
// Real AI needs VITE_GROQ_API_KEY in .env (restart the dev server after changing it).
const KEY = import.meta.env.VITE_GROQ_API_KEY;
const URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

export const aiConfigured = !!KEY;

/* Every AI feature has a deterministic fallback, so a failing key or network must never surface
   as an error to the person using the product. We log once, then let callers fall back. */
let aiDown = false; let warned = false;
export const aiAvailable = () => !!KEY && !aiDown;
function offline(reason) {
  if (!warned) { warned = true; console.warn('[ai] falling back to built-in logic — ' + reason); }
  return null;
}
async function chat(messages, { temperature = 0.6, max_tokens = 700 } = {}) {
  if (!KEY || aiDown) return null; // no key / key rejected → caller uses the built-in fallback
  let res;
  try {
    res = await fetch(URL, {
      method: 'POST',
      headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ model: MODEL, temperature, max_tokens, messages }),
    });
  } catch (e) { return offline('network error: ' + (e?.message || e)); }
  if (!res.ok) {
    if (res.status === 401 || res.status === 403) aiDown = true; // key is invalid/expired — stop calling until reload
    return offline('Groq responded ' + res.status + (aiDown ? ' (check VITE_GROQ_API_KEY)' : ''));
  }
  try { const json = await res.json(); return json?.choices?.[0]?.message?.content?.trim() || ''; }
  catch (e) { return offline('bad response: ' + (e?.message || e)); }
}

export async function draftJD({
  title, skills = [], languages = [], roleType, location, workMode, department,
  minExperienceYears, minEducation, minCefrLevel,
}) {
  const expText = minExperienceYears ? `${minExperienceYears}+ years` : null;
  const sys =
    'You are an expert technical recruiter who writes clear, inclusive, bias-safe job descriptions for the Indian job market. ' +
    'Return GitHub-flavored Markdown: use "## " for each section heading, "- " for bullet points, and **bold** sparingly. ' +
    'Sections in order: "## About the Role" (one short paragraph), "## Key Responsibilities" (5-7 "- " bullets), "## Requirements" (5-7 "- " bullets). ' +
    'The Requirements section MUST reflect every detail provided (experience, education, language/CEFR level, must-have skills). ' +
    '150-320 words. Return only the Markdown, no preamble.';
  const user =
    `Role title: ${title}\n` +
    (department ? `Department: ${department}\n` : '') +
    (roleType ? `Employment type: ${roleType}\n` : '') +
    (location ? `Location: ${location}\n` : '') +
    (workMode ? `Work mode: ${workMode}\n` : '') +
    (expText ? `Minimum experience: ${expText}\n` : '') +
    (minEducation ? `Minimum education: ${minEducation}\n` : '') +
    (minCefrLevel ? `Minimum English/communication level: CEFR ${minCefrLevel}\n` : '') +
    (languages.length ? `Languages: ${languages.join(', ')}\n` : '') +
    `Must-have skills: ${skills.length ? skills.join(', ') : 'the core skills typical for this role'}`;
  const real = await chat([{ role: 'system', content: sys }, { role: 'user', content: user }]);
  if (real) return real;
  // simulated fallback — also weaves in everything the user entered
  const reqs = [
    expText ? `${expText} of relevant experience` : null,
    minEducation ? `${minEducation} (or equivalent)` : null,
    skills.length ? `Hands-on expertise with ${skills.join(', ')}` : 'Strong grounding in the core skills for this role',
    minCefrLevel ? `Communication at CEFR ${minCefrLevel} or above` : null,
    languages.length ? `Fluency in ${languages.join(', ')}` : null,
    'Strong problem-solving, ownership and attention to detail',
  ].filter(Boolean);
  const meta = [roleType, workMode, location].filter(Boolean).join(' · ');
  return (
    `## About the Role\n` +
    `We are hiring a ${title || 'professional'}${department ? ' in our ' + department + ' team' : ''}${location ? ', based in ' + location : ''}${workMode ? ' (' + workMode + ')' : ''}. ` +
    `You will work closely with the team to deliver high-quality, reliable work${expText ? ', bringing ' + expText + ' of experience' : ''}.\n\n` +
    `## Key Responsibilities\n- Own and deliver the core ${title || 'role'} responsibilities\n- Apply ${skills.length ? skills.slice(0, 3).join(', ') : 'your core skills'} day to day\n- Collaborate across teams and communicate clearly\n- Produce clean, maintainable, high-quality work\n- Continuously learn and raise the bar\n\n` +
    `## Requirements\n${reqs.map((r) => '- ' + r).join('\n')}\n` +
    (meta ? `\n**Details:** ${meta}.\n` : '')
  );
}

export async function suggestSkills({ title, jd }) {
  const sys = 'Suggest 6-10 concise, relevant skills for the role as a comma-separated list. Return ONLY the comma-separated list.';
  const user = `Role: ${title}\nJD: ${(jd || '').slice(0, 1200)}`;
  const real = await chat([{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.4, max_tokens: 120 });
  const text = real || 'Communication, Problem Solving, Teamwork, Time Management, Adaptability, Attention to Detail';
  return text.replace(/\n/g, ',').split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10);
}

/* ── AI designs a role-specific assessment (modules + rank weights) ── */
const A_CATALOG = ['resume', 'written', 'mcq', 'coding', 'sjt', 'language', 'personality', 'typing', 'computer', 'interview', 'simulation'];
const mkW = (label, w) => ({ label, w });

function rescale100(weights) {
  const total = weights.reduce((a, b) => a + (Number(b.w) || 0), 0);
  if (!total) return weights;
  const scaled = weights.map((x) => ({ ...x, w: Math.round((Number(x.w) || 0) / total * 100) }));
  const drift = 100 - scaled.reduce((a, b) => a + b.w, 0);
  if (drift !== 0 && scaled.length) { let mi = 0; scaled.forEach((x, i) => { if (x.w > scaled[mi].w) mi = i; }); scaled[mi] = { ...scaled[mi], w: scaled[mi].w + drift }; }
  return scaled;
}

function heuristicAssessment({ title = '', skills = [], languages = [] }) {
  const t = title.toLowerCase();
  const langs = languages && languages.length ? languages : ['English'];
  const has = (...k) => k.some((x) => t.includes(x));
  const resume = { key: 'resume', skills, nQ: 0, rubric: ['Skill match vs JD'], gate: 'Fit ≥ 50 · knockout if must-have missing', weight: 0 };
  const interview = (weight) => ({ key: 'interview', skills, nQ: 10, rubric: ['Domain', 'Communication', 'Composure'], gate: 'Advance ≥ 60', weight, languages: langs });
  if (has('develop', 'engineer', 'programmer', 'software', 'backend', 'front-end', 'frontend', 'full stack', 'fullstack', 'devops', 'sre', 'qa engineer', 'test engineer', 'data engineer', 'data scientist', 'data analyst', 'machine learning', 'ml engineer'))
    return { modules: [resume, { key: 'coding', skills, nQ: 2, rubric: ['Correctness', 'Problem solving', 'Code quality'], gate: 'Reject <60 · Review 60–69 · Advance ≥70', weight: 35 }, { key: 'written', skills, nQ: 5, rubric: ['Domain knowledge'], gate: 'Advance ≥ 60', weight: 20 }, interview(30), { key: 'typing', skills: [], nQ: 0, rubric: [], gate: 'gate only', weight: 0 }], weights: [mkW('Coding', 35), mkW('AI Interview', 30), mkW('Written', 20), mkW('Resume-fit', 5), mkW('Integrity', 10)] };
  if (has('support', 'customer', 'bpo', 'voice', 'chat', 'call', 'tele'))
    return { modules: [resume, { key: 'language', skills: ['Speaking', 'Listening', 'Reading', 'Writing'], nQ: 0, rubric: ['Fluency', 'Comprehension'], gate: 'CEFR ≥ B2', weight: 30, languages: langs }, { key: 'sjt', skills, nQ: 6, rubric: ['Judgement', 'Empathy'], gate: 'Advance ≥ 60', weight: 20 }, { key: 'simulation', skills: ['Live handling'], nQ: 1, rubric: ['Resolution', 'Tone'], gate: 'Advance ≥ 60', weight: 20 }, interview(15), { key: 'typing', skills: [], nQ: 0, rubric: [], gate: '30 WPM · 90%', weight: 5 }], weights: [mkW('Language', 30), mkW('SJT', 20), mkW('Simulation', 20), mkW('AI Interview', 15), mkW('Integrity', 10), mkW('Typing', 5)] };
  if (has('doctor', 'physician', 'nurse', 'medical', 'clinical', 'health'))
    return { modules: [resume, { key: 'mcq', skills, nQ: 30, rubric: ['Accuracy'], gate: 'Advance ≥ 70', weight: 35 }, { key: 'sjt', skills: ['Clinical judgement', 'Ethics'], nQ: 8, rubric: ['Diagnosis', 'Safety', 'Ethics'], gate: 'Advance ≥ 70', weight: 30 }, interview(20)], weights: [mkW('Medical Knowledge', 35), mkW('Clinical Judgement', 30), mkW('AI Interview', 20), mkW('Integrity', 15)] };
  if (has('design', 'ux', 'ui', 'graphic'))
    return { modules: [resume, { key: 'written', skills: ['Design critique'], nQ: 3, rubric: ['Reasoning'], gate: 'Advance ≥ 60', weight: 20 }, { key: 'sjt', skills: ['Design judgement'], nQ: 5, rubric: ['Judgement'], gate: 'Advance ≥ 60', weight: 20 }, { ...interview(45), skills: ['Portfolio walkthrough'] }], weights: [mkW('Portfolio & Interview', 45), mkW('Design Judgement', 20), mkW('Written', 20), mkW('Resume-fit', 5), mkW('Integrity', 10)] };
  if (has('sales', 'business development', 'account exec'))
    return { modules: [resume, { key: 'sjt', skills, nQ: 6, rubric: ['Judgement'], gate: 'Advance ≥ 60', weight: 25 }, { key: 'simulation', skills: ['Sales pitch'], nQ: 1, rubric: ['Persuasion', 'Clarity'], gate: 'Advance ≥ 60', weight: 30 }, interview(35)], weights: [mkW('Simulation', 30), mkW('AI Interview', 35), mkW('SJT', 25), mkW('Integrity', 10)] };
  if (has('content', 'writer', 'copy', 'editor'))
    return { modules: [resume, { key: 'written', skills: ['Writing', 'SEO'], nQ: 5, rubric: ['Clarity', 'Structure'], gate: 'Advance ≥ 60', weight: 55 }, { key: 'language', skills: ['Writing'], nQ: 0, rubric: ['Grammar'], gate: 'CEFR ≥ B2', weight: 20, languages: langs }, interview(25)], weights: [mkW('Written', 55), mkW('Language', 20), mkW('AI Interview', 25)] };
  if (has('account', 'finance', 'ops', 'operation', 'admin'))
    return { modules: [resume, { key: 'mcq', skills, nQ: 20, rubric: ['Accuracy'], gate: 'Advance ≥ 60', weight: 35 }, { key: 'written', skills, nQ: 4, rubric: ['Reasoning'], gate: 'Advance ≥ 60', weight: 20 }, interview(25), { key: 'computer', skills: ['Spreadsheets'], nQ: 0, rubric: [], gate: 'Advance ≥ 60', weight: 20 }], weights: [mkW('MCQ', 35), mkW('AI Interview', 25), mkW('Written', 20), mkW('Computer Literacy', 20)] };
  return { modules: [resume, { key: 'written', skills, nQ: 5, rubric: ['Domain knowledge', 'Communication'], gate: 'Advance ≥ 60', weight: 30 }, { key: 'mcq', skills, nQ: 15, rubric: ['Accuracy'], gate: 'Advance ≥ 60', weight: 25 }, interview(35)], weights: [mkW('Written', 30), mkW('MCQ', 25), mkW('AI Interview', 35), mkW('Integrity', 10)] };
}

function normalizeAssessment(p, ctx) {
  if (!p || !Array.isArray(p.modules) || !Array.isArray(p.weights) || !p.weights.length) return null;
  const langs = ctx.languages && ctx.languages.length ? ctx.languages : ['English'];
  const modules = p.modules.filter((m) => m && A_CATALOG.includes(m.key)).map((m) => ({
    key: m.key, skills: Array.isArray(m.skills) ? m.skills : (ctx.skills || []), nQ: Number(m.nQ) || 0,
    rubric: Array.isArray(m.rubric) ? m.rubric : [], gate: typeof m.gate === 'string' ? m.gate : 'Advance ≥ 60',
    weight: Number(m.weight) || 0,
    ...(Array.isArray(m.questions) ? { questions: m.questions } : {}),
    ...(Array.isArray(m.bands) ? { bands: m.bands } : {}),
    ...(m.key === 'interview' || m.key === 'language' ? { languages: Array.isArray(m.languages) && m.languages.length ? m.languages : langs } : {}),
  }));
  if (!modules.length) return null;
  if (!modules.some((m) => m.key === 'resume')) modules.unshift({ key: 'resume', skills: ctx.skills || [], nQ: 0, rubric: ['Skill match vs JD'], gate: 'Fit ≥ 50 · knockout if must-have missing', weight: 0 });
  if (!modules.some((m) => m.key === 'interview')) modules.push({ key: 'interview', skills: ctx.skills || [], nQ: 10, rubric: ['Domain', 'Communication', 'Composure'], gate: 'Advance ≥ 60', weight: 0, languages: langs });
  let weights = p.weights.filter((x) => x && typeof x.label === 'string').map((x) => ({ label: x.label, w: Number(x.w) || 0 }));
  if (!weights.length) return null;
  const wsum = weights.reduce((a, b) => a + b.w, 0);
  if (wsum <= 0) return null; // malformed AI output → caller falls back to the deterministic heuristic
  if (wsum !== 100) weights = rescale100(weights);
  return { modules, weights };
}

export async function designAssessment(ctx = {}) {
  const { title = '', skills = [], languages = [], jd = '' } = ctx;
  const sys =
    'You are an expert assessment designer for hiring. Design a role-appropriate evaluation. ' +
    'Return ONLY a JSON object (no prose, no markdown) of shape: ' +
    '{"modules":[{"key":"resume|written|mcq|coding|sjt|language|personality|typing|computer|interview|simulation","skills":["..."],"nQ":number,"rubric":["..."],"gate":"string","weight":number,"languages":["..."]}],"weights":[{"label":"string","w":number}]}. ' +
    'Rules: include a "resume" module as the gate (weight 0); ALWAYS include exactly one "interview" module whose languages = the provided languages; pick modules that fit the role; weights[].w MUST sum to 100; ' +
    'use human-friendly weight labels (e.g. Coding, AI Interview, Written, MCQ, SJT, Simulation, Language, Typing, Computer Literacy, Resume-fit, Integrity).';
  const user = `Role title: ${title}\nMust-have skills: ${skills.join(', ') || '—'}\nLanguages: ${(languages.length ? languages : ['English']).join(', ')}\nJD excerpt: ${(jd || '').slice(0, 800)}`;
  let real = null;
  try { real = await chat([{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.4, max_tokens: 900 }); } catch { real = null; }
  if (real) {
    try {
      const parsed = JSON.parse(real.replace(/```json|```/g, '').trim());
      const norm = normalizeAssessment(parsed, ctx);
      if (norm) return norm;
    } catch { /* fall through to heuristic */ }
  }
  return heuristicAssessment(ctx);
}

export async function generateQuestions({ skill, n = 3 }) {
  const sys = 'You write concise interview/assessment questions. Return each question on its own line, no numbering.';
  const user = `Write ${n} questions to assess "${skill}".`;
  const real = await chat([{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.6, max_tokens: 300 });
  const text = real || `Explain a core concept in ${skill}.\nDescribe a real problem you solved using ${skill}.\nWhat are common pitfalls in ${skill}?`;
  return text.split('\n').map((q) => q.replace(/^[-\d.\)\s]+/, '').trim()).filter(Boolean).slice(0, n);
}

/* ═══════════════════════ candidate run-time AI (real via Groq when a key is set; deterministic fallback otherwise) ═══════════════════════ */
const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, Math.round(Number(n) || 0)));
const parseJson = (txt) => { try { return JSON.parse(String(txt).replace(/```json|```/g, '').trim()); } catch { const m = /\{[\s\S]*\}/.exec(String(txt)); if (m) { try { return JSON.parse(m[0]); } catch { return null; } } return null; } };
const heuristicWritten = (answer = '', rubric = []) => {
  const words = String(answer).trim().split(/\s+/).filter(Boolean).length;
  const sentences = String(answer).split(/[.!?]+/).filter((s) => s.trim().length > 3).length;
  const hasExample = /for example|e\.g\.|instance|when i|i built|i led|we |our team|result|outcome|%|\d/i.test(answer);
  let s = 35 + Math.min(35, words / 3) + Math.min(10, sentences * 2) + (hasExample ? 12 : 0);
  if (words < 12) s = Math.min(s, 30);
  const score = clamp(s, 0, 96);
  return { score, dimensions: Object.fromEntries((rubric.length ? rubric : ['Relevance', 'Clarity', 'Depth']).map((d, i) => [d, clamp(score + ((i * 7) % 11) - 5)])), strengths: words > 40 ? ['Answer is developed with detail'] : [], improvements: words < 40 ? ['Add a concrete example and the outcome'] : hasExample ? [] : ['Support the answer with a specific example'] };
};

/* grade one written / scenario answer against the module rubric (+ optional reference answer) */
export async function gradeWritten({ question, answer, rubric = [], reference = '', role = '' }) {
  const fallback = heuristicWritten(answer, rubric);
  if (!KEY || !String(answer).trim()) return fallback;
  const dims = rubric.length ? rubric : ['Relevance', 'Clarity', 'Depth'];
  const sys = 'You are a strict but fair hiring assessor. Grade the candidate answer 0-100 overall and per rubric dimension. Return ONLY JSON: {"score":number,"dimensions":{"<dim>":number},"strengths":["..."],"improvements":["..."]} (max 2 items each, short).';
  const user = `Role: ${role}\nQuestion: ${question}\n${reference ? `Reference points: ${reference}\n` : ''}Rubric dimensions: ${dims.join(', ')}\nCandidate answer:\n${String(answer).slice(0, 2500)}`;
  try { const real = await chat([{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.2, max_tokens: 400 }); const j = parseJson(real); if (j && j.score != null) return { score: clamp(j.score), dimensions: Object.fromEntries(dims.map((d) => [d, clamp(j.dimensions?.[d] ?? j.score)])), strengths: (j.strengths || []).slice(0, 2), improvements: (j.improvements || []).slice(0, 2) }; } catch { /* fall back */ }
  return fallback;
}

/* the AI interviewer's next question — adaptive on the transcript so far */
const IQ_TEMPLATES = [
  (s) => `Tell me about a time you used ${s} to solve a hard problem. What trade-offs did you weigh?`,
  (s) => `What's a mistake you've made with ${s}, and what did you change afterwards?`,
  (s) => `How would you explain ${s} to a new teammate in their first week?`,
  (s) => `Walk me through a concrete example where ${s} changed the outcome of a project.`,
  (s) => `If you had to improve how your last team handled ${s}, where would you start?`,
];
export async function nextInterviewQuestion({ role = '', skills = [], lang = 'English', history = [], index = 0, weakAreas = [] }) {
  const topics = skills.length ? skills : ['your recent work'];
  const fallback = IQ_TEMPLATES[index % IQ_TEMPLATES.length](topics[index % topics.length]);
  if (!KEY) return fallback;
  const sys = `You are Alex, a warm, professional AI interviewer for a ${role} role, speaking ${lang}. Ask ONE short spoken question (max 30 words), building on the candidate's last answer when useful. Probe these weak areas if any: ${weakAreas.join(', ') || 'none'}. Return only the question text in ${lang}.`;
  const convo = history.slice(-4).flatMap((h) => [{ role: 'assistant', content: h.q }, { role: 'user', content: h.a || '(no answer)' }]);
  try { const real = await chat([{ role: 'system', content: sys }, ...convo, { role: 'user', content: `Next topic to cover: ${topics[index % topics.length]}. Ask the next question.` }], { temperature: 0.7, max_tokens: 80 }); return (real || fallback).replace(/^["“]|["”]$/g, ''); } catch { return fallback; }
}

/* the separate judge: scores the full transcript against the interview rubric */
export async function judgeInterview({ role = '', rubric = ['Domain', 'Communication', 'Composure'], transcript = [], lang = 'English' }) {
  const answered = transcript.filter((t) => (t.a || '').trim().length > 0);
  const avgWords = answered.length ? answered.reduce((a, t) => a + t.a.trim().split(/\s+/).length, 0) / answered.length : 0;
  const coverage = transcript.length ? answered.length / transcript.length : 0;
  const base = clamp(40 + coverage * 30 + Math.min(25, avgWords / 2), 0, 95);
  const fallback = { score: base, dimensions: Object.fromEntries(rubric.map((d, i) => [d, clamp(base + ((i * 5) % 9) - 4)])), summary: answered.length ? `Answered ${answered.length} of ${transcript.length} questions with an average of ${Math.round(avgWords)} words per answer.` : 'No spoken answers were captured.', cefr: base >= 80 ? 'C1' : base >= 65 ? 'B2' : base >= 50 ? 'B1' : 'A2' };
  if (!KEY || !answered.length) return fallback;
  const sys = `You are the judge for a ${role} interview conducted in ${lang}. Score 0-100 overall and per dimension (${rubric.join(', ')}), estimate a CEFR level for the language used, and write a 2-sentence summary citing the candidate's own words. Never penalise accent, pauses or mixing languages. Return ONLY JSON: {"score":n,"dimensions":{"<dim>":n},"cefr":"A2|B1|B2|C1|C2","summary":"..."}`;
  const user = transcript.map((t, i) => `Q${i + 1}: ${t.q}\nA${i + 1}: ${t.a || '(no answer)'}`).join('\n\n').slice(0, 6000);
  try { const real = await chat([{ role: 'system', content: sys }, { role: 'user', content: user }], { temperature: 0.2, max_tokens: 400 }); const j = parseJson(real); if (j && j.score != null) return { score: clamp(j.score), dimensions: Object.fromEntries(rubric.map((d) => [d, clamp(j.dimensions?.[d] ?? j.score)])), summary: j.summary || fallback.summary, cefr: j.cefr || fallback.cefr }; } catch { /* fall back */ }
  return fallback;
}

/* one simulated customer/counterpart turn for the Simulation module */
export async function simulationReply({ scenario = '', persona = 'a frustrated customer', history = [] }) {
  const canned = ['Okay, but how long is this going to take? I have already waited a week.', 'I understand. Can you confirm exactly what you will do next and when?', 'Alright. If this is sorted by tomorrow I will keep my account. Thank you.'];
  const fallback = canned[Math.min(history.length, canned.length - 1)];
  if (!KEY) return fallback;
  const sys = `You are role-playing ${persona} in this scenario: ${scenario}. Reply in ONE or TWO short natural sentences to the agent's last message. Stay in character; soften if handled well, escalate if ignored. No preamble.`;
  const convo = history.flatMap((h) => [{ role: 'assistant', content: h.customer }, ...(h.agent ? [{ role: 'user', content: h.agent }] : [])]);
  try { const real = await chat([{ role: 'system', content: sys }, ...convo], { temperature: 0.8, max_tokens: 80 }); return real || fallback; } catch { return fallback; }
}

/* generate module questions at run-time when the client left the bank empty (real via Groq, template fallback) */
export async function generateMcq({ skill = '', role = '', n = 5, scenario = false }) {
  const tpl = (i) => scenario
    ? { text: [`A customer is upset because a ${skill.toLowerCase() || 'service'} issue was not resolved on the first call. What do you do first?`, `You notice a colleague giving a customer incorrect information about ${skill.toLowerCase() || 'the policy'}. What is the best response?`, `Your queue is full and one case about ${skill.toLowerCase() || 'billing'} needs a manager. What is the most effective action?`, `A customer asks for something outside the ${skill.toLowerCase() || 'refund'} policy. How do you respond?`, `You realise you made a mistake on a ${skill.toLowerCase() || 'ticket'} that already closed. What do you do?`, `A caller is speaking fast and mixing languages while describing a ${skill.toLowerCase() || 'problem'}. What is the best approach?`][i % 6], options: [['Acknowledge the frustration, apologise, and confirm you own the issue now', 'Explain it was not your fault', 'Transfer immediately without context', 'Ask them to email instead'], ['Wait until the call ends, then privately share the correct information with them', 'Correct them in front of the customer', 'Report them to the manager immediately', 'Ignore it — not your call'], ['Set expectations with the customer, escalate with a clear summary, and keep them updated', 'Tell the customer to call back later', 'Handle it yourself even if it takes long', 'Close the case as unresolved'], ['Explain what the policy allows, offer the closest alternative, and check if it helps', 'Say no and end the call', 'Promise it anyway', 'Escalate every such request'], ['Reopen it, fix it, and inform the customer proactively', 'Leave it — it is closed', 'Fix it silently without telling anyone', 'Blame the system'], ['Slow the pace with calm confirmations, mirror their language, summarise back to check understanding', 'Ask them to speak only English', 'Guess and proceed', 'Put them on hold until they calm down']][i % 6], correct: 0 }
    : { text: [`You are asked to use ${skill || 'a new tool'} on a project with a tight deadline. What is the best first step?`, `Which practice most improves the reliability of work done with ${skill || 'this tool'}?`, `A teammate's ${skill || 'work'} output looks wrong. What is the most effective response?`, `What is the strongest reason to document decisions made while working with ${skill || 'this technology'}?`, `When a ${skill || 'process'} result is unexpected, what should happen first?`][i % 5], options: [['Clarify requirements, constraints and success criteria', 'Start immediately and adjust later', 'Wait for detailed written instructions', 'Hand it to someone more senior'], ['Testing against realistic cases before release', 'Working faster', 'Skipping reviews to save time', 'Relying on memory'], ['Reproduce the issue and discuss findings with them', 'Fix it silently', 'Escalate to the manager first', 'Ignore it'], ['So others can understand and safely change the work later', 'To make the report longer', 'Because the manager asked', 'To assign blame later'], ['Reproduce and isolate the cause before changing anything', 'Restart everything', 'Assume the input was wrong', 'Ship and monitor']][i % 5], correct: 0 };
  const fallback = Array.from({ length: n }, (_, i) => ({ id: `gen-${i}`, type: 'mcq', ...tpl(i), marks: 5 }));
  if (!KEY) return fallback;
  const sys = `You write ${scenario ? 'situational-judgement (workplace scenario)' : 'knowledge'} multiple-choice questions for hiring a ${role}. Return ONLY JSON: {"questions":[{"text":"...","options":["...","...","...","..."],"correct":0}]} with exactly 4 options and a single correct index. Difficulty: practical, job-relevant, unambiguous.`;
  try { const real = await chat([{ role: 'system', content: sys }, { role: 'user', content: `Topic: ${skill || role}. Write ${n} questions.` }], { temperature: 0.5, max_tokens: 1400 }); const j = parseJson(real); const qs = (j?.questions || []).filter((q) => q?.text && Array.isArray(q.options) && q.options.length >= 2).slice(0, n).map((q, i) => ({ id: `gen-${i}`, type: 'mcq', text: q.text, options: q.options.slice(0, 4), correct: clamp(q.correct, 0, Math.min(3, q.options.length - 1)), marks: 5 })); if (qs.length) return qs; } catch { /* fall back */ }
  return fallback;
}
export async function generateWrittenPrompts({ skill = '', role = '', n = 3 }) {
  const topics = String(skill).split(',').map((s) => s.trim()).filter(Boolean);
  const t = (i) => topics[i % Math.max(1, topics.length)] || role || 'your work';
  const fallback = Array.from({ length: n }, (_, i) => ({ id: `gen-${i}`, type: 'short', text: [`Describe a real problem you solved using ${t(i)}. What was the situation, what did you do, and what was the outcome?`, `Explain ${t(i)} to a new teammate in a few sentences. What do people most often get wrong?`, `What is the most important trade-off you have had to make involving ${t(i)}, and how did you decide?`, `How would you evaluate whether work done with ${t(i)} is good quality? Give concrete criteria.`, `Tell us about a time ${t(i)} did not go to plan. What did you change afterwards?`][i % 5], marks: 10 }));
  if (!KEY) return fallback;
  try { const real = await chat([{ role: 'system', content: `You write concise written-assessment questions for a ${role} role. Each question must invite a specific, experience-based answer. Return ONLY JSON: {"questions":["...","..."]}` }, { role: 'user', content: `Skills: ${skill || role}. Write ${n} questions.` }], { temperature: 0.6, max_tokens: 500 }); const j = parseJson(real); const qs = (j?.questions || []).filter((q) => typeof q === 'string' && q.length > 10).slice(0, n).map((text, i) => ({ id: `gen-${i}`, type: 'short', text, marks: 10 })); if (qs.length) return qs; } catch { /* fall back */ }
  return fallback;
}

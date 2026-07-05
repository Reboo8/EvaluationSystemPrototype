// Real AI via Groq's OpenAI-compatible API, with a simulated fallback when no key is set.
// To enable REAL AI: create prototype/.env with  VITE_GROQ_API_KEY=your_key  and restart dev server.
const KEY = import.meta.env.VITE_GROQ_API_KEY;
const URL = 'https://api.groq.com/openai/v1/chat/completions';
const MODEL = 'llama-3.3-70b-versatile';

export const aiConfigured = !!KEY;

async function chat(messages, { temperature = 0.6, max_tokens = 700 } = {}) {
  if (!KEY) return null; // no key → caller uses simulated fallback
  const res = await fetch(URL, {
    method: 'POST',
    headers: { Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ model: MODEL, temperature, max_tokens, messages }),
  });
  if (!res.ok) throw new Error('Groq ' + res.status);
  const json = await res.json();
  return json?.choices?.[0]?.message?.content?.trim() || '';
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
    (meta ? `\n**Details:** ${meta}.\n` : '') +
    `\n_(Simulated draft — add VITE_GROQ_API_KEY to prototype/.env for real AI.)_`
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

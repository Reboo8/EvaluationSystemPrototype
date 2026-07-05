import { useState } from 'react';
import {
  Pencil, X, Lock, Eye, EyeOff, Check, Link2, Copy, BookOpen, Globe,
  Layers, Zap, Code2, ChevronRight, CheckCircle2, Loader2,
} from 'lucide-react';

/* ── faithful rebuild of the ClientPortal Profile, wired to local state ── */

const origin = (typeof window !== 'undefined' && window.location.origin) || 'https://app.reboo8.com';
const SLUG = 'flipkart';
const TOKEN = 'emb_flipkart_demo_key';
const careerUrl = `${origin}/careers/${SLUG}`;
const apiUrl = `${origin}/api/public/careers/${SLUG}`;
const applyUrl = `${origin}/apply/${SLUG}`;
const iframeCode = `<iframe src="${careerUrl}?embed=true" width="100%" height="600px" frameborder="0" style="border:none;border-radius:8px;"></iframe>`;
const widgetDiv = `<div id="reboo8-jobs"></div>`;
const widgetScript = `<script src="${origin}/widget.js" data-key="${TOKEN}" data-api="${origin}"></script>`;
const apiFetch = `fetch("${apiUrl}")\n  .then(res => res.json())\n  .then(data => {\n    console.log(data.jobs, data.company);\n  });`;
const apiResponse = `{\n  "success": true,\n  "company": { "name": "Flipkart", "industry": "E-Commerce", "logoUrl": null },\n  "jobs": [{\n    "id": "cmolxbc6w...",\n    "title": "Customer Support Agent",\n    "requiredPositions": 50,\n    "closingDate": "2026-08-15",\n    "requiredSkills": ["Communication", "CRM"],\n    "requiredLanguages": ["English", "Hindi"]\n  }]\n}`;
const apiReact = `function Jobs() {\n  const [jobs, setJobs] = useState([]);\n  useEffect(() => {\n    fetch("${apiUrl}")\n      .then(r => r.json())\n      .then(d => setJobs(d.jobs));\n  }, []);\n  return jobs.map(j => (\n    <a key={j.id} href={"${applyUrl}?opportunityId=" + j.id}>\n      {j.title}\n    </a>\n  ));\n}`;

const PW_RULES = [
  { label: 'At least 12 characters', test: (v) => v.length >= 12 },
  { label: 'One uppercase letter', test: (v) => /[A-Z]/.test(v) },
  { label: 'One number', test: (v) => /[0-9]/.test(v) },
  { label: 'One special character', test: (v) => /[^A-Za-z0-9]/.test(v) },
];

function Toast({ toast }) {
  if (!toast) return null;
  return (
    <div style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 80, display: 'flex', alignItems: 'center', gap: 9, background: '#14212A', color: '#fff', padding: '11px 16px', borderRadius: 10, fontSize: 13, fontWeight: 600, boxShadow: '0 8px 24px rgba(0,0,0,0.18)' }}>
      <Check size={15} color="#34D399" /> {toast}
    </div>
  );
}

function DisplayRow({ label, value, muted, last }) {
  return (
    <div style={{ display: 'flex', padding: '10px 0', borderBottom: last ? 'none' : '1px solid #F1F5F9' }}>
      <span style={{ width: 144, flexShrink: 0, fontSize: 13, color: '#6B7280' }}>{label}</span>
      <span style={{ fontSize: 13.5, fontWeight: 600, color: muted ? '#9CA3AF' : '#14212A' }}>{value || '—'}</span>
    </div>
  );
}

function CodeBlock({ code, id, copied, onCopy }) {
  return (
    <div style={{ position: 'relative', background: '#0F172A', borderRadius: 8, padding: '14px 16px', margin: '8px 0' }}>
      <button onClick={() => onCopy(id, code)} style={{ position: 'absolute', top: 8, right: 8, background: 'rgba(255,255,255,0.12)', border: 'none', color: '#fff', borderRadius: 6, padding: '4px 9px', fontSize: 11, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 4 }}>
        {copied === id ? <><Check size={12} /> Copied!</> : <><Copy size={12} /> Copy</>}
      </button>
      <pre style={{ margin: 0, color: '#94A3B8', fontSize: 12, fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace', whiteSpace: 'pre-wrap', overflowX: 'auto', lineHeight: 1.6 }}>{code}</pre>
    </div>
  );
}

export default function Profile() {
  const [company, setCompany] = useState({ companyName: 'Flipkart', industry: 'E-commerce / SaaS', website: 'https://flipkart.com' });
  const [contact, setContact] = useState({ fullName: 'Flipkart Admin', email: 'hr@flipkart.com', phone: '+91 98765 43210' });
  const [editC, setEditC] = useState(false);
  const [editP, setEditP] = useState(false);
  const [draftC, setDraftC] = useState(company);
  const [draftP, setDraftP] = useState(contact);
  const [savingC, setSavingC] = useState(false);
  const [savingP, setSavingP] = useState(false);
  const [pwOpen, setPwOpen] = useState(false);
  const [copied, setCopied] = useState('');
  const [toast, setToast] = useState(null);

  const showToast = (m) => { setToast(m); setTimeout(() => setToast(null), 2200); };
  const copy = (id, text) => { try { navigator.clipboard?.writeText(text); } catch { /* noop */ } setCopied(id); setTimeout(() => setCopied(''), 2000); };

  const saveCompany = () => { setSavingC(true); setTimeout(() => { setCompany(draftC); setSavingC(false); setEditC(false); showToast('Company information updated'); }, 500); };
  const saveContact = () => { setSavingP(true); setTimeout(() => { setContact(draftP); setSavingP(false); setEditP(false); showToast('Contact information updated'); }, 500); };

  const inputCls = { width: '100%', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 14px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none' };
  const label = (t) => <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#64748B', marginBottom: 6 }}>{t}</label>;

  return (
    <div style={{ maxWidth: 760, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>
      <h1 style={{ fontSize: 22, fontWeight: 700, margin: 0 }}>Profile</h1>

      {/* Company Information */}
      <div className="card" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 14.5, fontWeight: 700, margin: 0, color: '#1E293B' }}>Company Information</h2>
          {!editC && <button onClick={() => { setDraftC(company); setEditC(true); }} style={{ background: 'none', border: 'none', color: '#056FD4', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Pencil size={13} /> Edit</button>}
        </div>
        {!editC ? (
          <>
            <DisplayRow label="Company Name" value={company.companyName} />
            <DisplayRow label="Industry" value={company.industry} />
            <DisplayRow label="Website" value={company.website} last />
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>{label('Company Name')}<input style={inputCls} value={draftC.companyName} onChange={(e) => setDraftC({ ...draftC, companyName: e.target.value })} /></div>
            <div>{label('Industry')}<input style={inputCls} value={draftC.industry} placeholder="e.g. BPO / Customer Support" onChange={(e) => setDraftC({ ...draftC, industry: e.target.value })} /></div>
            <div>{label('Website')}<input style={inputCls} value={draftC.website} placeholder="www.yourcompany.com" onChange={(e) => setDraftC({ ...draftC, website: e.target.value })} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 2 }}>
              <button className="btn-ghost" onClick={() => setEditC(false)}><X size={13} /> Cancel</button>
              <button className="btn-primary" disabled={savingC} onClick={saveCompany}>{savingC ? <Loader2 size={13} className="spin" /> : null} Save Changes</button>
            </div>
          </div>
        )}
      </div>

      {/* Contact Information */}
      <div className="card" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <h2 style={{ fontSize: 14.5, fontWeight: 700, margin: 0, color: '#1E293B' }}>Contact Information</h2>
          {!editP && <button onClick={() => { setDraftP(contact); setEditP(true); }} style={{ background: 'none', border: 'none', color: '#056FD4', fontSize: 13, fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}><Pencil size={13} /> Edit</button>}
        </div>
        {!editP ? (
          <>
            <DisplayRow label="Full Name" value={contact.fullName} />
            <DisplayRow label="Email" value={contact.email} muted />
            <DisplayRow label="Phone" value={contact.phone} last />
          </>
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
            <div>{label('Full Name')}<input style={inputCls} value={draftP.fullName} onChange={(e) => setDraftP({ ...draftP, fullName: e.target.value })} /></div>
            <div>{label('Email (cannot be changed — contact support)')}<input style={{ ...inputCls, background: '#F8FAFC', color: '#94A3B8', cursor: 'not-allowed' }} value={contact.email} disabled /></div>
            <div>{label('Phone')}<input style={inputCls} value={draftP.phone} placeholder="+91 98XXX XXXXX" onChange={(e) => setDraftP({ ...draftP, phone: e.target.value })} /></div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 2 }}>
              <button className="btn-ghost" onClick={() => setEditP(false)}><X size={13} /> Cancel</button>
              <button className="btn-primary" disabled={savingP} onClick={saveContact}>{savingP ? <Loader2 size={13} className="spin" /> : null} Save Changes</button>
            </div>
          </div>
        )}
      </div>

      {/* Security */}
      <div className="card" style={{ padding: '22px 24px' }}>
        <h2 style={{ fontSize: 14.5, fontWeight: 700, margin: '0 0 18px', color: '#1E293B' }}>Security</h2>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <Lock size={18} color="#94A3B8" />
            <span style={{ fontSize: 13.5, fontWeight: 600, color: '#1E293B' }}>Password</span>
          </div>
          <button onClick={() => setPwOpen(true)} style={{ background: '#fff', border: '1px solid #CBD5E1', borderRadius: 8, padding: '7px 13px', fontSize: 12.5, fontWeight: 600, color: '#334155', cursor: 'pointer' }}>Change Password</button>
        </div>
        <div style={{ borderTop: '1px solid #F1F5F9', marginTop: 18, paddingTop: 14, fontSize: 12, color: '#94A3B8' }}>Last login: June 28, 2026, 9:05 AM</div>
      </div>

      {/* Career Page & Integration */}
      <div className="card" style={{ padding: '22px 24px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9, marginBottom: 6 }}>
          <Link2 size={16} color="#056FD4" />
          <h2 style={{ fontSize: 14.5, fontWeight: 700, margin: 0, color: '#1E293B' }}>Career Page &amp; Integration</h2>
        </div>
        <p style={{ fontSize: 12.5, color: '#64748B', margin: '0 0 18px', lineHeight: 1.6 }}>When you publish a job, it automatically appears on your career page. Share the link or embed it on your website — no extra steps needed.</p>

        <IntegBlock title="🔗 Hosted Career Page" sub="Share this link — your jobs appear here automatically when published.">
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '9px 12px' }}>
            <a href={careerUrl} target="_blank" rel="noopener noreferrer" style={{ flex: 1, minWidth: 0, color: '#056FD4', fontSize: 13, fontWeight: 500, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', textDecoration: 'none' }}>{careerUrl}</a>
            <button onClick={() => copy('career', careerUrl)} style={{ flexShrink: 0, background: '#fff', border: '1px solid #CBD5E1', borderRadius: 7, padding: '5px 11px', fontSize: 12, fontWeight: 600, color: copied === 'career' ? '#16A34A' : '#334155', cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: 5 }}>
              {copied === 'career' ? <><Check size={12} /> Copied!</> : 'Copy Link'}
            </button>
          </div>
        </IntegBlock>

        <IntegBlock title="📋 Embed on Your Website (iFrame)" sub="Paste this once on your careers page — jobs update automatically.">
          <CodeBlock code={iframeCode} id="iframe" copied={copied} onCopy={copy} />
        </IntegBlock>

        <IntegBlock title="⚡ Advanced JS Widget" sub="For developers — renders jobs directly inside your webpage with full control." last>
          <CodeBlock code={`${widgetDiv}\n${widgetScript}`} id="widget" copied={copied} onCopy={copy} />
        </IntegBlock>
      </div>

      {/* Developer Integration Guide (tabbed) */}
      <IntegrationGuide copied={copied} onCopy={copy} />

      {pwOpen && <ChangePasswordModal onClose={() => setPwOpen(false)} onDone={() => { setPwOpen(false); showToast('Password updated.'); }} />}
      <Toast toast={toast} />
    </div>
  );
}

function IntegBlock({ title, sub, children, last }) {
  return (
    <div style={{ marginBottom: last ? 0 : 18 }}>
      <div style={{ fontSize: 11, fontWeight: 700, letterSpacing: '0.6px', color: '#374151', marginBottom: 3 }}>{title}</div>
      <div style={{ fontSize: 12.5, color: '#9CA3AF', marginBottom: 8 }}>{sub}</div>
      {children}
    </div>
  );
}

/* ── Developer Integration Guide — 5 tabs ── */
const DOC_TABS = [
  { key: 'quick', label: 'Quick Start', icon: Zap },
  { key: 'iframe', label: 'iFrame Embed', icon: Layers },
  { key: 'widget', label: 'JS Widget', icon: Code2 },
  { key: 'api', label: 'REST API', icon: Globe },
  { key: 'apply', label: 'Apply Flow', icon: CheckCircle2 },
];

const APPLY_STEPS = [
  ['📧', 'Candidate clicks Apply Now', 'They land on the Reboo8 Evaluation System signup page. The job they applied for is tracked automatically.'],
  ['📝', 'Signup + Resume Upload', 'Candidate creates an account with email verification, sets a password, and uploads their resume. AI parses the resume automatically.'],
  ['🖥️', 'System Check', 'Camera, microphone, internet speed, and browser compatibility are verified.'],
  ['🪪', 'Identity Verification', "Face photo and audio sample are captured to verify the candidate's identity."],
  ['📋', 'AI Assessment', 'Candidate takes a written assessment with AI-generated questions. Typing speed is also measured.'],
  ['🎤', 'AI Video Interview', 'An AI conducts a 10–15 minute video interview and scores the candidate on communication, clarity, and role fit.'],
  ['✅', 'Results in Your Dashboard', 'Everything appears in your ClientPortal pipeline: score, CEFR level, typing speed, AI recommendation.'],
];

function StepBadge({ n }) {
  return <div style={{ flexShrink: 0, width: 24, height: 24, borderRadius: '50%', background: '#056FD4', color: '#fff', fontSize: 12, fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{n}</div>;
}
function DocStep({ n, title, children }) {
  return (
    <div style={{ display: 'flex', gap: 12, marginBottom: 16 }}>
      <StepBadge n={n} />
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#14212A', marginBottom: 4 }}>{title}</div>
        <div style={{ fontSize: 12.5, color: '#6B7280', lineHeight: 1.6 }}>{children}</div>
      </div>
    </div>
  );
}

function IntegrationGuide({ copied, onCopy }) {
  const [tab, setTab] = useState('quick');
  return (
    <div style={{ background: '#fff', border: '1px solid #E2E8F0', borderRadius: 12, overflow: 'hidden' }}>
      <div style={{ padding: '20px 24px 0' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}>
          <BookOpen size={18} color="#056FD4" />
          <span style={{ fontSize: 15, fontWeight: 700, color: '#14212A' }}>Developer Integration Guide</span>
          <span className="badge" style={{ background: '#EFF6FF', color: '#056FD4', border: '1px solid #BFDBFE' }}>For your dev team</span>
        </div>
        <p style={{ fontSize: 12.5, color: '#6B7280', margin: '8px 0 0' }}>Share this with your developer. Follow any one option below to show your jobs on your website — takes less than 10 minutes.</p>
        <div style={{ display: 'flex', gap: 4, marginTop: 14, borderBottom: '1px solid #E2E8F0', flexWrap: 'wrap' }}>
          {DOC_TABS.map((t) => {
            const on = tab === t.key;
            return (
              <button key={t.key} onClick={() => setTab(t.key)} style={{ display: 'inline-flex', alignItems: 'center', gap: 6, background: 'none', border: 'none', borderBottom: on ? '2px solid #056FD4' : '2px solid transparent', color: on ? '#056FD4' : '#6B7280', fontSize: 12.5, fontWeight: 600, padding: '8px 10px', cursor: 'pointer', marginBottom: -1 }}>
                <t.icon size={14} /> {t.label}
              </button>
            );
          })}
        </div>
      </div>

      <div style={{ padding: 24 }}>
        {tab === 'quick' && (
          <>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: 10, background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '12px 14px', marginBottom: 18 }}>
              <Zap size={16} color="#16A34A" style={{ marginTop: 1, flexShrink: 0 }} />
              <div><div style={{ fontSize: 13, fontWeight: 700, color: '#15803D' }}>You can be live in under 10 minutes</div><div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 2 }}>Choose any one option below. All options show your jobs automatically every time you publish.</div></div>
            </div>
            <DocStep n={1} title="Publish a job from the Opportunities page">Go to Opportunities → Create New, fill in the job details, and click Publish Opportunity. The job will be live immediately.</DocStep>
            <DocStep n={2} title="Choose how to show jobs to candidates">
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 8 }}>
                {[['🔗 Share a link', 'No code needed. Just share the URL.', 'iframe'], ['📋 Embed on website', 'Paste 1 line of HTML on your careers page.', 'iframe'], ['⚡ JS Widget', 'Full control. Paste 2 lines of code.', 'widget'], ['🔌 REST API', 'Build a fully custom UI with your design.', 'api']].map(([t, d, to]) => (
                  <div key={t} onClick={() => setTab(to)} style={{ border: '1px solid #E2E8F0', borderRadius: 10, padding: '12px 14px', cursor: 'pointer' }} onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#056FD4'; e.currentTarget.style.background = '#F8FBFF'; }} onMouseLeave={(e) => { e.currentTarget.style.borderColor = '#E2E8F0'; e.currentTarget.style.background = '#fff'; }}>
                    <div style={{ fontSize: 13, fontWeight: 700, color: '#14212A' }}>{t}</div>
                    <div style={{ fontSize: 12, color: '#6B7280', margin: '3px 0 6px', lineHeight: 1.5 }}>{d}</div>
                    <span style={{ fontSize: 12, color: '#056FD4', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: 2 }}>See steps <ChevronRight size={13} /></span>
                  </div>
                ))}
              </div>
            </DocStep>
            <DocStep n={3} title="That's it — jobs appear automatically">After the one-time setup, every time you publish a new job it automatically appears on your website. No developer work needed again.
              <div style={{ background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, padding: '10px 12px', marginTop: 8 }}>
                <div style={{ fontSize: 10.5, fontWeight: 700, letterSpacing: '0.5px', color: '#9CA3AF', marginBottom: 3 }}>YOUR CAREER PAGE URL</div>
                <a href={careerUrl} target="_blank" rel="noopener noreferrer" style={{ fontSize: 13, color: '#056FD4', fontWeight: 500, textDecoration: 'none' }}>{careerUrl}</a>
              </div>
            </DocStep>
          </>
        )}

        {tab === 'iframe' && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#14212A', marginBottom: 4 }}>iFrame Embed</div>
            <p style={{ fontSize: 12.5, color: '#6B7280', margin: '0 0 16px', lineHeight: 1.6 }}>The simplest way to show jobs on your website. Paste one HTML snippet on your careers page. That's it — no backend changes, no API keys, no maintenance.</p>
            <DocStep n={1} title="Open your website careers page (e.g. yourcompany.com/careers)">Go to the HTML file or CMS template where you want jobs to appear.</DocStep>
            <DocStep n={2} title="Paste this snippet where you want jobs to appear"><CodeBlock code={iframeCode} id="iframe-code" copied={copied} onCopy={onCopy} /></DocStep>
            <DocStep n={3} title="Save and deploy — done!">From now on, every time you publish a job in Reboo8, it automatically appears on your website. No further changes needed.</DocStep>
            <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: '#92400E', lineHeight: 1.6 }}>💡 Tip: You can adjust <code style={{ background: '#FEF3C7', padding: '1px 5px', borderRadius: 4 }}>height="600px"</code> to match your page layout. Use <code style={{ background: '#FEF3C7', padding: '1px 5px', borderRadius: 4 }}>height="100vh"</code> for full-page.</div>
          </>
        )}

        {tab === 'widget' && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#14212A', marginBottom: 4 }}>JavaScript Widget</div>
            <p style={{ fontSize: 12.5, color: '#6B7280', margin: '0 0 16px', lineHeight: 1.6 }}>Renders jobs natively inside your page. The widget matches your page font and you can style it with CSS. Requires 2 snippets of code added once.</p>
            <DocStep n={1} title="Add a container where jobs should appear">Place this div on your careers page, wherever you want the job list to show:<CodeBlock code={widgetDiv} id="widget-step1" copied={copied} onCopy={onCopy} /></DocStep>
            <DocStep n={2} title="Add the script tag before your closing &lt;/body&gt; tag"><CodeBlock code={widgetScript} id="widget-step2" copied={copied} onCopy={onCopy} /></DocStep>
            <DocStep n={3} title="Optional: Customize the widget">
              <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 8, border: '1px solid #E2E8F0', borderRadius: 8, overflow: 'hidden' }}>
                <thead><tr style={{ background: '#F8FAFC' }}>{['Attribute', 'Value', 'Default'].map((h) => <th key={h} style={{ textAlign: 'left', fontSize: 11, fontWeight: 700, color: '#6B7280', padding: '8px 12px' }}>{h}</th>)}</tr></thead>
                <tbody>
                  {[['data-key', 'Your embed token', 'Required'], ['data-theme', '"light" or "dark"', '"light"'], ['data-container', 'Any div ID', '"reboo8-jobs"']].map((r) => (
                    <tr key={r[0]} style={{ borderTop: '1px solid #F1F5F9' }}>
                      <td style={{ padding: '8px 12px' }}><code style={{ color: '#056FD4', fontSize: 12 }}>{r[0]}</code></td>
                      <td style={{ padding: '8px 12px', fontSize: 12.5, color: '#475569' }}>{r[1]}</td>
                      <td style={{ padding: '8px 12px', fontSize: 12.5, color: '#9CA3AF' }}>{r[2]}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </DocStep>
          </>
        )}

        {tab === 'api' && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#14212A', marginBottom: 4 }}>REST API — Build Your Own UI</div>
            <p style={{ fontSize: 12.5, color: '#6B7280', margin: '0 0 16px', lineHeight: 1.6 }}>Fetch job data directly from our API and build any UI you want — fully matching your brand and design system. No API key or authentication needed.</p>
            <DocStep n={1} title="Fetch your open jobs">Call this endpoint from your frontend or backend:<CodeBlock code={apiFetch} id="api-fetch" copied={copied} onCopy={onCopy} /></DocStep>
            <DocStep n={2} title="API Response Structure"><CodeBlock code={apiResponse} id="api-response" copied={copied} onCopy={onCopy} /></DocStep>
            <DocStep n={3} title="Example: React Component">Copy this and customize the design to match your brand:<CodeBlock code={apiReact} id="api-react" copied={copied} onCopy={onCopy} /></DocStep>
            <div style={{ background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '10px 12px', fontSize: 12.5, color: '#1E40AF', lineHeight: 1.6 }}>📌 Apply Now URL format: <code style={{ background: '#DBEAFE', padding: '1px 5px', borderRadius: 4 }}>{applyUrl}?opportunityId=&lt;job.id&gt;</code> — replace <code style={{ background: '#DBEAFE', padding: '1px 5px', borderRadius: 4 }}>&lt;job.id&gt;</code> with the actual id from the API response.</div>
          </>
        )}

        {tab === 'apply' && (
          <>
            <div style={{ fontSize: 14, fontWeight: 700, color: '#14212A', marginBottom: 4 }}>What Happens After a Candidate Clicks "Apply Now"</div>
            <p style={{ fontSize: 12.5, color: '#6B7280', margin: '0 0 18px', lineHeight: 1.6 }}>You don't need to build anything for this. Reboo8 handles the entire evaluation process. Here's what the candidate experiences:</p>
            <div>
              {APPLY_STEPS.map(([emoji, title, desc], i) => {
                const lastStep = i === APPLY_STEPS.length - 1;
                return (
                  <div key={title} style={{ display: 'flex', gap: 12 }}>
                    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                      <div style={{ width: 36, height: 36, borderRadius: '50%', background: lastStep ? '#DCFCE7' : '#EFF6FF', border: `1px solid ${lastStep ? '#16A34A' : '#056FD4'}`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 16, flexShrink: 0 }}>{emoji}</div>
                      {!lastStep && <div style={{ width: 2, flex: 1, minHeight: 18, background: '#E2E8F0' }} />}
                    </div>
                    <div style={{ paddingBottom: lastStep ? 0 : 14 }}>
                      <div style={{ fontSize: 13.5, fontWeight: 600, color: '#14212A' }}>{title}</div>
                      <div style={{ fontSize: 12.5, color: '#6B7280', marginTop: 2, lineHeight: 1.6 }}>{desc}</div>
                    </div>
                  </div>
                );
              })}
            </div>
            <div style={{ background: '#F0FDF4', border: '1px solid #BBF7D0', borderRadius: 10, padding: '14px 16px', marginTop: 16 }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#15803D', marginBottom: 10 }}>What you see in your ClientPortal pipeline:</div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 12 }}>
                {[['Applied', 245, '#056FD4'], ['Assessment', 80, '#7C3AED'], ['Interview', 30, '#D97706'], ['Cleared', 18, '#059669']].map(([l, v, c]) => (
                  <div key={l} style={{ textAlign: 'center' }}><div style={{ fontSize: 22, fontWeight: 700, color: c }}>{v}</div><div style={{ fontSize: 11, color: '#6B7280', fontWeight: 600 }}>{l}</div></div>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px 24px', borderTop: '1px solid #F3F4F6', fontSize: 12, color: '#9CA3AF' }}>
        <span>Need help? Contact <a href="mailto:support@reboo8.com" style={{ color: '#056FD4', textDecoration: 'none' }}>support@reboo8.com</a></span>
        <span>Reboo8 Integration Guide v1.0</span>
      </div>
    </div>
  );
}

/* ── Change Password modal ── */
function ChangePasswordModal({ onClose, onDone }) {
  const [show, setShow] = useState({ cur: false, nw: false, cf: false });
  const [v, setV] = useState({ cur: '', nw: '', cf: '' });
  const [err, setErr] = useState({});
  const [busy, setBusy] = useState(false);

  const validate = () => {
    const e = {};
    if (!v.cur) e.cur = 'Required';
    if (!v.nw) e.nw = 'Required';
    else if (!/^(?=.*[A-Z])(?=.*[0-9])(?=.*[^A-Za-z0-9]).{12,}$/.test(v.nw)) e.nw = 'Password does not meet requirements';
    if (!v.cf) e.cf = 'Required';
    else if (v.cf !== v.nw) e.cf = 'Passwords do not match';
    setErr(e);
    return Object.keys(e).length === 0;
  };
  const submit = () => { if (!validate()) return; setBusy(true); setTimeout(() => { setBusy(false); onDone(); }, 600); };

  const Field = ({ k, lbl }) => (
    <div style={{ marginBottom: 14 }}>
      <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#334155', marginBottom: 6 }}>{lbl}</label>
      <div style={{ position: 'relative' }}>
        <input type={show[k] ? 'text' : 'password'} value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })}
          style={{ width: '100%', border: `1px solid ${err[k] ? '#F87171' : '#E2E8F0'}`, borderRadius: 8, padding: '10px 38px 10px 14px', fontSize: 13.5, fontFamily: 'inherit', outline: 'none' }} />
        <span onClick={() => setShow({ ...show, [k]: !show[k] })} style={{ position: 'absolute', right: 12, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer', color: '#94A3B8' }}>{show[k] ? <EyeOff size={15} /> : <Eye size={15} />}</span>
      </div>
      {err[k] && <div style={{ fontSize: 11.5, color: '#EF4444', marginTop: 4 }}>{err[k]}</div>}
      {k === 'nw' && (
        <ul style={{ listStyle: 'none', padding: 0, margin: '8px 0 0', display: 'flex', flexDirection: 'column', gap: 4 }}>
          {PW_RULES.map((r) => { const ok = r.test(v.nw); return (
            <li key={r.label} style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 11.5, color: ok ? '#16A34A' : '#9CA3AF' }}>
              {ok ? <Check size={13} /> : <X size={13} />} {r.label}
            </li>
          ); })}
        </ul>
      )}
    </div>
  );

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 60, padding: 16 }}>
      <div onClick={(e) => e.stopPropagation()} className="card" style={{ width: '100%', maxWidth: 420, padding: 24, borderRadius: 16 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18 }}>
          <h2 style={{ fontSize: 16, fontWeight: 700, margin: 0 }}>Change Password</h2>
          <X size={18} color="#94A3B8" style={{ cursor: 'pointer' }} onClick={onClose} />
        </div>
        <Field k="cur" lbl="Current Password" />
        <Field k="nw" lbl="New Password" />
        <Field k="cf" lbl="Confirm Password" />
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 10, marginTop: 6 }}>
          <button className="btn-ghost" onClick={onClose}>Cancel</button>
          <button className="btn-primary" disabled={busy} onClick={submit}>{busy ? <Loader2 size={14} className="spin" /> : null} Update Password</button>
        </div>
      </div>
    </div>
  );
}

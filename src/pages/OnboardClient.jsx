import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Check, ArrowRight, ArrowLeft, Building2, Mail, Rocket } from 'lucide-react';
import { useApp, PLANS } from '../store.jsx';

const fmt = (n) => '₹' + n.toLocaleString('en-IN');
const STEPS = ['Deal', 'Plan', 'Tenant & Invite'];

export default function OnboardClient() {
  const nav = useNavigate();
  const { onboardClient } = useApp();
  const [step, setStep] = useState(0);
  const [form, setForm] = useState({ name: '', industry: '', contact: '', admin: '', planId: 'growth' });
  const [done, setDone] = useState(null);

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const slug = form.name.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'company';
  const plan = PLANS.find((p) => p.id === form.planId);
  const canNext = step === 0 ? form.name.trim() && form.contact.includes('@') : true;

  const finish = () => { const id = onboardClient(form); setDone(id); };

  if (done) return (
    <div style={{ maxWidth: 560, margin: '40px auto' }}>
      <div className="card" style={{ padding: 36, textAlign: 'center' }}>
        <div className="avatar" style={{ width: 60, height: 60, background: '#DCFCE7', color: '#16A34A', margin: '0 auto 14px' }}><Check size={30} /></div>
        <h2 style={{ fontSize: 20, fontWeight: 700, margin: '0 0 6px' }}>Tenant created 🎉</h2>
        <p style={{ fontSize: 13.5, color: '#6B7280', margin: '0 0 6px' }}>An activation invite was sent to <b>{form.contact}</b>. Their portal unlocks the <b>{plan.name}</b> plan’s features and limits on activation.</p>
        <p style={{ fontSize: 12.5, color: '#9CA3AF', margin: '0 0 18px' }}>Workspace: {slug}.reboo8.com · Status: Invite pending</p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn-ghost" onClick={() => nav('/admin/clients')}>Back to clients</button>
          <button className="btn-primary" onClick={() => nav('/admin/clients/' + done)}>Open client →</button>
        </div>
      </div>
    </div>
  );

  return (
    <div style={{ maxWidth: 720, margin: '0 auto' }}>
      <div style={{ fontSize: 13, color: '#475569', marginBottom: 14 }}>
        <span style={{ color: '#056FD4', fontWeight: 600, cursor: 'pointer' }} onClick={() => nav('/admin/clients')}>Clients</span> › Onboard client
      </div>

      {/* stepper */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 24 }}>
        {STEPS.map((s, i) => (
          <div key={s} style={{ display: 'contents' }}>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6 }}>
              <div className={'step-circle' + (i === step ? ' active' : i < step ? ' done' : '')}>{i < step ? <Check size={15} /> : i + 1}</div>
              <span style={{ fontSize: 12, fontWeight: 600, color: i === step ? '#056FD4' : '#9CA3AF' }}>{s}</span>
            </div>
            {i < STEPS.length - 1 && <div className={'step-conn' + (i < step ? ' done' : '')} />}
          </div>
        ))}
      </div>

      <div className="card" style={{ padding: '24px 26px' }}>
        {step === 0 && (
          <>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}><Building2 size={17} style={{ verticalAlign: -3 }} /> Deal & company</h2>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Capture the won deal — who you’re onboarding.</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 18 }}>
              <F label="Company name *"><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="e.g. Globex Retail" /></F>
              <F label="Industry"><input className="input" value={form.industry} onChange={(e) => set('industry', e.target.value)} placeholder="e.g. Retail / BPO" /></F>
              <F label="Primary contact email *"><input className="input" value={form.contact} onChange={(e) => set('contact', e.target.value)} placeholder="hr@company.com" /></F>
              <F label="Admin name"><input className="input" value={form.admin} onChange={(e) => set('admin', e.target.value)} placeholder="e.g. Priya (TA Head)" /></F>
            </div>
            <div style={{ fontSize: 12, color: '#9CA3AF', marginTop: 14 }}>Workspace will be <b style={{ color: '#056FD4' }}>{slug}.reboo8.com</b></div>
          </>
        )}

        {step === 1 && (
          <>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}>Choose a plan</h2>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Sets their usage limits and which features unlock on activation.</div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14 }}>
              {PLANS.map((p) => {
                const on = form.planId === p.id;
                return (
                  <div key={p.id} onClick={() => set('planId', p.id)} style={{ position: 'relative', border: `1.5px solid ${on ? '#056FD4' : '#E2E8F0'}`, background: on ? '#F8FBFF' : '#fff', borderRadius: 12, padding: '18px 16px', cursor: 'pointer' }}>
                    {p.popular && <span className="badge" style={{ position: 'absolute', top: -10, left: 16, background: '#056FD4', color: '#fff' }}>Popular</span>}
                    <div style={{ fontSize: 15, fontWeight: 700 }}>{p.name}</div>
                    <div style={{ fontSize: 20, fontWeight: 700, color: '#056FD4', margin: '4px 0 2px' }}>{p.price ? fmt(p.price) : 'Custom'}<span style={{ fontSize: 12, color: '#9CA3AF', fontWeight: 600 }}>{p.price ? '/mo' : ''}</span></div>
                    <div style={{ fontSize: 11.5, color: '#6B7280', marginBottom: 10 }}>{p.evalLimit === Infinity ? 'Unlimited evals' : p.evalLimit + ' evals/mo'} · {p.oppLimit === Infinity ? '∞' : p.oppLimit} opps</div>
                    {p.features.slice(0, 4).map((f) => <div key={f} style={{ display: 'flex', gap: 6, fontSize: 11.5, color: '#475569', padding: '2px 0' }}><Check size={12} color="#16A34A" style={{ flexShrink: 0, marginTop: 2 }} /> {f}</div>)}
                  </div>
                );
              })}
            </div>
          </>
        )}

        {step === 2 && (
          <>
            <h2 style={{ fontSize: 17, fontWeight: 700, margin: '0 0 4px' }}><Mail size={17} style={{ verticalAlign: -3 }} /> Create tenant & send invite</h2>
            <div style={{ fontSize: 13, color: '#6B7280', marginBottom: 20 }}>Review, then provision the workspace and email the activation link.</div>
            <div style={{ border: '1px solid #E2E8F0', borderRadius: 10, overflow: 'hidden' }}>
              {[['Company', form.name || '—'], ['Industry', form.industry || '—'], ['Workspace', slug + '.reboo8.com'], ['Admin contact', form.contact || '—'], ['Plan', `${plan.name} · ${plan.price ? fmt(plan.price) + '/mo' : 'Custom'}`], ['Limits', `${plan.evalLimit === Infinity ? '∞' : plan.evalLimit} evals · ${plan.oppLimit === Infinity ? '∞' : plan.oppLimit} opps · ${plan.seats === Infinity ? '∞' : plan.seats} seats`]].map(([k, v], i, a) => (
                <div key={k} style={{ display: 'flex', justifyContent: 'space-between', padding: '12px 16px', borderBottom: i < a.length - 1 ? '1px solid #F3F4F6' : 'none', fontSize: 13 }}><span style={{ color: '#6B7280' }}>{k}</span><span style={{ fontWeight: 600 }}>{v}</span></div>
              ))}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 14, fontSize: 12.5, color: '#6B7280' }}><Rocket size={14} color="#056FD4" /> On activation, the {plan.name} plan’s features and limits unlock automatically in their portal.</div>
          </>
        )}

        {/* footer nav */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 24, paddingTop: 18, borderTop: '1px solid #F3F4F6' }}>
          <button className="btn-ghost" onClick={() => (step === 0 ? nav('/admin/clients') : setStep(step - 1))}><ArrowLeft size={15} /> {step === 0 ? 'Cancel' : 'Back'}</button>
          {step < STEPS.length - 1
            ? <button className="btn-primary" disabled={!canNext} onClick={() => setStep(step + 1)}>Continue <ArrowRight size={15} /></button>
            : <button className="btn-success" onClick={finish}><Mail size={15} /> Create tenant & send invite</button>}
        </div>
      </div>
    </div>
  );
}

const F = ({ label, children }) => <div><label className="field-label">{label}</label>{children}</div>;

import { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { Search, Command, Coins, UserPlus, AlertTriangle, Wallet, LifeBuoy, Activity, Shield, Building2, Briefcase, User, Receipt, Banknote, ShieldCheck, ArrowRight, Lightbulb } from 'lucide-react';
import { useApp, roleName } from '../../store.jsx';

/* ═══════════ Global search + command palette (spec §16) — ⌘ / Ctrl + K ═══════════
   Search answers "where do I go?" (entities) · Command answers "what do I want to do?" (actions).
   RBAC is enforced by the store: commandsFor() and searchAll() already drop what the current role may not see. */

const CMD_META = {
  cmd_add:    { icon: Coins,         hint: 'Top up a client wallet — purchase or admin grant' },
  cmd_client: { icon: UserPlus,      hint: 'Create an organization and invite its primary owner' },
  cmd_failed: { icon: AlertTriangle, hint: 'Failed jobs / needs-attention queue with recovery actions' },
  cmd_neg:    { icon: Wallet,        hint: 'Wallets in overdraft — outstanding credits to recover' },
  cmd_queue:  { icon: LifeBuoy,      hint: 'Open and in-progress support tickets' },
  cmd_usage:  { icon: Activity,      hint: 'Per-client usage report and safety controls' },
  cmd_audit:  { icon: Shield,        hint: 'Immutable audit log' },
};
const TYPE_ICON = { Client: Building2, Opportunity: Briefcase, Candidate: User, 'Support Ticket': LifeBuoy, 'Credit Transaction': Receipt, 'Invoice / Payment': Banknote, 'Evaluation Attempt': Activity, 'Admin User': ShieldCheck };
const ENTITIES = Object.keys(TYPE_ICON);

export default function CommandPalette({ open, onClose }) {
  const nav = useNavigate();
  const { commandsFor, searchAll, currentAdmin } = useApp();
  const [q, setQ] = useState('');
  const [idx, setIdx] = useState(0);
  const listRef = useRef(null);

  useEffect(() => { if (open) { setQ(''); setIdx(0); } }, [open]);
  useEffect(() => { setIdx(0); }, [q]);
  useEffect(() => { const el = listRef.current?.querySelector(`[data-idx="${idx}"]`); if (el && el.scrollIntoView) el.scrollIntoView({ block: 'nearest' }); }, [idx]);

  if (!open) return null;

  const s = q.trim().toLowerCase();
  const cmds = commandsFor()
    .map((c) => ({ kind: 'cmd', key: 'cmd-' + c.id, id: c.id, title: c.label, sub: CMD_META[c.id]?.hint || c.to, to: c.to }))
    .filter((c) => !s || c.title.toLowerCase().includes(s) || c.sub.toLowerCase().includes(s));
  const groups = [];
  if (s) {
    const byType = {};
    searchAll(q).forEach((r) => {
      if (!byType[r.type]) { byType[r.type] = []; groups.push({ type: r.type, items: byType[r.type] }); }
      byType[r.type].push({ kind: 'res', key: `res-${r.type}-${r.id}`, ...r });
    });
  }
  const flat = [...cmds, ...groups.flatMap((g) => g.items)];
  flat.forEach((it, i) => { it._i = i; });
  const total = groups.reduce((a, g) => a + g.items.length, 0);

  const go = (it) => { if (!it) return; nav(it.to); onClose?.(); };
  const onKey = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); setIdx((i) => (flat.length ? (i + 1) % flat.length : 0)); }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setIdx((i) => (flat.length ? (i - 1 + flat.length) % flat.length : 0)); }
    else if (e.key === 'Enter') { e.preventDefault(); go(flat[idx]); }
    else if (e.key === 'Escape') { e.preventDefault(); onClose?.(); }
  };

  return (
    <div onClick={onClose} style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'rgba(20,33,42,0.45)', display: 'flex', alignItems: 'flex-start', justifyContent: 'center', padding: '10vh 16px 16px' }}>
      <div onClick={(e) => e.stopPropagation()} className="card fade-in" style={{ width: 660, maxWidth: '100%', maxHeight: '78vh', display: 'flex', flexDirection: 'column', overflow: 'hidden', boxShadow: '0 24px 64px rgba(0,0,0,0.25)' }}>
        {/* input */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '13px 18px', borderBottom: '1px solid #E2E8F0' }}>
          <Search size={17} color="#6B7280" />
          <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} onKeyDown={onKey} placeholder="Search clients, candidates, tickets, transactions… or type a command"
            style={{ flex: 1, minWidth: 0, border: 'none', outline: 'none', background: 'transparent', fontSize: 15, fontFamily: 'inherit', color: '#14212A' }} />
          <span className="kbd">esc</span>
        </div>

        {/* list */}
        <div ref={listRef} style={{ overflowY: 'auto', flex: 1, padding: '6px 0' }}>
          {!s && (
            <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', margin: '8px 18px 6px', padding: '10px 12px', background: '#F8FAFC', border: '1px solid #E2E8F0', borderRadius: 8, fontSize: 12.5, color: '#475569' }}>
              <Lightbulb size={15} color="#B45309" style={{ flexShrink: 0, marginTop: 1 }} />
              <div>
                <div>Search answers <b>“where do I go?”</b> — Command answers <b>“what do I want to do?”</b></div>
                <div style={{ color: '#9CA3AF', marginTop: 3, fontSize: 11.5 }}>Searches {ENTITIES.join(' · ')}. Try “Acme”, “TKT-1063”, “LX-”, “PAY-” or a candidate name.</div>
              </div>
            </div>
          )}

          {cmds.length > 0 && <GroupLabel label="Commands" count={cmds.length} />}
          {cmds.map((c) => { const Icon = CMD_META[c.id]?.icon || Command; return (
            <Row key={c.key} i={c._i} active={idx === c._i} onHover={() => setIdx(c._i)} onGo={() => go(c)}
              icon={<Icon size={16} />} iconBg="#EDE9FE" iconFg="#6D28D9" title={c.title} sub={c.sub}
              right={<span className="chip" style={{ background: '#F3F4F6', color: '#6B7280', fontSize: 11 }}>Command</span>} />
          ); })}

          {groups.length > 0 && <GroupLabel label="Results" count={total} />}
          {groups.map((g) => { const Icon = TYPE_ICON[g.type] || Search; return (
            <div key={g.type}>
              <div className="eyebrow" style={{ padding: '8px 18px 2px', color: '#B4BCC8' }}>{g.type} · {g.items.length}</div>
              {g.items.map((r) => (
                <Row key={r.key} i={r._i} active={idx === r._i} onHover={() => setIdx(r._i)} onGo={() => go(r)}
                  icon={<Icon size={16} />} iconBg="#EFF6FF" iconFg="#056FD4" title={r.title} sub={r.sub}
                  right={<span className="chip" style={{ background: '#EFF6FF', color: '#1E40AF', fontSize: 11, whiteSpace: 'nowrap' }}>{r.type}</span>} />
              ))}
            </div>
          ); })}

          {s && flat.length === 0 && (
            <div style={{ padding: '28px 18px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No matches for “{q}” visible to your role. Try a client, candidate, ticket ID (TKT-…), transaction (LX-…) or payment (PAY-…).</div>
          )}
          {!s && cmds.length === 0 && (
            <div style={{ padding: '22px 18px', textAlign: 'center', color: '#9CA3AF', fontSize: 13 }}>No commands are available to your role — type to search.</div>
          )}
        </div>

        {/* footer */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12, padding: '9px 18px', borderTop: '1px solid #E2E8F0', background: '#FAFAFA', fontSize: 11.5, color: '#6B7280', flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
            <span><span className="kbd">↑</span> <span className="kbd">↓</span> navigate</span>
            <span><span className="kbd">↵</span> open</span>
            <span><span className="kbd">esc</span> close</span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}><ShieldCheck size={13} color="#15803D" /> Results respect your role · {roleName(currentAdmin.role)}</div>
        </div>
      </div>
    </div>
  );
}

/* ── local pieces ── */
const GroupLabel = ({ label, count }) => (
  <div style={{ display: 'flex', alignItems: 'center', gap: 8, padding: '10px 18px 4px', fontSize: 11, fontWeight: 700, letterSpacing: '.6px', textTransform: 'uppercase', color: '#6B7280' }}>
    {label}<span className="badge" style={{ background: '#F3F4F6', color: '#6B7280' }}>{count}</span>
  </div>
);

function Row({ i, active, onHover, onGo, icon, iconBg, iconFg, title, sub, right }) {
  return (
    <div data-idx={i} onMouseEnter={onHover} onClick={onGo} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 18px 8px 15px', background: active ? '#EFF6FF' : 'transparent', cursor: 'pointer', borderLeft: active ? '3px solid #056FD4' : '3px solid transparent' }}>
      <div style={{ width: 30, height: 30, borderRadius: 8, background: iconBg, color: iconFg, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{icon}</div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13.5, fontWeight: 600, color: '#14212A', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{title}</div>
        {sub && <div style={{ fontSize: 12, color: '#6B7280', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{sub}</div>}
      </div>
      {right}
      {active && <ArrowRight size={14} color="#056FD4" />}
    </div>
  );
}

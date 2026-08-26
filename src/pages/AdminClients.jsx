import { useState, useMemo } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { Plus, Search, Info, X, Pause, TrendingUp, Wallet } from 'lucide-react';
import { useApp, CLIENT_STATUS, WALLET_STATE, walletOf, fmtCr, initials } from '../store.jsx';
import { ClientStatusBadge, WalletStateBadge, PermButton, PageHeader, EmptyRow, Mono } from '../components/admin/ui.jsx';

/* Clients list (spec §02 onboarding entry · §03 account lifecycle · §06 wallet states).
   Locked distinction: account status and wallet state are SEPARATE badges — low / zero / overdraft are never account statuses. */

const PALETTE = [['#DBEAFE', '#1E40AF'], ['#DCFCE7', '#15803D'], ['#EDE9FE', '#6D28D9'], ['#FFEDD5', '#C2410C'], ['#FEF3C7', '#B45309'], ['#E0F2FE', '#0369A1']];
const paletteFor = (s = '') => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return PALETTE[h % PALETTE.length]; };
const num = (n) => (Number(n) || 0).toLocaleString('en-IN');
const COLS = 8;

export default function AdminClients() {
  const nav = useNavigate();
  const loc = useLocation();
  const { clients } = useApp();
  const params = new URLSearchParams(loc.search);
  const [q, setQ] = useState(params.get('q') || '');
  const [status, setStatus] = useState(CLIENT_STATUS[params.get('status')] ? params.get('status') : 'ALL');
  const [wallet, setWallet] = useState(WALLET_STATE[params.get('wallet')] ? params.get('wallet') : 'ALL');

  const rows = useMemo(() => clients.map((c) => ({ c, w: walletOf(c) })), [clients]);
  const s = q.trim().toLowerCase();
  const list = rows.filter(({ c, w }) =>
    (status === 'ALL' || c.status === status) &&
    (wallet === 'ALL' || w.state === wallet) &&
    (!s || [c.name, c.legalName, c.tenantId, c.owner?.email, c.owner?.name].some((v) => (v || '').toLowerCase().includes(s))));

  const byStatus = Object.fromEntries(Object.keys(CLIENT_STATUS).map((k) => [k, rows.filter(({ c }) => c.status === k).length]));
  const byWallet = Object.fromEntries(Object.keys(WALLET_STATE).map((k) => [k, rows.filter(({ w }) => w.state === k).length]));
  const attention = rows.filter(({ w }) => w.state !== 'HEALTHY').length;
  const filtered = status !== 'ALL' || wallet !== 'ALL' || !!s;
  const reset = () => { setQ(''); setStatus('ALL'); setWallet('ALL'); };

  return (
    <>
      <PageHeader
        title={<>Clients <span style={{ color: '#9CA3AF', fontWeight: 600, fontSize: 15 }}>[{clients.length}]</span></>}
        sub="Every organization — account status and wallet state are tracked separately"
        right={<PermButton action="client.create" className="btn-primary" onClick={() => nav('/admin/clients/new')}><Plus size={15} /> Onboard client</PermButton>}
      />

      {/* summary strip — counts by account status (click to filter) + wallets needing attention */}
      <div className="card" style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap', padding: '10px 14px', marginBottom: 14 }}>
        <span className="eyebrow" style={{ marginRight: 4 }}>By account status</span>
        {Object.entries(CLIENT_STATUS).map(([k, v]) => {
          const n = byStatus[k]; const on = status === k;
          return (
            <button key={k} type="button" title={v.desc} onClick={() => setStatus(on ? 'ALL' : k)} className="chip"
              style={{ background: on ? v.bg : '#F9FAFB', color: n ? v.fg : '#9CA3AF', border: `1px solid ${on ? v.fg : '#E2E8F0'}`, cursor: 'pointer', fontSize: 11.5 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: n ? v.fg : '#D1D5DB', flexShrink: 0 }} />
              {v.label}<b className="tnum" style={{ marginLeft: 2 }}>{n}</b>
            </button>
          );
        })}
        <span style={{ flex: 1 }} />
        <button type="button" className="chip" onClick={() => nav('/admin/credits?tab=wallets')} title="Open Credits & Billing → Wallets"
          style={{ background: attention ? '#FFFBEB' : '#F0FDF4', color: attention ? '#B45309' : '#15803D', border: `1px solid ${attention ? '#FDE68A' : '#BBF7D0'}`, cursor: 'pointer', fontSize: 11.5 }}>
          <Wallet size={13} /> {attention ? `${attention} wallet${attention === 1 ? '' : 's'} need attention` : 'All wallets healthy'}
        </button>
      </div>

      {/* filters: search + account-status chips + wallet-state chips */}
      <div className="card" style={{ padding: '12px 14px', marginBottom: 14, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
          <div style={{ position: 'relative', flex: '1 1 260px', maxWidth: 420 }}>
            <Search size={15} color="#9CA3AF" style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)' }} />
            <input className="input" value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search company, tenant ID or owner email…" style={{ paddingLeft: 34, paddingRight: q ? 32 : 14 }} />
            {q && <X size={14} color="#9CA3AF" style={{ position: 'absolute', right: 11, top: '50%', transform: 'translateY(-50%)', cursor: 'pointer' }} onClick={() => setQ('')} />}
          </div>
          <span style={{ fontSize: 12.5, color: '#6B7280' }}>{list.length} of {clients.length} shown</span>
          {filtered && <button type="button" className="btn-ghost" style={{ padding: '6px 12px', fontSize: 12.5 }} onClick={reset}><X size={13} /> Clear filters</button>}
        </div>
        <FilterRow label="Account status" value={status} onChange={setStatus} counts={byStatus} options={[['ALL', 'All'], ...Object.entries(CLIENT_STATUS).map(([k, v]) => [k, v.label])]} />
        <FilterRow label="Wallet state" value={wallet} onChange={setWallet} counts={byWallet} options={[['ALL', 'All'], ...Object.entries(WALLET_STATE).map(([k, v]) => [k, v.label])]} />
      </div>

      {/* table */}
      <div className="card" style={{ overflow: 'hidden' }}>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Company</th><th>Tenant ID</th><th>Primary owner</th><th>Account status</th><th>Wallet</th>
                <th style={{ textAlign: 'right' }}>Open opps</th><th style={{ textAlign: 'right' }}>Credits consumed</th><th>Sales owner</th>
              </tr>
            </thead>
            <tbody>
              {list.length === 0
                ? <EmptyRow cols={COLS} text={clients.length === 0 ? 'No clients yet — onboard the first organization.' : 'No clients match these filters.'} />
                : list.map(({ c, w }) => {
                  const [bg, fg] = paletteFor(c.name);
                  return (
                    <tr className="row" key={c.id} onClick={() => nav('/admin/clients/' + c.id)}>
                      <td>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                          <div className="avatar" style={{ width: 34, height: 34, background: bg, color: fg, fontSize: 11.5 }}>{initials(c.name)}</div>
                          <div style={{ minWidth: 0 }}>
                            <div style={{ fontWeight: 600, display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                              {c.name}
                              {(c.flags || []).includes('spike') && <Tag bg="#FEF3C7" fg="#B45309" icon={TrendingUp}>usage spike</Tag>}
                              {c.paused && <Tag bg="#F3F4F6" fg="#6B7280" icon={Pause}>usage paused</Tag>}
                            </div>
                            <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{c.industry}{c.country ? ` · ${c.country}` : ''}</div>
                          </div>
                        </div>
                      </td>
                      <td><Mono>{c.tenantId}</Mono></td>
                      <td>
                        <div style={{ fontWeight: 500 }}>{c.owner?.name || '—'}</div>
                        <div style={{ fontSize: 11.5, color: '#9CA3AF' }}>{c.owner?.email || '—'}</div>
                      </td>
                      <td>
                        <ClientStatusBadge status={c.status} />
                        {c.statusReason && <div title={c.statusReason} style={{ fontSize: 11, color: '#9CA3AF', marginTop: 4, maxWidth: 170, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{c.statusReason}</div>}
                      </td>
                      <td>
                        <WalletStateBadge state={w.state} />
                        <div className="tnum" style={{ fontSize: 11.5, color: '#6B7280', marginTop: 4, whiteSpace: 'nowrap' }}>
                          {fmtCr(w.available)} available{w.reserved > 0 && <span style={{ color: '#9CA3AF' }}> · {fmtCr(w.reserved)} reserved</span>}
                        </div>
                        {w.outstanding > 0 && <div className="tnum" style={{ fontSize: 11.5, color: '#B91C1C', fontWeight: 700, marginTop: 2, whiteSpace: 'nowrap' }}>{fmtCr(w.outstanding)} outstanding</div>}
                      </td>
                      <td className="tnum" style={{ textAlign: 'right' }}>{c.oppsOpen ?? 0}</td>
                      <td className="tnum" style={{ textAlign: 'right', fontWeight: 600, whiteSpace: 'nowrap' }}>{num(c.usage?.creditsConsumed)} <span style={{ color: '#9CA3AF', fontWeight: 500 }}>cr</span></td>
                      <td style={{ color: '#475569', whiteSpace: 'nowrap' }}>{c.salesOwner || '—'}</td>
                    </tr>
                  );
                })}
            </tbody>
          </table>
        </div>

        {/* legend — the locked distinction */}
        <div style={{ display: 'flex', alignItems: 'flex-start', gap: 9, padding: '11px 16px', borderTop: '1px solid #F3F4F6', background: '#FAFAFA', fontSize: 12, color: '#6B7280', lineHeight: 1.5 }}>
          <Info size={14} color="#056FD4" style={{ flexShrink: 0, marginTop: 2 }} />
          <div>
            <b style={{ color: '#374151' }}>Low / zero / overdraft are wallet states — not account statuses.</b>{' '}
            Account status is the lifecycle (Invite pending → Active ↔ Suspended → Offboarding → Deactivated → Retention → Deleted); the wallet badge only says whether the <i>next</i> paid evaluation may start.
            A client stays <b>Active</b> at 0 credits, and a running evaluation is never interrupted by the wallet.
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
              {Object.entries(WALLET_STATE).map(([k, v]) => <span key={k} className="badge" style={{ background: v.bg, color: v.fg }}>{v.label} · {byWallet[k]}</span>)}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ── local helpers ── */
function FilterRow({ label, value, onChange, options, counts }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span className="eyebrow" style={{ minWidth: 104 }}>{label}</span>
      {options.map(([k, l]) => {
        const n = k === 'ALL' ? null : counts[k];
        return (
          <button key={k} type="button" className={'filter-btn' + (value === k ? ' active' : '')} onClick={() => onChange(k)} style={{ padding: '5px 11px', fontSize: 12 }}>
            {l}{n != null && <span className="tnum" style={{ opacity: 0.7, fontWeight: 600 }}>{n}</span>}
          </button>
        );
      })}
    </div>
  );
}
const Tag = ({ bg, fg, icon: Icon, children }) => (
  <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 10.5, fontWeight: 700, background: bg, color: fg, borderRadius: 6, padding: '1px 6px', letterSpacing: '.2px' }}>{Icon && <Icon size={10} />}{children}</span>
);

import { useEffect, useState } from 'react';
import { Plus, Building2, Globe, Users, ChevronRight, X, Pencil, Check, Ban, CheckCircle2, Settings } from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';

const PLAN_COLORS: Record<string, string> = {
  TRIAL:      'bg-gray-100 text-gray-600',
  STARTER:    'bg-blue-100 text-blue-700',
  PRO:        'bg-purple-100 text-purple-700',
  ENTERPRISE: 'bg-amber-100 text-amber-700',
};

const SITE_TYPE_LABELS: Record<string, string> = {
  HOTEL: 'Hotel', BNB: 'B&B', BEACH_CLUB: 'Beach Club', RESTAURANT: 'Ristorante', OTHER: 'Altro',
};

const LICENSE_STATUS_COLORS: Record<string, string> = {
  attivo:       'bg-green-100 text-green-700',
  in_scadenza:  'bg-amber-100 text-amber-700',
  scaduto:      'bg-red-100 text-red-700',
  sospeso:      'bg-red-100 text-red-700',
};

const LICENSE_STATUS_LABELS: Record<string, string> = {
  attivo:       'Attivo',
  in_scadenza:  'In scadenza',
  scaduto:      'Scaduto',
  sospeso:      'Sospeso',
};

interface TenantRow {
  id: string; name: string; slug: string; plan: string;
  contactEmail?: string | null; telefono?: string | null;
  pec?: string | null; sitoWeb?: string | null;
  ragioneSociale?: string | null; formaGiuridica?: string | null;
  partitaIva?: string | null; codiceFiscale?: string | null;
  via?: string | null; civico?: string | null; cap?: string | null;
  citta?: string | null; provincia?: string | null; paese?: string | null;
  codiceSdi?: string | null; pecFatturazione?: string | null;
  iban?: string | null; note?: string | null;
  planExpiresAt?: string | null;
  isSuspended?: boolean;
  licenseStatus?: string;
  daysRemaining?: number | null;
  siteCount: number; managerCount: number; createdAt: string;
}

interface SiteRow { id: string; name: string; type: string; address: string | null; createdAt: string; }
interface ManagerRow { id: string; email: string; role: string; firstName: string | null; lastName: string | null; }
interface TenantDetail extends TenantRow { sites: SiteRow[]; managers: ManagerRow[]; }

type EF = Record<string, string>;

function toEditForm(t: TenantRow): EF {
  const s = (v: string | null | undefined) => v ?? '';
  const dateStr = (v: string | null | undefined) => v ? v.substring(0, 10) : '';
  return {
    name: s(t.name), slug: s(t.slug), plan: t.plan ?? 'TRIAL',
    contactEmail: s(t.contactEmail), telefono: s(t.telefono),
    pec: s(t.pec), sitoWeb: s(t.sitoWeb),
    ragioneSociale: s(t.ragioneSociale), formaGiuridica: s(t.formaGiuridica),
    partitaIva: s(t.partitaIva), codiceFiscale: s(t.codiceFiscale),
    via: s(t.via), civico: s(t.civico), cap: s(t.cap),
    citta: s(t.citta), provincia: s(t.provincia), paese: s(t.paese),
    codiceSdi: s(t.codiceSdi), pecFatturazione: s(t.pecFatturazione),
    iban: s(t.iban), note: s(t.note),
    planExpiresAt: dateStr(t.planExpiresAt),
  };
}

function toPayload(form: EF): Record<string, string | null> {
  return Object.fromEntries(
    Object.entries(form).map(([k, v]) => {
      if (k === 'planExpiresAt') return [k, v.trim() === '' ? null : v.trim()];
      return [k, v.trim() === '' ? null : v.trim()];
    })
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────────

export default function SuperAdminPage() {
  const [tenants, setTenants] = useState<TenantRow[]>([]);
  const [selected, setSelected] = useState<TenantDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [showTenantForm, setShowTenantForm] = useState(false);
  const [showSiteForm, setShowSiteForm] = useState(false);
  const [showManagerForm, setShowManagerForm] = useState(false);
  const [editingTenant, setEditingTenant] = useState(false);
  const [editTab, setEditTab] = useState<'generale' | 'anagrafica' | 'fatturazione'>('generale');
  const [editForm, setEditForm] = useState<EF>({});
  const [editSaving, setEditSaving] = useState(false);

  useEffect(() => {
    api.get<TenantRow[]>('/superadmin/tenants')
      .then((r) => setTenants(r.data))
      .finally(() => setLoading(false));
  }, []);

  const selectTenant = async (id: string) => {
    const { data } = await api.get<TenantDetail>(`/superadmin/tenants/${id}`);
    setSelected(data);
    setEditingTenant(false);
  };

  const startEdit = () => {
    if (!selected) return;
    setEditForm(toEditForm(selected));
    setEditTab('generale');
    setEditingTenant(true);
  };

  const set = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setEditForm((p) => ({ ...p, [field]: e.target.value }));

  const handleTenantSave = async () => {
    if (!selected) return;
    setEditSaving(true);
    try {
      const { data } = await api.patch<TenantRow>(`/superadmin/tenants/${selected.id}`, toPayload(editForm));
      const updated = { ...selected, ...data };
      setSelected(updated);
      setTenants((prev) => prev.map((t) => t.id === selected.id ? { ...t, ...data } : t));
      setEditingTenant(false);
    } finally {
      setEditSaving(false);
    }
  };

  const handleSuspendToggle = async () => {
    if (!selected) return;
    const action = selected.isSuspended ? 'unsuspend' : 'suspend';
    const { data } = await api.post<TenantRow>(`/superadmin/tenants/${selected.id}/${action}`);
    const updated = { ...selected, ...data };
    setSelected(updated);
    setTenants((prev) => prev.map((t) => t.id === selected.id ? { ...t, ...data } : t));
  };

  const handleTenantCreated = (t: TenantRow) => {
    setTenants((prev) => [t, ...prev]);
    setShowTenantForm(false);
  };

  const handleSiteCreated = (site: SiteRow) => {
    setSelected((prev) => prev ? { ...prev, sites: [...prev.sites, site], siteCount: prev.siteCount + 1 } : prev);
    setTenants((prev) => prev.map((t) => t.id === selected?.id ? { ...t, siteCount: t.siteCount + 1 } : t));
    setShowSiteForm(false);
  };

  const handleManagerCreated = (m: ManagerRow) => {
    setSelected((prev) => prev ? { ...prev, managers: [...prev.managers, m], managerCount: prev.managerCount + 1 } : prev);
    setTenants((prev) => prev.map((t) => t.id === selected?.id ? { ...t, managerCount: t.managerCount + 1 } : t));
    setShowManagerForm(false);
  };

  const handleManagerDeleted = async (managerId: string) => {
    if (!selected) return;
    await api.delete(`/superadmin/tenants/${selected.id}/managers/${managerId}`);
    setSelected((prev) => prev ? {
      ...prev,
      managers: prev.managers.filter((m) => m.id !== managerId),
      managerCount: prev.managerCount - 1,
    } : prev);
    setTenants((prev) => prev.map((t) => t.id === selected.id ? { ...t, managerCount: t.managerCount - 1 } : t));
  };

  return (
    <div className="flex h-full">
      {/* Left: tenant list */}
      <div className="w-80 border-r border-gray-200 bg-white flex flex-col shrink-0">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Tenant</h2>
          <button onClick={() => setShowTenantForm(true)}
            className="p-1.5 bg-brand-500 hover:bg-brand-600 text-white rounded-lg transition-colors">
            <Plus className="w-4 h-4" />
          </button>
        </div>

        {loading ? (
          <div className="p-5 text-sm text-gray-400">Caricamento...</div>
        ) : tenants.length === 0 ? (
          <div className="p-5 text-sm text-gray-400">Nessun tenant.</div>
        ) : (
          <div className="flex-1 overflow-y-auto divide-y divide-gray-50">
            {tenants.map((t) => (
              <button key={t.id} onClick={() => selectTenant(t.id)}
                className={`w-full text-left px-5 py-4 hover:bg-gray-50 transition-colors ${
                  selected?.id === t.id ? 'bg-brand-50 border-l-2 border-brand-500' : ''}`}>
                <div className="flex items-center justify-between gap-2">
                  <span className="font-medium text-gray-900 text-sm truncate">{t.name}</span>
                  <ChevronRight className="w-3.5 h-3.5 text-gray-400 shrink-0" />
                </div>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${PLAN_COLORS[t.plan] ?? 'bg-gray-100 text-gray-600'}`}>
                    {t.plan}
                  </span>
                  {t.licenseStatus && t.licenseStatus !== 'attivo' && (
                    <span className={`text-xs font-medium px-1.5 py-0.5 rounded-full ${LICENSE_STATUS_COLORS[t.licenseStatus] ?? ''}`}>
                      {LICENSE_STATUS_LABELS[t.licenseStatus] ?? t.licenseStatus}
                    </span>
                  )}
                  <span className="text-xs text-gray-400">{t.siteCount} siti · {t.managerCount} utenti</span>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Right: detail */}
      <div className="flex-1 overflow-y-auto p-8 bg-gray-50">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-sm text-gray-400">
            Seleziona un tenant per vedere i dettagli
          </div>
        ) : (
          <div className="max-w-3xl space-y-6">

            {/* Tenant header card */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
              {editingTenant ? (
                <div className="space-y-4">
                  <TabBar
                    tabs={[
                      { id: 'generale', label: 'Generale' },
                      { id: 'anagrafica', label: 'Anagrafica' },
                      { id: 'fatturazione', label: 'Fatturazione' },
                    ]}
                    active={editTab}
                    onChange={(t) => setEditTab(t as typeof editTab)}
                  />

                  {editTab === 'generale' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={labelCls}>Nome *</label>
                        <input className={inputCls} value={editForm.name} onChange={set('name')} /></div>
                      <div><label className={labelCls}>Slug *</label>
                        <input className={inputCls} value={editForm.slug} onChange={set('slug')} /></div>
                      <div><label className={labelCls}>Piano</label>
                        <select className={inputCls} value={editForm.plan} onChange={set('plan')}>
                          {['TRIAL','STARTER','PRO','ENTERPRISE'].map((p) => <option key={p} value={p}>{p}</option>)}
                        </select></div>
                      <div><label className={labelCls}>Scadenza licenza</label>
                        <input type="date" className={inputCls} value={editForm.planExpiresAt ?? ''} onChange={set('planExpiresAt')} /></div>
                      <div><label className={labelCls}>Email di contatto</label>
                        <input type="email" className={inputCls} value={editForm.contactEmail} onChange={set('contactEmail')} /></div>
                      <div><label className={labelCls}>Telefono</label>
                        <input className={inputCls} value={editForm.telefono} onChange={set('telefono')} /></div>
                      <div><label className={labelCls}>PEC</label>
                        <input type="email" className={inputCls} value={editForm.pec} onChange={set('pec')} /></div>
                      <div className="col-span-2"><label className={labelCls}>Sito web</label>
                        <input className={inputCls} value={editForm.sitoWeb} onChange={set('sitoWeb')} /></div>
                    </div>
                  )}

                  {editTab === 'anagrafica' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={labelCls}>Ragione Sociale</label>
                        <input className={inputCls} value={editForm.ragioneSociale} onChange={set('ragioneSociale')} /></div>
                      <div><label className={labelCls}>Forma Giuridica</label>
                        <input className={inputCls} placeholder="es. S.r.l., S.p.A." value={editForm.formaGiuridica} onChange={set('formaGiuridica')} /></div>
                      <div><label className={labelCls}>Partita IVA</label>
                        <input className={inputCls} value={editForm.partitaIva} onChange={set('partitaIva')} /></div>
                      <div><label className={labelCls}>Codice Fiscale</label>
                        <input className={inputCls} value={editForm.codiceFiscale} onChange={set('codiceFiscale')} /></div>
                      <div className="col-span-2 border-t border-gray-100 pt-3">
                        <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Indirizzo sede</p>
                        <div className="grid grid-cols-4 gap-3">
                          <div className="col-span-2"><label className={labelCls}>Via / Piazza</label>
                            <input className={inputCls} value={editForm.via} onChange={set('via')} /></div>
                          <div><label className={labelCls}>Civico</label>
                            <input className={inputCls} value={editForm.civico} onChange={set('civico')} /></div>
                          <div><label className={labelCls}>CAP</label>
                            <input className={inputCls} value={editForm.cap} onChange={set('cap')} /></div>
                          <div className="col-span-2"><label className={labelCls}>Città</label>
                            <input className={inputCls} value={editForm.citta} onChange={set('citta')} /></div>
                          <div><label className={labelCls}>Provincia</label>
                            <input className={inputCls} placeholder="es. MI" maxLength={2} value={editForm.provincia} onChange={set('provincia')} /></div>
                          <div><label className={labelCls}>Paese</label>
                            <input className={inputCls} placeholder="IT" value={editForm.paese} onChange={set('paese')} /></div>
                        </div>
                      </div>
                    </div>
                  )}

                  {editTab === 'fatturazione' && (
                    <div className="grid grid-cols-2 gap-3">
                      <div><label className={labelCls}>Codice SDI</label>
                        <input className={inputCls} maxLength={7} value={editForm.codiceSdi} onChange={set('codiceSdi')} /></div>
                      <div><label className={labelCls}>PEC Fatturazione</label>
                        <input type="email" className={inputCls} value={editForm.pecFatturazione} onChange={set('pecFatturazione')} /></div>
                      <div className="col-span-2"><label className={labelCls}>IBAN</label>
                        <input className={inputCls} value={editForm.iban} onChange={set('iban')} /></div>
                      <div className="col-span-2"><label className={labelCls}>Note</label>
                        <textarea className={inputCls} rows={3} value={editForm.note}
                          onChange={set('note')} /></div>
                    </div>
                  )}

                  <div className="flex gap-3 pt-1">
                    <button onClick={handleTenantSave} disabled={editSaving}
                      className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
                      <Check className="w-4 h-4" />
                      {editSaving ? 'Salvataggio...' : 'Salva'}
                    </button>
                    <button onClick={() => setEditingTenant(false)}
                      className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
                      Annulla
                    </button>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-start justify-between">
                    <div>
                      <h1 className="text-xl font-bold text-gray-900">{selected.name}</h1>
                      {selected.ragioneSociale && (
                        <p className="text-sm text-gray-500 mt-0.5">{selected.ragioneSociale}</p>
                      )}
                      <p className="text-xs text-gray-400 mt-0.5">slug: {selected.slug}</p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap justify-end">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${PLAN_COLORS[selected.plan] ?? ''}`}>
                        {selected.plan}
                      </span>
                      {selected.licenseStatus && (
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${LICENSE_STATUS_COLORS[selected.licenseStatus] ?? 'bg-green-100 text-green-700'}`}>
                          {LICENSE_STATUS_LABELS[selected.licenseStatus] ?? selected.licenseStatus}
                          {selected.licenseStatus === 'in_scadenza' && selected.daysRemaining != null
                            ? ` · ${selected.daysRemaining}g`
                            : ''}
                        </span>
                      )}
                      <button
                        onClick={handleSuspendToggle}
                        title={selected.isSuspended ? 'Riattiva tenant' : 'Sospendi tenant'}
                        className={`p-1.5 rounded-lg transition-colors ${selected.isSuspended
                          ? 'bg-green-50 text-green-600 hover:bg-green-100'
                          : 'hover:bg-red-50 text-gray-400 hover:text-red-600'}`}
                      >
                        {selected.isSuspended ? <CheckCircle2 className="w-4 h-4" /> : <Ban className="w-4 h-4" />}
                      </button>
                      <button onClick={startEdit}
                        className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-gray-700">
                        <Pencil className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  <div className="flex gap-6 mt-4 text-sm text-gray-500">
                    <span className="flex items-center gap-1.5"><Building2 className="w-4 h-4" /> {selected.siteCount} siti</span>
                    <span className="flex items-center gap-1.5"><Users className="w-4 h-4" /> {selected.managerCount} utenti</span>
                    <span className="flex items-center gap-1.5"><Globe className="w-4 h-4" /> {new Date(selected.createdAt).toLocaleDateString('it-IT')}</span>
                  </div>

                  {/* Anagrafica quick view */}
                  <AnagraficaView t={selected} />
                </>
              )}
            </div>

            {/* Sites */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Siti ({selected.sites.length})</h2>
                <button onClick={() => setShowSiteForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Nuovo sito
                </button>
              </div>

              {showSiteForm && (
                <div className="px-6 py-4 border-b border-gray-100">
                  <CreateSiteForm tenantId={selected.id} onCreated={handleSiteCreated} onCancel={() => setShowSiteForm(false)} />
                </div>
              )}

              {selected.sites.length === 0 ? (
                <div className="px-6 py-6 text-sm text-gray-400">Nessun sito configurato.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {selected.sites.map((s) => (
                    <SiteCard key={s.id} site={s} />
                  ))}
                </div>
              )}
            </div>

            {/* Managers */}
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
              <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
                <h2 className="font-semibold text-gray-900">Utenti ({selected.managers.length})</h2>
                <button onClick={() => setShowManagerForm(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-xs font-semibold rounded-lg transition-colors">
                  <Plus className="w-3.5 h-3.5" /> Nuovo utente
                </button>
              </div>

              {showManagerForm && (
                <div className="px-6 py-4 border-b border-gray-100">
                  <CreateManagerForm
                    tenantId={selected.id}
                    sites={selected.sites}
                    onCreated={handleManagerCreated}
                    onCancel={() => setShowManagerForm(false)}
                  />
                </div>
              )}

              {selected.managers.length === 0 ? (
                <div className="px-6 py-6 text-sm text-gray-400">Nessun utente.</div>
              ) : (
                <div className="divide-y divide-gray-50">
                  {selected.managers.map((m) => (
                    <div key={m.id} className="px-6 py-3.5 flex items-center justify-between">
                      <div>
                        <p className="text-sm font-medium text-gray-900">
                          {m.firstName || m.lastName ? `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim() : m.email}
                        </p>
                        {(m.firstName || m.lastName) && <p className="text-xs text-gray-400">{m.email}</p>}
                      </div>
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-medium capitalize text-gray-500 bg-gray-100 px-2 py-0.5 rounded-full">
                          {m.role.toLowerCase()}
                        </span>
                        <button
                          onClick={() => handleManagerDeleted(m.id)}
                          className="p-1 hover:bg-red-50 text-gray-300 hover:text-red-500 rounded transition-colors"
                          title="Elimina utente"
                        >
                          <X className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {showTenantForm && (
        <Modal title="Nuovo tenant" onClose={() => setShowTenantForm(false)} wide>
          <CreateTenantForm onCreated={handleTenantCreated} onCancel={() => setShowTenantForm(false)} />
        </Modal>
      )}
    </div>
  );
}

// ─── Anagrafica View ────────────────────────────────────────────────────────────

function InfoRow({ label, value }: { label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div>
      <p className="text-xs text-gray-400">{label}</p>
      <p className="text-sm text-gray-700">{value}</p>
    </div>
  );
}

function AnagraficaView({ t }: { t: TenantRow }) {
  const hasAnagrafica = t.ragioneSociale || t.partitaIva || t.codiceFiscale || t.via || t.citta;
  const hasFatturazione = t.codiceSdi || t.pecFatturazione || t.iban;
  const hasContatti = t.contactEmail || t.telefono || t.pec || t.sitoWeb;

  if (!hasAnagrafica && !hasFatturazione && !hasContatti) return null;

  const addr = [t.via, t.civico].filter(Boolean).join(' ');
  const city = [t.cap, t.citta, t.provincia && `(${t.provincia})`, t.paese].filter(Boolean).join(' ');

  return (
    <div className="mt-5 pt-5 border-t border-gray-100 grid grid-cols-2 gap-x-8 gap-y-3">
      <InfoRow label="Ragione Sociale" value={t.ragioneSociale} />
      <InfoRow label="Forma Giuridica" value={t.formaGiuridica} />
      <InfoRow label="Partita IVA" value={t.partitaIva} />
      <InfoRow label="Codice Fiscale" value={t.codiceFiscale} />
      {addr && <InfoRow label="Indirizzo" value={addr} />}
      {city && <InfoRow label="Città" value={city} />}
      <InfoRow label="Email" value={t.contactEmail} />
      <InfoRow label="Telefono" value={t.telefono} />
      <InfoRow label="PEC" value={t.pec} />
      <InfoRow label="Sito web" value={t.sitoWeb} />
      <InfoRow label="Codice SDI" value={t.codiceSdi} />
      <InfoRow label="PEC Fatturazione" value={t.pecFatturazione} />
      <InfoRow label="IBAN" value={t.iban} />
      {t.note && (
        <div className="col-span-2">
          <p className="text-xs text-gray-400">Note</p>
          <p className="text-sm text-gray-700 whitespace-pre-line">{t.note}</p>
        </div>
      )}
    </div>
  );
}

// ─── Create Tenant Form ─────────────────────────────────────────────────────────

function CreateTenantForm({ onCreated, onCancel }: { onCreated: (t: TenantRow) => void; onCancel: () => void }) {
  const [tab, setTab] = useState<'generale' | 'anagrafica' | 'fatturazione'>('generale');
  const [form, setForm] = useState<EF>({
    name: '', slug: '', plan: 'TRIAL', planExpiresAt: '',
    contactEmail: '', telefono: '', pec: '', sitoWeb: '',
    ragioneSociale: '', formaGiuridica: '', partitaIva: '', codiceFiscale: '',
    via: '', civico: '', cap: '', citta: '', provincia: '', paese: '',
    codiceSdi: '', pecFatturazione: '', iban: '', note: '',
    ownerEmail: '', ownerPassword: '', ownerFirstName: '', ownerLastName: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const s = (field: string) => (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) =>
    setForm((p) => ({ ...p, [field]: e.target.value }));

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = toPayload(form);
      const { data } = await api.post<TenantRow>('/superadmin/tenants', payload);
      onCreated(data);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Errore');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {error && <div className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}

      <TabBar
        tabs={[{ id: 'generale', label: 'Generale' }, { id: 'anagrafica', label: 'Anagrafica' }, { id: 'fatturazione', label: 'Fatturazione' }]}
        active={tab}
        onChange={(t) => setTab(t as typeof tab)}
      />

      {tab === 'generale' && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Nome struttura *</label>
              <input required className={inputCls} value={form.name} onChange={s('name')} /></div>
            <div><label className={labelCls}>Slug (URL) *</label>
              <input required className={inputCls} value={form.slug} onChange={s('slug')} /></div>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <div><label className={labelCls}>Piano</label>
              <select className={inputCls} value={form.plan} onChange={s('plan')}>
                {['TRIAL','STARTER','PRO','ENTERPRISE'].map((p) => <option key={p} value={p}>{p}</option>)}
              </select></div>
            <div><label className={labelCls}>Scadenza licenza</label>
              <input type="date" className={inputCls} value={form.planExpiresAt} onChange={s('planExpiresAt')} /></div>
            <div className="col-span-2"><label className={labelCls}>Email di contatto</label>
              <input type="email" className={inputCls} value={form.contactEmail} onChange={s('contactEmail')} /></div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Telefono</label>
              <input className={inputCls} value={form.telefono} onChange={s('telefono')} /></div>
            <div><label className={labelCls}>PEC</label>
              <input type="email" className={inputCls} value={form.pec} onChange={s('pec')} /></div>
            <div className="col-span-2"><label className={labelCls}>Sito web</label>
              <input className={inputCls} value={form.sitoWeb} onChange={s('sitoWeb')} /></div>
          </div>
          <hr className="border-gray-100" />
          <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide">Owner account (opzionale)</p>
          <div className="grid grid-cols-2 gap-3">
            <div><label className={labelCls}>Nome</label>
              <input className={inputCls} value={form.ownerFirstName} onChange={s('ownerFirstName')} /></div>
            <div><label className={labelCls}>Cognome</label>
              <input className={inputCls} value={form.ownerLastName} onChange={s('ownerLastName')} /></div>
            <div><label className={labelCls}>Email</label>
              <input type="email" className={inputCls} value={form.ownerEmail} onChange={s('ownerEmail')} /></div>
            <div><label className={labelCls}>Password</label>
              <input type="password" className={inputCls} value={form.ownerPassword} onChange={s('ownerPassword')} /></div>
          </div>
        </div>
      )}

      {tab === 'anagrafica' && (
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Ragione Sociale</label>
            <input className={inputCls} value={form.ragioneSociale} onChange={s('ragioneSociale')} /></div>
          <div><label className={labelCls}>Forma Giuridica</label>
            <input className={inputCls} placeholder="es. S.r.l." value={form.formaGiuridica} onChange={s('formaGiuridica')} /></div>
          <div><label className={labelCls}>Partita IVA</label>
            <input className={inputCls} value={form.partitaIva} onChange={s('partitaIva')} /></div>
          <div><label className={labelCls}>Codice Fiscale</label>
            <input className={inputCls} value={form.codiceFiscale} onChange={s('codiceFiscale')} /></div>
          <div className="col-span-2 border-t border-gray-100 pt-3">
            <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Indirizzo sede</p>
            <div className="grid grid-cols-4 gap-3">
              <div className="col-span-2"><label className={labelCls}>Via / Piazza</label>
                <input className={inputCls} value={form.via} onChange={s('via')} /></div>
              <div><label className={labelCls}>Civico</label>
                <input className={inputCls} value={form.civico} onChange={s('civico')} /></div>
              <div><label className={labelCls}>CAP</label>
                <input className={inputCls} value={form.cap} onChange={s('cap')} /></div>
              <div className="col-span-2"><label className={labelCls}>Città</label>
                <input className={inputCls} value={form.citta} onChange={s('citta')} /></div>
              <div><label className={labelCls}>Provincia</label>
                <input className={inputCls} placeholder="MI" maxLength={2} value={form.provincia} onChange={s('provincia')} /></div>
              <div><label className={labelCls}>Paese</label>
                <input className={inputCls} placeholder="IT" value={form.paese} onChange={s('paese')} /></div>
            </div>
          </div>
        </div>
      )}

      {tab === 'fatturazione' && (
        <div className="grid grid-cols-2 gap-3">
          <div><label className={labelCls}>Codice SDI</label>
            <input className={inputCls} maxLength={7} value={form.codiceSdi} onChange={s('codiceSdi')} /></div>
          <div><label className={labelCls}>PEC Fatturazione</label>
            <input type="email" className={inputCls} value={form.pecFatturazione} onChange={s('pecFatturazione')} /></div>
          <div className="col-span-2"><label className={labelCls}>IBAN</label>
            <input className={inputCls} value={form.iban} onChange={s('iban')} /></div>
          <div className="col-span-2"><label className={labelCls}>Note</label>
            <textarea className={inputCls} rows={3} value={form.note} onChange={s('note')} /></div>
        </div>
      )}

      <div className="flex gap-3 pt-2">
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
          {saving ? 'Creazione...' : 'Crea tenant'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 border border-gray-200 text-gray-600 text-sm rounded-lg hover:bg-gray-50">
          Annulla
        </button>
      </div>
    </form>
  );
}

// ─── Site Card ──────────────────────────────────────────────────────────────────

function SiteCard({ site }: { site: SiteRow }) {
  const [copied, setCopied] = useState(false);
  const navigate = useNavigate();
  const portalUrl = `${window.location.protocol}//${window.location.host}/portal/splash?siteId=${site.id}`;

  const copyUrl = () => {
    const fallback = () => {
      const el = document.createElement('textarea');
      el.value = portalUrl;
      el.style.cssText = 'position:fixed;opacity:0;top:0;left:0';
      document.body.appendChild(el);
      el.focus();
      el.select();
      document.execCommand('copy');
      document.body.removeChild(el);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    };
    if (navigator.clipboard) {
      navigator.clipboard.writeText(portalUrl).then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
      }).catch(fallback);
    } else {
      fallback();
    }
  };

  return (
    <div className="px-6 py-4">
      <div className="flex items-start justify-between">
        <div>
          <p className="text-sm font-medium text-gray-900">{site.name}</p>
          <p className="text-xs text-gray-400 mt-0.5">
            {SITE_TYPE_LABELS[site.type] ?? site.type}{site.address ? ` · ${site.address}` : ''}
          </p>
        </div>
        <div className="flex items-center gap-2 ml-4 shrink-0">
          <button
            onClick={() => navigate(`/settings?siteId=${site.id}`)}
            className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors text-gray-400 hover:text-brand-600"
            title="Impostazioni sito"
          >
            <Settings className="w-4 h-4" />
          </button>
          <span className="text-xs text-gray-400">{new Date(site.createdAt).toLocaleDateString('it-IT')}</span>
        </div>
      </div>
      <div className="mt-2 flex items-center gap-2">
        <span className="text-xs text-gray-400 font-medium">URL portale:</span>
        <code className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded font-mono truncate max-w-xs">
          {portalUrl}
        </code>
        <button
          onClick={copyUrl}
          className={`text-xs px-2 py-0.5 rounded border transition-colors shrink-0 ${
            copied
              ? 'border-green-300 text-green-600 bg-green-50'
              : 'border-gray-200 text-gray-500 hover:border-brand-400 hover:text-brand-600'
          }`}
        >
          {copied ? 'Copiato!' : 'Copia'}
        </button>
      </div>
    </div>
  );
}

// ─── Create Manager Form ────────────────────────────────────────────────────────

function CreateManagerForm({ tenantId, sites, onCreated, onCancel }: {
  tenantId: string;
  sites: SiteRow[];
  onCreated: (m: ManagerRow) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    email: '', password: '', first_name: '', last_name: '', role: 'manager',
  });
  const [selectedSites, setSelectedSites] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const needsSites = form.role === 'manager' || form.role === 'staff';

  const toggleSite = (id: string) =>
    setSelectedSites((prev) => prev.includes(id) ? prev.filter((s) => s !== id) : [...prev, id]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const payload = {
        ...form,
        first_name: form.first_name || null,
        last_name: form.last_name || null,
        site_ids: needsSites && selectedSites.length > 0 ? selectedSites : null,
      };
      const { data } = await api.post<ManagerRow>(`/superadmin/tenants/${tenantId}/managers`, payload);
      onCreated(data);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Errore');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}
      <div className="grid grid-cols-2 gap-3">
        <div><label className={labelCls}>Nome</label>
          <input className={inputCls} value={form.first_name}
            onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} /></div>
        <div><label className={labelCls}>Cognome</label>
          <input className={inputCls} value={form.last_name}
            onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} /></div>
        <div><label className={labelCls}>Email *</label>
          <input required type="email" className={inputCls} value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} /></div>
        <div><label className={labelCls}>Password *</label>
          <input required type="password" className={inputCls} value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} /></div>
        <div><label className={labelCls}>Ruolo</label>
          <select className={inputCls} value={form.role}
            onChange={(e) => setForm((p) => ({ ...p, role: e.target.value }))}>
            <option value="owner">Owner</option>
            <option value="manager">Manager</option>
            <option value="staff">Staff</option>
          </select></div>
      </div>
      {needsSites && sites.length > 0 && (
        <div>
          <label className={labelCls}>Siti assegnati (opzionale — nessuna selezione = accesso a tutti)</label>
          <div className="flex flex-wrap gap-2 mt-1">
            {sites.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => toggleSite(s.id)}
                className={`text-xs px-2.5 py-1 rounded-full border transition-colors ${
                  selectedSites.includes(s.id)
                    ? 'bg-brand-500 text-white border-brand-500'
                    : 'border-gray-200 text-gray-600 hover:border-brand-400'
                }`}
              >
                {s.name}
              </button>
            ))}
          </div>
        </div>
      )}
      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
          {saving ? 'Creazione...' : 'Crea utente'}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
          Annulla
        </button>
      </div>
    </form>
  );
}

// ─── Create Site Form ───────────────────────────────────────────────────────────

function CreateSiteForm({ tenantId, onCreated, onCancel }: {
  tenantId: string; onCreated: (s: SiteRow) => void; onCancel: () => void;
}) {
  const [form, setForm] = useState({ name: '', address: '', type: 'HOTEL' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      const { data } = await api.post<SiteRow>(`/superadmin/tenants/${tenantId}/sites`, form);
      onCreated(data);
    } catch (err: unknown) {
      setError((err as { response?: { data?: { detail?: string } } })?.response?.data?.detail ?? 'Errore');
    } finally {
      setSaving(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-3">
      {error && <div className="px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>}
      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-1">
          <label className={labelCls}>Nome sito *</label>
          <input required className={inputCls} value={form.name}
            onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))} />
        </div>
        <div>
          <label className={labelCls}>Tipo</label>
          <select className={inputCls} value={form.type}
            onChange={(e) => setForm((p) => ({ ...p, type: e.target.value }))}>
            {Object.entries(SITE_TYPE_LABELS).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <div>
          <label className={labelCls}>Indirizzo</label>
          <input className={inputCls} value={form.address}
            onChange={(e) => setForm((p) => ({ ...p, address: e.target.value }))} />
        </div>
      </div>
      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
          {saving ? 'Creazione...' : 'Crea sito'}
        </button>
        <button type="button" onClick={onCancel} className="px-3 py-2 text-sm text-gray-500 hover:text-gray-700">
          Annulla
        </button>
      </div>
    </form>
  );
}

// ─── Tab Bar ────────────────────────────────────────────────────────────────────

function TabBar({ tabs, active, onChange }: {
  tabs: { id: string; label: string }[];
  active: string;
  onChange: (id: string) => void;
}) {
  return (
    <div className="flex gap-1 bg-gray-100 p-1 rounded-lg w-fit">
      {tabs.map((t) => (
        <button
          key={t.id}
          type="button"
          onClick={() => onChange(t.id)}
          className={`px-3 py-1.5 text-sm font-medium rounded-md transition-colors ${
            active === t.id ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
          }`}
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

// ─── Modal ──────────────────────────────────────────────────────────────────────

function Modal({ title, children, onClose, wide }: {
  title: string; children: React.ReactNode; onClose: () => void; wide?: boolean;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className={`bg-white rounded-2xl shadow-xl w-full ${wide ? 'max-w-2xl' : 'max-w-lg'} p-6 max-h-[90vh] overflow-y-auto`}>
          <div className="flex items-center justify-between mb-5">
            <h2 className="font-semibold text-gray-900 text-lg">{title}</h2>
            <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg transition-colors">
              <X className="w-4 h-4 text-gray-500" />
            </button>
          </div>
          {children}
        </div>
      </div>
    </>
  );
}

const inputCls = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

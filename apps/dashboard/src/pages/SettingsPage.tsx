import { useEffect, useState } from 'react';
import { Save, Wifi, Palette, Settings2, ShieldCheck, Ban, Plus, Trash2, Globe } from 'lucide-react';
import { useSearchParams } from 'react-router-dom';
import api from '../api/client';
import ImageUploader from '../components/ImageUploader';

interface SiteConfig {
  id: string;
  name: string;
  address: string | null;
  primaryColor: string;
  accentColor: string;
  welcomeTitle: string;
  welcomeText: string;
  loginMethods: string;
  logoUrl: string | null;
  backgroundImageUrl: string | null;
  heroImageUrl: string | null;
  omadaControllerUrl: string | null;
  omadaOmadacId: string | null;
  omadaSiteId: string | null;
  omadaOperatorUser: string | null;
  omadaOperatorPass: string | null;
  facebookUrl: string | null;
  instagramUrl: string | null;
  tripadvisorUrl: string | null;
  googleReviewUrl: string | null;
  bookingUrl: string | null;
  twitterUrl: string | null;
}

type Tab = 'branding' | 'omada' | 'login' | 'whitelist' | 'blacklist' | 'social';

interface BlacklistEntry {
  id: string;
  macAddress: string;
  reason: string | null;
  createdAt: string;
}

interface WhitelistEntry {
  id: string;
  macAddress: string;
  label: string | null;
  createdAt: string;
}

export default function SettingsPage() {
  const [searchParams] = useSearchParams();
  const [tab, setTab] = useState<Tab>('branding');
  const [siteId, setSiteId] = useState<string>('');
  const [config, setConfig] = useState<SiteConfig | null>(null);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [whitelist, setWhitelist] = useState<WhitelistEntry[]>([]);
  const [wlMac, setWlMac] = useState('');
  const [wlLabel, setWlLabel] = useState('');
  const [wlAdding, setWlAdding] = useState(false);
  const [blacklist, setBlacklist] = useState<BlacklistEntry[]>([]);
  const [blMac, setBlMac] = useState('');
  const [blReason, setBlReason] = useState('');
  const [blAdding, setBlAdding] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const paramId = searchParams.get('siteId');
        let id: string;
        if (paramId) {
          id = paramId;
        } else {
          const { data: sites } = await api.get<SiteConfig[]>('/sites');
          if (!sites.length) {
            setError('Nessun sito configurato. Crea prima un sito.');
            return;
          }
          id = sites[0].id;
        }
        setSiteId(id);
        const { data } = await api.get<SiteConfig>(`/sites/${id}`);
        setConfig(data);
        const { data: wl } = await api.get<WhitelistEntry[]>(`/sites/${id}/whitelist`);
        setWhitelist(wl);
        const { data: bl } = await api.get<BlacklistEntry[]>(`/sites/${id}/blacklist`);
        setBlacklist(bl);
      } catch {
        setError('Errore nel caricamento delle impostazioni.');
      }
    })();
  }, [searchParams]);

  const update = (patch: Partial<SiteConfig>) =>
    setConfig((prev) => (prev ? { ...prev, ...patch } : prev));

  const handleSave = async () => {
    if (!config || !siteId) return;
    setSaving(true);
    try {
      await api.patch(`/sites/${siteId}`, config);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } finally {
      setSaving(false);
    }
  };

  if (error) {
    return <div className="p-8 text-sm text-red-500">{error}</div>;
  }

  if (!config) {
    return (
      <div className="p-8 text-sm text-gray-400">Caricamento impostazioni...</div>
    );
  }

  const tabs: { key: Tab; label: string; icon: React.ReactNode }[] = [
    { key: 'branding',   label: 'Branding',       icon: <Palette className="w-4 h-4" /> },
    { key: 'omada',      label: 'Omada',           icon: <Wifi className="w-4 h-4" /> },
    { key: 'login',      label: 'Metodi di login', icon: <Settings2 className="w-4 h-4" /> },
    { key: 'whitelist',  label: 'Whitelist MAC',   icon: <ShieldCheck className="w-4 h-4" /> },
    { key: 'blacklist',  label: 'Blacklist MAC',    icon: <Ban className="w-4 h-4" /> },
    { key: 'social',     label: 'Social',           icon: <Globe className="w-4 h-4" /> },
  ];

  const loginMethodOptions = [
    { value: 'email',        label: 'Email + consensi GDPR' },
    { value: 'clickthrough', label: 'Click-through (solo accetta termini)' },
    { value: 'google',       label: 'Google (OAuth — richiede config)' },
    { value: 'facebook',     label: 'Facebook (OAuth — richiede config)' },
  ];

  const activeMethods = config.loginMethods.split(',').map((m) => m.trim()).filter(Boolean);

  const toggleMethod = (value: string) => {
    const current = new Set(activeMethods);
    if (current.has(value)) current.delete(value);
    else current.add(value);
    update({ loginMethods: Array.from(current).join(',') });
  };

  return (
    <div className="p-8 max-w-3xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Impostazioni</h1>
          <p className="text-sm text-gray-500 mt-1">Configura il portale WiFi e il branding</p>
        </div>
        <button
          onClick={handleSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
        >
          <Save className="w-4 h-4" />
          {saving ? 'Salvataggio...' : saved ? '✓ Salvato' : 'Salva modifiche'}
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-8 w-fit">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key
                ? 'bg-white text-gray-900 shadow-sm'
                : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.icon}
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab: Branding */}
      {tab === 'branding' && (
        <div className="space-y-6">
          <Card title="Informazioni sito">
            <Field label="Nome sito">
              <input
                type="text"
                value={config.name}
                onChange={(e) => update({ name: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Indirizzo">
              <input
                type="text"
                value={config.address ?? ''}
                onChange={(e) => update({ address: e.target.value })}
                placeholder="Via Roma 1, Milano"
                className={inputCls}
              />
            </Field>
          </Card>

          <Card title="Testi splash page">
            <Field label="Titolo benvenuto">
              <input
                type="text"
                value={config.welcomeTitle}
                onChange={(e) => update({ welcomeTitle: e.target.value })}
                className={inputCls}
              />
            </Field>
            <Field label="Testo descrittivo">
              <textarea
                value={config.welcomeText}
                onChange={(e) => update({ welcomeText: e.target.value })}
                rows={3}
                className={inputCls + ' resize-none'}
              />
            </Field>
          </Card>

          <Card title="Immagini">
            <ImageUploader
              siteId={siteId}
              field="logo"
              label="Logo struttura"
              hint="Mostrato in cima al form di login"
              aspectHint="Consigliato: formato orizzontale, sfondo trasparente (PNG/SVG)"
              currentUrl={config.logoUrl ?? null}
              onUploaded={(url) => update({ logoUrl: url || null })}
            />
            <ImageUploader
              siteId={siteId}
              field="hero"
              label="Banner hero"
              hint="Immagine nella parte alta della card, sopra il titolo"
              aspectHint="Consigliato: 800×300 px, formato landscape"
              currentUrl={config.heroImageUrl ?? null}
              onUploaded={(url) => update({ heroImageUrl: url || null })}
            />
            <ImageUploader
              siteId={siteId}
              field="background"
              label="Immagine di sfondo"
              hint="Sostituisce il colore di sfondo con una foto (es. foto dell'hotel)"
              aspectHint="Consigliato: 1920×1080 px"
              currentUrl={config.backgroundImageUrl ?? null}
              onUploaded={(url) => update({ backgroundImageUrl: url || null })}
            />
          </Card>

          <Card title="Colori">
            <div className="grid grid-cols-2 gap-4">
              <Field label="Colore primario (pulsanti)">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.primaryColor}
                    onChange={(e) => update({ primaryColor: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={config.primaryColor}
                    onChange={(e) => update({ primaryColor: e.target.value })}
                    className={inputCls + ' font-mono text-sm'}
                    maxLength={7}
                  />
                </div>
              </Field>
              <Field label="Colore sfondo">
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={config.accentColor}
                    onChange={(e) => update({ accentColor: e.target.value })}
                    className="w-10 h-10 rounded-lg border border-gray-200 cursor-pointer p-0.5"
                  />
                  <input
                    type="text"
                    value={config.accentColor}
                    onChange={(e) => update({ accentColor: e.target.value })}
                    className={inputCls + ' font-mono text-sm'}
                    maxLength={7}
                  />
                </div>
              </Field>
            </div>
          </Card>

          {/* Preview */}
          <Card title="Anteprima splash page">
            <div
              className="rounded-xl flex items-center justify-center min-h-48 p-6"
              style={{
                background: config.backgroundImageUrl
                  ? `url('${config.backgroundImageUrl}') center/cover`
                  : config.accentColor,
              }}
            >
              <div className="bg-white rounded-2xl shadow-md w-72 overflow-hidden">
                {config.heroImageUrl && (
                  <img
                    src={config.heroImageUrl}
                    alt="hero"
                    className="w-full h-20 object-cover"
                  />
                )}
                <div className="p-5 text-center">
                  {config.logoUrl && (
                    <img
                      src={config.logoUrl}
                      alt="logo"
                      className="max-h-10 max-w-32 object-contain mx-auto mb-3"
                    />
                  )}
                  <h3 className="font-bold text-gray-900 mb-1 text-sm">
                    {config.welcomeTitle || 'Benvenuto!'}
                  </h3>
                  <p className="text-gray-500 text-xs mb-3">
                    {config.welcomeText || 'Connettiti al WiFi gratuito.'}
                  </p>
                  <div
                    className="w-full py-1.5 rounded-lg text-white text-xs font-semibold"
                    style={{ background: config.primaryColor }}
                  >
                    Connettiti →
                  </div>
                </div>
              </div>
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Omada */}
      {tab === 'omada' && (
        <Card title="Configurazione controller Omada">
          <Field label="URL controller (es. https://10.0.0.1:8043)">
            <input
              type="url"
              value={config.omadaControllerUrl ?? ''}
              onChange={(e) => update({ omadaControllerUrl: e.target.value })}
              placeholder="https://10.0.0.1:8043"
              className={inputCls}
            />
          </Field>
          <Field label="Omada Controller ID">
            <input
              type="text"
              value={config.omadaOmadacId ?? ''}
              onChange={(e) => update({ omadaOmadacId: e.target.value })}
              placeholder="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4"
              className={inputCls + ' font-mono text-sm'}
            />
          </Field>
          <Field label="Site ID Omada">
            <input
              type="text"
              value={config.omadaSiteId ?? ''}
              onChange={(e) => update({ omadaSiteId: e.target.value })}
              placeholder="test"
              className={inputCls}
            />
          </Field>
          <Field label="Username operatore hotspot">
            <input
              type="text"
              value={config.omadaOperatorUser ?? ''}
              onChange={(e) => update({ omadaOperatorUser: e.target.value })}
              placeholder="Operatore1"
              className={inputCls}
            />
          </Field>
          <Field label="Password operatore hotspot">
            <input
              type="password"
              value={config.omadaOperatorPass ?? ''}
              onChange={(e) => update({ omadaOperatorPass: e.target.value })}
              placeholder="••••••••"
              className={inputCls}
            />
          </Field>
          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mt-2">
            ⚠️ Le credenziali sono salvate in chiaro nel DB. In produzione usare un vault (Fase 4).
          </p>
        </Card>
      )}

      {/* Tab: Login methods */}
      {tab === 'login' && (
        <Card title="Metodi di accesso al portale">
          <p className="text-sm text-gray-500 mb-4">
            Seleziona quali metodi di login mostrare sulla splash page.
          </p>
          <div className="space-y-3">
            {loginMethodOptions.map((opt) => (
              <label
                key={opt.value}
                className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors"
              >
                <input
                  type="checkbox"
                  checked={activeMethods.includes(opt.value)}
                  onChange={() => toggleMethod(opt.value)}
                  className="accent-brand-500 w-4 h-4"
                />
                <span className="text-sm text-gray-800">{opt.label}</span>
              </label>
            ))}
          </div>
        </Card>
      )}
      {/* Tab: Social */}
      {tab === 'social' && (
        <Card title="Link social network">
          <p className="text-sm text-gray-500 mb-4">
            I link configurati appaiono come icone nella splash page sotto il form di login.
          </p>
          {([
            { key: 'facebookUrl',    label: 'Facebook',     placeholder: 'https://facebook.com/tuapagina' },
            { key: 'instagramUrl',   label: 'Instagram',    placeholder: 'https://instagram.com/tuoprofilo' },
            { key: 'tripadvisorUrl', label: 'TripAdvisor',  placeholder: 'https://tripadvisor.com/...' },
            { key: 'googleReviewUrl',label: 'Google Reviews',placeholder: 'https://g.page/...' },
            { key: 'bookingUrl',     label: 'Booking.com',  placeholder: 'https://booking.com/hotel/...' },
            { key: 'twitterUrl',     label: 'X (Twitter)',  placeholder: 'https://x.com/tuoprofilo' },
          ] as { key: keyof SiteConfig; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
            <Field key={key} label={label}>
              <input
                type="url"
                value={(config[key] as string) ?? ''}
                onChange={(e) => update({ [key]: e.target.value || null })}
                placeholder={placeholder}
                className={inputCls}
              />
            </Field>
          ))}
        </Card>
      )}

      {/* Tab: Blacklist MAC */}
      {tab === 'blacklist' && (
        <div className="space-y-6">
          <Card title="Blacklist MAC address">
            <p className="text-sm text-gray-500 mb-4">
              I dispositivi in lista vengono bloccati con una pagina di "Accesso negato" senza mostrare il form.
            </p>

            {/* Form aggiunta */}
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={blMac}
                onChange={(e) => setBlMac(e.target.value)}
                placeholder="MAC address (es. AA:BB:CC:DD:EE:FF)"
                className={inputCls + ' flex-1 font-mono text-sm'}
              />
              <input
                type="text"
                value={blReason}
                onChange={(e) => setBlReason(e.target.value)}
                placeholder="Motivazione (opzionale)"
                className={inputCls + ' flex-1'}
              />
              <button
                disabled={blAdding || !blMac.trim()}
                onClick={async () => {
                  setBlAdding(true);
                  try {
                    const { data } = await api.post<BlacklistEntry>(`/sites/${siteId}/blacklist`, {
                      mac_address: blMac.trim(),
                      reason: blReason.trim() || null,
                    });
                    setBlacklist((prev) => [...prev, data]);
                    setBlMac('');
                    setBlReason('');
                  } finally {
                    setBlAdding(false);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <Ban className="w-4 h-4" />
                Blocca
              </button>
            </div>

            {/* Lista */}
            {blacklist.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nessun MAC in blacklist.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {blacklist.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-mono font-medium text-gray-900">{e.macAddress}</p>
                      {e.reason && <p className="text-xs text-gray-400 mt-0.5">{e.reason}</p>}
                    </div>
                    <button
                      onClick={async () => {
                        await api.delete(`/sites/${siteId}/blacklist/${e.id}`);
                        setBlacklist((prev) => prev.filter((x) => x.id !== e.id));
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab: Whitelist MAC */}
      {tab === 'whitelist' && (
        <div className="space-y-6">
          <Card title="Whitelist MAC address">
            <p className="text-sm text-gray-500 mb-4">
              I dispositivi in lista vengono autorizzati automaticamente senza mostrare il form di registrazione.
            </p>

            {/* Form aggiunta */}
            <div className="flex gap-2 mb-6">
              <input
                type="text"
                value={wlMac}
                onChange={(e) => setWlMac(e.target.value)}
                placeholder="MAC address (es. AA:BB:CC:DD:EE:FF)"
                className={inputCls + ' flex-1 font-mono text-sm'}
              />
              <input
                type="text"
                value={wlLabel}
                onChange={(e) => setWlLabel(e.target.value)}
                placeholder="Etichetta (opzionale)"
                className={inputCls + ' flex-1'}
              />
              <button
                disabled={wlAdding || !wlMac.trim()}
                onClick={async () => {
                  setWlAdding(true);
                  try {
                    const { data } = await api.post<WhitelistEntry>(`/sites/${siteId}/whitelist`, {
                      mac_address: wlMac.trim(),
                      label: wlLabel.trim() || null,
                    });
                    setWhitelist((prev) => [...prev, data]);
                    setWlMac('');
                    setWlLabel('');
                  } finally {
                    setWlAdding(false);
                  }
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" />
                Aggiungi
              </button>
            </div>

            {/* Lista */}
            {whitelist.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-6">Nessun MAC in whitelist.</p>
            ) : (
              <div className="divide-y divide-gray-100">
                {whitelist.map((e) => (
                  <div key={e.id} className="flex items-center justify-between py-3">
                    <div>
                      <p className="text-sm font-mono font-medium text-gray-900">{e.macAddress}</p>
                      {e.label && <p className="text-xs text-gray-400 mt-0.5">{e.label}</p>}
                    </div>
                    <button
                      onClick={async () => {
                        await api.delete(`/sites/${siteId}/whitelist/${e.id}`);
                        setWhitelist((prev) => prev.filter((x) => x.id !== e.id));
                      }}
                      className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}
    </div>
  );
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const inputCls =
  'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
      <h2 className="font-semibold text-gray-900 mb-5">{title}</h2>
      <div className="space-y-4">{children}</div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {children}
    </div>
  );
}

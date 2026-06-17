import { useEffect, useState } from 'react';
import { Save, Wifi, Palette, Settings2, ShieldCheck, Ban, Plus, Trash2, Globe, MessageSquareDot, Mail } from 'lucide-react';
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
  surveyEnabled: boolean;
  surveyHoursDelay: number;
  googlePlaceId: string | null;
  surveyTitle: string | null;
  surveySubtitle: string | null;
  surveyQuestionLabel: string | null;
  surveyCommentLabel: string | null;
  surveyButtonText: string | null;
  surveyThankYouTitle: string | null;
  surveyShowComment: boolean;
  smtpHost: string | null;
  smtpPort: number;
  smtpSecurity: string;
  smtpUsername: string | null;
  smtpPassword: string | null;
  smtpFromEmail: string | null;
  smtpFromName: string | null;
  emailSubject: string | null;
  emailBodyText: string | null;
  emailButtonText: string | null;
  emailFooterText: string | null;
}

type Tab = 'branding' | 'omada' | 'login' | 'whitelist' | 'blacklist' | 'social' | 'survey' | 'smtp';

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
  const [testEmailSending, setTestEmailSending] = useState(false);
  const [testEmailMsg, setTestEmailMsg] = useState<string | null>(null);

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
    { key: 'survey',     label: 'Survey',           icon: <MessageSquareDot className="w-4 h-4" /> },
    { key: 'smtp',       label: 'Email / SMTP',     icon: <Mail className="w-4 h-4" /> },
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
    <div className="p-8 w-full">
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
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-8 overflow-x-auto">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-lg transition-colors whitespace-nowrap ${
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
                  <img src={config.heroImageUrl} alt="hero" className="w-full h-20 object-cover" />
                )}
                <div className="p-5 text-center">
                  {config.logoUrl && (
                    <img src={config.logoUrl} alt="logo" className="max-h-10 max-w-32 object-contain mx-auto mb-3" />
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
            <input type="url" value={config.omadaControllerUrl ?? ''} onChange={(e) => update({ omadaControllerUrl: e.target.value })} placeholder="https://10.0.0.1:8043" className={inputCls} />
          </Field>
          <Field label="Omada Controller ID">
            <input type="text" value={config.omadaOmadacId ?? ''} onChange={(e) => update({ omadaOmadacId: e.target.value })} placeholder="a1b2c3d4e5f6a1b2c3d4e5f6a1b2c3d4" className={inputCls + ' font-mono text-sm'} />
          </Field>
          <Field label="Site ID Omada">
            <input type="text" value={config.omadaSiteId ?? ''} onChange={(e) => update({ omadaSiteId: e.target.value })} placeholder="test" className={inputCls} />
          </Field>
          <Field label="Username operatore hotspot">
            <input type="text" value={config.omadaOperatorUser ?? ''} onChange={(e) => update({ omadaOperatorUser: e.target.value })} placeholder="Operatore1" className={inputCls} />
          </Field>
          <Field label="Password operatore hotspot">
            <input type="password" value={config.omadaOperatorPass ?? ''} onChange={(e) => update({ omadaOperatorPass: e.target.value })} placeholder="••••••••" className={inputCls} />
          </Field>
          <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mt-2">
            ⚠️ Le credenziali sono salvate in chiaro nel DB. In produzione usare un vault (Fase 4).
          </p>
        </Card>
      )}

      {/* Tab: Login methods */}
      {tab === 'login' && (
        <Card title="Metodi di accesso al portale">
          <p className="text-sm text-gray-500 mb-4">Seleziona quali metodi di login mostrare sulla splash page.</p>
          <div className="space-y-3">
            {loginMethodOptions.map((opt) => (
              <label key={opt.value} className="flex items-center gap-3 p-3 border border-gray-200 rounded-xl cursor-pointer hover:bg-gray-50 transition-colors">
                <input type="checkbox" checked={activeMethods.includes(opt.value)} onChange={() => toggleMethod(opt.value)} className="accent-brand-500 w-4 h-4" />
                <span className="text-sm text-gray-800">{opt.label}</span>
              </label>
            ))}
          </div>
        </Card>
      )}

      {/* Tab: Social */}
      {tab === 'social' && (
        <Card title="Link social network">
          <p className="text-sm text-gray-500 mb-4">I link configurati appaiono come icone nella splash page sotto il form di login.</p>
          {([
            { key: 'facebookUrl',     label: 'Facebook',      placeholder: 'https://facebook.com/tuapagina' },
            { key: 'instagramUrl',    label: 'Instagram',     placeholder: 'https://instagram.com/tuoprofilo' },
            { key: 'tripadvisorUrl',  label: 'TripAdvisor',   placeholder: 'https://tripadvisor.com/...' },
            { key: 'googleReviewUrl', label: 'Google Reviews', placeholder: 'https://g.page/...' },
            { key: 'bookingUrl',      label: 'Booking.com',   placeholder: 'https://booking.com/hotel/...' },
            { key: 'twitterUrl',      label: 'X (Twitter)',   placeholder: 'https://x.com/tuoprofilo' },
          ] as { key: keyof SiteConfig; label: string; placeholder: string }[]).map(({ key, label, placeholder }) => (
            <Field key={key} label={label}>
              <input type="url" value={(config[key] as string) ?? ''} onChange={(e) => update({ [key]: e.target.value || null })} placeholder={placeholder} className={inputCls} />
            </Field>
          ))}
        </Card>
      )}

      {/* Tab: Survey */}
      {tab === 'survey' && (
        <div className="space-y-6">
          <Card title="Impostazioni survey post-soggiorno">
            <p className="text-sm text-gray-500 -mt-2 mb-2">
              Quando abilitata, il sistema invia automaticamente un'email NPS agli ospiti dopo un numero configurabile di ore dall'ultima sessione WiFi.
            </p>

            <Field label="Stato survey">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => update({ surveyEnabled: !config.surveyEnabled })}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${config.surveyEnabled ? 'bg-brand-500' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${config.surveyEnabled ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm text-gray-700">
                  {config.surveyEnabled ? 'Survey abilitata' : 'Survey disabilitata'}
                </span>
              </label>
            </Field>

            <Field label="Google Place ID">
              <input
                type="text"
                value={config.googlePlaceId ?? ''}
                onChange={(e) => update({ googlePlaceId: e.target.value || null })}
                placeholder="ChIJN1t_tDeuEmsRUsoyG83frY4"
                className={inputCls + ' font-mono text-sm'}
              />
              <p className="text-xs text-gray-400 mt-1">
                Trovalo su{' '}
                <a href="https://developers.google.com/maps/documentation/javascript/examples/places-placeid-finder" target="_blank" rel="noopener noreferrer" className="text-brand-500 hover:underline">
                  Google Place ID Finder
                </a>
                {' '}— serve per sincronizzare le recensioni Google nella pagina Survey.
              </p>
            </Field>

            <Field label="Ore dopo l'ultima sessione WiFi">
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  min={1}
                  max={720}
                  value={config.surveyHoursDelay}
                  onChange={(e) => update({ surveyHoursDelay: parseInt(e.target.value) || 24 })}
                  className={inputCls + ' w-24 text-center font-mono'}
                  disabled={!config.surveyEnabled}
                />
                <span className="text-sm text-gray-500">ore (default: 24)</span>
              </div>
              <p className="text-xs text-gray-400 mt-1">
                L'email viene inviata solo se l'ospite ha fornito l'email e non ha già ricevuto una survey.
              </p>
            </Field>
          </Card>

          <Card title="Personalizzazione survey">
            <p className="text-sm text-gray-500 -mt-2 mb-2">
              Testi mostrati nella pagina survey ricevuta dall'ospite. Lascia vuoto per usare il testo predefinito. Usa <code className="bg-gray-100 px-1 rounded text-xs">{"{nome_sito}"}</code> per inserire il nome della struttura.
            </p>

            <Field label="Titolo principale">
              <input type="text" value={config.surveyTitle ?? ''} onChange={(e) => update({ surveyTitle: e.target.value || null })}
                placeholder="Come è stata la tua esperienza?" className={inputCls} />
            </Field>

            <Field label="Sottotitolo">
              <input type="text" value={config.surveySubtitle ?? ''} onChange={(e) => update({ surveySubtitle: e.target.value || null })}
                placeholder="La tua opinione su {nome_sito} ci aiuta a migliorare il servizio." className={inputCls} />
            </Field>

            <Field label="Testo domanda NPS">
              <input type="text" value={config.surveyQuestionLabel ?? ''} onChange={(e) => update({ surveyQuestionLabel: e.target.value || null })}
                placeholder="Da 0 a 10, quanto ci consiglieresti a un amico?" className={inputCls} />
            </Field>

            <Field label="Etichetta commento">
              <input type="text" value={config.surveyCommentLabel ?? ''} onChange={(e) => update({ surveyCommentLabel: e.target.value || null })}
                placeholder="Vuoi aggiungere qualcosa?" className={inputCls} />
            </Field>

            <Field label="Testo pulsante invio">
              <input type="text" value={config.surveyButtonText ?? ''} onChange={(e) => update({ surveyButtonText: e.target.value || null })}
                placeholder="Invia valutazione" className={inputCls} />
            </Field>

            <Field label="Titolo pagina di ringraziamento">
              <input type="text" value={config.surveyThankYouTitle ?? ''} onChange={(e) => update({ surveyThankYouTitle: e.target.value || null })}
                placeholder="Grazie mille!" className={inputCls} />
            </Field>

            <Field label="Campo commento libero">
              <label className="flex items-center gap-3 cursor-pointer select-none">
                <div
                  onClick={() => update({ surveyShowComment: !config.surveyShowComment })}
                  className={`relative w-11 h-6 rounded-full transition-colors cursor-pointer ${config.surveyShowComment ? 'bg-brand-500' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow-sm transition-transform ${config.surveyShowComment ? 'translate-x-5' : ''}`} />
                </div>
                <span className="text-sm text-gray-700">
                  {config.surveyShowComment ? 'Campo commento visibile' : 'Campo commento nascosto'}
                </span>
              </label>
            </Field>
          </Card>

          <Card title="Anteprima survey">
            <p className="text-sm text-gray-500 -mt-2 mb-4">
              Anteprima in tempo reale di come vedrà la survey l'ospite.
            </p>
            <SurveyPreview config={config} />
          </Card>

          <Card title="Personalizzazione email">
            <p className="text-sm text-gray-500 -mt-2 mb-4">
              Testi dell'email survey inviata all'ospite. Usa{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">{'{nome_sito}'}</code> e{' '}
              <code className="bg-gray-100 px-1 rounded text-xs">{'{nome_ospite}'}</code> come segnaposto.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Oggetto email</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  value={config.emailSubject || ''}
                  onChange={e => setConfig(c => c ? { ...c, emailSubject: e.target.value || null } : c)}
                  placeholder="Come è stata la tua esperienza da {nome_sito}?"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Testo corpo</label>
                <textarea
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400 resize-none"
                  rows={2}
                  value={config.emailBodyText || ''}
                  onChange={e => setConfig(c => c ? { ...c, emailBodyText: e.target.value || null } : c)}
                  placeholder="Grazie per aver visitato {nome_sito}. Ci piacerebbe sapere come è stata la tua esperienza — bastano 30 secondi."
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Testo bottone CTA</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  value={config.emailButtonText || ''}
                  onChange={e => setConfig(c => c ? { ...c, emailButtonText: e.target.value || null } : c)}
                  placeholder="Lascia la tua valutazione"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-600 mb-1">Testo footer</label>
                <input
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-brand-400"
                  value={config.emailFooterText || ''}
                  onChange={e => setConfig(c => c ? { ...c, emailFooterText: e.target.value || null } : c)}
                  placeholder="Hai ricevuto questa email perché ti sei connesso al WiFi di {nome_sito}."
                />
              </div>
            </div>
          </Card>

          <Card title="Anteprima email">
            <p className="text-sm text-gray-500 -mt-2 mb-4">
              Anteprima di come apparirà l'email all'ospite.
            </p>
            <EmailPreview config={config} />
          </Card>

          <Card title="Email di test">
            <p className="text-sm text-gray-500 -mt-2 mb-3">
              Invia una email survey di prova al tuo indirizzo per verificare la configurazione SMTP.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  setTestEmailSending(true);
                  setTestEmailMsg(null);
                  try {
                    const params = siteId ? `?site_id=${siteId}` : '';
                    const { data } = await api.post<{ success: boolean; sentTo: string }>(`/survey/send-test${params}`);
                    setTestEmailMsg(`Email inviata a ${data.sentTo}`);
                  } catch (e: unknown) {
                    const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
                    setTestEmailMsg(detail ?? 'Errore invio email');
                  } finally {
                    setTestEmailSending(false);
                  }
                }}
                disabled={testEmailSending}
                className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                {testEmailSending ? 'Invio...' : 'Invia email di test'}
              </button>
              {testEmailMsg && (
                <p className={`text-sm ${testEmailMsg.startsWith('Email inviata') ? 'text-green-600' : 'text-red-500'}`}>
                  {testEmailMsg}
                </p>
              )}
            </div>
          </Card>

          <Card title="Review funnel">
            <p className="text-sm text-gray-500 -mt-2">
              Gli ospiti con NPS 9-10 ricevono un invito diretto a lasciare una recensione Google. Configura il link nel tab <strong>Social</strong>.
            </p>
            {([
              { range: '9+', bg: 'bg-green-100', text: 'text-green-600', label: 'Promotori (NPS 9-10)', desc: config.googleReviewUrl ? `→ Bottone "Recensione Google"` : '→ Nessun link Google — vai nel tab Social' },
              { range: '7-8', bg: 'bg-yellow-100', text: 'text-yellow-600', label: 'Passivi (NPS 7-8)', desc: '→ Pagina di ringraziamento semplice' },
              { range: '0-6', bg: 'bg-red-100', text: 'text-red-600', label: 'Detrattori (NPS 0-6)', desc: '→ Messaggio "lo trasmetteremo allo staff"' },
            ]).map((row) => (
              <div key={row.range} className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl text-sm mt-2">
                <div className={`w-8 h-8 rounded-lg ${row.bg} flex items-center justify-center shrink-0`}>
                  <span className={`${row.text} font-bold text-xs`}>{row.range}</span>
                </div>
                <div>
                  <p className="font-medium text-gray-700">{row.label}</p>
                  <p className="text-xs text-gray-400">{row.desc}</p>
                </div>
              </div>
            ))}
          </Card>
        </div>
      )}

      {/* Tab: Blacklist MAC */}
      {tab === 'blacklist' && (
        <div className="space-y-6">
          <Card title="Blacklist MAC address">
            <p className="text-sm text-gray-500 mb-4">I dispositivi in lista vengono bloccati con una pagina di "Accesso negato" senza mostrare il form.</p>
            <div className="flex gap-2 mb-6">
              <input type="text" value={blMac} onChange={(e) => setBlMac(e.target.value)} placeholder="MAC address (es. AA:BB:CC:DD:EE:FF)" className={inputCls + ' flex-1 font-mono text-sm'} />
              <input type="text" value={blReason} onChange={(e) => setBlReason(e.target.value)} placeholder="Motivazione (opzionale)" className={inputCls + ' flex-1'} />
              <button
                disabled={blAdding || !blMac.trim()}
                onClick={async () => {
                  setBlAdding(true);
                  try {
                    const { data } = await api.post<BlacklistEntry>(`/sites/${siteId}/blacklist`, { mac_address: blMac.trim(), reason: blReason.trim() || null });
                    setBlacklist((prev) => [...prev, data]);
                    setBlMac(''); setBlReason('');
                  } finally { setBlAdding(false); }
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <Ban className="w-4 h-4" /> Blocca
              </button>
            </div>
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
                    <button onClick={async () => { await api.delete(`/sites/${siteId}/blacklist/${e.id}`); setBlacklist((prev) => prev.filter((x) => x.id !== e.id)); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        </div>
      )}

      {/* Tab: Email / SMTP */}
      {tab === 'smtp' && (
        <div className="space-y-6">
          <Card title="Configurazione server SMTP per-sito">
            <p className="text-sm text-gray-500 -mt-2 mb-2">
              Configura il server SMTP di questo sito per inviare le email survey. Se vuoto, viene usata la configurazione globale del server.
            </p>

            <Field label="Host SMTP">
              <input
                type="text"
                value={config.smtpHost ?? ''}
                onChange={(e) => update({ smtpHost: e.target.value || null })}
                placeholder="smtp.gmail.com"
                className={inputCls}
              />
            </Field>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Porta">
                <input
                  type="number"
                  value={config.smtpPort}
                  onChange={(e) => update({ smtpPort: parseInt(e.target.value) || 587 })}
                  placeholder="587"
                  className={inputCls + ' font-mono'}
                />
              </Field>
              <Field label="Sicurezza">
                <select
                  value={config.smtpSecurity}
                  onChange={(e) => update({ smtpSecurity: e.target.value })}
                  className={inputCls}
                >
                  <option value="none">Nessuna (testo in chiaro)</option>
                  <option value="starttls">STARTTLS (porta 587)</option>
                  <option value="ssl">SSL/TLS diretto (porta 465)</option>
                </select>
              </Field>
            </div>

            <Field label="Username SMTP">
              <input
                type="text"
                value={config.smtpUsername ?? ''}
                onChange={(e) => update({ smtpUsername: e.target.value || null })}
                placeholder="noreply@tuodominio.it"
                className={inputCls}
              />
            </Field>

            <Field label="Password SMTP">
              <input
                type="password"
                value={config.smtpPassword ?? ''}
                onChange={(e) => update({ smtpPassword: e.target.value || null })}
                placeholder="••••••••"
                className={inputCls}
              />
            </Field>

            <Field label="Email mittente (From)">
              <input
                type="email"
                value={config.smtpFromEmail ?? ''}
                onChange={(e) => update({ smtpFromEmail: e.target.value || null })}
                placeholder="noreply@tuodominio.it"
                className={inputCls}
              />
            </Field>

            <Field label="Nome mittente (From name)">
              <input
                type="text"
                value={config.smtpFromName ?? ''}
                onChange={(e) => update({ smtpFromName: e.target.value || null })}
                placeholder="Hotel Bella Vista"
                className={inputCls}
              />
            </Field>

            <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-lg mt-2">
              ⚠️ La password è salvata in chiaro nel DB. In produzione usare un vault (Fase 4).
            </p>
          </Card>

          <Card title="Test connessione SMTP">
            <p className="text-sm text-gray-500 -mt-2 mb-3">
              Salva prima le impostazioni, poi invia un'email di test per verificare che il server SMTP funzioni.
            </p>
            <div className="flex items-center gap-3">
              <button
                onClick={async () => {
                  setTestEmailSending(true);
                  setTestEmailMsg(null);
                  try {
                    const params = siteId ? `?site_id=${siteId}` : '';
                    const { data } = await api.post<{ success: boolean; sentTo: string }>(`/survey/send-test${params}`);
                    setTestEmailMsg(`Email inviata a ${data.sentTo}`);
                  } catch (e: unknown) {
                    const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
                    setTestEmailMsg(detail ?? 'Errore invio email');
                  } finally {
                    setTestEmailSending(false);
                  }
                }}
                disabled={testEmailSending}
                className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <Mail className="w-4 h-4" />
                {testEmailSending ? 'Invio...' : 'Invia email di test'}
              </button>
              {testEmailMsg && (
                <p className={`text-sm ${testEmailMsg.startsWith('Email inviata') ? 'text-green-600' : 'text-red-500'}`}>
                  {testEmailMsg}
                </p>
              )}
            </div>
          </Card>

          <Card title="Provider comuni">
            <div className="space-y-2 text-sm text-gray-600">
              {([
                { name: 'Gmail',        host: 'smtp.gmail.com',       port: 587, note: 'Richiede "App Password" (non la password Google)' },
                { name: 'Outlook/365',  host: 'smtp.office365.com',   port: 587, note: 'Autenticazione OAuth consigliata per produzione' },
                { name: 'Aruba Mail',   host: 'smtps.aruba.it',       port: 465, note: 'Usa SSL/TLS diretto — seleziona SSL nel menu sicurezza' },
                { name: 'Register.it',  host: 'smtp.register.it',     port: 587, note: 'STARTTLS su porta 587' },
                { name: 'Libero/IOL',   host: 'smtp.libero.it',       port: 587, note: 'STARTTLS su porta 587' },
              ]).map((p) => (
                <div key={p.name} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="min-w-28 font-semibold text-gray-800">{p.name}</div>
                  <div>
                    <span className="font-mono text-xs bg-gray-200 px-1.5 py-0.5 rounded">{p.host}:{p.port}</span>
                    <span className="text-xs text-gray-400 ml-2">{p.note}</span>
                  </div>
                </div>
              ))}
            </div>
          </Card>
        </div>
      )}

      {/* Tab: Whitelist MAC */}
      {tab === 'whitelist' && (
        <div className="space-y-6">
          <Card title="Whitelist MAC address">
            <p className="text-sm text-gray-500 mb-4">I dispositivi in lista vengono autorizzati automaticamente senza mostrare il form di registrazione.</p>
            <div className="flex gap-2 mb-6">
              <input type="text" value={wlMac} onChange={(e) => setWlMac(e.target.value)} placeholder="MAC address (es. AA:BB:CC:DD:EE:FF)" className={inputCls + ' flex-1 font-mono text-sm'} />
              <input type="text" value={wlLabel} onChange={(e) => setWlLabel(e.target.value)} placeholder="Etichetta (opzionale)" className={inputCls + ' flex-1'} />
              <button
                disabled={wlAdding || !wlMac.trim()}
                onClick={async () => {
                  setWlAdding(true);
                  try {
                    const { data } = await api.post<WhitelistEntry>(`/sites/${siteId}/whitelist`, { mac_address: wlMac.trim(), label: wlLabel.trim() || null });
                    setWhitelist((prev) => [...prev, data]);
                    setWlMac(''); setWlLabel('');
                  } finally { setWlAdding(false); }
                }}
                className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <Plus className="w-4 h-4" /> Aggiungi
              </button>
            </div>
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
                    <button onClick={async () => { await api.delete(`/sites/${siteId}/whitelist/${e.id}`); setWhitelist((prev) => prev.filter((x) => x.id !== e.id)); }} className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors">
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

// ─── Survey Preview ──────────────────────────────────────────────────────────

function SurveyPreview({ config }: { config: SiteConfig }) {
  const [selectedScore, setSelectedScore] = useState<number | null>(null);
  const primary = config.primaryColor || '#0055ff';

  const t = (val: string | null, def: string) =>
    (val || def).replace('{nome_sito}', config.name || 'La struttura');

  const title       = t(config.surveyTitle,         'Come è stata la tua esperienza?');
  const subtitle    = t(config.surveySubtitle,       `La tua opinione su ${config.name || 'la struttura'} ci aiuta a migliorare il servizio.`);
  const qLabel      = t(config.surveyQuestionLabel,  'Da 0 a 10, quanto ci consiglieresti a un amico?');
  const cLabel      = t(config.surveyCommentLabel,   'Vuoi aggiungere qualcosa?');
  const btnText     = t(config.surveyButtonText,     'Invia valutazione');
  const tyTitle     = t(config.surveyThankYouTitle,  'Grazie mille!');
  const showComment = config.surveyShowComment !== false;

  return (
    <div className="flex justify-center">
      <div
        className="w-full max-w-sm rounded-2xl shadow-lg overflow-hidden border border-gray-100"
        style={{ background: '#fff', fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif' }}
      >
        {/* Header */}
        {config.logoUrl ? (
          <div className="flex items-center justify-center px-6 py-4 border-b border-gray-100 bg-white">
            <img src={config.logoUrl} alt="logo" className="max-h-12 max-w-36 object-contain" />
          </div>
        ) : (
          <div className="px-6 py-4 text-center" style={{ background: primary }}>
            <span className="text-white font-bold text-base">{config.name || 'La struttura'}</span>
          </div>
        )}

        {/* Body */}
        <div className="px-6 py-6">
          <h2 className="font-bold text-gray-900 text-base mb-1.5">{title}</h2>
          <p className="text-sm text-gray-500 mb-5 leading-relaxed">{subtitle}</p>

          {/* Scores */}
          <p className="text-xs font-semibold text-gray-700 mb-2">{qLabel}</p>
          <div className="flex gap-1 flex-wrap justify-center mb-1">
            {Array.from({ length: 11 }, (_, i) => (
              <button
                key={i}
                type="button"
                onClick={() => setSelectedScore(i)}
                className="w-8 h-8 rounded-lg text-xs font-semibold transition-all"
                style={{
                  border: selectedScore === i ? `2px solid ${primary}` : '2px solid #e0e0e0',
                  background: selectedScore === i ? primary : '#fff',
                  color: selectedScore === i ? '#fff' : '#555',
                  cursor: 'pointer',
                }}
              >
                {i}
              </button>
            ))}
          </div>
          <div className="flex justify-between text-xs text-gray-400 mb-4 px-0.5">
            <span>Per niente</span><span>Assolutamente</span>
          </div>

          {/* Comment */}
          {showComment && (
            <div className="mb-4">
              <p className="text-xs font-semibold text-gray-700 mb-1.5">
                {cLabel} <span className="font-normal text-gray-400">(opzionale)</span>
              </p>
              <textarea
                readOnly
                placeholder="Scrivi qui la tua opinione..."
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none text-gray-400 bg-gray-50"
                rows={2}
              />
            </div>
          )}

          {/* Button */}
          <button
            type="button"
            className="w-full py-3 rounded-lg text-white text-sm font-semibold"
            style={{ background: primary }}
          >
            {btnText}
          </button>
        </div>

        {/* Thank you preview (solo se score selezionato) */}
        {selectedScore !== null && (
          <div className="px-6 pb-6 pt-2 border-t border-gray-100 text-center">
            <div
              className="w-10 h-10 rounded-full flex items-center justify-center mx-auto mb-2"
              style={{ background: primary }}
            >
              <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="20 6 9 17 4 12"/>
              </svg>
            </div>
            <p className="font-bold text-gray-900 text-sm mb-1">{tyTitle}</p>
            <p className="text-xs text-gray-400">
              {selectedScore >= 9
                ? 'Mostra link recensione Google'
                : selectedScore >= 7
                ? 'Pagina di ringraziamento semplice'
                : 'Messaggio "lo trasmetteremo allo staff"'}
            </p>
            <button
              type="button"
              onClick={() => setSelectedScore(null)}
              className="mt-2 text-xs text-gray-400 underline"
            >
              Torna alla survey
            </button>
          </div>
        )}

        <div className="text-center pb-3">
          <span className="text-xs text-gray-300">Powered by Authwifi</span>
        </div>
      </div>
    </div>
  );
}

// ─── Email Preview ───────────────────────────────────────────────────────────

function EmailPreview({ config }: { config: SiteConfig }) {
  const primary  = config.primaryColor || '#0055ff';
  const siteName = config.name || 'La struttura';

  const t = (val: string | null, def: string) =>
    (val || def).replace('{nome_sito}', siteName).replace('{nome_ospite}', 'Ospite');

  const bodyText   = t(config.emailBodyText,   `Grazie per aver visitato ${siteName}. Ci piacerebbe sapere come è stata la tua esperienza — bastano 30 secondi.`);
  const buttonText = t(config.emailButtonText, 'Lascia la tua valutazione');
  const footerText = t(config.emailFooterText, `Hai ricevuto questa email perché ti sei connesso al WiFi di ${siteName}.`);

  const scoreBg = ['#fee2e2','#fee2e2','#fef3c7','#fef3c7','#fef3c7','#fef3c7','#fef3c7','#dcfce7','#dcfce7','#dcfce7','#dcfce7'];
  const scoreFg = ['#dc2626','#dc2626','#b45309','#b45309','#b45309','#b45309','#b45309','#15803d','#15803d','#15803d','#15803d'];

  return (
    <div style={{ background: '#eef2f7', padding: '24px 16px', borderRadius: '12px' }}>
      <div style={{ maxWidth: '460px', margin: '0 auto', background: '#fff', borderRadius: '16px', overflow: 'hidden', boxShadow: '0 4px 24px rgba(0,0,0,0.08)' }}>
        {config.logoUrl ? (
          <div style={{ background: '#fff', padding: '18px 28px', textAlign: 'center', borderBottom: '1px solid #f0f0f0' }}>
            <img src={config.logoUrl} alt="logo" style={{ maxHeight: '40px', maxWidth: '140px', objectFit: 'contain' }} />
          </div>
        ) : (
          <div style={{ background: primary, padding: '20px 28px', textAlign: 'center' }}>
            <span style={{ color: '#fff', fontWeight: 700, fontSize: '15px' }}>{siteName}</span>
          </div>
        )}
        <div style={{ padding: '24px 28px 0' }}>
          <h2 style={{ margin: '0 0 8px', fontSize: '18px', fontWeight: 700, color: '#111' }}>Ciao Ospite,</h2>
          <p style={{ margin: '0 0 20px', fontSize: '13px', color: '#555', lineHeight: 1.65 }}
             dangerouslySetInnerHTML={{ __html: bodyText }} />
          <div style={{ background: '#f7f8fa', borderRadius: '10px', padding: '14px 14px 10px', marginBottom: '20px' }}>
            <p style={{ margin: '0 0 8px', fontSize: '9px', fontWeight: 600, color: '#aaa', textTransform: 'uppercase', letterSpacing: '0.8px' }}>
              Da 0 a 10, quanto ci consiglieresti?
            </p>
            <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap' }}>
              {Array.from({ length: 11 }, (_, i) => (
                <div key={i} style={{ width: '26px', height: '26px', borderRadius: '5px', background: scoreBg[i], display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '11px', fontWeight: 700, color: scoreFg[i] }}>{i}</div>
              ))}
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '6px' }}>
              <span style={{ fontSize: '9px', color: '#bbb' }}>Per niente</span>
              <span style={{ fontSize: '9px', color: '#bbb' }}>Assolutamente</span>
            </div>
          </div>
          <div style={{ textAlign: 'center', marginBottom: '24px' }}>
            <div style={{ display: 'inline-block', background: primary, color: '#fff', padding: '12px 32px', borderRadius: '10px', fontSize: '13px', fontWeight: 700 }}>
              {buttonText}
            </div>
          </div>
        </div>
        <div style={{ padding: '14px 28px 20px', borderTop: '1px solid #f0f0f0', textAlign: 'center' }}>
          <p style={{ margin: 0, fontSize: '10px', color: '#bbb', lineHeight: 1.6 }}>
            {footerText}<br/>
            <span style={{ color: '#ccc' }}>Powered by Authwifi</span>
          </p>
        </div>
      </div>
    </div>
  );
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

import { useEffect, useState } from 'react';
import { MessageSquareDot, Star, TrendingUp, TrendingDown, Minus, RefreshCw } from 'lucide-react';
import api from '../api/client';

// ─── Types ───────────────────────────────────────────────────────────────────

interface SurveyItem {
  id: string;
  npsScore: number | null;
  comment: string | null;
  submittedAt: string | null;
  guestEmail: string | null;
  guestFirstName: string | null;
  guestLastName: string | null;
  siteName: string;
  siteId: string;
}
interface SurveyData {
  total: number;
  avgNps: number | null;
  promotersPct: number;
  detractorsPct: number;
  passivesPct: number;
  items: SurveyItem[];
}
interface ReviewItem {
  id: string;
  authorName: string | null;
  authorPhoto: string | null;
  rating: number | null;
  text: string | null;
  publishedAt: string | null;
  siteId: string;
}
interface ReviewData {
  avgRating: number | null;
  total: number;
  lastSync: string | null;
  hasApiKey: boolean;
  items: ReviewItem[];
}
interface Site { id: string; name: string; }

type Tab = 'nps' | 'reviews';

// ─── Helpers ─────────────────────────────────────────────────────────────────

function npsColor(score: number | null): string {
  if (score === null) return 'bg-gray-100 text-gray-500';
  if (score >= 9) return 'bg-green-100 text-green-700';
  if (score >= 7) return 'bg-yellow-100 text-yellow-700';
  return 'bg-red-100 text-red-700';
}
function npsLabel(score: number | null): string {
  if (score === null) return '—';
  if (score >= 9) return 'Promotore';
  if (score >= 7) return 'Passivo';
  return 'Detrattore';
}
function avgNpsColor(avg: number | null): string {
  if (avg === null) return 'text-gray-400';
  if (avg >= 8) return 'text-green-600';
  if (avg >= 6) return 'text-yellow-600';
  return 'text-red-600';
}
function Stars({ rating, max = 5 }: { rating: number | null; max?: number }) {
  return (
    <div className="flex gap-0.5">
      {Array.from({ length: max }).map((_, i) => (
        <Star
          key={i}
          className={`w-3.5 h-3.5 ${
            rating !== null && i < rating ? 'text-yellow-400 fill-yellow-400' : 'text-gray-200 fill-gray-200'
          }`}
        />
      ))}
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function SurveyPage() {
  const [tab, setTab] = useState<Tab>('nps');
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState('');

  // NPS state
  const [npsData, setNpsData] = useState<SurveyData | null>(null);
  const [npsLoading, setNpsLoading] = useState(true);

  // Reviews state
  const [reviewData, setReviewData] = useState<ReviewData | null>(null);
  const [reviewLoading, setReviewLoading] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  useEffect(() => {
    api.get<Site[]>('/sites').then(({ data }) => {
      setSites(data);
      if (data.length === 1) setSelectedSite(data[0].id);
    }).catch(() => {});
  }, []);

  // Load NPS
  useEffect(() => {
    setNpsLoading(true);
    const params = selectedSite ? `?site_id=${selectedSite}` : '';
    api.get<SurveyData>(`/survey/responses${params}`)
      .then(({ data }) => setNpsData(data))
      .catch(() => setNpsData(null))
      .finally(() => setNpsLoading(false));
  }, [selectedSite]);

  // Load reviews when tab becomes active
  useEffect(() => {
    if (tab !== 'reviews') return;
    setReviewLoading(true);
    const params = selectedSite ? `?site_id=${selectedSite}` : '';
    api.get<ReviewData>(`/reviews${params}`)
      .then(({ data }) => setReviewData(data))
      .catch(() => setReviewData(null))
      .finally(() => setReviewLoading(false));
  }, [tab, selectedSite]);

  const handleSync = async () => {
    if (!selectedSite) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const { data } = await api.post<{ synced: number; total: number }>(
        `/reviews/sync?site_id=${selectedSite}`
      );
      setSyncMsg(`Sincronizzate ${data.total} recensioni (${data.synced} nuove).`);
      // Reload reviews
      const params = `?site_id=${selectedSite}`;
      const { data: rd } = await api.get<ReviewData>(`/reviews${params}`);
      setReviewData(rd);
    } catch (e: unknown) {
      const detail = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setSyncMsg(detail ?? 'Errore durante la sincronizzazione.');
    } finally {
      setSyncing(false);
    }
  };

  const formatDate = (iso: string | null) =>
    iso ? new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

  const guestName = (item: SurveyItem) =>
    [item.guestFirstName, item.guestLastName].filter(Boolean).join(' ') || item.guestEmail || 'Ospite anonimo';

  return (
    <div className="p-8 w-full">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Survey & Recensioni</h1>
          <p className="text-sm text-gray-500 mt-1">NPS post-soggiorno e recensioni Google</p>
        </div>
        {sites.length > 1 && (
          <select
            value={selectedSite}
            onChange={(e) => setSelectedSite(e.target.value)}
            className="px-3.5 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500"
          >
            <option value="">Tutti i siti</option>
            {sites.map((s) => (
              <option key={s.id} value={s.id}>{s.name}</option>
            ))}
          </select>
        )}
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl mb-8 w-fit">
        {([
          { key: 'nps',     label: 'NPS & Feedback' },
          { key: 'reviews', label: 'Recensioni Google' },
        ] as { key: Tab; label: string }[]).map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              tab === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {/* ── NPS tab ─────────────────────────────────────────────────────────── */}
      {tab === 'nps' && (
        <>
          {npsData && (
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
              <StatCard label="Media NPS" value={npsData.avgNps !== null ? String(npsData.avgNps) : '—'} sub="su 10" valueClass={avgNpsColor(npsData.avgNps)} />
              <StatCard label="Promotori" value={`${npsData.promotersPct}%`} sub="NPS 9-10" icon={<TrendingUp className="w-3 h-3 text-green-500"/>} valueClass="text-green-600" />
              <StatCard label="Passivi"   value={`${npsData.passivesPct}%`}  sub="NPS 7-8"  icon={<Minus className="w-3 h-3 text-yellow-500"/>} valueClass="text-yellow-600" />
              <StatCard label="Detrattori" value={`${npsData.detractorsPct}%`} sub="NPS 0-6" icon={<TrendingDown className="w-3 h-3 text-red-500"/>} valueClass="text-red-600" />
            </div>
          )}

          {npsData && npsData.total > 0 && (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8">
              <div className="flex justify-between mb-3">
                <p className="text-sm font-semibold text-gray-700">Distribuzione risposte</p>
                <p className="text-xs text-gray-400">{npsData.total} risposta{npsData.total !== 1 ? 'e' : ''}</p>
              </div>
              <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
                {npsData.promotersPct > 0 && <div className="bg-green-500" style={{ width: `${npsData.promotersPct}%` }} />}
                {npsData.passivesPct > 0  && <div className="bg-yellow-400" style={{ width: `${npsData.passivesPct}%` }} />}
                {npsData.detractorsPct > 0 && <div className="bg-red-500"  style={{ width: `${npsData.detractorsPct}%` }} />}
              </div>
              <div className="flex gap-4 mt-2">
                {[['bg-green-500','Promotori'],['bg-yellow-400','Passivi'],['bg-red-500','Detrattori']].map(([c,l])=>(
                  <span key={l} className="flex items-center gap-1.5 text-xs text-gray-500">
                    <span className={`w-2 h-2 rounded-full ${c} inline-block`}/>{l}
                  </span>
                ))}
              </div>
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Risposte recenti</h2>
            </div>
            {npsLoading && <div className="p-8 text-center text-sm text-gray-400">Caricamento...</div>}
            {!npsLoading && (!npsData || npsData.items.length === 0) && (
              <div className="p-12 text-center">
                <MessageSquareDot className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400">Nessuna risposta ancora.</p>
              </div>
            )}
            {!npsLoading && npsData && npsData.items.map((item) => (
              <div key={item.id} className="px-6 py-4 flex items-start gap-4 hover:bg-gray-50 border-b border-gray-50 last:border-0 transition-colors">
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${npsColor(item.npsScore)}`}>
                  {item.npsScore ?? '—'}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{guestName(item)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${npsColor(item.npsScore)}`}>{npsLabel(item.npsScore)}</span>
                  </div>
                  {item.guestEmail && <p className="text-xs text-gray-400 truncate mb-1">{item.guestEmail}</p>}
                  {item.comment && <p className="text-sm text-gray-600 line-clamp-2">"{item.comment}"</p>}
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-gray-400">{formatDate(item.submittedAt)}</p>
                  {sites.length > 1 && <p className="text-xs text-gray-300 mt-0.5">{item.siteName}</p>}
                </div>
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Reviews tab ──────────────────────────────────────────────────────── */}
      {tab === 'reviews' && (
        <>
          {/* Stats + sync button */}
          <div className="flex items-center gap-4 mb-6">
            {reviewData && reviewData.avgRating !== null && (
              <div className="bg-white rounded-2xl border border-gray-100 shadow-sm px-5 py-4 flex items-center gap-3">
                <p className="text-3xl font-bold text-gray-900">{reviewData.avgRating}</p>
                <div>
                  <Stars rating={Math.round(reviewData.avgRating)} />
                  <p className="text-xs text-gray-400 mt-0.5">{reviewData.total} recension{reviewData.total !== 1 ? 'i' : 'e'}</p>
                </div>
              </div>
            )}
            <div className="flex-1" />
            <div className="text-right">
              {reviewData?.lastSync && (
                <p className="text-xs text-gray-400 mb-1.5">
                  Ultima sync: {formatDate(reviewData.lastSync)}
                </p>
              )}
              <button
                onClick={handleSync}
                disabled={syncing || !selectedSite}
                className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw className={`w-4 h-4 ${syncing ? 'animate-spin' : ''}`} />
                {syncing ? 'Sincronizzazione...' : 'Sincronizza ora'}
              </button>
              {!selectedSite && (
                <p className="text-xs text-gray-400 mt-1">Seleziona un sito per sincronizzare</p>
              )}
            </div>
          </div>

          {syncMsg && (
            <div className={`mb-4 px-4 py-3 rounded-xl text-sm ${
              syncMsg.startsWith('Sincronizzate') ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-600'
            }`}>
              {syncMsg}
            </div>
          )}

          {!reviewData?.hasApiKey && (
            <div className="bg-amber-50 border border-amber-200 rounded-xl px-5 py-4 mb-6 text-sm text-amber-700">
              <strong>GOOGLE_PLACES_API_KEY</strong> non configurata.<br/>
              Aggiungila nel file <code className="bg-amber-100 px-1 rounded">.env</code> del server per attivare la sincronizzazione recensioni.
            </div>
          )}

          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100">
              <h2 className="font-semibold text-gray-900">Recensioni Google recenti</h2>
            </div>

            {reviewLoading && <div className="p-8 text-center text-sm text-gray-400">Caricamento...</div>}

            {!reviewLoading && (!reviewData || reviewData.items.length === 0) && (
              <div className="p-12 text-center">
                <Star className="w-8 h-8 text-gray-200 mx-auto mb-3" />
                <p className="text-sm text-gray-400 mb-1">Nessuna recensione ancora.</p>
                <p className="text-xs text-gray-300">
                  Configura il Google Place ID in Impostazioni → Survey, poi clicca "Sincronizza ora".
                </p>
              </div>
            )}

            {!reviewLoading && reviewData && reviewData.items.map((item) => (
              <div key={item.id} className="px-6 py-5 border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
                <div className="flex items-start gap-3">
                  {item.authorPhoto ? (
                    <img src={item.authorPhoto} alt="" className="w-9 h-9 rounded-full shrink-0" />
                  ) : (
                    <div className="w-9 h-9 rounded-full bg-brand-100 flex items-center justify-center shrink-0">
                      <span className="text-brand-600 text-sm font-bold">
                        {(item.authorName ?? 'A').charAt(0).toUpperCase()}
                      </span>
                    </div>
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between mb-1">
                      <p className="text-sm font-medium text-gray-900">{item.authorName ?? 'Anonimo'}</p>
                      <p className="text-xs text-gray-400 shrink-0 ml-2">{formatDate(item.publishedAt)}</p>
                    </div>
                    <Stars rating={item.rating} />
                    {item.text && (
                      <p className="text-sm text-gray-600 mt-2 line-clamp-3">{item.text}</p>
                    )}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

// ─── Helpers components ───────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, valueClass }: {
  label: string; value: string; sub: string; icon?: React.ReactNode; valueClass?: string;
}) {
  return (
    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
      <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">{label}</p>
      <p className={`text-4xl font-bold ${valueClass ?? 'text-gray-900'}`}>{value}</p>
      <div className="flex items-center justify-center gap-1 mt-1">
        {icon}
        <p className="text-xs text-gray-400">{sub}</p>
      </div>
    </div>
  );
}

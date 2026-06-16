import { useEffect, useState } from 'react';
import { MessageSquareDot, Star, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import api from '../api/client';

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

interface Site {
  id: string;
  name: string;
}

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

function avgColor(avg: number | null): string {
  if (avg === null) return 'text-gray-400';
  if (avg >= 8) return 'text-green-600';
  if (avg >= 6) return 'text-yellow-600';
  return 'text-red-600';
}

export default function SurveyPage() {
  const [data, setData] = useState<SurveyData | null>(null);
  const [sites, setSites] = useState<Site[]>([]);
  const [selectedSite, setSelectedSite] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get<Site[]>('/sites').then(({ data: s }) => setSites(s)).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = selectedSite ? `?site_id=${selectedSite}` : '';
    api.get<SurveyData>(`/survey/responses${params}`)
      .then(({ data: d }) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [selectedSite]);

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('it-IT', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  const guestName = (item: SurveyItem) => {
    const name = [item.guestFirstName, item.guestLastName].filter(Boolean).join(' ');
    return name || item.guestEmail || 'Ospite anonimo';
  };

  return (
    <div className="p-8 max-w-5xl">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Survey & NPS</h1>
          <p className="text-sm text-gray-500 mt-1">Risposte degli ospiti al questionario post-soggiorno</p>
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

      {/* Stats cards */}
      {data && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-8">
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Media NPS</p>
            <p className={`text-4xl font-bold ${avgColor(data.avgNps)}`}>
              {data.avgNps !== null ? data.avgNps : '—'}
            </p>
            <p className="text-xs text-gray-400 mt-1">su 10</p>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Promotori</p>
            <p className="text-4xl font-bold text-green-600">{data.promotersPct}%</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendingUp className="w-3 h-3 text-green-500" />
              <p className="text-xs text-gray-400">NPS 9-10</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Passivi</p>
            <p className="text-4xl font-bold text-yellow-600">{data.passivesPct}%</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <Minus className="w-3 h-3 text-yellow-500" />
              <p className="text-xs text-gray-400">NPS 7-8</p>
            </div>
          </div>
          <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 text-center">
            <p className="text-xs text-gray-400 font-medium uppercase tracking-wider mb-2">Detrattori</p>
            <p className="text-4xl font-bold text-red-600">{data.detractorsPct}%</p>
            <div className="flex items-center justify-center gap-1 mt-1">
              <TrendingDown className="w-3 h-3 text-red-500" />
              <p className="text-xs text-gray-400">NPS 0-6</p>
            </div>
          </div>
        </div>
      )}

      {/* NPS bar */}
      {data && data.total > 0 && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 mb-8">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm font-semibold text-gray-700">Distribuzione risposte</p>
            <p className="text-xs text-gray-400">{data.total} risposta{data.total !== 1 ? 'e' : ''}</p>
          </div>
          <div className="flex h-3 rounded-full overflow-hidden gap-0.5">
            {data.promotersPct > 0 && (
              <div className="bg-green-500 transition-all" style={{ width: `${data.promotersPct}%` }} title={`Promotori ${data.promotersPct}%`} />
            )}
            {data.passivesPct > 0 && (
              <div className="bg-yellow-400 transition-all" style={{ width: `${data.passivesPct}%` }} title={`Passivi ${data.passivesPct}%`} />
            )}
            {data.detractorsPct > 0 && (
              <div className="bg-red-500 transition-all" style={{ width: `${data.detractorsPct}%` }} title={`Detrattori ${data.detractorsPct}%`} />
            )}
          </div>
          <div className="flex gap-4 mt-2">
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-green-500 inline-block"/>Promotori</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-yellow-400 inline-block"/>Passivi</span>
            <span className="flex items-center gap-1.5 text-xs text-gray-500"><span className="w-2 h-2 rounded-full bg-red-500 inline-block"/>Detrattori</span>
          </div>
        </div>
      )}

      {/* Responses table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">Risposte recenti</h2>
        </div>

        {loading && (
          <div className="p-8 text-center text-sm text-gray-400">Caricamento...</div>
        )}

        {!loading && (!data || data.items.length === 0) && (
          <div className="p-12 text-center">
            <div className="w-12 h-12 bg-gray-100 rounded-full flex items-center justify-center mx-auto mb-3">
              <MessageSquareDot className="w-6 h-6 text-gray-300" />
            </div>
            <p className="text-sm font-medium text-gray-500">Nessuna risposta ancora</p>
            <p className="text-xs text-gray-400 mt-1">
              Le survey vengono inviate automaticamente {'{'}ore delay{'}'} ore dopo l'ultima sessione WiFi.
            </p>
          </div>
        )}

        {!loading && data && data.items.length > 0 && (
          <div className="divide-y divide-gray-50">
            {data.items.map((item) => (
              <div key={item.id} className="px-6 py-4 flex items-start gap-4 hover:bg-gray-50 transition-colors">
                {/* Score badge */}
                <div className={`shrink-0 w-10 h-10 rounded-xl flex items-center justify-center font-bold text-sm ${npsColor(item.npsScore)}`}>
                  {item.npsScore ?? '—'}
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-0.5">
                    <p className="text-sm font-medium text-gray-900 truncate">{guestName(item)}</p>
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${npsColor(item.npsScore)}`}>
                      {npsLabel(item.npsScore)}
                    </span>
                  </div>
                  {item.guestEmail && (
                    <p className="text-xs text-gray-400 truncate mb-1">{item.guestEmail}</p>
                  )}
                  {item.comment && (
                    <p className="text-sm text-gray-600 line-clamp-2">"{item.comment}"</p>
                  )}
                </div>

                {/* Meta */}
                <div className="shrink-0 text-right">
                  <p className="text-xs text-gray-400">{formatDate(item.submittedAt)}</p>
                  {sites.length > 1 && (
                    <p className="text-xs text-gray-300 mt-0.5">{item.siteName}</p>
                  )}
                </div>

                {/* Stars */}
                <div className="shrink-0 flex gap-0.5">
                  {[...Array(10)].map((_, i) => (
                    <Star
                      key={i}
                      className={`w-2.5 h-2.5 ${
                        item.npsScore !== null && i < item.npsScore
                          ? 'text-yellow-400 fill-yellow-400'
                          : 'text-gray-200 fill-gray-200'
                      }`}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}

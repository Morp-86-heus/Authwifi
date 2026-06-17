import { useEffect, useState, lazy, Suspense } from 'react';
import { Users, Wifi, Mail, TrendingUp, ArrowRight, MessageSquareDot, TrendingDown, Minus } from 'lucide-react';
import {
  AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid,
} from 'recharts';
import { useNavigate } from 'react-router-dom';
import api from '../api/client';
import { useAuthStore } from '../stores/auth';

const WorldMap = lazy(() => import('../components/WorldMap'));

interface NpsSummary {
  total: number;
  avgNps: number | null;
  promotersPct: number;
  passivesPct: number;
  detractorsPct: number;
  items: {
    id: string;
    npsScore: number | null;
    comment: string | null;
    submittedAt: string | null;
    guestFirstName: string | null;
    guestLastName: string | null;
    guestEmail: string | null;
  }[];
}

interface Stats {
  totalGuests: number;
  newGuestsThisWeek: number;
  connectionsToday: number;
  emailsCollected: number;
  registrationsByDay: { date: string; count: number }[];
  topCountries: { country: string; count: number }[];
  recentGuests: {
    id: string;
    email: string | null;
    firstName: string | null;
    lastName: string | null;
    createdAt: string;
  }[];
}

export default function DashboardPage() {
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [noSite, setNoSite] = useState(false);
  const [nps, setNps] = useState<NpsSummary | null>(null);
  const tenantId = useAuthStore((s) => s.tenantId);
  const role = useAuthStore((s) => s.role);
  const navigate = useNavigate();

  useEffect(() => {
    (async () => {
      try {
        if (role === 'superadmin') { setLoading(false); return; }
        const { data: sites } = await api.get<{ id: string }[]>('/sites');
        if (!sites.length) { setNoSite(true); setLoading(false); return; }
        const [{ data }, { data: npsData }] = await Promise.all([
          api.get<Stats>(`/stats/${sites[0].id}`),
          api.get<NpsSummary>(`/survey/responses?site_id=${sites[0].id}`),
        ]);
        setStats(data);
        setNps(npsData);
      } finally {
        setLoading(false);
      }
    })();
  }, [tenantId, role]);

  const chartData = buildChartData(stats?.registrationsByDay ?? []);

  if (role === 'superadmin') {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="text-center">
          <p className="text-gray-500 text-sm mb-3">Seleziona un tenant dal pannello SuperAdmin.</p>
          <button onClick={() => navigate('/admin')} className="text-sm text-brand-600 font-medium hover:underline">
            Vai a SuperAdmin →
          </button>
        </div>
      </div>
    );
  }

  if (noSite) {
    return (
      <div className="p-8 flex items-center justify-center min-h-96">
        <div className="text-center">
          <p className="text-gray-500 text-sm">Nessun sito configurato.</p>
        </div>
      </div>
    );
  }

  const total = stats?.topCountries.reduce((s, x) => s + x.count, 0) ?? 0;

  return (
    <div className="p-8 w-full space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Dashboard</h1>
        <p className="text-sm text-gray-500 mt-1">Statistiche del tuo portale WiFi</p>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
        <KpiCard label="Ospiti totali" value={loading ? '–' : String(stats?.totalGuests ?? 0)} sub="Registrazioni totali" color="teal" icon={<Users className="w-9 h-9" />} onClick={() => navigate('/guests')} />
        <KpiCard label="Accessi oggi" value={loading ? '–' : String(stats?.connectionsToday ?? 0)} sub="Connessioni WiFi oggi" color="green" icon={<Wifi className="w-9 h-9" />} onClick={() => navigate('/guests')} />
        <KpiCard label="Email raccolte" value={loading ? '–' : String(stats?.emailsCollected ?? 0)} sub="Ospiti con email valida" color="orange" icon={<Mail className="w-9 h-9" />} onClick={() => navigate('/guests')} />
      </div>

      {/* Trend chart */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h2 className="font-semibold text-gray-900">Nuovi ospiti</h2>
            <p className="text-xs text-gray-400 mt-0.5">Ultimi 30 giorni</p>
          </div>
          <TrendingUp className="w-4 h-4 text-gray-300" />
        </div>
        {loading ? (
          <div className="h-44 flex items-center justify-center text-sm text-gray-300">Caricamento...</div>
        ) : (
          <ResponsiveContainer width="100%" height={176}>
            <AreaChart data={chartData} margin={{ top: 4, right: 4, left: -24, bottom: 0 }}>
              <defs>
                <linearGradient id="gradBlue" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.18} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" vertical={false} />
              <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval={4} />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
              <Tooltip contentStyle={{ fontSize: 12, borderRadius: 8, border: '1px solid #e5e7eb', boxShadow: 'none' }} labelStyle={{ color: '#6b7280' }} />
              <Area type="monotone" dataKey="count" name="Ospiti" stroke="#3b82f6" strokeWidth={2} fill="url(#gradBlue)" dot={false} activeDot={{ r: 4, strokeWidth: 0 }} />
            </AreaChart>
          </ResponsiveContainer>
        )}
      </div>

      {/* Mappa + tabella */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
        <h2 className="font-semibold text-gray-900 mb-4">Provenienze</h2>
        {/* Planisfero */}
        <div className="h-72 w-full mb-6">
          {loading ? (
            <div className="h-full flex items-center justify-center text-sm text-gray-300">Caricamento...</div>
          ) : (
            <Suspense fallback={<div className="h-full flex items-center justify-center text-sm text-gray-300">Caricamento mappa...</div>}>
              <WorldMap countries={stats?.topCountries ?? []} />
            </Suspense>
          )}
        </div>
        {/* Tabella paesi */}
        {!loading && !!stats?.topCountries.length && (
          <table className="w-full">
            <thead>
              <tr className="text-left text-xs font-semibold text-gray-400 uppercase tracking-wide border-b border-gray-100">
                <th className="pb-2">#</th>
                <th className="pb-2">Nazione</th>
                <th className="pb-2 text-right">Ospiti</th>
                <th className="pb-2 text-right">%</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {stats.topCountries.map((c, i) => (
                <tr key={c.country} className="hover:bg-gray-50 transition-colors">
                  <td className="py-2.5 text-sm text-gray-400 pr-4">{i + 1}</td>
                  <td className="py-2.5 text-sm font-medium text-gray-900 uppercase">{c.country}</td>
                  <td className="py-2.5 text-sm font-semibold text-gray-700 text-right">{c.count}</td>
                  <td className="py-2.5 text-sm text-gray-400 text-right pl-6">
                    {total > 0 ? ((c.count / total) * 100).toFixed(1) : '0'}%
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
        {!loading && !stats?.topCountries.length && (
          <p className="text-sm text-gray-400 text-center py-4">Nessun dato disponibile</p>
        )}
      </div>

      {/* NPS Widget */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <MessageSquareDot className="w-4 h-4 text-brand-500" />
            <h2 className="font-semibold text-gray-900">NPS & Feedback</h2>
          </div>
          <button onClick={() => navigate('/survey')} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
            Vedi tutti <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        {loading ? (
          <div className="px-6 py-8 text-center text-sm text-gray-400">Caricamento...</div>
        ) : !nps || nps.total === 0 ? (
          <div className="px-6 py-8 text-center">
            <MessageSquareDot className="w-7 h-7 text-gray-200 mx-auto mb-2" />
            <p className="text-sm text-gray-400">Nessuna risposta survey ancora.</p>
          </div>
        ) : (
          <div className="px-6 py-5 space-y-4">
            {/* Score + distribuzione */}
            <div className="flex items-center gap-6">
              <div className="text-center shrink-0">
                <p className={`text-4xl font-bold ${nps.avgNps !== null && nps.avgNps >= 8 ? 'text-green-600' : nps.avgNps !== null && nps.avgNps >= 6 ? 'text-yellow-500' : 'text-red-500'}`}>
                  {nps.avgNps ?? '—'}
                </p>
                <p className="text-xs text-gray-400 mt-0.5">Media NPS</p>
              </div>
              <div className="flex-1 space-y-2">
                <div className="flex h-2.5 rounded-full overflow-hidden gap-0.5">
                  {nps.promotersPct > 0  && <div className="bg-green-500"  style={{ width: `${nps.promotersPct}%` }} />}
                  {nps.passivesPct > 0   && <div className="bg-yellow-400" style={{ width: `${nps.passivesPct}%` }} />}
                  {nps.detractorsPct > 0 && <div className="bg-red-500"    style={{ width: `${nps.detractorsPct}%` }} />}
                </div>
                <div className="flex gap-4">
                  <span className="flex items-center gap-1 text-xs text-gray-500"><TrendingUp className="w-3 h-3 text-green-500"/>{nps.promotersPct}% Promotori</span>
                  <span className="flex items-center gap-1 text-xs text-gray-500"><Minus className="w-3 h-3 text-yellow-500"/>{nps.passivesPct}% Passivi</span>
                  <span className="flex items-center gap-1 text-xs text-gray-500"><TrendingDown className="w-3 h-3 text-red-500"/>{nps.detractorsPct}% Detrattori</span>
                </div>
              </div>
            </div>
            {/* Ultime 3 risposte */}
            <div className="divide-y divide-gray-50 border-t border-gray-50">
              {nps.items.slice(0, 3).map((item) => {
                const name = [item.guestFirstName, item.guestLastName].filter(Boolean).join(' ') || item.guestEmail || 'Ospite anonimo';
                const scoreColor = item.npsScore === null ? 'bg-gray-100 text-gray-500' : item.npsScore >= 9 ? 'bg-green-100 text-green-700' : item.npsScore >= 7 ? 'bg-yellow-100 text-yellow-700' : 'bg-red-100 text-red-700';
                return (
                  <div key={item.id} className="py-3 flex items-start gap-3">
                    <div className={`shrink-0 w-8 h-8 rounded-lg flex items-center justify-center font-bold text-xs ${scoreColor}`}>
                      {item.npsScore ?? '—'}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                      {item.comment && <p className="text-xs text-gray-400 truncate">"{item.comment}"</p>}
                    </div>
                    <span className="text-xs text-gray-400 shrink-0">
                      {item.submittedAt ? new Date(item.submittedAt).toLocaleDateString('it-IT') : '—'}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Ultimi ospiti */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900">Ultimi ospiti</h2>
          <button onClick={() => navigate('/guests')} className="flex items-center gap-1 text-xs text-brand-600 hover:text-brand-700 font-medium">
            Vedi tutti <ArrowRight className="w-3 h-3" />
          </button>
        </div>
        <div className="divide-y divide-gray-50">
          {loading ? (
            <div className="px-6 py-8 text-center text-sm text-gray-400">Caricamento...</div>
          ) : !stats?.recentGuests.length ? (
            <div className="px-6 py-8 text-center text-sm text-gray-400">
              Nessun ospite ancora. Configura l&apos;AP e testa il portale!
            </div>
          ) : (
            stats.recentGuests.map((g) => {
              const initials = (g.firstName?.[0] ?? g.email?.[0] ?? '?').toUpperCase();
              const name = g.firstName || g.lastName ? `${g.firstName ?? ''} ${g.lastName ?? ''}`.trim() : 'Ospite anonimo';
              return (
                <div key={g.id} className="px-6 py-3.5 flex items-center gap-4">
                  <div className="w-8 h-8 rounded-full bg-brand-50 flex items-center justify-center flex-shrink-0">
                    <span className="text-xs font-semibold text-brand-600">{initials}</span>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{name}</p>
                    <p className="text-xs text-gray-400 truncate">{g.email ?? 'nessuna email'}</p>
                  </div>
                  <span className="text-xs text-gray-400 flex-shrink-0">
                    {new Date(g.createdAt).toLocaleDateString('it-IT')}
                  </span>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function buildChartData(byDay: { date: string; count: number }[]) {
  const map = new Map(byDay.map((d) => [d.date, d.count]));
  const result = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date();
    d.setUTCDate(d.getUTCDate() - i);
    const key = d.toISOString().slice(0, 10);
    result.push({ label: `${d.getUTCDate()}/${d.getUTCMonth() + 1}`, count: map.get(key) ?? 0 });
  }
  return result;
}

function KpiCard({ label, value, sub, color, icon, onClick }: {
  label: string; value: string; sub: string;
  color: 'teal' | 'green' | 'orange'; icon: React.ReactNode; onClick?: () => void;
}) {
  const bg = { teal: 'bg-[#0abab5]', green: 'bg-emerald-500', orange: 'bg-orange-500' }[color];
  return (
    <div className={`${bg} rounded-2xl p-6 text-white relative overflow-hidden cursor-pointer group`} onClick={onClick}>
      <div className="absolute right-5 top-5 opacity-20 group-hover:opacity-30 transition-opacity">{icon}</div>
      <p className="text-sm font-medium opacity-80 mb-2">{label}</p>
      <p className="text-4xl font-bold tracking-tight mb-3">{value}</p>
      <div className="flex items-center justify-between">
        <p className="text-xs opacity-70">{sub}</p>
        <span className="text-xs opacity-60 flex items-center gap-0.5">Dettaglio <ArrowRight className="w-3 h-3" /></span>
      </div>
    </div>
  );
}

import { useEffect, useState, useCallback } from 'react';
import { Search, ChevronLeft, ChevronRight, User, Download } from 'lucide-react';
import api from '../api/client';
import GuestDetail from '../components/GuestDetail';

const SITE_ID = import.meta.env.VITE_DEFAULT_SITE_ID ?? '';

interface GuestRow {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  language: string | null;
  country: string | null;
  createdAt: string;
  sessions: number;
  lastVisit: string | null;
  lastSsid: string | null;
}

interface GuestListResponse {
  guests: GuestRow[];
  total: number;
  page: number;
  limit: number;
}

const LIMIT = 25;

export default function GuestsPage() {
  const [data, setData] = useState<GuestListResponse | null>(null);
  const [page, setPage] = useState(1);
  const [search, setSearch] = useState('');
  const [searchInput, setSearchInput] = useState('');
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [exporting, setExporting] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, any> = { page, limit: LIMIT };
      if (search) params.search = search;
      const { data: res } = await api.get<GuestListResponse>('/crm/guests', { params });
      setData(res);
    } finally {
      setLoading(false);
    }
  }, [page, search]);

  useEffect(() => { load(); }, [load]);

  const handleSearch = (e: React.FormEvent) => {
    e.preventDefault();
    setPage(1);
    setSearch(searchInput);
  };

  const handleExport = async () => {
    setExporting(true);
    try {
      const { data: blob } = await api.get('/crm/guests/export', { responseType: 'blob' });
      const url = URL.createObjectURL(new Blob([blob], { type: 'text/csv;charset=utf-8;' }));
      const a = document.createElement('a');
      a.href = url;
      a.download = `ospiti-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setExporting(false);
    }
  };

  const totalPages = data ? Math.ceil(data.total / LIMIT) : 1;

  const fullName = (g: GuestRow) => {
    const name = [g.firstName, g.lastName].filter(Boolean).join(' ');
    return name || g.email || g.id.slice(0, 8);
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return '—';
    return new Date(iso).toLocaleDateString('it-IT', {
      day: '2-digit', month: 'short', year: 'numeric',
    });
  };

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ospiti</h1>
          <p className="text-sm text-gray-500 mt-1">
            {data ? `${data.total.toLocaleString('it-IT')} ospiti registrati` : 'Caricamento...'}
          </p>
        </div>
        <button
          onClick={handleExport}
          disabled={exporting || !data?.total}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" />
          {exporting ? 'Esportazione...' : 'Esporta CSV'}
        </button>
      </div>

      {/* Search */}
      <form onSubmit={handleSearch} className="flex gap-2 mb-6 max-w-md">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            placeholder="Cerca per nome o email..."
            className="w-full pl-9 pr-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent"
          />
        </div>
        <button
          type="submit"
          className="px-4 py-2.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
        >
          Cerca
        </button>
        {search && (
          <button
            type="button"
            onClick={() => { setSearchInput(''); setSearch(''); setPage(1); }}
            className="px-3 py-2.5 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg"
          >
            ✕
          </button>
        )}
      </form>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-gray-400">
            Caricamento...
          </div>
        ) : data && data.guests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 gap-3 text-gray-400">
            <User className="w-10 h-10 text-gray-200" />
            <p className="text-sm">
              {search ? 'Nessun ospite trovato per questa ricerca.' : 'Nessun ospite ancora registrato.'}
            </p>
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50/60 text-xs text-gray-500 font-medium uppercase tracking-wide">
                <th className="text-left px-5 py-3.5">Ospite</th>
                <th className="text-left px-5 py-3.5">Email</th>
                <th className="text-left px-5 py-3.5">Provenienza</th>
                <th className="text-right px-5 py-3.5">Sessioni</th>
                <th className="text-left px-5 py-3.5">Ultima visita</th>
                <th className="text-left px-5 py-3.5">Registrato</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {data?.guests.map((g) => (
                <tr
                  key={g.id}
                  onClick={() => setSelectedId(g.id)}
                  className="hover:bg-brand-50/40 cursor-pointer transition-colors"
                >
                  <td className="px-5 py-3.5">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-xs font-semibold shrink-0">
                        {(g.firstName?.[0] ?? g.email?.[0] ?? '?').toUpperCase()}
                      </div>
                      <span className="font-medium text-gray-900">{fullName(g)}</span>
                    </div>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{g.email ?? '—'}</td>
                  <td className="px-5 py-3.5 text-gray-500 uppercase">{g.country ?? '—'}</td>
                  <td className="px-5 py-3.5 text-right">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-700">
                      {g.sessions}
                    </span>
                  </td>
                  <td className="px-5 py-3.5 text-gray-500">{formatDate(g.lastVisit)}</td>
                  <td className="px-5 py-3.5 text-gray-400">{formatDate(g.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        {/* Pagination */}
        {data && totalPages > 1 && (
          <div className="flex items-center justify-between px-5 py-3.5 border-t border-gray-100 bg-gray-50/40">
            <p className="text-xs text-gray-500">
              {(page - 1) * LIMIT + 1}–{Math.min(page * LIMIT, data.total)} di {data.total}
            </p>
            <div className="flex gap-1">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={page === 1}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-3 py-1 text-xs text-gray-600 flex items-center">
                {page} / {totalPages}
              </span>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={page === totalPages}
                className="p-1.5 rounded-lg hover:bg-gray-100 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Detail panel */}
      {selectedId && (
        <GuestDetail
          guestId={selectedId}
          onClose={() => setSelectedId(null)}
        />
      )}
    </div>
  );
}

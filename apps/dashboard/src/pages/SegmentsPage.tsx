import { useEffect, useState, useCallback } from 'react';
import { Plus, Pencil, Trash2, ToggleLeft, ToggleRight, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Segment {
  id: string;
  name: string;
  priority: number;
  enabled: boolean;
  createdAt: string;
}

interface SubSegment {
  id: string;
  segmentId: string;
  segmentName: string;
  name: string;
  textIt: string | null;
  dateStart: string | null;
  dateEnd: string | null;
  recurring: boolean;
  online: number;
  enabled: boolean;
  createdAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDate(s: string | null) {
  if (!s) return '—';
  return new Date(s).toLocaleDateString('it-IT');
}

const inputCls =
  'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent';
const labelCls = 'block text-sm font-medium text-gray-700 mb-1';

// ─── Segment modal ────────────────────────────────────────────────────────────

function SegmentModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: Segment | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState(initial?.name ?? '');
  const [priority, setPriority] = useState(initial?.priority ?? 0);
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) { setError('Il nome è obbligatorio'); return; }
    setSaving(true); setError(null);
    try {
      if (initial) {
        await api.patch(`/segments/${initial.id}`, { name, priority, enabled });
      } else {
        await api.post('/segments', { name, priority, enabled });
      }
      onSaved();
    } catch {
      setError('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{initial ? 'Modifica segmento' : 'Nuovo segmento'}</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Nome *</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Mare e Relax Balneare" />
          </div>
          <div>
            <label className={labelCls}>Priorità</label>
            <input type="number" className={inputCls} value={priority} onChange={(e) => setPriority(Number(e.target.value))} />
          </div>
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700">Abilitato</label>
            <button
              type="button"
              onClick={() => setEnabled((v) => !v)}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-brand-500' : 'bg-gray-300'}`}
            >
              <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
            </button>
          </div>
          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annulla</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg disabled:opacity-60"
          >
            {saving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── SubSegment modal ─────────────────────────────────────────────────────────

function SubSegmentModal({
  initial,
  segments,
  onClose,
  onSaved,
}: {
  initial: SubSegment | null;
  segments: Segment[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const [segmentId, setSegmentId] = useState(initial?.segmentId ?? '');
  const [name, setName] = useState(initial?.name ?? '');
  const [textIt, setTextIt] = useState(initial?.textIt ?? '');
  const [dateStart, setDateStart] = useState(initial?.dateStart ? initial.dateStart.slice(0, 10) : '');
  const [dateEnd, setDateEnd] = useState(initial?.dateEnd ? initial.dateEnd.slice(0, 10) : '');
  const [recurring, setRecurring] = useState(initial?.recurring ?? false);
  const [enabled, setEnabled] = useState(initial?.enabled ?? true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSave = async () => {
    if (!name.trim()) { setError('Il nome è obbligatorio'); return; }
    if (!segmentId) { setError('Seleziona un segmento'); return; }
    setSaving(true); setError(null);
    const payload = {
      segment_id: segmentId,
      name,
      text_it: textIt || null,
      date_start: dateStart || null,
      date_end: dateEnd || null,
      recurring,
      enabled,
    };
    try {
      if (initial) {
        await api.patch(`/segments/sub-segments/${initial.id}`, payload);
      } else {
        await api.post('/segments/sub-segments', payload);
      }
      onSaved();
    } catch {
      setError('Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg" onClick={(e) => e.stopPropagation()}>
        <div className="px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">{initial ? 'Modifica sotto-segmento' : 'Nuovo sotto-segmento'}</h2>
        </div>
        <div className="px-6 py-5 space-y-4">
          <div>
            <label className={labelCls}>Segmento *</label>
            <select className={inputCls} value={segmentId} onChange={(e) => setSegmentId(e.target.value)}>
              <option value="">Seleziona segmento</option>
              {segments.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
          <div>
            <label className={labelCls}>Nome *</label>
            <input className={inputCls} value={name} onChange={(e) => setName(e.target.value)} placeholder="es. Relax in spiaggia" />
          </div>
          <div>
            <label className={labelCls}>Testo italiano</label>
            <input className={inputCls} value={textIt} onChange={(e) => setTextIt(e.target.value)} placeholder="Descrizione visualizzata sulla splash" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelCls}>Data inizio</label>
              <input type="date" className={inputCls} value={dateStart} onChange={(e) => setDateStart(e.target.value)} />
            </div>
            <div>
              <label className={labelCls}>Data fine</label>
              <input type="date" className={inputCls} value={dateEnd} onChange={(e) => setDateEnd(e.target.value)} />
            </div>
          </div>
          <div className="flex items-center gap-6">
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Ricorrente</label>
              <button type="button" onClick={() => setRecurring((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${recurring ? 'bg-brand-500' : 'bg-gray-300'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${recurring ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
            <div className="flex items-center gap-2">
              <label className="text-sm font-medium text-gray-700">Abilitato</label>
              <button type="button" onClick={() => setEnabled((v) => !v)}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${enabled ? 'bg-brand-500' : 'bg-gray-300'}`}>
                <span className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${enabled ? 'translate-x-6' : 'translate-x-1'}`} />
              </button>
            </div>
          </div>
          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annulla</button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg disabled:opacity-60"
          >
            {saving ? 'Salvataggio...' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Pagination ───────────────────────────────────────────────────────────────

function Pagination({
  page, total, limit, onChange,
}: { page: number; total: number; limit: number; onChange: (p: number) => void }) {
  const pages = Math.ceil(total / limit) || 1;
  return (
    <div className="flex items-center justify-between px-4 py-3 border-t border-gray-100 text-sm text-gray-500">
      <span>Righe totali: {total}</span>
      <div className="flex items-center gap-1">
        <button onClick={() => onChange(Math.max(1, page - 1))} disabled={page === 1}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-40">
          <ChevronLeft className="w-4 h-4" />
        </button>
        {Array.from({ length: pages }, (_, i) => i + 1).map((p) => (
          <button key={p} onClick={() => onChange(p)}
            className={`w-7 h-7 rounded text-xs font-medium ${p === page ? 'bg-brand-500 text-white' : 'hover:bg-gray-100'}`}>
            {p}
          </button>
        ))}
        <button onClick={() => onChange(Math.min(pages, page + 1))} disabled={page === pages}
          className="p-1 rounded hover:bg-gray-100 disabled:opacity-40">
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

const LIMIT = 25;

export default function SegmentsPage() {
  const [segments, setSegments] = useState<Segment[]>([]);
  const [segTotal, setSegTotal] = useState(0);
  const [segPage, setSegPage] = useState(1);

  const [subSegments, setSubSegments] = useState<SubSegment[]>([]);
  const [subTotal, setSubTotal] = useState(0);
  const [subPage, setSubPage] = useState(1);

  const [segModal, setSegModal] = useState<Segment | null | 'new'>(null);
  const [subModal, setSubModal] = useState<SubSegment | null | 'new'>(null);

  const [deleteSegId, setDeleteSegId] = useState<string | null>(null);
  const [deleteSubId, setDeleteSubId] = useState<string | null>(null);

  const loadSegments = useCallback(async () => {
    const { data } = await api.get('/segments', { params: { page: segPage, limit: LIMIT } });
    setSegments(data.segments);
    setSegTotal(data.total);
  }, [segPage]);

  const loadSubSegments = useCallback(async () => {
    const { data } = await api.get('/segments/sub-segments', { params: { page: subPage, limit: LIMIT } });
    setSubSegments(data.subSegments);
    setSubTotal(data.total);
  }, [subPage]);

  useEffect(() => { loadSegments(); }, [loadSegments]);
  useEffect(() => { loadSubSegments(); }, [loadSubSegments]);

  const toggleSegment = useCallback(async (seg: Segment) => {
    await api.patch(`/segments/${seg.id}`, { name: seg.name, priority: seg.priority, enabled: !seg.enabled });
    loadSegments();
  }, [loadSegments]);

  const toggleSubSegment = useCallback(async (sub: SubSegment) => {
    await api.patch(`/segments/sub-segments/${sub.id}`, {
      segment_id: sub.segmentId, name: sub.name, text_it: sub.textIt,
      date_start: sub.dateStart, date_end: sub.dateEnd, recurring: sub.recurring, enabled: !sub.enabled,
    });
    loadSubSegments();
  }, [loadSubSegments]);

  const deleteSeg = useCallback(async () => {
    if (!deleteSegId) return;
    await api.delete(`/segments/${deleteSegId}`);
    setDeleteSegId(null);
    setSubModal(null); // close sub modal if open — parent segment is gone
    loadSegments();
    loadSubSegments();
  }, [deleteSegId, loadSegments, loadSubSegments]);

  const deleteSub = useCallback(async () => {
    if (!deleteSubId) return;
    await api.delete(`/segments/sub-segments/${deleteSubId}`);
    setDeleteSubId(null);
    loadSubSegments();
  }, [deleteSubId, loadSubSegments]);

  return (
    <div className="p-6 space-y-8">
      {/* ── Segments ────────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h1 className="text-xl font-bold text-gray-900">Segmenti Utenti</h1>
            <p className="text-sm text-gray-500 mt-0.5">Gestione segmenti (tipologia di vacanza)</p>
          </div>
          <button
            onClick={() => setSegModal('new')}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Aggiungi
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Segmento</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Priorità</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Abilitato</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {segments.length === 0 && (
                <tr><td colSpan={4} className="px-4 py-8 text-center text-gray-400">Nessun segmento configurato</td></tr>
              )}
              {segments.map((seg) => (
                <tr key={seg.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{seg.name}</td>
                  <td className="px-4 py-3 text-gray-600">{seg.priority}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${seg.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {seg.enabled ? 'Sì' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => toggleSegment(seg)} title={seg.enabled ? 'Disabilita' : 'Abilita'}
                        className="p-1.5 text-gray-400 hover:text-brand-500 rounded">
                        {seg.enabled ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button onClick={() => setSegModal(seg)} title="Modifica"
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteSegId(seg.id)} title="Elimina"
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={segPage} total={segTotal} limit={LIMIT} onChange={setSegPage} />
      </div>

      {/* ── Sub-segments ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100">
        <div className="flex items-start justify-between px-6 py-5 border-b border-gray-100">
          <div>
            <h2 className="text-lg font-bold text-gray-900">Sotto-Segmenti</h2>
            <p className="text-sm text-gray-500 mt-0.5">Proposti nelle pagine di registrazione</p>
          </div>
          <button
            onClick={() => setSubModal('new')}
            className="flex items-center gap-1.5 px-4 py-2 bg-green-500 hover:bg-green-600 text-white text-sm font-semibold rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4" /> Aggiungi
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Sotto-segmento</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Segmento</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Testo italiano</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Dal</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Al</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Ricorrente</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Online</th>
                <th className="px-4 py-3 text-left font-semibold text-gray-600">Attivo</th>
                <th className="px-4 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {subSegments.length === 0 && (
                <tr><td colSpan={9} className="px-4 py-8 text-center text-gray-400">Nessun sotto-segmento configurato</td></tr>
              )}
              {subSegments.map((sub) => (
                <tr key={sub.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 font-medium text-gray-900">{sub.name}</td>
                  <td className="px-4 py-3 text-gray-600">{sub.segmentName}</td>
                  <td className="px-4 py-3 text-gray-500 max-w-xs truncate">{sub.textIt ?? '—'}</td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(sub.dateStart)}</td>
                  <td className="px-4 py-3 text-gray-500">{fmtDate(sub.dateEnd)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium ${sub.recurring ? 'text-blue-600' : 'text-gray-400'}`}>
                      {sub.recurring ? 'Sì' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-gray-600 font-medium">{sub.online}</td>
                  <td className="px-4 py-3">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${sub.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                      {sub.enabled ? 'Sì' : 'No'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 justify-end">
                      <button onClick={() => toggleSubSegment(sub)} title={sub.enabled ? 'Disabilita' : 'Abilita'}
                        className="p-1.5 text-gray-400 hover:text-brand-500 rounded">
                        {sub.enabled ? <ToggleRight className="w-5 h-5 text-green-500" /> : <ToggleLeft className="w-5 h-5" />}
                      </button>
                      <button onClick={() => setSubModal(sub)} title="Modifica"
                        className="p-1.5 text-gray-400 hover:text-blue-600 rounded">
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button onClick={() => setDeleteSubId(sub.id)} title="Elimina"
                        className="p-1.5 text-gray-400 hover:text-red-600 rounded">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination page={subPage} total={subTotal} limit={LIMIT} onChange={setSubPage} />
      </div>

      {/* ── Modals ──────────────────────────────────────────────────────────── */}

      {segModal !== null && (
        <SegmentModal
          initial={segModal === 'new' ? null : segModal}
          onClose={() => setSegModal(null)}
          onSaved={() => { setSegModal(null); loadSegments(); }}
        />
      )}

      {subModal !== null && (
        <SubSegmentModal
          initial={subModal === 'new' ? null : subModal}
          segments={segments}
          onClose={() => setSubModal(null)}
          onSaved={() => { setSubModal(null); loadSubSegments(); }}
        />
      )}

      {/* ── Delete confirms ──────────────────────────────────────────────────── */}

      {deleteSegId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <p className="font-semibold text-gray-900">Eliminare il segmento?</p>
            <p className="text-sm text-gray-500">Verranno eliminati anche tutti i sotto-segmenti associati.</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteSegId(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annulla</button>
              <button onClick={deleteSeg} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg">Elimina</button>
            </div>
          </div>
        </div>
      )}

      {deleteSubId && (
        <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-sm p-6 text-center space-y-4">
            <p className="font-semibold text-gray-900">Eliminare il sotto-segmento?</p>
            <div className="flex gap-3 justify-center">
              <button onClick={() => setDeleteSubId(null)} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annulla</button>
              <button onClick={deleteSub} className="px-4 py-2 bg-red-500 hover:bg-red-600 text-white text-sm font-semibold rounded-lg">Elimina</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

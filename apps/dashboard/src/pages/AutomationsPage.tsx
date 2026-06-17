import { useState, useCallback, useEffect } from 'react';
import { Zap, Plus, Trash2, X, RefreshCw, FileText, GripVertical } from 'lucide-react';
import api from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

interface Block {
  id: string;
  type: string;
  content?: string;
  text?: string;
  url?: string;
  color?: string;
  alt?: string;
  link?: string | null;
}

interface Automation {
  id: string;
  siteId: string | null;
  name: string;
  subject: string;
  blocks: Block[];
  triggerType: string;
  triggerConfig: Record<string, unknown>;
  delayHours: number;
  enabled: boolean;
  createdAt: string;
}

interface Site { id: string; name: string; primaryColor: string; logoUrl: string | null; }
interface Segment { id: string; name: string; subSegments?: { id: string; name: string }[]; }

const TRIGGER_LABELS: Record<string, string> = {
  welcome: 'Benvenuto (dopo WiFi)',
  anniversary: 'Anniversario ospite',
  inactivity: 'Inattività prolungata',
  survey_done: 'Dopo survey completata',
  segment_enter: 'Ingresso in segmento',
};

const DELAY_OPTIONS = [
  { label: 'Immediato', value: 0 },
  { label: '1 ora', value: 1 },
  { label: '6 ore', value: 6 },
  { label: '24 ore', value: 24 },
  { label: '48 ore', value: 48 },
  { label: '1 settimana', value: 168 },
];

const BLOCK_LABELS: Record<string, string> = {
  text: 'Testo', button: 'Pulsante', divider: 'Separatore', image: 'Immagine',
};

// ─── Inline block editor (semplificato) ──────────────────────────────────────

function MiniBlockEditor({
  blocks, onChange, primaryColor
}: {
  blocks: Block[];
  onChange: (b: Block[]) => void;
  primaryColor: string;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);

  const uid = () => Math.random().toString(36).slice(2);

  const makeBlock = (type: string): Block => {
    const base = { id: uid(), type };
    if (type === 'text') return { ...base, content: '<p>Testo...</p>' };
    if (type === 'button') return { ...base, text: 'Clicca qui', url: 'https://', color: primaryColor };
    if (type === 'image') return { ...base, url: '', alt: '', link: null };
    return base;
  };

  const updateBlock = (updated: Block) =>
    onChange(blocks.map(b => b.id === updated.id ? updated : b));

  const removeBlock = (id: string) => {
    onChange(blocks.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const addBlock = (type: string) => {
    const b = makeBlock(type);
    onChange([...blocks, b]);
    setSelectedId(b.id);
    setShowAddMenu(false);
  };

  const handleDragStart = (e: React.DragEvent, i: number) => {
    setDragIndex(i);
    e.dataTransfer.effectAllowed = 'move';
  };
  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    setDropIndex(i);
  };
  const handleDrop = (e: React.DragEvent, ti: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === ti) { setDragIndex(null); setDropIndex(null); return; }
    const arr = [...blocks];
    const [m] = arr.splice(dragIndex, 1);
    arr.splice(ti, 0, m);
    onChange(arr);
    setDragIndex(null);
    setDropIndex(null);
  };

  const selected = blocks.find(b => b.id === selectedId) ?? null;
  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400';

  return (
    <div className="flex flex-col gap-3 h-full">
      <div className="relative">
        <button
          onClick={() => setShowAddMenu(v => !v)}
          className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg"
        >
          <Plus className="w-4 h-4" /> Aggiungi blocco
        </button>
        {showAddMenu && (
          <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-36 py-1">
            {['text', 'button', 'divider', 'image'].map(t => (
              <button key={t} onClick={() => addBlock(t)}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                {BLOCK_LABELS[t]}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="flex gap-3 flex-1 min-h-0">
        {/* Block list */}
        <div className="w-48 shrink-0 flex flex-col gap-1.5 overflow-y-auto">
          {blocks.length === 0 && (
            <div className="text-center py-8 text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
              Nessun blocco
            </div>
          )}
          {blocks.map((b, i) => (
            <div
              key={b.id}
              draggable
              onDragStart={e => handleDragStart(e, i)}
              onDragOver={e => handleDragOver(e, i)}
              onDrop={e => handleDrop(e, i)}
              onDragEnd={() => { setDragIndex(null); setDropIndex(null); }}
              onClick={() => setSelectedId(b.id)}
              className={`flex items-center gap-2 px-2.5 py-2 rounded-lg cursor-pointer border transition-all select-none
                ${selectedId === b.id ? 'border-brand-400 bg-brand-50' : 'border-gray-100 bg-white hover:border-gray-200'}
                ${dropIndex === i && dragIndex !== i ? 'border-t-2 border-t-brand-400' : ''}
                ${dragIndex === i ? 'opacity-40' : ''}`}
            >
              <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0" />
              <span className="text-xs text-gray-700 font-medium flex-1 truncate">{BLOCK_LABELS[b.type] || b.type}</span>
              <button onClick={e => { e.stopPropagation(); removeBlock(b.id); }}
                className="p-0.5 text-gray-300 hover:text-red-500 transition-colors">
                <Trash2 className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>

        {/* Block properties */}
        <div className="flex-1 min-w-0 overflow-y-auto">
          {selected ? (
            <div className="space-y-4">
              {selected.type === 'text' && (
                <>
                  <label className="block text-sm font-medium text-gray-700">Contenuto HTML</label>
                  <textarea
                    rows={8}
                    value={selected.content || ''}
                    onChange={e => updateBlock({ ...selected, content: e.target.value })}
                    placeholder="<p>Testo...</p>"
                    className={inp + ' font-mono text-xs resize-none'}
                  />
                  <p className="text-xs text-gray-400">HTML semplice: p, strong, em, br, a href</p>
                </>
              )}
              {selected.type === 'button' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Testo pulsante</label>
                    <input type="text" value={selected.text || ''} onChange={e => updateBlock({ ...selected, text: e.target.value })} className={inp} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL</label>
                    <input type="url" value={selected.url || ''} onChange={e => updateBlock({ ...selected, url: e.target.value })} className={inp} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Colore</label>
                    <div className="flex items-center gap-2">
                      <input type="color" value={selected.color || primaryColor} onChange={e => updateBlock({ ...selected, color: e.target.value })}
                        className="w-10 h-9 border border-gray-200 rounded-lg cursor-pointer p-0.5" />
                      <span className="text-sm text-gray-500">{selected.color || primaryColor}</span>
                    </div>
                  </div>
                </div>
              )}
              {selected.type === 'image' && (
                <div className="space-y-3">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">URL immagine</label>
                    <input type="url" value={selected.url || ''} onChange={e => updateBlock({ ...selected, url: e.target.value })} className={inp} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Alt text</label>
                    <input type="text" value={selected.alt || ''} onChange={e => updateBlock({ ...selected, alt: e.target.value })} className={inp} />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Link (opzionale)</label>
                    <input type="url" value={selected.link || ''} onChange={e => updateBlock({ ...selected, link: e.target.value || null })} className={inp} />
                  </div>
                </div>
              )}
              {selected.type === 'divider' && (
                <p className="text-sm text-gray-400 py-4 text-center">Separatore — nessuna opzione</p>
              )}
            </div>
          ) : (
            <div className="flex items-center justify-center h-full text-gray-400 text-sm">
              Seleziona un blocco per modificarlo
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Automation Modal ─────────────────────────────────────────────────────────

function AutomationModal({
  automation, sites, segments, onClose, onSaved,
}: {
  automation: Automation | null;
  sites: Site[];
  segments: Segment[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !automation;
  const [tab, setTab] = useState<'settings' | 'content'>('settings');
  const [name, setName] = useState(automation?.name || '');
  const [subject, setSubject] = useState(automation?.subject || '');
  const [siteId, setSiteId] = useState(automation?.siteId || sites[0]?.id || '');
  const [triggerType, setTriggerType] = useState(automation?.triggerType || 'welcome');
  const [delayHours, setDelayHours] = useState(automation?.delayHours ?? 0);
  const [enabled, setEnabled] = useState(automation?.enabled ?? true);
  const [blocks, setBlocks] = useState<Block[]>(automation?.blocks || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const site = sites.find(s => s.id === siteId);
  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400';

  const handleSave = async () => {
    if (!name.trim()) { setError('Il nome è obbligatorio'); return; }
    setSaving(true);
    setError(null);
    const payload = {
      site_id: siteId || null,
      name, subject, blocks,
      trigger_type: triggerType,
      trigger_config: {},
      delay_hours: delayHours,
      enabled,
    };
    try {
      if (isNew) await api.post('/automations', payload);
      else await api.patch(`/automations/${automation!.id}`, payload);
      onSaved();
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl h-[80vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <h2 className="font-bold text-gray-900">
            {isNew ? 'Nuova automazione' : 'Modifica automazione'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 shrink-0">
          {(['settings', 'content'] as const).map(t => (
            <button key={t} onClick={() => setTab(t)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${tab === t ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'settings' ? 'Impostazioni' : 'Contenuto email'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-y-auto px-6 py-4">
          {tab === 'settings' && (
            <div className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)} className={inp} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Oggetto email</label>
                  <input type="text" value={subject} onChange={e => setSubject(e.target.value)} className={inp} />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sito</label>
                <select value={siteId} onChange={e => setSiteId(e.target.value)} className={inp}>
                  <option value="">Tutti i siti</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Trigger</label>
                  <select value={triggerType} onChange={e => setTriggerType(e.target.value)} className={inp}>
                    {Object.entries(TRIGGER_LABELS).map(([k, v]) => (
                      <option key={k} value={k}>{v}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Ritardo invio</label>
                  <select value={delayHours} onChange={e => setDelayHours(Number(e.target.value))} className={inp}>
                    {DELAY_OPTIONS.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3 p-4 border border-gray-100 rounded-xl">
                <div className="flex-1">
                  <p className="text-sm font-medium text-gray-700">Automazione attiva</p>
                  <p className="text-xs text-gray-400 mt-0.5">Se disattivata, nessuna email verrà inviata</p>
                </div>
                <button
                  onClick={() => setEnabled(v => !v)}
                  className={`relative w-11 h-6 rounded-full transition-colors ${enabled ? 'bg-brand-500' : 'bg-gray-200'}`}
                >
                  <span className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full shadow transition-transform ${enabled ? 'translate-x-5' : ''}`} />
                </button>
              </div>
            </div>
          )}

          {tab === 'content' && (
            <div className="h-full flex flex-col">
              <MiniBlockEditor
                blocks={blocks}
                onChange={setBlocks}
                primaryColor={site?.primaryColor || '#0055ff'}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-5 pt-3 border-t border-gray-100 shrink-0">
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="ml-auto flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">
              Annulla
            </button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
              {saving ? 'Salvataggio...' : 'Salva'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AutomationsPage() {
  const [automations, setAutomations] = useState<Automation[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Automation | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [aRes, sRes, segRes] = await Promise.all([
        api.get('/automations'),
        api.get('/sites'),
        api.get('/segments/full'),
      ]);
      setAutomations(aRes.data.items || []);
      setSites(sRes.data || []);
      setSegments(segRes.data || []);
    } catch {
      /* silent */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const toggleEnabled = async (a: Automation) => {
    await api.patch(`/automations/${a.id}`, {
      site_id: a.siteId,
      name: a.name,
      subject: a.subject,
      blocks: a.blocks,
      trigger_type: a.triggerType,
      trigger_config: a.triggerConfig,
      delay_hours: a.delayHours,
      enabled: !a.enabled,
    });
    loadAll();
  };

  const handleDelete = async (a: Automation) => {
    if (!confirm(`Eliminare "${a.name}"?`)) return;
    await api.delete(`/automations/${a.id}`);
    loadAll();
  };

  const siteName = (id: string | null) =>
    sites.find(s => s.id === id)?.name ?? 'Tutti i siti';

  return (
    <div className="p-6 max-w-5xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Automazioni</h1>
          <p className="text-sm text-gray-500 mt-0.5">Email automatiche basate su comportamenti degli ospiti</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAll} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw className="w-4 h-4" />
          </button>
          <button
            onClick={() => { setEditing(null); setModalOpen(true); }}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" /> Nuova automazione
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2" /> Caricamento...
        </div>
      ) : automations.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Zap className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="font-medium">Nessuna automazione</p>
          <p className="text-sm mt-1">Crea automazioni per inviare email al momento giusto</p>
        </div>
      ) : (
        <div className="space-y-3">
          {automations.map(a => (
            <div key={a.id} className="bg-white border border-gray-100 rounded-2xl p-4 flex items-center gap-4 shadow-sm hover:shadow-md transition-shadow">
              <div className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 ${a.enabled ? 'bg-brand-50' : 'bg-gray-50'}`}>
                <Zap className={`w-5 h-5 ${a.enabled ? 'text-brand-500' : 'text-gray-300'}`} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-medium text-gray-900 text-sm">{a.name}</p>
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${a.enabled ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {a.enabled ? 'Attiva' : 'Disattivata'}
                  </span>
                </div>
                <p className="text-xs text-gray-400 mt-0.5">
                  {TRIGGER_LABELS[a.triggerType] || a.triggerType}
                  {a.delayHours > 0 && ` · ${a.delayHours}h ritardo`}
                  {' · '}{siteName(a.siteId)}
                </p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => toggleEnabled(a)}
                  className={`relative w-10 h-5 rounded-full transition-colors ${a.enabled ? 'bg-brand-500' : 'bg-gray-200'}`}
                  title={a.enabled ? 'Disattiva' : 'Attiva'}
                >
                  <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${a.enabled ? 'translate-x-5' : ''}`} />
                </button>
                <button
                  onClick={() => { setEditing(a); setModalOpen(true); }}
                  className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                  title="Modifica"
                >
                  <FileText className="w-4 h-4" />
                </button>
                <button
                  onClick={() => handleDelete(a)}
                  className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                  title="Elimina"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {modalOpen && (
        <AutomationModal
          automation={editing}
          sites={sites}
          segments={segments}
          onClose={() => { setModalOpen(false); setEditing(null); }}
          onSaved={() => { setModalOpen(false); setEditing(null); loadAll(); }}
        />
      )}
    </div>
  );
}

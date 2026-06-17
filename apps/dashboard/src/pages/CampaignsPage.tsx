import { useState, useCallback, useEffect } from 'react';
import {
  Send, Plus, Trash2, GripVertical, Eye, Calendar,
  Type, Link2, Minus, ImageIcon, X, CheckCircle,
  Clock, AlertCircle, FileText, RefreshCw, Users, ChevronDown
} from 'lucide-react';
import api from '../api/client';

// ─── Types ────────────────────────────────────────────────────────────────────

type BlockType = 'text' | 'button' | 'divider' | 'image';

interface Block {
  id: string;
  type: BlockType;
  content?: string;   // text
  text?: string;      // button label
  url?: string;       // button/image link
  color?: string;     // button color
  alt?: string;       // image alt
  link?: string | null; // image link
}

interface Campaign {
  id: string;
  siteId: string | null;
  name: string;
  subject: string;
  blocks: Block[];
  status: 'draft' | 'scheduled' | 'sending' | 'sent' | 'cancelled';
  audienceType: string;
  audienceSegmentId: string | null;
  audienceSubSegmentId: string | null;
  totalRecipients: number;
  sentCount: number;
  failedCount: number;
  scheduledAt: string | null;
  sentAt: string | null;
  createdAt: string;
}

interface Site { id: string; name: string; primaryColor: string; logoUrl: string | null; }
interface Segment { id: string; name: string; subSegments?: { id: string; name: string }[]; }

// ─── Helpers ─────────────────────────────────────────────────────────────────

const uid = () => Math.random().toString(36).slice(2);

const STATUS_LABELS: Record<string, string> = {
  draft: 'Bozza', scheduled: 'Pianificata', sending: 'In invio',
  sent: 'Inviata', cancelled: 'Annullata',
};

const STATUS_COLOR: Record<string, string> = {
  draft: 'bg-gray-100 text-gray-600',
  scheduled: 'bg-blue-100 text-blue-700',
  sending: 'bg-yellow-100 text-yellow-700',
  sent: 'bg-green-100 text-green-700',
  cancelled: 'bg-red-100 text-red-600',
};

const AUDIENCE_LABELS: Record<string, string> = {
  all: 'Tutti gli ospiti',
  segment: 'Per segmento',
  sub_segment: 'Per sotto-segmento',
  marketing_consent: 'Con consenso marketing',
};

function newBlock(type: BlockType): Block {
  const base = { id: uid(), type };
  if (type === 'text') return { ...base, content: '<p>Scrivi il tuo testo qui...</p>' };
  if (type === 'button') return { ...base, text: 'Scopri di più', url: 'https://', color: '#0055ff' };
  if (type === 'image') return { ...base, url: '', alt: '', link: null };
  return base; // divider
}

// ─── Preview HTML (generato localmente) ───────────────────────────────────────

function blocksToPreview(
  blocks: Block[],
  siteName: string,
  primaryColor: string,
  logoUrl: string | null,
): string {
  const escape = (s: string) => s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  const abs = (u: string) => u.startsWith('/') ? `${window.location.origin}${u}` : u;

  let headerHtml = '';
  if (logoUrl) {
    headerHtml = `<td style="background:${escape(primaryColor)};padding:24px 32px;text-align:center">
      <img src="${escape(abs(logoUrl))}" alt="${escape(siteName)}" style="max-height:120px;max-width:320px;display:block;margin:0 auto"/>
    </td>`;
  } else {
    headerHtml = `<td style="background:${escape(primaryColor)};padding:28px 32px;text-align:center">
      <span style="font-size:22px;font-weight:700;color:#fff">${escape(siteName || 'Anteprima')}</span>
    </td>`;
  }

  let body = `<table width="100%" cellpadding="0" cellspacing="0"><tr>${headerHtml}</tr></table>
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:16px"></td></tr></table>`;

  for (const b of blocks) {
    if (b.type === 'text') {
      body += `<table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="padding:12px 32px;font-size:15px;line-height:1.6;color:#374151">${b.content || ''}</td>
      </tr></table>`;
    } else if (b.type === 'button') {
      body += `<table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="padding:12px 32px;text-align:center">
          <a style="display:inline-block;background:${escape(b.color||primaryColor)};color:#fff;padding:14px 32px;border-radius:8px;font-size:15px;font-weight:600;text-decoration:none">
            ${escape(b.text||'Clicca qui')}
          </a>
        </td>
      </tr></table>`;
    } else if (b.type === 'divider') {
      body += `<table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="padding:12px 32px"><hr style="border:none;border-top:1px solid #e5e7eb;margin:0"/></td>
      </tr></table>`;
    } else if (b.type === 'image' && b.url) {
      const img = `<img src="${escape(b.url)}" alt="${escape(b.alt||'')}" style="max-width:100%;border-radius:8px;display:block;margin:0 auto"/>`;
      body += `<table width="100%" cellpadding="0" cellspacing="0"><tr>
        <td style="padding:12px 32px;text-align:center">
          ${b.link ? `<a href="${escape(b.link)}">${img}</a>` : img}
        </td>
      </tr></table>`;
    }
  }

  body += `<table width="100%" cellpadding="0" cellspacing="0"><tr><td style="height:16px"></td></tr></table>`;
  body += `<table width="100%" cellpadding="0" cellspacing="0"><tr>
    <td style="background:#f9fafb;padding:20px 32px;text-align:center;font-size:12px;color:#9ca3af;border-top:1px solid #e5e7eb">
      ${escape(siteName || 'Authwifi')} · <a href="https://authwifi.it" style="color:#ccc">Powered by Authwifi</a>
    </td>
  </tr></table>`;

  return `<!DOCTYPE html><html><head><meta charset="utf-8"/>
    <style>body{margin:0;background:#f0f4f8;font-family:Arial,sans-serif;color-scheme:light}</style>
    </head><body>
    <div style="padding:32px 16px">
    <table style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.08)" width="100%" cellpadding="0" cellspacing="0">
    <tr><td>${body}</td></tr>
    </table></div></body></html>`;
}

// ─── BlockEditor ─────────────────────────────────────────────────────────────

function BlockEditor({
  blocks, onChange, primaryColor, siteName, logoUrl
}: {
  blocks: Block[];
  onChange: (b: Block[]) => void;
  primaryColor: string;
  siteName: string;
  logoUrl: string | null;
}) {
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddMenu, setShowAddMenu] = useState(false);
  const [preview, setPreview] = useState(false);
  const [dragIndex, setDragIndex] = useState<number | null>(null);
  const [dropIndex, setDropIndex] = useState<number | null>(null);
  const previewHtml = blocksToPreview(blocks, siteName, primaryColor, logoUrl);

  const selected = blocks.find(b => b.id === selectedId) ?? null;

  const updateBlock = (updated: Block) => {
    onChange(blocks.map(b => b.id === updated.id ? updated : b));
  };

  const removeBlock = (id: string) => {
    onChange(blocks.filter(b => b.id !== id));
    if (selectedId === id) setSelectedId(null);
  };

  const addBlock = (type: BlockType) => {
    const b = newBlock(type);
    onChange([...blocks, b]);
    setSelectedId(b.id);
    setShowAddMenu(false);
  };

  // Drag & drop
  const handleDragStart = (e: React.DragEvent, i: number) => {
    setDragIndex(i);
    e.dataTransfer.effectAllowed = 'move';
    e.dataTransfer.setData('text/plain', String(i));
  };

  const handleDragOver = (e: React.DragEvent, i: number) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
    setDropIndex(i);
  };

  const handleDrop = (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (dragIndex === null || dragIndex === targetIndex) { setDragIndex(null); setDropIndex(null); return; }
    const arr = [...blocks];
    const [moved] = arr.splice(dragIndex, 1);
    arr.splice(targetIndex, 0, moved);
    onChange(arr);
    setDragIndex(null);
    setDropIndex(null);
  };

  const BLOCK_ICONS: Record<BlockType, React.ReactNode> = {
    text: <Type className="w-3.5 h-3.5"/>,
    button: <Link2 className="w-3.5 h-3.5"/>,
    divider: <Minus className="w-3.5 h-3.5"/>,
    image: <ImageIcon className="w-3.5 h-3.5"/>,
  };
  const BLOCK_LABELS: Record<BlockType, string> = {
    text: 'Testo', button: 'Pulsante', divider: 'Separatore', image: 'Immagine',
  };

  return (
    <div className="flex flex-col gap-3 h-full">
      {/* Toolbar */}
      <div className="flex items-center gap-2">
        <div className="relative">
          <button
            onClick={() => setShowAddMenu(v => !v)}
            className="flex items-center gap-1.5 px-3 py-1.5 bg-brand-500 hover:bg-brand-600 text-white text-sm font-medium rounded-lg transition-colors"
          >
            <Plus className="w-4 h-4"/> Aggiungi blocco <ChevronDown className="w-3.5 h-3.5"/>
          </button>
          {showAddMenu && (
            <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 min-w-40 py-1">
              {(['text','button','divider','image'] as BlockType[]).map(t => (
                <button key={t} onClick={() => addBlock(t)}
                  className="flex items-center gap-2 w-full px-3 py-2 text-sm text-gray-700 hover:bg-gray-50">
                  {BLOCK_ICONS[t]} {BLOCK_LABELS[t]}
                </button>
              ))}
            </div>
          )}
        </div>
        <button onClick={() => setPreview(v => !v)}
          className={`flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-lg border transition-colors
            ${preview ? 'bg-gray-900 text-white border-gray-900' : 'text-gray-600 border-gray-200 hover:bg-gray-50'}`}>
          <Eye className="w-4 h-4"/> {preview ? 'Modifica' : 'Anteprima'}
        </button>
      </div>

      {preview ? (
        /* Preview pane */
        <div className="flex-1 rounded-xl overflow-hidden border border-gray-200">
          <iframe srcDoc={previewHtml} className="w-full h-full border-0" title="Anteprima email"/>
        </div>
      ) : (
        /* Editor pane */
        <div className="flex gap-3 flex-1 min-h-0">
          {/* Block list */}
          <div className="w-56 shrink-0 flex flex-col gap-1.5 overflow-y-auto pr-1">
            {blocks.length === 0 && (
              <div className="flex flex-col items-center justify-center py-10 text-center text-gray-400 text-sm border-2 border-dashed border-gray-200 rounded-xl">
                <FileText className="w-8 h-8 mb-2 opacity-40"/>
                Nessun blocco.<br/>Aggiungi uno.
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
                <GripVertical className="w-3.5 h-3.5 text-gray-300 shrink-0 cursor-grab"/>
                <span className="text-gray-500 shrink-0">{BLOCK_ICONS[b.type]}</span>
                <span className="text-xs text-gray-700 font-medium truncate flex-1">{BLOCK_LABELS[b.type]}</span>
                <button onClick={e => { e.stopPropagation(); removeBlock(b.id); }}
                  className="p-0.5 text-gray-300 hover:text-red-500 transition-colors shrink-0">
                  <Trash2 className="w-3.5 h-3.5"/>
                </button>
              </div>
            ))}
          </div>

          {/* Block editor */}
          <div className="flex-1 min-w-0 overflow-y-auto">
            {selected ? (
              <BlockForm block={selected} onChange={updateBlock} primaryColor={primaryColor}/>
            ) : (
              <div className="flex items-center justify-center h-full text-gray-400 text-sm">
                Seleziona un blocco per modificarlo
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── BlockForm ────────────────────────────────────────────────────────────────

function BlockForm({ block, onChange, primaryColor }: {
  block: Block; onChange: (b: Block) => void; primaryColor: string;
}) {
  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400';

  if (block.type === 'text') return (
    <div className="space-y-3">
      <label className="block text-sm font-medium text-gray-700">Contenuto HTML</label>
      <textarea
        rows={10}
        value={block.content || ''}
        onChange={e => onChange({ ...block, content: e.target.value })}
        placeholder="<p>Testo...</p>"
        className={inp + ' font-mono text-xs resize-none'}
      />
      <p className="text-xs text-gray-400">Supporta HTML semplice: &lt;p&gt;, &lt;strong&gt;, &lt;em&gt;, &lt;br&gt;, &lt;a href&gt;</p>
    </div>
  );

  if (block.type === 'button') return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Testo pulsante</label>
        <input type="text" value={block.text || ''} onChange={e => onChange({ ...block, text: e.target.value })}
          placeholder="Scopri di più" className={inp}/>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">URL di destinazione</label>
        <input type="url" value={block.url || ''} onChange={e => onChange({ ...block, url: e.target.value })}
          placeholder="https://..." className={inp}/>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Colore pulsante</label>
        <div className="flex items-center gap-3">
          <input type="color" value={block.color || primaryColor} onChange={e => onChange({ ...block, color: e.target.value })}
            className="w-10 h-9 border border-gray-200 rounded-lg cursor-pointer p-0.5"/>
          <span className="text-sm text-gray-500">{block.color || primaryColor}</span>
          <button onClick={() => onChange({ ...block, color: primaryColor })}
            className="text-xs text-brand-500 hover:underline">Reset</button>
        </div>
      </div>
    </div>
  );

  if (block.type === 'divider') return (
    <div className="py-8 text-center text-gray-400 text-sm">
      <Minus className="w-6 h-6 mx-auto mb-2 opacity-40"/>
      Separatore orizzontale — nessuna opzione
    </div>
  );

  if (block.type === 'image') return (
    <div className="space-y-4">
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">URL immagine</label>
        <input type="url" value={block.url || ''} onChange={e => onChange({ ...block, url: e.target.value })}
          placeholder="https://..." className={inp}/>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Alt text</label>
        <input type="text" value={block.alt || ''} onChange={e => onChange({ ...block, alt: e.target.value })}
          placeholder="Descrizione immagine" className={inp}/>
      </div>
      <div>
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Link (opzionale)</label>
        <input type="url" value={block.link || ''} onChange={e => onChange({ ...block, link: e.target.value || null })}
          placeholder="https://..." className={inp}/>
      </div>
      {block.url && (
        <div className="rounded-xl overflow-hidden border border-gray-100 max-h-40">
          <img src={block.url} alt={block.alt} className="max-w-full object-cover"/>
        </div>
      )}
    </div>
  );

  return null;
}

// ─── Campaign Modal ───────────────────────────────────────────────────────────

function CampaignModal({
  campaign, sites, segments, onClose, onSaved
}: {
  campaign: Campaign | null;
  sites: Site[];
  segments: Segment[];
  onClose: () => void;
  onSaved: () => void;
}) {
  const isNew = !campaign;
  const [tab, setTab] = useState<'content' | 'settings'>('settings');
  const [name, setName] = useState(campaign?.name || '');
  const [subject, setSubject] = useState(campaign?.subject || '');
  const [siteId, setSiteId] = useState<string>(campaign?.siteId || sites[0]?.id || '');
  const [audienceType, setAudienceType] = useState(campaign?.audienceType || 'all');
  const [segmentId, setSegmentId] = useState(campaign?.audienceSegmentId || '');
  const [subSegmentId, setSubSegmentId] = useState(campaign?.audienceSubSegmentId || '');
  const [blocks, setBlocks] = useState<Block[]>(campaign?.blocks || []);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sending, setSending] = useState(false);
  const [scheduleOpen, setScheduleOpen] = useState(false);
  const [scheduledAt, setScheduledAt] = useState('');

  const site = sites.find(s => s.id === siteId);
  const selectedSegment = segments.find(s => s.id === segmentId);
  const subSegments = selectedSegment?.subSegments || [];

  const buildPayload = () => ({
    site_id: siteId || null,
    name, subject, blocks,
    audience_type: audienceType,
    audience_segment_id: audienceType === 'segment' ? segmentId || null : null,
    audience_sub_segment_id: audienceType === 'sub_segment' ? subSegmentId || null : null,
    scheduled_at: scheduledAt || null,
  });

  const handleSave = async () => {
    if (!name.trim()) { setError('Il nome è obbligatorio'); return; }
    setSaving(true); setError(null);
    try {
      if (isNew) await api.post('/campaigns', buildPayload());
      else await api.patch(`/campaigns/${campaign!.id}`, buildPayload());
      onSaved();
    } catch (e: unknown) {
      const msg = (e as {response?: {data?: {detail?: string}}})?.response?.data?.detail;
      setError(msg ?? 'Errore nel salvataggio');
    } finally { setSaving(false); }
  };

  const handleSendNow = async () => {
    if (!confirm('Inviare la campagna ora? L\'operazione non è reversibile.')) return;
    setSending(true); setError(null);
    try {
      // Prima salva
      if (isNew) {
        const res = await api.post('/campaigns', buildPayload());
        await api.post(`/campaigns/${res.data.id}/send-now`);
      } else {
        await api.patch(`/campaigns/${campaign!.id}`, buildPayload());
        await api.post(`/campaigns/${campaign!.id}/send-now`);
      }
      onSaved();
    } catch (e: unknown) {
      const msg = (e as {response?: {data?: {detail?: string}}})?.response?.data?.detail;
      setError(msg ?? 'Errore durante invio');
    } finally { setSending(false); }
  };

  const inp = 'w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-400';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-4xl h-[85vh] flex flex-col"
        onClick={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100 shrink-0">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-brand-50 rounded-xl flex items-center justify-center">
              <Send className="w-4.5 h-4.5 text-brand-600"/>
            </div>
            <div>
              <h2 className="font-bold text-gray-900">{isNew ? 'Nuova campagna' : 'Modifica campagna'}</h2>
              {campaign && <p className="text-xs text-gray-400">{STATUS_LABELS[campaign.status]}</p>}
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5"/>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 px-6 pt-3 shrink-0">
          {['settings','content'].map(t => (
            <button key={t} onClick={() => setTab(t as typeof tab)}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors
                ${tab === t ? 'bg-gray-100 text-gray-900' : 'text-gray-500 hover:text-gray-700'}`}>
              {t === 'settings' ? 'Impostazioni' : 'Contenuto email'}
            </button>
          ))}
        </div>

        {/* Body */}
        <div className="flex-1 min-h-0 overflow-hidden px-6 py-4">
          {tab === 'settings' && (
            <div className="h-full overflow-y-auto space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome campagna *</label>
                  <input type="text" value={name} onChange={e => setName(e.target.value)}
                    placeholder="Es. Newsletter giugno" className={inp}/>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1.5">Oggetto email *</label>
                  <input type="text" value={subject} onChange={e => setSubject(e.target.value)}
                    placeholder="Es. Offerta esclusiva per te!" className={inp}/>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Sito</label>
                <select value={siteId} onChange={e => setSiteId(e.target.value)} className={inp}>
                  <option value="">Tutti i siti del tenant</option>
                  {sites.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>

              <div className="border border-gray-100 rounded-xl p-4 space-y-3">
                <label className="block text-sm font-medium text-gray-700">
                  <Users className="w-4 h-4 inline mr-1.5 -mt-0.5"/>Audience
                </label>
                <select value={audienceType} onChange={e => setAudienceType(e.target.value)} className={inp}>
                  {Object.entries(AUDIENCE_LABELS).map(([k,v]) => <option key={k} value={k}>{v}</option>)}
                </select>

                {audienceType === 'segment' && (
                  <select value={segmentId} onChange={e => setSegmentId(e.target.value)} className={inp}>
                    <option value="">Seleziona segmento</option>
                    {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                )}

                {audienceType === 'sub_segment' && (
                  <>
                    <select value={segmentId} onChange={e => { setSegmentId(e.target.value); setSubSegmentId(''); }} className={inp}>
                      <option value="">Seleziona segmento</option>
                      {segments.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                    </select>
                    {subSegments.length > 0 && (
                      <select value={subSegmentId} onChange={e => setSubSegmentId(e.target.value)} className={inp}>
                        <option value="">Seleziona sotto-segmento</option>
                        {subSegments.map(ss => <option key={ss.id} value={ss.id}>{ss.name}</option>)}
                      </select>
                    )}
                  </>
                )}
              </div>

              {scheduleOpen && (
                <div className="border border-blue-100 bg-blue-50 rounded-xl p-4 space-y-2">
                  <label className="block text-sm font-medium text-blue-700">
                    <Calendar className="w-4 h-4 inline mr-1.5 -mt-0.5"/>Pianifica invio
                  </label>
                  <input type="datetime-local" value={scheduledAt} onChange={e => setScheduledAt(e.target.value)}
                    className={inp + ' bg-white'}/>
                </div>
              )}
            </div>
          )}

          {tab === 'content' && (
            <div className="h-full">
              <BlockEditor
                blocks={blocks}
                onChange={setBlocks}
                primaryColor={site?.primaryColor || '#0055ff'}
                siteName={site?.name || ''}
                logoUrl={site?.logoUrl || null}
              />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 pb-5 pt-3 border-t border-gray-100 shrink-0">
          <div className="flex gap-2">
            <button onClick={() => setScheduleOpen(v => !v)}
              className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors">
              <Calendar className="w-4 h-4"/> Pianifica
            </button>
          </div>
          {error && <p className="text-sm text-red-500">{error}</p>}
          <div className="flex gap-2">
            <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg">Annulla</button>
            <button onClick={handleSave} disabled={saving}
              className="px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
              {saving ? 'Salvataggio...' : 'Salva bozza'}
            </button>
            <button onClick={handleSendNow} disabled={sending || saving}
              className="flex items-center gap-1.5 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg disabled:opacity-60">
              <Send className="w-4 h-4"/> {sending ? 'Invio...' : 'Invia ora'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── Stats Modal ──────────────────────────────────────────────────────────────

function StatsModal({ campaign, onClose }: { campaign: Campaign; onClose: () => void }) {
  const [stats, setStats] = useState<{total:number;sent:number;failed:number;pending:number;status:string} | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get(`/campaigns/${campaign.id}/stats`)
      .then(r => setStats(r.data))
      .finally(() => setLoading(false));
  }, [campaign.id]);

  const rate = stats?.total ? Math.round((stats.sent / stats.total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-md" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 pt-5 pb-4 border-b border-gray-100">
          <h2 className="font-bold text-gray-900">Statistiche campagna</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100">
            <X className="w-5 h-5"/>
          </button>
        </div>
        <div className="px-6 py-5">
          {loading ? <p className="text-sm text-gray-400">Caricamento...</p> : stats ? (
            <div className="space-y-4">
              <p className="text-sm font-medium text-gray-700">{campaign.name}</p>
              <div className="grid grid-cols-4 gap-3">
                {[
                  { label:'Totale', val: stats.total, color: 'text-gray-700' },
                  { label:'Inviati', val: stats.sent, color: 'text-green-600' },
                  { label:'Falliti', val: stats.failed, color: 'text-red-500' },
                  { label:'In coda', val: stats.pending, color: 'text-yellow-600' },
                ].map(({ label, val, color }) => (
                  <div key={label} className="text-center bg-gray-50 rounded-xl p-3">
                    <p className={`text-2xl font-bold ${color}`}>{val}</p>
                    <p className="text-xs text-gray-500 mt-0.5">{label}</p>
                  </div>
                ))}
              </div>
              {stats.total > 0 && (
                <div>
                  <div className="flex justify-between text-xs text-gray-500 mb-1">
                    <span>Tasso di consegna</span><span>{rate}%</span>
                  </div>
                  <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                    <div className="h-full bg-green-500 rounded-full transition-all" style={{ width: `${rate}%` }}/>
                  </div>
                </div>
              )}
            </div>
          ) : <p className="text-sm text-gray-400">Dati non disponibili</p>}
        </div>
      </div>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [sites, setSites] = useState<Site[]>([]);
  const [segments, setSegments] = useState<Segment[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState<Campaign | null>(null);
  const [statsFor, setStatsFor] = useState<Campaign | null>(null);

  const loadAll = useCallback(async () => {
    setLoading(true);
    try {
      const [campRes, sitesRes, segRes] = await Promise.all([
        api.get('/campaigns'),
        api.get('/sites'),
        api.get('/segments/full'),
      ]);
      setCampaigns(campRes.data.items || []);
      setSites(sitesRes.data || []);
      setSegments(segRes.data || []);
    } catch {}
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadAll(); }, [loadAll]);

  const handleDelete = async (c: Campaign) => {
    if (!confirm(`Eliminare la campagna "${c.name}"?`)) return;
    await api.delete(`/campaigns/${c.id}`);
    loadAll();
  };

  const openNew = () => { setEditing(null); setModalOpen(true); };
  const openEdit = (c: Campaign) => { setEditing(c); setModalOpen(true); };
  const closeModal = () => { setModalOpen(false); setEditing(null); };
  const onSaved = () => { closeModal(); loadAll(); };

  const siteName = (id: string | null) => sites.find(s => s.id === id)?.name ?? '—';

  return (
    <div className="p-6 max-w-6xl mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Campagne email</h1>
          <p className="text-sm text-gray-500 mt-0.5">Crea e invia campagne email ai tuoi ospiti</p>
        </div>
        <div className="flex gap-2">
          <button onClick={loadAll} className="p-2 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            <RefreshCw className="w-4.5 h-4.5"/>
          </button>
          <button onClick={openNew}
            className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-xl transition-colors">
            <Plus className="w-4 h-4"/> Nuova campagna
          </button>
        </div>
      </div>

      {/* Table */}
      {loading ? (
        <div className="flex items-center justify-center py-20 text-gray-400">
          <RefreshCw className="w-5 h-5 animate-spin mr-2"/>Caricamento...
        </div>
      ) : campaigns.length === 0 ? (
        <div className="text-center py-20 text-gray-400">
          <Send className="w-12 h-12 mx-auto mb-3 opacity-30"/>
          <p className="font-medium">Nessuna campagna</p>
          <p className="text-sm">Crea la tua prima campagna email</p>
          <button onClick={openNew} className="mt-4 px-4 py-2 bg-brand-500 text-white text-sm rounded-xl hover:bg-brand-600">
            Inizia
          </button>
        </div>
      ) : (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-100 bg-gray-50">
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Campagna</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Sito</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Stato</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Destinatari</th>
                <th className="text-left text-xs font-semibold text-gray-500 px-4 py-3">Data</th>
                <th className="text-right text-xs font-semibold text-gray-500 px-4 py-3">Azioni</th>
              </tr>
            </thead>
            <tbody>
              {campaigns.map((c, i) => (
                <tr key={c.id} className={`border-b border-gray-50 hover:bg-gray-50 transition-colors ${i === campaigns.length-1 ? 'border-b-0' : ''}`}>
                  <td className="px-4 py-3">
                    <div>
                      <p className="font-medium text-gray-900 text-sm">{c.name}</p>
                      <p className="text-xs text-gray-400 truncate max-w-56">{c.subject || '—'}</p>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-600">{siteName(c.siteId)}</td>
                  <td className="px-4 py-3">
                    <span className={`text-xs font-medium px-2.5 py-1 rounded-full ${STATUS_COLOR[c.status] || 'bg-gray-100 text-gray-600'}`}>
                      {STATUS_LABELS[c.status] || c.status}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {c.totalRecipients > 0 ? (
                      <div className="text-sm">
                        <span className="text-green-600 font-medium">{c.sentCount}</span>
                        <span className="text-gray-400">/{c.totalRecipients}</span>
                        {c.failedCount > 0 && <span className="text-red-400 ml-1">({c.failedCount} err)</span>}
                      </div>
                    ) : <span className="text-sm text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {c.sentAt
                      ? new Date(c.sentAt).toLocaleDateString('it-IT')
                      : c.scheduledAt
                      ? `📅 ${new Date(c.scheduledAt).toLocaleDateString('it-IT')}`
                      : new Date(c.createdAt).toLocaleDateString('it-IT')
                    }
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      {['sent','sending'].includes(c.status) && (
                        <button onClick={() => setStatsFor(c)}
                          className="p-1.5 text-gray-400 hover:text-brand-500 hover:bg-brand-50 rounded-lg transition-colors" title="Statistiche">
                          <CheckCircle className="w-4 h-4"/>
                        </button>
                      )}
                      {['draft','scheduled'].includes(c.status) && (
                        <button onClick={() => openEdit(c)}
                          className="p-1.5 text-gray-400 hover:text-gray-700 hover:bg-gray-100 rounded-lg transition-colors" title="Modifica">
                          <FileText className="w-4 h-4"/>
                        </button>
                      )}
                      {!['sending'].includes(c.status) && (
                        <button onClick={() => handleDelete(c)}
                          className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors" title="Elimina">
                          <Trash2 className="w-4 h-4"/>
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {modalOpen && (
        <CampaignModal
          campaign={editing}
          sites={sites}
          segments={segments}
          onClose={closeModal}
          onSaved={onSaved}
        />
      )}
      {statsFor && <StatsModal campaign={statsFor} onClose={() => setStatsFor(null)}/>}
    </div>
  );
}

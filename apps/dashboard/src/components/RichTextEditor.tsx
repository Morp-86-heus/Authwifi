import { useRef, useEffect, useState, useCallback } from 'react';
import {
  Bold, Italic, Underline, Strikethrough, Link2, Link2Off,
  List, AlignLeft, AlignCenter, AlignRight,
} from 'lucide-react';

function Btn({
  title, active, onClick, children,
}: {
  title: string;
  active?: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={e => {
        e.preventDefault();
        onClick();
      }}
      className={`w-7 h-7 flex items-center justify-center rounded text-sm transition-colors
        ${active ? 'bg-brand-500 text-white' : 'text-gray-600 hover:bg-gray-100'}`}
    >
      {children}
    </button>
  );
}

/**
 * Editor rich-text WYSIWYG basato su contenteditable.
 * Usa key={blockId} nel consumer per forzare il remount al cambio blocco.
 * Converte automaticamente la formattazione in HTML.
 */
export function RichTextEditor({
  value,
  onChange,
  minHeight = 160,
  placeholder = 'Scrivi il contenuto...',
}: {
  value: string;
  onChange: (html: string) => void;
  minHeight?: number;
  placeholder?: string;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const [fmt, setFmt] = useState({
    bold: false, italic: false, underline: false,
    strikeThrough: false, justifyLeft: false, justifyCenter: false, justifyRight: false,
  });
  const [isEmpty, setIsEmpty] = useState(!value);

  // Imposta innerHTML al mount (il consumer usa key={id} per forzare il remount)
  useEffect(() => {
    if (ref.current) {
      ref.current.innerHTML = value || '';
      setIsEmpty(!value || value === '<br>');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const updateFmt = useCallback(() => {
    try {
      setFmt({
        bold: document.queryCommandState('bold'),
        italic: document.queryCommandState('italic'),
        underline: document.queryCommandState('underline'),
        strikeThrough: document.queryCommandState('strikeThrough'),
        justifyLeft: document.queryCommandState('justifyLeft'),
        justifyCenter: document.queryCommandState('justifyCenter'),
        justifyRight: document.queryCommandState('justifyRight'),
      });
    } catch { /* ignore */ }
  }, []);

  const emit = useCallback(() => {
    if (!ref.current) return;
    const html = ref.current.innerHTML;
    setIsEmpty(!html || html === '<br>');
    onChange(html);
  }, [onChange]);

  const exec = useCallback((cmd: string, arg?: string) => {
    document.execCommand(cmd, false, arg ?? undefined);
    emit();
    updateFmt();
    ref.current?.focus();
  }, [emit, updateFmt]);

  const handleLink = useCallback(() => {
    const sel = window.getSelection();
    if (!sel || sel.isCollapsed) {
      alert('Seleziona prima il testo da linkare.');
      return;
    }
    const url = window.prompt('URL del link:', 'https://');
    if (url) exec('createLink', url);
  }, [exec]);

  return (
    <div className="rounded-xl border border-gray-200 overflow-hidden focus-within:ring-2 focus-within:ring-brand-400 focus-within:border-transparent">
      {/* Toolbar */}
      <div className="flex items-center gap-0.5 flex-wrap px-2 py-1.5 bg-gray-50 border-b border-gray-200">
        <Btn title="Grassetto (Ctrl+B)" active={fmt.bold} onClick={() => exec('bold')}>
          <Bold className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Corsivo (Ctrl+I)" active={fmt.italic} onClick={() => exec('italic')}>
          <Italic className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Sottolineato (Ctrl+U)" active={fmt.underline} onClick={() => exec('underline')}>
          <Underline className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Barrato" active={fmt.strikeThrough} onClick={() => exec('strikeThrough')}>
          <Strikethrough className="w-3.5 h-3.5" />
        </Btn>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <Btn title="Inserisci link" onClick={handleLink}>
          <Link2 className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Rimuovi link" onClick={() => exec('unlink')}>
          <Link2Off className="w-3.5 h-3.5" />
        </Btn>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <Btn title="Lista puntata" onClick={() => exec('insertUnorderedList')}>
          <List className="w-3.5 h-3.5" />
        </Btn>

        <div className="w-px h-5 bg-gray-200 mx-1" />

        <Btn title="Allinea a sinistra" active={fmt.justifyLeft} onClick={() => exec('justifyLeft')}>
          <AlignLeft className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Centra" active={fmt.justifyCenter} onClick={() => exec('justifyCenter')}>
          <AlignCenter className="w-3.5 h-3.5" />
        </Btn>
        <Btn title="Allinea a destra" active={fmt.justifyRight} onClick={() => exec('justifyRight')}>
          <AlignRight className="w-3.5 h-3.5" />
        </Btn>
      </div>

      {/* Editable area */}
      <div className="relative bg-white">
        {isEmpty && (
          <div className="absolute top-3 left-3 text-gray-300 text-sm pointer-events-none select-none">
            {placeholder}
          </div>
        )}
        <div
          ref={ref}
          contentEditable
          suppressContentEditableWarning
          onInput={emit}
          onKeyUp={updateFmt}
          onMouseUp={updateFmt}
          onSelect={updateFmt}
          className="px-3 py-3 text-sm text-gray-800 outline-none leading-relaxed"
          style={{ minHeight }}
        />
      </div>
    </div>
  );
}

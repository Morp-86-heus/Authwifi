import { useRef, useState } from 'react';
import { Upload, X, Image } from 'lucide-react';
import api from '../api/client';

interface Props {
  siteId: string;
  field: 'logo' | 'background' | 'hero';
  label: string;
  hint?: string;
  currentUrl?: string | null;
  onUploaded: (url: string) => void;
  aspectHint?: string; // es. "1:1 — max 512px"
}

export default function ImageUploader({
  siteId,
  field,
  label,
  hint,
  currentUrl,
  onUploaded,
  aspectHint,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl ?? null);
  const [error, setError] = useState('');
  const [dragging, setDragging] = useState(false);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('File non valido. Usa JPEG, PNG, WebP o SVG.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('File troppo grande (max 5 MB).');
      return;
    }

    setError('');
    setPreview(URL.createObjectURL(file));
    setUploading(true);

    try {
      const form = new FormData();
      form.append('file', file);
      const { data } = await api.post(
        `/sites/${siteId}/upload/${field}`,
        form,
        { headers: { 'Content-Type': 'multipart/form-data' } },
      );
      onUploaded(data.url);
    } catch {
      setError('Errore durante il caricamento. Riprova.');
    } finally {
      setUploading(false);
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragging(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleRemove = () => {
    setPreview(null);
    onUploaded('');
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1.5">{label}</label>
      {hint && <p className="text-xs text-gray-400 mb-2">{hint}</p>}

      {preview ? (
        <div className="relative rounded-xl overflow-hidden border border-gray-200 group">
          <img
            src={preview}
            alt={label}
            className={`w-full object-cover ${field === 'logo' ? 'max-h-24 object-contain bg-gray-50 p-2' : field === 'hero' ? 'h-32' : 'h-24'}`}
          />
          <div className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-all flex items-center justify-center gap-2 opacity-0 group-hover:opacity-100">
            <button
              onClick={() => inputRef.current?.click()}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-white text-gray-800 text-xs font-medium rounded-lg shadow"
            >
              <Upload className="w-3 h-3" /> Cambia
            </button>
            <button
              onClick={handleRemove}
              className="flex items-center gap-1.5 px-3 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg shadow"
            >
              <X className="w-3 h-3" /> Rimuovi
            </button>
          </div>
          {uploading && (
            <div className="absolute inset-0 bg-white/70 flex items-center justify-center">
              <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
            </div>
          )}
        </div>
      ) : (
        <div
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`relative flex flex-col items-center justify-center gap-2 border-2 border-dashed rounded-xl cursor-pointer transition-colors p-6
            ${dragging ? 'border-brand-500 bg-brand-50' : 'border-gray-200 hover:border-brand-400 hover:bg-gray-50'}`}
        >
          {uploading ? (
            <div className="w-6 h-6 border-2 border-brand-500 border-t-transparent rounded-full animate-spin" />
          ) : (
            <>
              <div className="w-10 h-10 bg-gray-100 rounded-xl flex items-center justify-center">
                <Image className="w-5 h-5 text-gray-400" />
              </div>
              <div className="text-center">
                <p className="text-sm text-gray-600 font-medium">
                  Trascina qui o <span className="text-brand-500">seleziona un file</span>
                </p>
                {aspectHint && (
                  <p className="text-xs text-gray-400 mt-0.5">{aspectHint}</p>
                )}
                <p className="text-xs text-gray-400">JPEG, PNG, WebP, SVG — max 5 MB</p>
              </div>
            </>
          )}
        </div>
      )}

      {error && <p className="text-xs text-red-500 mt-1.5">{error}</p>}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
      />
    </div>
  );
}

import { useEffect, useState } from 'react';
import { X, Mail, Phone, Globe, Wifi, ShieldCheck, Calendar, Bookmark } from 'lucide-react';
import api from '../api/client';

interface Session {
  id: string;
  startedAt: string;
  endedAt: string | null;
  ssidName: string | null;
  apMac: string | null;
  site: { name: string };
}

interface Consent {
  id: string;
  type: string;
  granted: boolean;
  policyVersion: string;
  createdAt: string;
}

interface GuestFull {
  id: string;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  phone: string | null;
  language: string | null;
  country: string | null;
  macAddress: string | null;
  createdAt: string;
  segmentName: string | null;
  subSegmentName: string | null;
  sessions: Session[];
  consents: Consent[];
}

const CONSENT_LABELS: Record<string, string> = {
  TERMS_OF_SERVICE: 'Termini di servizio',
  MARKETING_EMAIL:  'Email promozionali',
  MARKETING_SMS:    'SMS / WhatsApp',
  PROFILING:        'Profilazione',
  THIRD_PARTY:      'Terze parti',
};

interface Props {
  guestId: string;
  onClose: () => void;
}

export default function GuestDetail({ guestId, onClose }: Props) {
  const [guest, setGuest] = useState<GuestFull | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    api.get<GuestFull>(`/crm/guests/${guestId}`)
      .then((r) => setGuest(r.data))
      .finally(() => setLoading(false));
  }, [guestId]);

  const fullName = guest
    ? [guest.firstName, guest.lastName].filter(Boolean).join(' ') || guest.email || guestId.slice(0, 8)
    : '...';

  const fmtDate = (iso: string) =>
    new Date(iso).toLocaleDateString('it-IT', { day: '2-digit', month: 'short', year: 'numeric' });

  const fmtDateTime = (iso: string) =>
    new Date(iso).toLocaleString('it-IT', { day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit' });

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black/20 z-40 transition-opacity"
        onClick={onClose}
      />

      {/* Slide-over */}
      <div className="fixed inset-y-0 right-0 w-full max-w-md bg-white shadow-2xl z-50 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-5 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-brand-100 text-brand-600 flex items-center justify-center text-sm font-bold shrink-0">
              {(guest?.firstName?.[0] ?? guest?.email?.[0] ?? '?').toUpperCase()}
            </div>
            <div>
              <h2 className="font-semibold text-gray-900 text-base">{fullName}</h2>
              {guest && <p className="text-xs text-gray-400">Registrato {fmtDate(guest.createdAt)}</p>}
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-gray-100 rounded-xl transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        {loading ? (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Caricamento...
          </div>
        ) : guest ? (
          <div className="flex-1 overflow-y-auto">
            <Section title="Dati anagrafici">
              <Row icon={<Mail className="w-4 h-4" />} label="Email" value={guest.email} />
              <Row icon={<Phone className="w-4 h-4" />} label="Telefono" value={guest.phone} />
              <Row icon={<Globe className="w-4 h-4" />} label="Lingua" value={guest.language?.toUpperCase()} />
              <Row icon={<Globe className="w-4 h-4" />} label="Paese" value={guest.country} />
              <Row icon={<Wifi className="w-4 h-4" />} label="MAC address" value={guest.macAddress} mono />
            </Section>

            {(guest.segmentName || guest.subSegmentName) && (
              <Section title="Profilazione">
                <Row icon={<Bookmark className="w-4 h-4" />} label="Tipologia" value={guest.segmentName} />
                <Row icon={<Bookmark className="w-4 h-4" />} label="Interessi" value={guest.subSegmentName} />
              </Section>
            )}

            <Section title={`Sessioni WiFi (${guest.sessions.length})`}>
              {guest.sessions.length === 0 ? (
                <p className="text-sm text-gray-400">Nessuna sessione registrata.</p>
              ) : (
                <div className="space-y-2">
                  {guest.sessions.map((s) => (
                    <div key={s.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                      <Calendar className="w-4 h-4 text-gray-400 mt-0.5 shrink-0" />
                      <div className="min-w-0">
                        <p className="text-sm font-medium text-gray-800">{s.site.name}</p>
                        <p className="text-xs text-gray-500 mt-0.5">
                          {fmtDateTime(s.startedAt)}
                          {s.ssidName && <span className="ml-2 text-gray-400">· {s.ssidName}</span>}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>

            <Section title="Consensi GDPR">
              {guest.consents.length === 0 ? (
                <p className="text-sm text-gray-400">Nessun consenso registrato.</p>
              ) : (
                <div className="space-y-2">
                  {guest.consents.map((c) => (
                    <div key={c.id} className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-xl">
                      <div className="flex items-center gap-2">
                        <ShieldCheck className={`w-4 h-4 shrink-0 ${c.granted ? 'text-green-500' : 'text-gray-300'}`} />
                        <span className="text-sm text-gray-700">
                          {CONSENT_LABELS[c.type] ?? c.type}
                        </span>
                      </div>
                      <div className="text-right shrink-0">
                        <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${
                          c.granted ? 'bg-green-50 text-green-700' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {c.granted ? 'Concesso' : 'Negato'}
                        </span>
                        <p className="text-xs text-gray-400 mt-0.5">{fmtDate(c.createdAt)}</p>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </Section>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-sm text-gray-400">
            Ospite non trovato.
          </div>
        )}
      </div>
    </>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="px-6 py-5 border-b border-gray-100 last:border-b-0">
      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">{title}</h3>
      {children}
    </div>
  );
}

function Row({
  icon, label, value, mono = false,
}: {
  icon: React.ReactNode;
  label: string;
  value?: string | null;
  mono?: boolean;
}) {
  return (
    <div className="flex items-center gap-3 py-1.5">
      <span className="text-gray-300 shrink-0">{icon}</span>
      <span className="text-sm text-gray-500 w-28 shrink-0">{label}</span>
      <span className={`text-sm text-gray-800 truncate ${mono ? 'font-mono text-xs' : ''}`}>
        {value ?? '—'}
      </span>
    </div>
  );
}

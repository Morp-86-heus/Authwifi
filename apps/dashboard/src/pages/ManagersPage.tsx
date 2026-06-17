import { useEffect, useState } from 'react';
import { Plus, Trash2, ChevronDown } from 'lucide-react';
import api from '../api/client';

interface SiteOption {
  id: string;
  name: string;
}

interface TeamMember {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  role: string;
  siteIds: string[];
  createdAt: string;
}

const ROLE_LABELS: Record<string, string> = {
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
};

const ROLE_COLORS: Record<string, string> = {
  owner: 'bg-purple-100 text-purple-700',
  manager: 'bg-blue-100 text-blue-700',
  staff: 'bg-gray-100 text-gray-600',
};

export default function ManagersPage() {
  const [members, setMembers] = useState<TeamMember[]>([]);
  const [sites, setSites] = useState<SiteOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);

  const load = async () => {
    setLoading(true);
    try {
      const [mRes, sRes] = await Promise.all([
        api.get<TeamMember[]>('/managers'),
        api.get<SiteOption[]>('/sites'),
      ]);
      setMembers(mRes.data);
      setSites(sRes.data);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, []);

  const handleDelete = async (id: string) => {
    if (!confirm('Eliminare questo membro del team?')) return;
    await api.delete(`/managers/${id}`);
    setMembers((prev) => prev.filter((m) => m.id !== id));
  };

  const handleRoleChange = async (id: string, role: string) => {
    const { data } = await api.patch<TeamMember>(`/managers/${id}`, { role });
    setMembers((prev) => prev.map((m) => (m.id === id ? data : m)));
  };

  return (
    <div className="p-8 w-full">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Team</h1>
          <p className="text-sm text-gray-500 mt-1">Gestisci accessi e ruoli del tuo staff</p>
        </div>
        <button
          onClick={() => setShowForm(true)}
          className="flex items-center gap-2 px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors"
        >
          <Plus className="w-4 h-4" />
          Aggiungi membro
        </button>
      </div>

      {showForm && (
        <AddMemberForm
          sites={sites}
          onCreated={(m) => { setMembers((prev) => [...prev, m]); setShowForm(false); }}
          onCancel={() => setShowForm(false)}
        />
      )}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">Caricamento...</div>
        ) : members.length === 0 ? (
          <div className="px-6 py-10 text-center text-sm text-gray-400">
            Nessun membro. Aggiungi il primo collaboratore.
          </div>
        ) : (
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100 text-left text-xs text-gray-400 uppercase tracking-wide">
                <th className="px-6 py-3 font-medium">Utente</th>
                <th className="px-6 py-3 font-medium">Ruolo</th>
                <th className="px-6 py-3 font-medium">Siti assegnati</th>
                <th className="px-6 py-3 font-medium">Registrato</th>
                <th className="px-6 py-3" />
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {members.map((m) => (
                <tr key={m.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-4">
                    <p className="font-medium text-gray-900">
                      {m.firstName || m.lastName
                        ? `${m.firstName ?? ''} ${m.lastName ?? ''}`.trim()
                        : '—'}
                    </p>
                    <p className="text-xs text-gray-400 mt-0.5">{m.email}</p>
                  </td>
                  <td className="px-6 py-4">
                    {m.role === 'owner' ? (
                      <span className={`text-xs font-medium px-2 py-1 rounded-full ${ROLE_COLORS.owner}`}>
                        Owner
                      </span>
                    ) : (
                      <RoleSelect
                        value={m.role}
                        onChange={(role) => handleRoleChange(m.id, role)}
                      />
                    )}
                  </td>
                  <td className="px-6 py-4 text-gray-500 text-xs">
                    {m.role === 'owner'
                      ? 'Tutti i siti'
                      : m.siteIds.length === 0
                        ? <span className="text-gray-300">Tutti i siti</span>
                        : m.siteIds.map((sid) => {
                            const site = sites.find((s) => s.id === sid);
                            return site?.name ?? sid;
                          }).join(', ')}
                  </td>
                  <td className="px-6 py-4 text-gray-400 text-xs">
                    {new Date(m.createdAt).toLocaleDateString('it-IT')}
                  </td>
                  <td className="px-6 py-4 text-right">
                    {m.role !== 'owner' && (
                      <button
                        onClick={() => handleDelete(m.id)}
                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

function RoleSelect({ value, onChange }: { value: string; onChange: (r: string) => void }) {
  return (
    <div className="relative inline-block">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className={`appearance-none text-xs font-medium px-2 py-1 pr-6 rounded-full cursor-pointer border-0 outline-none ${ROLE_COLORS[value] ?? 'bg-gray-100 text-gray-600'}`}
      >
        <option value="manager">Manager</option>
        <option value="staff">Staff</option>
      </select>
      <ChevronDown className="w-3 h-3 absolute right-1.5 top-1/2 -translate-y-1/2 pointer-events-none" />
    </div>
  );
}

function AddMemberForm({
  sites,
  onCreated,
  onCancel,
}: {
  sites: SiteOption[];
  onCreated: (m: TeamMember) => void;
  onCancel: () => void;
}) {
  const [form, setForm] = useState({
    email: '',
    password: '',
    first_name: '',
    last_name: '',
    role: 'manager',
    site_ids: [] as string[],
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const toggleSite = (id: string) => {
    setForm((prev) => ({
      ...prev,
      site_ids: prev.site_ids.includes(id)
        ? prev.site_ids.filter((s) => s !== id)
        : [...prev.site_ids, id],
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSaving(true);
    setError(null);
    try {
      const payload = {
        ...form,
        site_ids: form.site_ids.length > 0 ? form.site_ids : null,
      };
      const { data } = await api.post<TeamMember>('/managers', payload);
      onCreated(data);
    } catch (err: unknown) {
      const detail = (err as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(detail ?? 'Errore durante la creazione');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent';

  return (
    <form
      onSubmit={handleSubmit}
      className="bg-white rounded-2xl border border-brand-200 shadow-sm p-6 mb-6"
    >
      <h2 className="font-semibold text-gray-900 mb-5">Nuovo membro</h2>

      {error && (
        <div className="mb-4 px-3 py-2 bg-red-50 text-red-600 text-sm rounded-lg">{error}</div>
      )}

      <div className="grid grid-cols-2 gap-4 mb-4">
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome</label>
          <input className={inputCls} value={form.first_name}
            onChange={(e) => setForm((p) => ({ ...p, first_name: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Cognome</label>
          <input className={inputCls} value={form.last_name}
            onChange={(e) => setForm((p) => ({ ...p, last_name: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Email *</label>
          <input required type="email" className={inputCls} value={form.email}
            onChange={(e) => setForm((p) => ({ ...p, email: e.target.value }))} />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">Password *</label>
          <input required type="password" className={inputCls} value={form.password}
            onChange={(e) => setForm((p) => ({ ...p, password: e.target.value }))} />
        </div>
      </div>

      <div className="mb-4">
        <label className="block text-sm font-medium text-gray-700 mb-1.5">Ruolo</label>
        <div className="flex gap-3">
          {(['manager', 'staff'] as const).map((r) => (
            <label key={r} className="flex items-center gap-2 cursor-pointer">
              <input type="radio" name="role" value={r} checked={form.role === r}
                onChange={() => setForm((p) => ({ ...p, role: r }))}
                className="accent-brand-500" />
              <span className="text-sm text-gray-700">{ROLE_LABELS[r]}</span>
            </label>
          ))}
        </div>
      </div>

      {sites.length > 0 && (
        <div className="mb-6">
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Siti assegnati <span className="text-gray-400 font-normal">(vuoto = tutti)</span>
          </label>
          <div className="flex flex-wrap gap-2">
            {sites.map((s) => (
              <label key={s.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 border rounded-lg text-sm cursor-pointer transition-colors ${
                  form.site_ids.includes(s.id)
                    ? 'bg-brand-50 border-brand-300 text-brand-700'
                    : 'border-gray-200 text-gray-600 hover:bg-gray-50'
                }`}>
                <input type="checkbox" checked={form.site_ids.includes(s.id)}
                  onChange={() => toggleSite(s.id)} className="hidden" />
                {s.name}
              </label>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-3">
        <button type="submit" disabled={saving}
          className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60">
          {saving ? 'Creazione...' : 'Crea membro'}
        </button>
        <button type="button" onClick={onCancel}
          className="px-4 py-2 border border-gray-200 text-gray-600 text-sm font-medium rounded-lg hover:bg-gray-50 transition-colors">
          Annulla
        </button>
      </div>
    </form>
  );
}

import { Outlet, NavLink, useNavigate } from 'react-router-dom';
import { Wifi, LayoutDashboard, Users, Settings, LogOut, UsersRound, ShieldCheck, AlertTriangle, X, Eye, EyeOff, Tags, MessageSquareDot, Send, Zap } from 'lucide-react';
import { useAuthStore } from '../stores/auth';
import { useEffect, useState } from 'react';
import api from '../api/client';

const ROLE_LABELS: Record<string, string> = {
  superadmin: 'Super Admin',
  owner: 'Owner',
  manager: 'Manager',
  staff: 'Staff',
};

export default function AppLayout() {
  const logout = useAuthStore((s) => s.logout);
  const role = useAuthStore((s) => s.role);
  const licenseError = useAuthStore((s) => s.licenseError);
  const email = useAuthStore((s) => s.email);
  const firstName = useAuthStore((s) => s.firstName);
  const lastName = useAuthStore((s) => s.lastName);
  const setProfile = useAuthStore((s) => s.setProfile);
  const navigate = useNavigate();
  const [profileOpen, setProfileOpen] = useState(false);

  useEffect(() => {
    api.get<{ email: string; firstName: string | null; lastName: string | null }>('/auth/me')
      .then(({ data }) => setProfile({ email: data.email, firstName: data.firstName, lastName: data.lastName }))
      .catch(() => {});
  }, [setProfile]);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const isSuperAdmin = role === 'superadmin';
  const canManageTeam = role === 'owner' || role === 'superadmin';
  const canManageSettings = role === 'owner' || role === 'manager' || role === 'superadmin';

  const displayName = [firstName, lastName].filter(Boolean).join(' ') || email || '—';
  const initials = firstName && lastName
    ? `${firstName[0]}${lastName[0]}`.toUpperCase()
    : firstName
    ? firstName.slice(0, 2).toUpperCase()
    : email
    ? email.slice(0, 2).toUpperCase()
    : '?';

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-60 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo */}
        <div className="flex items-center gap-2 px-5 py-5 border-b border-gray-100">
          <div className="w-8 h-8 bg-brand-500 rounded-lg flex items-center justify-center">
            <Wifi className="w-4 h-4 text-white" />
          </div>
          <span className="font-bold text-gray-900 text-lg">Authwifi</span>
        </div>

        {/* Nav */}
        <nav className="flex-1 px-3 py-4 space-y-1">
          <NavItem to="/" icon={<LayoutDashboard className="w-4 h-4" />} label="Overview" />
          <NavItem to="/guests" icon={<Users className="w-4 h-4" />} label="Ospiti" />
          {canManageSettings && (
            <NavItem to="/segments" icon={<Tags className="w-4 h-4" />} label="Segmenti" />
          )}
          {canManageTeam && (
            <NavItem to="/team" icon={<UsersRound className="w-4 h-4" />} label="Team" />
          )}
          {isSuperAdmin && (
            <NavItem to="/admin" icon={<ShieldCheck className="w-4 h-4" />} label="SuperAdmin" />
          )}
          {canManageSettings && (
            <NavItem to="/survey" icon={<MessageSquareDot className="w-4 h-4" />} label="Survey & NPS" />
          )}
          {canManageSettings && (
            <NavItem to="/campaigns" icon={<Send className="w-4 h-4" />} label="Campagne" />
          )}
          {canManageSettings && (
            <NavItem to="/automations" icon={<Zap className="w-4 h-4" />} label="Automazioni" />
          )}
          {canManageSettings && (
            <NavItem to="/settings" icon={<Settings className="w-4 h-4" />} label="Impostazioni" />
          )}
        </nav>

        {/* Profile card + Logout */}
        <div className="px-3 py-3 border-t border-gray-100">
          <button
            onClick={() => setProfileOpen(true)}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-xl hover:bg-gray-50 transition-colors text-left"
          >
            <div className="w-8 h-8 rounded-full bg-brand-500 flex items-center justify-center shrink-0">
              <span className="text-white text-xs font-bold">{initials}</span>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-gray-900 truncate">{displayName}</p>
              <p className="text-xs text-gray-400 truncate">{ROLE_LABELS[role ?? ''] ?? role}</p>
            </div>
          </button>
          <button
            onClick={handleLogout}
            className="flex items-center gap-2 w-full px-3 py-2 mt-1 text-sm text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
          >
            <LogOut className="w-4 h-4" />
            Esci
          </button>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>

      {/* Profile modal */}
      {profileOpen && (
        <ProfileModal
          initialFirstName={firstName ?? ''}
          initialLastName={lastName ?? ''}
          email={email ?? ''}
          role={role ?? ''}
          onClose={() => setProfileOpen(false)}
          onSaved={(fn, ln) => {
            setProfile({ email: email ?? '', firstName: fn || null, lastName: ln || null });
            setProfileOpen(false);
          }}
        />
      )}

      {/* License error overlay */}
      {licenseError && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl shadow-2xl max-w-sm w-full p-8 text-center space-y-4">
            <div className="w-14 h-14 bg-red-100 rounded-full flex items-center justify-center mx-auto">
              <AlertTriangle className="w-7 h-7 text-red-500" />
            </div>
            <h2 className="text-lg font-bold text-gray-900">Accesso bloccato</h2>
            <p className="text-sm text-gray-500">{licenseError}</p>
            <p className="text-xs text-gray-400">Contatta il tuo amministratore o il supporto Authwifi.</p>
            <button
              onClick={() => { logout(); navigate('/login'); }}
              className="w-full px-4 py-2 bg-gray-900 hover:bg-gray-700 text-white text-sm font-semibold rounded-lg transition-colors"
            >
              Disconnetti
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Profile Modal ────────────────────────────────────────────────────────────

interface ProfileModalProps {
  initialFirstName: string;
  initialLastName: string;
  email: string;
  role: string;
  onClose: () => void;
  onSaved: (firstName: string, lastName: string) => void;
}

function ProfileModal({ initialFirstName, initialLastName, email, role, onClose, onSaved }: ProfileModalProps) {
  const [firstName, setFirstName] = useState(initialFirstName);
  const [lastName, setLastName] = useState(initialLastName);
  const [currentPwd, setCurrentPwd] = useState('');
  const [newPwd, setNewPwd] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const handleSave = async () => {
    setSaving(true);
    setError(null);
    try {
      await api.patch('/auth/me', {
        first_name: firstName,
        last_name: lastName,
        current_password: currentPwd || undefined,
        new_password: newPwd || undefined,
      });
      setSuccess(true);
      setCurrentPwd('');
      setNewPwd('');
      setTimeout(() => {
        setSuccess(false);
        onSaved(firstName, lastName);
      }, 1200);
    } catch (e: unknown) {
      const msg = (e as { response?: { data?: { detail?: string } } })?.response?.data?.detail;
      setError(msg ?? 'Errore nel salvataggio');
    } finally {
      setSaving(false);
    }
  };

  const inputCls = 'w-full px-3.5 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-brand-500 focus:border-transparent';

  return (
    <div className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-md"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 pt-6 pb-4 border-b border-gray-100">
          <h2 className="text-lg font-bold text-gray-900">Impostazioni profilo</h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          {/* Email (read-only) */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
            <div className="flex items-center gap-2 px-3.5 py-2.5 bg-gray-50 border border-gray-200 rounded-lg text-sm text-gray-500">
              {email}
              <span className="ml-auto text-xs bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full">
                {ROLE_LABELS[role] ?? role}
              </span>
            </div>
          </div>

          {/* Nome */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Nome</label>
              <input
                type="text"
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                placeholder="Mario"
                className={inputCls}
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Cognome</label>
              <input
                type="text"
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                placeholder="Rossi"
                className={inputCls}
              />
            </div>
          </div>

          {/* Cambio password */}
          <div className="pt-2 border-t border-gray-100">
            <p className="text-sm font-medium text-gray-700 mb-3">Cambia password <span className="text-gray-400 font-normal">(opzionale)</span></p>
            <div className="space-y-3">
              <div className="relative">
                <input
                  type={showCurrent ? 'text' : 'password'}
                  value={currentPwd}
                  onChange={(e) => setCurrentPwd(e.target.value)}
                  placeholder="Password attuale"
                  className={inputCls + ' pr-10'}
                />
                <button type="button" onClick={() => setShowCurrent((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPwd}
                  onChange={(e) => setNewPwd(e.target.value)}
                  placeholder="Nuova password"
                  className={inputCls + ' pr-10'}
                />
                <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>
          </div>

          {error && <p className="text-sm text-red-500 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
        </div>

        {/* Footer */}
        <div className="flex justify-end gap-3 px-6 pb-6">
          <button onClick={onClose} className="px-4 py-2 text-sm text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
            Annulla
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="px-4 py-2 bg-brand-500 hover:bg-brand-600 text-white text-sm font-semibold rounded-lg transition-colors disabled:opacity-60"
          >
            {saving ? 'Salvataggio...' : success ? '✓ Salvato' : 'Salva'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Nav item ─────────────────────────────────────────────────────────────────

function NavItem({ to, icon, label }: { to: string; icon: React.ReactNode; label: string }) {
  return (
    <NavLink
      to={to}
      end
      className={({ isActive }) =>
        `flex items-center gap-2 px-3 py-2 text-sm rounded-lg transition-colors ${
          isActive
            ? 'bg-brand-50 text-brand-600 font-medium'
            : 'text-gray-600 hover:bg-gray-100'
        }`
      }
    >
      {icon}
      {label}
    </NavLink>
  );
}

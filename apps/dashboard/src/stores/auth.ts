import { create } from 'zustand';
import { persist } from 'zustand/middleware';

function parseJwtPayload(token: string): Record<string, unknown> | null {
  try {
    const base64 = token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/');
    return JSON.parse(atob(base64));
  } catch {
    return null;
  }
}

interface AuthState {
  token: string | null;
  tenantId: string | null;
  role: string | null;
  licenseError: string | null;
  email: string | null;
  firstName: string | null;
  lastName: string | null;
  setToken: (token: string, tenantId: string) => void;
  setProfile: (profile: { email: string; firstName: string | null; lastName: string | null }) => void;
  setLicenseError: (msg: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      token: null,
      tenantId: null,
      role: null,
      licenseError: null,
      email: null,
      firstName: null,
      lastName: null,
      setToken: (token, tenantId) => {
        const payload = parseJwtPayload(token);
        set({ token, tenantId, role: (payload?.role as string) ?? null, licenseError: null });
      },
      setProfile: ({ email, firstName, lastName }) => set({ email, firstName, lastName }),
      setLicenseError: (msg) => set({ licenseError: msg }),
      logout: () => set({ token: null, tenantId: null, role: null, licenseError: null, email: null, firstName: null, lastName: null }),
    }),
    { name: 'authwifi-auth' },
  ),
);

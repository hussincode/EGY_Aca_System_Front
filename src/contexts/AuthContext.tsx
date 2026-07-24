import { createContext, useContext, useMemo } from 'react';
import type { ReactNode } from 'react';

export type UserRole = 'admin' | 'manager' | 'coach' | 'accountant';

export interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
}

// Pages each role can access
const ROLE_PAGES: Record<UserRole, string[]> = {
  admin: ['/', '/players', '/staff', '/branches', '/ambassadors', '/leads', '/games', '/subscriptions', '/attendance', '/financ', '/store-synced', '/users', '/settings'],
  manager: ['/', '/players', '/staff', '/branches', '/ambassadors', '/leads', '/games', '/subscriptions', '/attendance', '/financ', '/store-synced', '/settings'],
  coach: ['/', '/players', '/games', '/subscriptions', '/attendance'],
  accountant: ['/', '/subscriptions', '/financ', '/store-synced'],
};

// Sections each role can mutate (add / edit / delete)
const ROLE_EDITABLE: Record<UserRole, string[]> = {
  admin: ['players', 'staff', 'branches', 'ambassadors', 'leads', 'games', 'subscriptions', 'attendance', 'finance', 'users', 'settings'],
  manager: ['players', 'staff', 'branches', 'ambassadors', 'leads', 'games', 'subscriptions', 'attendance', 'finance', 'settings'],
  coach: [],          // view only
  accountant: ['subscriptions', 'finance'],
};

interface AuthContextValue {
  user: AuthUser | null;
  role: UserRole | null;
  /** Returns true if current user can navigate to this path */
  hasPageAccess: (path: string) => boolean;
  /** Returns true if current user can add/edit/delete in this section */
  canEdit: (section: string) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  hasPageAccess: () => false,
  canEdit: () => false,
});

function readUser(): AuthUser | null {
  if (typeof window === 'undefined') return null;
  const raw = window.localStorage.getItem('loggedInUser');
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as Partial<AuthUser>;
    if (!parsed?.id || !parsed?.role) return null;
    return parsed as AuthUser;
  } catch {
    return null;
  }
}

function normalizeRole(role: string | undefined): UserRole {
  if (role === 'admin') return 'admin';
  if (role === 'coach') return 'coach';
  if (role === 'accountant') return 'accountant';
  return 'manager';
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const user = useMemo(() => readUser(), []);
  const role: UserRole | null = user ? normalizeRole(user.role) : null;

  const hasPageAccess = (path: string) => {
    if (!role) return false;
    const allowed = ROLE_PAGES[role] ?? [];
    return allowed.includes(path);
  };

  const canEdit = (section: string) => {
    if (!role) return false;
    const allowed = ROLE_EDITABLE[role] ?? [];
    return allowed.includes(section);
  };

  return (
    <AuthContext.Provider value={{ user, role, hasPageAccess, canEdit }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

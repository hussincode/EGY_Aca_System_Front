import { createContext, useContext, useMemo, useState, useEffect } from 'react';
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
  manager: ['/', '/players', '/staff', '/branches', '/ambassadors', '/leads', '/games', '/subscriptions', '/attendance', '/financ', '/store-synced', '/users', '/settings'],
  coach: ['/', '/players', '/games', '/subscriptions', '/attendance'],
  accountant: ['/', '/subscriptions', '/financ', '/store-synced'],
};

// Sections each role can mutate (add / edit / delete)
const ROLE_EDITABLE: Record<UserRole, string[]> = {
  admin: ['players', 'staff', 'branches', 'ambassadors', 'leads', 'games', 'subscriptions', 'attendance', 'finance', 'users', 'settings'],
  manager: ['players', 'staff', 'branches', 'ambassadors', 'leads', 'games', 'subscriptions', 'attendance', 'finance', 'users', 'settings'],
  coach: [],          // view only
  accountant: ['subscriptions', 'finance'],
};

interface AuthContextValue {
  user: AuthUser | null;
  role: UserRole | null;
  setUser: (user: AuthUser | null) => void;
  /** Returns true if current user can navigate to this path */
  hasPageAccess: (path: string) => boolean;
  /** Returns true if current user can add/edit/delete in this section */
  canEdit: (section: string) => boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  role: null,
  setUser: () => {},
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
  const [user, setUserState] = useState<AuthUser | null>(() => readUser());

  useEffect(() => {
    const handleStorage = () => {
      setUserState(readUser());
    };
    window.addEventListener('storage', handleStorage);
    window.addEventListener('auth:change', handleStorage);
    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('auth:change', handleStorage);
    };
  }, []);

  const setUser = (newUser: AuthUser | null) => {
    setUserState(newUser);
    if (typeof window !== 'undefined') {
      if (newUser) {
        window.localStorage.setItem('loggedInUser', JSON.stringify(newUser));
      } else {
        window.localStorage.removeItem('loggedInUser');
      }
      window.dispatchEvent(new Event('auth:change'));
    }
  };

  const role: UserRole | null = useMemo(() => (user ? normalizeRole(user.role) : null), [user]);

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
    <AuthContext.Provider value={{ user, role, setUser, hasPageAccess, canEdit }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}

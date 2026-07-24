import { useState } from 'react';
import { BrowserRouter, Routes, Route, Navigate, Outlet, useLocation } from 'react-router-dom';
import Sidebar from './components/Sidebar';
import Ambassadors from './pages/Ambassadors';
import Attendance from './pages/Attendance';
import Branches from './pages/Branches';
import Dashboard from './pages/Dashboard';
import Players from './pages/Players';
import Staff from './pages/Staff';
import Leads from './pages/Leads';
import Games from './pages/Games';
import Settings from './pages/Settings';
import Subscriptions from './pages/Subscriptions';
import Finance from './pages/Finance';
import StoreSynced from './pages/StoreSynced';
import Users from './pages/Users';
import Login from './pages/Login';
import { AuthProvider, useAuth } from './contexts/AuthContext';

/** Redirect to /login if no token present */
function RequireAuth() {
  const location = useLocation();
  const token = typeof window !== 'undefined' ? window.api?.getToken?.() : null;

  if (!token) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  return <Outlet />;
}

/** Redirect to / if the current role cannot access this page */
function RequireRole({ path }: { path: string }) {
  const { hasPageAccess } = useAuth();

  if (!hasPageAccess(path)) {
    return <Navigate to="/" replace />;
  }

  return <Outlet />;
}

function AppLayout() {
  const [sidebarOpen, setSidebarOpen] = useState(false);

  return (
    <div className="flex min-h-screen flex-col lg:flex-row">
      <Sidebar isOpen={sidebarOpen} setIsOpen={setSidebarOpen} />

      <main className="flex-1 bg-body-bg p-4 md:p-6 lg:pr-20">
        <div className="flex items-center justify-between gap-4 border-b border-slate-800 pb-4 mb-6 lg:hidden">
          <button
            type="button"
            onClick={() => setSidebarOpen(true)}
            className="inline-flex items-center gap-2 rounded-2xl border border-slate-700 bg-slate-950/90 px-4 py-2 text-sm font-semibold text-slate-100 transition hover:border-slate-600 hover:bg-slate-900"
          >
            القائمة
          </button>
          <p className="text-sm text-slate-400">اضغط على القائمة للوصول إلى الأقسام</p>
        </div>

        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <Routes>
          <Route path="/login" element={<Login />} />
          <Route element={<RequireAuth />}>
            <Route element={<AppLayout />}>
              {/* Dashboard – accessible by all authenticated users */}
              <Route path="/" element={<Dashboard />} />

              {/* admin + manager + coach + accountant */}
              <Route element={<RequireRole path="/players" />}>
                <Route path="/players" element={<Players />} />
              </Route>

              <Route element={<RequireRole path="/games" />}>
                <Route path="/games" element={<Games />} />
              </Route>

              <Route element={<RequireRole path="/subscriptions" />}>
                <Route path="/subscriptions" element={<Subscriptions />} />
              </Route>

              <Route element={<RequireRole path="/attendance" />}>
                <Route path="/attendance" element={<Attendance />} />
              </Route>

              {/* admin + manager only */}
              <Route element={<RequireRole path="/staff" />}>
                <Route path="/staff" element={<Staff />} />
              </Route>

              <Route element={<RequireRole path="/branches" />}>
                <Route path="/branches" element={<Branches />} />
              </Route>

              <Route element={<RequireRole path="/ambassadors" />}>
                <Route path="/ambassadors" element={<Ambassadors />} />
              </Route>

              <Route element={<RequireRole path="/leads" />}>
                <Route path="/leads" element={<Leads />} />
              </Route>

              <Route element={<RequireRole path="/financ" />}>
                <Route path="/financ" element={<Finance />} />
              </Route>

              <Route element={<RequireRole path="/store-synced" />}>
                <Route path="/store-synced" element={<StoreSynced />} />
              </Route>

              <Route element={<RequireRole path="/settings" />}>
                <Route path="/settings" element={<Settings />} />
              </Route>

              {/* admin only */}
              <Route element={<RequireRole path="/users" />}>
                <Route path="/users" element={<Users />} />
              </Route>
            </Route>
          </Route>
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </AuthProvider>
    </BrowserRouter>
  );
}

export default App;

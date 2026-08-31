import { useEffect, useMemo, useState } from 'react';
import { Folder, LinkExternal01, MarkerPin01, SearchSm, Plus, Trash01 } from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';
import Pagination from '@/components/Pagination';
import { useAuth } from '@/contexts/AuthContext';
import { API_BASE_URL } from '@/api';

type Branch = {
  id: string;
  name: string;
  manager?: string;
  location?: string;
};

type BranchFormState = {
  name: string;
  manager: string;
  location: string;
};

type ToastState = {
  message: string;
  type: 'success' | 'error' | 'warning';
};

const BRANCHES_KEY = 'branches';

function readLocalBranches(): Branch[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(BRANCHES_KEY);
  if (!raw) return [];
  try {
    return JSON.parse(raw) as Branch[];
  } catch {
    return [];
  }
}

function normalizeBranchRole(user: Record<string, unknown> | null | undefined) {
  return String(user?.roleKey || user?.role || '').trim().toLowerCase();
}

function getBranchSessionUser() {
  if (typeof window === 'undefined') return {};
  try {
    return JSON.parse(window.localStorage.getItem('loggedInUser') || '{}');
  } catch {
    return {};
  }
}

function isApiConnectivityError(error: unknown) {
  const message = String((error as { message?: string } | undefined)?.message || '').toLowerCase();
  return (
    !message ||
    message.includes('network') ||
    message.includes('failed to fetch') ||
    message.includes('load failed') ||
    message.includes('http 500')
  );
}

function resolveBranchData(raw: Record<string, unknown> | null | undefined): Branch {
  return {
    id: String(raw?.id || raw?._id || raw?.branchId || `branch_${Date.now()}`),
    name: String(raw?.name || raw?.branchName || ''),
    manager: String(raw?.manager || raw?.branchManager || ''),
    location: String(raw?.location || raw?.address || ''),
  };
}

function isUrl(str?: string) {
  if (!str) return false;
  const trimmed = str.trim();
  return (
    /^https?:\/\//i.test(trimmed) ||
    /^www\./i.test(trimmed) ||
    /maps\.google/i.test(trimmed) ||
    /goo\.gl/i.test(trimmed) ||
    /maps\.app/i.test(trimmed)
  );
}

function getFormattedUrl(url: string) {
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

function getApiToken() {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem('api_token');
}

function resolveApiUrl(url: string) {
  const normalized = url.startsWith('/api') ? url : `/api${url.startsWith('/') ? url : `/${url}`}`;
  return `${API_BASE_URL}${normalized}`;
}

async function fetchJson<T = unknown>(url: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers || {});
  const token = getApiToken();
  if (token) headers.set('Authorization', `Bearer ${token}`);
  if (options.body != null && !(options.body instanceof FormData) && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json');
  }

  const response = await fetch(resolveApiUrl(url), {
    credentials: 'include',
    ...options,
    headers,
  });

  const text = await response.text();
  let payload: unknown;
  try {
    payload = text ? JSON.parse(text) : undefined;
  } catch {
    payload = text;
  }

  if (!response.ok) {
    const message =
      typeof payload === 'object' && payload !== null && 'message' in payload
        ? String((payload as { message?: unknown }).message || response.statusText)
        : response.statusText || 'API request failed';
    throw new Error(message);
  }

  return payload as T;
}

function syncBranchesToLanding(branchList: Branch[]) {
  if (typeof window === 'undefined') return;
  try {
    const landingBranches = branchList.map((b) => ({
      id: b.id,
      name: b.name,
      description: b.location ? `الموقع: ${b.location} | المدير: ${b.manager || 'إدارة الأكاديمية'}` : `المدير: ${b.manager || 'إدارة الأكاديمية'}`,
      address: b.location || 'العنوان الرئيسي للأكاديمية',
      hours: '6:00 AM - 10:00 PM Daily',
      mapsUrl: /^https?:\/\//i.test(b.location || '') ? b.location : '',
      image: '/assets/football_card.jpg',
      features: ['ملاعب معتمدة', 'استراحة أولياء الأمور', 'مرافق رياضية شمولية'],
    }));

    window.localStorage.setItem('landing_branches', JSON.stringify(landingBranches));

    try {
      const bc = new BroadcastChannel('landing_settings_sync');
      bc.postMessage({ landing_branches: landingBranches });
      bc.close();
    } catch {}

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('app:sync', { detail: { key: 'landing_branches', value: landingBranches } }));

    const urls = ['http://localhost:5000/api/landing-settings', `${API_BASE_URL}/api/landing-settings`];
    urls.forEach((url) => {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landing_branches: landingBranches }),
      }).catch(() => {});
    });
  } catch (err) {
    console.warn('Sync branches to landing failed:', err);
  }
}

export default function Branches() {
  const { canEdit } = useAuth();
  const canEditBranches = canEdit('branches');
  const [branches, setBranches] = useState<Branch[]>(() => readLocalBranches());
  const [search, setSearch] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
  const [branchToDelete, setBranchToDelete] = useState<Branch | null>(null);
  const [formState, setFormState] = useState<BranchFormState>({ name: '', manager: '', location: '' });
  const [toast, setToast] = useState<ToastState | null>(null);

  const canManageBranches = useMemo(() => normalizeBranchRole(getBranchSessionUser()) === 'admin', []);

  const filteredBranches = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return branches;
    return branches.filter((item) =>
      [item.name, item.manager, item.location]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(term),
    );
  }, [branches, search]);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search]);

  const totalPages = Math.ceil(filteredBranches.length / rowsPerPage) || 1;
  const paginatedBranches = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredBranches.slice(start, start + rowsPerPage);
  }, [filteredBranches, currentPage]);

  const stats = useMemo(() => {
    const total = branches.length;
    const managers = branches.filter((item) => item.manager?.trim()).length;
    const locations = branches.filter((item) => item.location?.trim()).length;
    return { total, managers, locations };
  }, [branches]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BRANCHES_KEY, JSON.stringify(branches));
    syncBranchesToLanding(branches);
  }, [branches]);

  useEffect(() => {
    if (!toast) return;
    const timeout = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toast]);

  useEffect(() => {
    if (typeof window === 'undefined') return undefined;

    const handleStorage = (event: StorageEvent) => {
      if (event.key === BRANCHES_KEY) {
        setBranches(readLocalBranches());
      }
    };

    const handleAppSync = (event: Event & { detail?: { key?: string; value?: unknown } }) => {
      if (event?.detail?.key === BRANCHES_KEY) {
        setBranches(Array.isArray(event.detail.value) ? event.detail.value : []);
      }
    };

    window.addEventListener('storage', handleStorage);
    window.addEventListener('app:sync', handleAppSync);

    return () => {
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('app:sync', handleAppSync);
    };
  }, []);

  const showToast = (message: string, type: ToastState['type']) => {
    setToast({ message, type });
  };

  const loadBranches = async () => {
    if (typeof window === 'undefined') return;

    if (getApiToken()) {
      try {
        const response = await fetchJson<{ data?: unknown[] }>('/branches');
        const items = Array.isArray(response?.data)
          ? response.data.map((item) => resolveBranchData(item as Record<string, unknown> | null | undefined))
          : [];
        setBranches(items);
        window.localStorage.setItem(BRANCHES_KEY, JSON.stringify(items));
        return;
      } catch (error) {
        console.error('Branch API load failed', error);
        if (isApiConnectivityError(error)) {
          switchToLocalMode('تعذر الوصول للباك إند، تم التحويل للوضع المحلي');
          return;
        }
      }
    }

    setBranches(readLocalBranches());
  };

  const switchToLocalMode = (message = '') => {
    const local = readLocalBranches();
    setBranches(local);
    if (message) showToast(message, 'warning');
  };

  const openBranchModal = (branchId?: string) => {
    if (!canManageBranches && !canEditBranches) {
      showToast('إدارة الفروع متاحة للمصرح لهم فقط', 'error');
      return;
    }

    if (!branchId) {
      setEditingBranchId(null);
      setFormState({ name: '', manager: '', location: '' });
    } else {
      const branch = branches.find((item) => item.id === branchId);
      if (!branch) return;
      setEditingBranchId(branchId);
      setFormState({ name: branch.name, manager: branch.manager || '', location: branch.location || '' });
    }

    setIsModalOpen(true);
  };

  const closeBranchModal = () => {
    setIsModalOpen(false);
    setEditingBranchId(null);
    setFormState({ name: '', manager: '', location: '' });
  };

  const requestDeleteBranch = (branchId: string) => {
    if (!canManageBranches && !canEditBranches) {
      showToast('حذف الفروع متاح للمصرح لهم فقط', 'error');
      return;
    }

    const branch = branches.find((item) => item.id === branchId);
    if (!branch) return;
    setBranchToDelete(branch);
  };

  const cancelDeleteBranch = () => {
    setBranchToDelete(null);
  };

  const deleteBranch = async (branchId: string) => {
    const branch = branches.find((item) => item.id === branchId);
    if (!branch) return;

    if (getApiToken()) {
      try {
        await fetchJson(`/branches/${branchId}`, { method: 'DELETE' });
        showToast('تم حذف الفرع بنجاح', 'success');
        await loadBranches();
        setBranchToDelete(null);
        return;
      } catch (error) {
        if (isApiConnectivityError(error)) {
          setBranches((current) => {
            const next = current.filter((item) => item.id !== branchId);
            window.localStorage.setItem(BRANCHES_KEY, JSON.stringify(next));
            return next;
          });
          showToast('تعذر الوصول للباك إند، تم الحذف محلياً', 'warning');
          setBranchToDelete(null);
          return;
        } else {
          showToast((error as { message?: string } | undefined)?.message || 'فشل حذف الفرع', 'error');
          return;
        }
      }
    }

    setBranches((current) => {
      const next = current.filter((item) => item.id !== branchId);
      window.localStorage.setItem(BRANCHES_KEY, JSON.stringify(next));
      return next;
    });
    showToast('تم حذف الفرع محلياً', 'success');
    setBranchToDelete(null);
  };

  const saveBranch = async () => {
    if (!formState.name.trim()) {
      showToast('اسم الفرع مطلوب', 'error');
      return;
    }

    const payload: Branch = {
      id: editingBranchId || `branch_${Date.now()}`,
      name: formState.name.trim(),
      manager: formState.manager.trim(),
      location: formState.location.trim(),
    };

    if (getApiToken()) {
      try {
        if (editingBranchId) {
          await fetchJson('/branches/' + payload.id, {
            method: 'PUT',
            body: JSON.stringify({
              name: payload.name,
              manager: payload.manager,
              location: payload.location,
            }),
          });
          showToast('تم تعديل الفرع بنجاح', 'success');
        } else {
          await fetchJson('/branches', {
            method: 'POST',
            body: JSON.stringify({
              name: payload.name,
              manager: payload.manager,
              location: payload.location,
            }),
          });
          showToast('تم إضافة الفرع بنجاح', 'success');
        }
        await loadBranches();
        closeBranchModal();
        return;
      } catch (error) {
        if (isApiConnectivityError(error)) {
          setBranches((current) => {
            const next = editingBranchId
              ? current.map((item) => (item.id === editingBranchId ? payload : item))
              : [...current, payload];
            window.localStorage.setItem(BRANCHES_KEY, JSON.stringify(next));
            return next;
          });
          showToast('تعذر الوصول للباك إند، تم الحفظ محلياً', 'warning');
          closeBranchModal();
          return;
        } else {
          showToast((error as { message?: string } | undefined)?.message || 'فشل حفظ الفرع', 'error');
          return;
        }
      }
    }

    setBranches((current) => {
      const next = editingBranchId
        ? current.map((item) => (item.id === editingBranchId ? payload : item))
        : [...current, payload];
      window.localStorage.setItem(BRANCHES_KEY, JSON.stringify(next));
      return next;
    });
    showToast('تم حفظ الفرع محلياً', 'success');
    closeBranchModal();
  };

  return (
    <div dir="rtl" className="space-y-5 font-sans">
      {/* Toast Notification */}
      {toast ? (
        <div
          className={`fixed right-6 top-6 z-50 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : toast.type === 'warning'
              ? 'bg-amber-500 text-white'
              : 'bg-rose-600 text-white'
          }`}
        >
          {toast.message}
        </div>
      ) : null}

      {/* ── Compact Header Card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-50 p-3 text-sky-600">
              <AppIcon icon={Folder} className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">إدارة الفروع</h1>
              <p className="text-xs text-slate-500">متابعة الفروع والمديرين والمواقع من واجهة موحدة بدقة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEditBranches && (
              <button
                type="button"
                onClick={() => openBranchModal()}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                <Plus className="h-4 w-4" />
                إضافة فرع
              </button>
            )}
            <button
              type="button"
              onClick={() => setViewMode(viewMode === 'cards' ? 'table' : 'cards')}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              {viewMode === 'cards' ? 'عرض جدول 📋' : 'عرض كروت 🎴'}
            </button>
          </div>
        </div>

        {/* Compact Stat Cards Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-right">
            <span className="text-xs font-medium text-slate-500">إجمالي الفروع</span>
            <p className="mt-1 text-xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-right">
            <span className="text-xs font-medium text-sky-600">مديرون محددون</span>
            <p className="mt-1 text-xl font-bold text-sky-700">{stats.managers}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-right sm:col-span-1">
            <span className="text-xs font-medium text-emerald-600">عناوين ومواقع</span>
            <p className="mt-1 text-xl font-bold text-emerald-700">{stats.locations}</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="relative flex items-center">
          <SearchSm className="absolute right-3 h-4 w-4 text-slate-400" />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="بحث باسم الفرع، المدير أو الموقع..."
            className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-9 pl-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
          />
        </div>
      </div>

      {/* ── Content View (Cards or Table) ── */}
      {viewMode === 'cards' ? (
        /* ── Compact Cards View ── */
        paginatedBranches.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
            لا توجد فروع تطابق البحث.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedBranches.map((branch) => (
              <div
                key={branch.id}
                className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
              >
                <div>
                  <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                    <div className="flex items-center gap-2.5">
                      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-sky-50 text-sky-600 font-bold text-xs">
                        🏢
                      </div>
                      <div>
                        <h3 className="font-bold text-slate-900 text-sm">{branch.name}</h3>
                        <p className="text-[11px] text-slate-400">المدير: {branch.manager || 'غير محدد'}</p>
                      </div>
                    </div>

                    <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-[10px] font-bold text-sky-700">
                      فرع فعال
                    </span>
                  </div>

                  <div className="mt-3 text-xs text-slate-600">
                    {branch.location ? (
                      isUrl(branch.location) ? (
                        <a
                          href={getFormattedUrl(branch.location)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1.5 font-medium text-sky-600 bg-sky-50/60 px-3 py-1.5 rounded-lg w-full transition hover:bg-sky-100"
                        >
                          <AppIcon icon={MarkerPin01} className="h-3.5 w-3.5 text-sky-600 shrink-0" />
                          <span className="truncate">عرض موقع الفرع على الخريطة</span>
                          <AppIcon icon={LinkExternal01} className="h-3 w-3 shrink-0 opacity-70" />
                        </a>
                      ) : (
                        <div className="bg-slate-50 p-2 rounded-lg text-slate-600">
                          📍 {branch.location}
                        </div>
                      )
                    ) : (
                      <div className="bg-slate-50 p-2 rounded-lg text-slate-400">
                        لا يوجد عنوان مسجل
                      </div>
                    )}
                  </div>
                </div>

                {canEditBranches && (
                  <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => openBranchModal(branch.id)}
                      className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                    >
                      تعديل
                    </button>
                    <button
                      type="button"
                      onClick={() => requestDeleteBranch(branch.id)}
                      className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 transition"
                      title="حذف"
                    >
                      <AppIcon icon={Trash01} className="h-4 w-4" />
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )
      ) : (
        /* ── Compact Table View ── */
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">اسم الفرع</th>
                  <th className="px-4 py-3 font-semibold">مدير الفرع</th>
                  <th className="px-4 py-3 font-semibold">الموقع</th>
                  <th className="px-4 py-3 text-center font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedBranches.map((branch) => (
                  <tr key={branch.id} className="hover:bg-slate-50/70 transition">
                    <td className="px-4 py-3 font-bold text-slate-900">{branch.name}</td>
                    <td className="px-4 py-3 text-slate-600">{branch.manager || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {branch.location ? (
                        isUrl(branch.location) ? (
                          <a
                            href={getFormattedUrl(branch.location)}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 font-medium text-sky-600 hover:underline"
                          >
                            <AppIcon icon={MarkerPin01} className="h-3.5 w-3.5 shrink-0 text-sky-600" />
                            <span>عرض الخريطة</span>
                            <AppIcon icon={LinkExternal01} className="h-3 w-3 shrink-0 opacity-70" />
                          </a>
                        ) : (
                          branch.location
                        )
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-2">
                        {canEditBranches && (
                          <button
                            type="button"
                            onClick={() => openBranchModal(branch.id)}
                            className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                          >
                            تعديل
                          </button>
                        )}
                        {canEditBranches && (
                          <button
                            type="button"
                            onClick={() => requestDeleteBranch(branch.id)}
                            className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 transition"
                            title="حذف"
                          >
                            <AppIcon icon={Trash01} className="h-4 w-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}

                {filteredBranches.length === 0 && (
                  <tr>
                    <td colSpan={4} className="px-4 py-10 text-center text-slate-400 text-xs">
                      لا توجد فروع تطابق البحث.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Pagination Bar ── */}
      <Pagination
        currentPage={currentPage}
        totalPages={totalPages}
        totalItems={filteredBranches.length}
        onPageChange={setCurrentPage}
        label="فرع"
      />

      {/* ── Modal Dialog: Add / Edit Branch ── */}
      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-sky-50 p-2.5 text-sky-600">
                  <AppIcon icon={Folder} className="h-5 w-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingBranchId ? 'تعديل الفرع' : 'إضافة فرع جديد'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeBranchModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <div className="space-y-4 p-5 text-right text-xs">
              <div>
                <label className="block mb-1 font-semibold text-slate-700">اسم الفرع</label>
                <input
                  value={formState.name}
                  placeholder="مثال: فرع مدينة نصر"
                  onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">مدير الفرع</label>
                <input
                  value={formState.manager}
                  placeholder="اسم مدير الفرع..."
                  onChange={(event) => setFormState((prev) => ({ ...prev, manager: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">
                  رابط الموقع (خرائط جوجل / Google Maps)
                </label>
                <input
                  type="url"
                  value={formState.location}
                  placeholder="https://maps.google.com/..."
                  dir="ltr"
                  onChange={(event) => setFormState((prev) => ({ ...prev, location: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-left text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
              <button
                type="button"
                onClick={closeBranchModal}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={saveBranch}
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 transition"
              >
                حفظ الفرع
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* Delete Confirmation Modal */}
      {branchToDelete ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-md overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200 p-5 text-right space-y-4">
            <h3 className="text-base font-bold text-slate-900">تأكيد حذف الفرع</h3>
            <p className="text-xs text-slate-600">
              هل أنت متأكد من حذف الفرع <span className="font-bold text-slate-900">{branchToDelete.name}</span>؟
            </p>
            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={cancelDeleteBranch}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={() => deleteBranch(branchToDelete.id)}
                className="rounded-xl bg-rose-600 px-4 py-2 text-xs font-semibold text-white hover:bg-rose-700"
              >
                حذف الفرع
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

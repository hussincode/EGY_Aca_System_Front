import { useEffect, useMemo, useState } from 'react';
import { Folder, Gift02, SearchSm } from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';

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

export default function Branches() {
  const [branches, setBranches] = useState<Branch[]>(() => readLocalBranches());
  const [search, setSearch] = useState('');
  const [isUsingAPI, setIsUsingAPI] = useState(() => typeof window !== 'undefined' ? !!window.api?.getToken?.() : false);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingBranchId, setEditingBranchId] = useState<string | null>(null);
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

  const stats = useMemo(() => {
    const total = branches.length;
    const managers = branches.filter((item) => item.manager?.trim()).length;
    const locations = branches.filter((item) => item.location?.trim()).length;
    return { total, managers, locations };
  }, [branches]);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(BRANCHES_KEY, JSON.stringify(branches));
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

  const loadBranches = async (useApi = isUsingAPI) => {
    if (typeof window === 'undefined') return;

    const api = window.api;
    if (useApi && api?.getToken && api.getBranches) {
      try {
        const response = await api.getBranches();
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
    setIsUsingAPI(false);
    const local = readLocalBranches();
    setBranches(local);
    if (message) showToast(message, 'warning');
  };

  const openBranchModal = (branchId?: string) => {
    if (!canManageBranches) {
      showToast('إدارة الفروع متاحة للأدمن فقط', 'error');
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

    const api = window.api;
    if (isUsingAPI && api?.getToken) {
      try {
        if (editingBranchId) {
          await api.updateBranch?.(payload.id, payload);
          showToast('تم تعديل الفرع عبر الباك إند', 'success');
        } else {
          await api.createBranch?.(payload);
          showToast('تم إضافة الفرع عبر الباك إند', 'success');
        }
        await loadBranches(true);
        closeBranchModal();
        return;
      } catch (error) {
        if (isApiConnectivityError(error)) {
          showToast('تعذر الوصول للباك إند، تم الحفظ محلياً', 'warning');
          switchToLocalMode();
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

  const deleteBranch = async (branchId: string) => {
    if (!canManageBranches) {
      showToast('حذف الفروع متاح للأدمن فقط', 'error');
      return;
    }

    if (!window.confirm('هل تريد حذف هذا الفرع؟')) return;

    const api = window.api;
    if (isUsingAPI && api?.getToken) {
      try {
        await api.deleteBranch?.(branchId);
        showToast('تم حذف الفرع عبر الباك إند', 'success');
        await loadBranches(true);
        return;
      } catch (error) {
        if (isApiConnectivityError(error)) {
          showToast('تعذر الوصول للباك إند، تم الحذف محلياً', 'warning');
          switchToLocalMode();
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
  };

  const toggleApiMode = async () => {
    if (typeof window === 'undefined') return;
    if (!window.api?.getToken) {
      showToast('يلزم تسجيل دخول على الباك إند لتفعيل وضع API', 'error');
      return;
    }

    const nextMode = !isUsingAPI;
    setIsUsingAPI(nextMode);
    if (nextMode) {
      await loadBranches(true);
    } else {
      setBranches(readLocalBranches());
    }
  };

  const apiLabel = isUsingAPI ? 'Backend Sync: API' : 'Backend Sync: Local';

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 text-slate-500">
              <AppIcon icon={Folder} className="text-slate-500" />
              <span className="text-sm">إدارة الفروع</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">إدارة الفروع</h1>
            <p className="mt-2 text-sm text-slate-600">متابعة الفروع والمديرين والمواقع من واجهة موحدة بنفس طابع السيستم.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => openBranchModal()}
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              إضافة فرع
            </button>
            <button
              type="button"
              onClick={toggleApiMode}
              className={`inline-flex items-center gap-2 rounded-2xl px-4 py-3 text-sm font-semibold transition ${isUsingAPI ? 'bg-emerald-600 text-white hover:bg-emerald-700' : 'bg-slate-50 text-slate-800 hover:bg-slate-100'}`}
            >
              <AppIcon icon={Gift02} className={isUsingAPI ? 'text-white' : 'text-slate-500'} />
              {apiLabel}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
        <div className="grid gap-4 md:grid-cols-3">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-sm font-semibold text-slate-500">إجمالي الفروع</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{stats.total}</p>
            <p className="mt-2 text-sm text-slate-500">كل الفروع المسجلة حاليًا</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-sm font-semibold text-slate-500">مديرون محددون</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{stats.managers}</p>
            <p className="mt-2 text-sm text-slate-500">الفروع التي لها مدير مسجل</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 text-center">
            <p className="text-sm font-semibold text-slate-500">عناوين مكتملة</p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">{stats.locations}</p>
            <p className="mt-2 text-sm text-slate-500">الفروع التي تحتوي على موقع واضح</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
        <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
          <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
            <AppIcon icon={SearchSm} className="text-slate-500" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="بحث عن فرع أو مدير..."
              className="w-full border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
            />
          </div>
          <button
            type="button"
            onClick={() => openBranchModal()}
            className="inline-flex items-center justify-center rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            إضافة فرع
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/70">
        <div className="flex flex-col gap-3 border-b border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-semibold text-slate-900">قائمة الفروع</h2>
            <p className="mt-1 text-sm text-slate-500">عرض الفروع مع خيارات التعديل والحذف.</p>
          </div>
          <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">{stats.total} فرع</span>
        </div>
        <div className="overflow-x-auto px-6 py-5">
          <table className="min-w-full border-separate border-spacing-y-3 text-sm">
            <thead>
              <tr className="text-right text-slate-500">
                <th className="px-4 py-3 text-right">اسم الفرع</th>
                <th className="px-4 py-3 text-right">مدير الفرع</th>
                <th className="px-4 py-3 text-right">الموقع</th>
                <th className="px-4 py-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredBranches.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
                    لم يتم العثور على فروع تطابق البحث.
                  </td>
                </tr>
              ) : (
                filteredBranches.map((branch) => (
                  <tr key={branch.id} className="rounded-3xl border border-slate-200 bg-slate-50">
                    <td className="px-4 py-4 text-right font-semibold text-slate-900">{branch.name}</td>
                    <td className="px-4 py-4 text-right text-slate-600">{branch.manager || '-'}</td>
                    <td className="px-4 py-4 text-right text-slate-600">{branch.location || '-'}</td>
                    <td className="px-4 py-4 text-center">
                      <div className="flex flex-wrap justify-center gap-2">
                        <button
                          type="button"
                          onClick={() => openBranchModal(branch.id)}
                          className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => deleteBranch(branch.id)}
                          className="rounded-2xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-200"
                        >
                          حذف
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h3 className="text-xl font-semibold text-slate-900">{editingBranchId ? 'تعديل فرع' : 'إضافة فرع'}</h3>
              <button type="button" onClick={closeBranchModal} className="text-slate-500 transition hover:text-slate-900">×</button>
            </div>
            <div className="space-y-6 p-6">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                  اسم الفرع
                  <input
                    value={formState.name}
                    onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                  />
                </label>
                <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                  مدير الفرع
                  <input
                    value={formState.manager}
                    onChange={(event) => setFormState((prev) => ({ ...prev, manager: event.target.value }))}
                    className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                  />
                </label>
              </div>
              <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                الموقع
                <input
                  value={formState.location}
                  onChange={(event) => setFormState((prev) => ({ ...prev, location: event.target.value }))}
                  className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                />
              </label>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={closeBranchModal}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={saveBranch}
                className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                حفظ
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`fixed bottom-6 left-6 right-6 z-50 mx-auto max-w-md rounded-3xl px-5 py-4 text-sm font-semibold text-white ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'warning' ? 'bg-amber-500' : 'bg-rose-500'}`}>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

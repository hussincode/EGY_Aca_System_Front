import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import logo from '@/assets/logo.jpg';

type UserRole = 'admin' | 'manager' | 'coach' | 'accountant';

type UserRecord = {
  id: string;
  name: string;
  phone: string;
  photo?: string;
  email: string;
  password?: string;
  role: UserRole;
  branch?: string;
  branchName?: string;
  active?: boolean;
  access: string[];
  permissions: string[];
  lastLogin?: string;
};

type Branch = {
  id?: string;
  name?: string;
};

type UserFormState = {
  id: string;
  name: string;
  phone: string;
  photo: string;
  email: string;
  password: string;
  role: UserRole;
  branch: string;
  access: string[];
  permissions: string[];
};

type ToastState = {
  message: string;
  type: 'success' | 'error' | 'warning';
};

const initialForm: UserFormState = {
  id: '',
  name: '',
  phone: '',
  photo: '',
  email: '',
  password: '',
  role: 'manager',
  branch: '',
  access: [],
  permissions: [],
};

const accessOptions = [
  { value: 'dashboard', label: 'لوحة التحكم' },
  { value: 'players', label: 'اللاعبين' },
  { value: 'subscriptions', label: 'الاشتراكات' },
  { value: 'finance', label: 'الماليات' },
  { value: 'users', label: 'المستخدمين' },
];

const permissionGroups = [
  {
    title: 'اللاعبين',
    values: ['players_view', 'players_add', 'players_edit', 'players_delete'],
  },
  {
    title: 'الاشتراكات',
    values: ['subs_view', 'subs_add', 'subs_edit', 'subs_delete'],
  },
  {
    title: 'الماليات',
    values: ['fin_view', 'fin_add', 'fin_edit', 'fin_delete'],
  },
  {
    title: 'المستخدمين',
    values: ['users_view', 'users_add', 'users_edit', 'users_delete'],
  },
];

const roleDefaults: Record<UserRole, { access: string[]; permissions: string[] }> = {
  admin: {
    access: ['dashboard', 'players', 'subscriptions', 'finance', 'users'],
    permissions: ['players_view', 'players_add', 'players_edit', 'players_delete', 'subs_view', 'subs_add', 'subs_edit', 'subs_delete', 'fin_view', 'fin_add', 'fin_edit', 'fin_delete', 'users_view', 'users_add', 'users_edit', 'users_delete'],
  },
  manager: {
    access: ['dashboard', 'players', 'subscriptions', 'finance', 'users'],
    permissions: ['players_view', 'players_add', 'players_edit', 'subs_view', 'subs_add', 'subs_edit', 'fin_view', 'fin_add', 'fin_edit', 'users_view', 'users_add', 'users_edit'],
  },
  coach: {
    access: ['dashboard', 'players'],
    permissions: ['players_view', 'players_edit', 'subs_view'],
  },
  accountant: {
    access: ['dashboard', 'subscriptions', 'finance'],
    permissions: ['fin_view', 'fin_add', 'fin_edit', 'fin_delete', 'subs_view', 'subs_add', 'subs_edit'],
  },
};

function readJson<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const raw = window.localStorage.getItem(key);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function writeJson<T>(key: string, value: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(value));
}

function normalizeRole(value: string | undefined): UserRole {
  const role = String(value || '').toLowerCase();
  if (role === 'admin') return 'admin';
  if (role === 'coach' || role.includes('مدرب')) return 'coach';
  if (role === 'accountant' || role.includes('محاسب')) return 'accountant';
  if (role === 'manager' || role.includes('موظف') || role.includes('مدير')) return 'manager';
  return 'manager';
}

function roleLabel(value: string | undefined) {
  const labels: Record<UserRole, string> = {
    admin: 'Admin',
    manager: 'Manager',
    coach: 'Coach',
    accountant: 'Accountant',
  };
  return labels[normalizeRole(value)] || '-';
}

function createId(prefix = 'user') {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeUserFromApi(row: Record<string, unknown> | null | undefined): UserRecord | null {
  if (!row) return null;
  return {
    id: String(row.id || row._id || ''),
    name: String(row.name || ''),
    phone: String(row.phone || ''),
    photo: String(row.photo || ''),
    email: String(row.email || ''),
    role: normalizeRole(String(row.role || '')),
    branch: String(row.branchId || row.branch_id || row.branch || ''), // branch UUID from API
    branchName: String(row.branchName || row.branch || ''),
    active: row.active !== false,
    access: Array.isArray(row.access) ? row.access as string[] : [],
    permissions: Array.isArray(row.permissions) ? row.permissions as string[] : [],
    lastLogin: String(row.lastLogin || ''),
  };
}

export default function UsersPage() {
  const [users, setUsers] = useState<UserRecord[]>(() => readJson('users', []));
  const [branches] = useState<Branch[]>(() => {
    const storedBranches = readJson<Branch[]>('branches', []);
    return storedBranches.length ? storedBranches : [];
  });
  const [search, setSearch] = useState('');
  const [roleFilter, setRoleFilter] = useState('');
  const [toast, setToast] = useState<ToastState | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<UserFormState>(initialForm);
  const [photoPreview, setPhotoPreview] = useState<string>(logo);

  // Load from API on mount
  useEffect(() => {
    const loadFromApi = async () => {
      const api = window.api;
      if (!api?.getUsers || !api?.getToken?.()) return;

      try {
        const response = await api.getUsers() as { data?: unknown[] };
        const serverData = Array.isArray(response?.data) ? response.data as Record<string, unknown>[] : [];
        if (serverData.length > 0) {
          const mapped = serverData.map((item) => normalizeUserFromApi(item)).filter(Boolean) as UserRecord[];
          if (mapped.length > 0) {
            setUsers(mapped);
            writeJson('users', mapped);
          }
        }
      } catch {
        // fallback to localStorage
      }
    };
    loadFromApi();
  }, []);

  useEffect(() => {
    writeJson('users', users);
  }, [users]);

  const showToast = (message: string, type: ToastState['type'] = 'success') => {
    setToast({ message, type });
  };

  const filteredUsers = useMemo(() => {
    const needle = search.toLowerCase();
    return users.filter((user) => {
      const matchesSearch = !needle || user.name.toLowerCase().includes(needle) || user.email.toLowerCase().includes(needle);
      const matchesRole = !roleFilter || normalizeRole(user.role) === normalizeRole(roleFilter);
      return matchesSearch && matchesRole;
    });
  }, [users, search, roleFilter]);

  const openAddModal = () => {
    setEditingId(null);
    setForm({ ...initialForm, role: 'manager', access: roleDefaults.manager.access, permissions: roleDefaults.manager.permissions });
    setPhotoPreview(logo);
    setIsModalOpen(true);
  };

  const openEditModal = (user: UserRecord) => {
    setEditingId(user.id);
    setForm({
      id: user.id,
      name: user.name,
      phone: user.phone,
      photo: user.photo || '',
      email: user.email,
      password: '',
      role: normalizeRole(user.role),
      branch: user.branch || user.branchName || '',
      access: user.access || [],
      permissions: user.permissions || [],
    });
    setPhotoPreview(user.photo || logo);
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setForm({ ...initialForm, role: 'manager', access: roleDefaults.manager.access, permissions: roleDefaults.manager.permissions });
    setEditingId(null);
    setPhotoPreview(logo);
  };

  const handlePhotoChange = (event: ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : '';
      setForm((prev) => ({ ...prev, photo: result }));
      setPhotoPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const applyRoleDefaults = (role: UserRole) => {
    const defaults = roleDefaults[role];
    setForm((prev) => ({ ...prev, role, access: defaults.access, permissions: defaults.permissions }));
  };

const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!form.name.trim() || !form.email.trim()) {
      showToast('الاسم والبريد مطلوبان', 'error');
      return;
    }

    if (!editingId) {
      if (!form.password.trim() || form.password.trim().length < 6) {
        showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
        return;
      }
    } else if (form.password.trim() && form.password.trim().length < 6) {
      showToast('كلمة المرور يجب أن تكون 6 أحرف على الأقل', 'error');
      return;
    }

    const nextUser: UserRecord = {
      id: editingId || createId('user'),
      name: form.name.trim(),
      phone: form.phone.trim(),
      photo: form.photo.trim(),
      email: form.email.trim(),
      role: form.role,
      branch: form.branch,
      branchName: form.branch,
      active: true,
      access: form.access,
      permissions: form.permissions,
      lastLogin: editingId ? users.find((item) => item.id === editingId)?.lastLogin : new Date().toISOString(),
      ...(form.password.trim() ? { password: form.password.trim() } : {}),
    };

    try {
      const api = window.api;
      const token = api?.getToken?.();

      if (token) {
        if (editingId) {
          if (api?.updateUser) {
            await api.updateUser(editingId, {
              name: nextUser.name,
              email: nextUser.email,
              role: nextUser.role,
              branch_id: nextUser.branch || null,
              ...(nextUser.password ? { password: nextUser.password } : {}),
            });
          }
        } else {
          // Create new user via auth/register API
          if (api?.register) {
            const result = await api.register({
              name: nextUser.name,
              email: nextUser.email,
              password: form.password.trim(),
              role: nextUser.role,
              branch_id: nextUser.branch || undefined,
            }) as { data?: { id?: string } } | undefined;
            if (result?.data?.id) {
              nextUser.id = String(result.data.id);
            }
          }
        }
      }

      if (editingId) {
        setUsers((prev) => prev.map((item) => (item.id === editingId ? { ...item, ...nextUser, active: item.active !== false } : item)));
      } else {
        setUsers((prev) => [nextUser, ...prev]);
      }

      setIsModalOpen(false);
      setForm({ ...initialForm, role: 'manager', access: roleDefaults.manager.access, permissions: roleDefaults.manager.permissions });
      setPhotoPreview(logo);
      showToast('تم حفظ المستخدم بنجاح', 'success');
    } catch (error) {
      console.error('Failed to save user via API, saving locally', error);
      if (editingId) {
        setUsers((prev) => prev.map((item) => (item.id === editingId ? { ...item, ...nextUser, active: item.active !== false } : item)));
      } else {
        setUsers((prev) => [nextUser, ...prev]);
      }
      setIsModalOpen(false);
      setForm({ ...initialForm, role: 'manager', access: roleDefaults.manager.access, permissions: roleDefaults.manager.permissions });
      setPhotoPreview(logo);
      showToast('تم حفظ المستخدم محلياً', 'success');
    }
  };

  const toggleStatus = (id: string) => {
    setUsers((prev) => prev.map((user) => (user.id === id ? { ...user, active: user.active === false } : user)));
    showToast('تم تحديث حالة المستخدم', 'success');
  };

  const deleteUser = async (id: string) => {
    if (!window.confirm('حذف المستخدم؟')) return;

    try {
      const api = window.api;
      if (api?.getToken?.() && api.deleteUser) {
        await api.deleteUser(id);
      }
    } catch (error) {
      console.error('Failed to delete user via API', error);
    }

    setUsers((prev) => prev.filter((user) => user.id !== id));
    showToast('تم حذف المستخدم', 'success');
  };

  const sendCoachCode = (user: UserRecord) => {
    if (!user.phone) {
      showToast('لا يوجد رقم هاتف مسجل لهذا المدرب', 'warning');
      return;
    }

    const cleanPhone = user.phone.replace(/\D/g, '');
    const portalUrl = `${window.location.origin}/coach-evaluations.html`;
    const message = encodeURIComponent(`أهلاً ${user.name}\nبيانات الدخول: ${user.id}\n${portalUrl}`);
    window.open(`https://wa.me/${cleanPhone}?text=${message}`, '_blank', 'noopener,noreferrer');
  };

  const stats = useMemo(() => {
    const admins = users.filter((user) => normalizeRole(user.role) === 'admin').length;
    const permissionsCount = users.reduce((sum, user) => sum + (user.permissions?.length || 0), 0);
    return { total: users.length, admins, permissions: permissionsCount };
  }, [users]);

  return (
    <div className="space-y-6" dir="rtl">
      <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-500">المستخدمين</p>
            <h1 className="text-3xl font-semibold text-slate-900">إدارة المستخدمين</h1>
            <p className="mt-2 text-sm text-slate-600">تنظيم الحسابات والأدوار وصلاحيات الوصول والعمليات من واجهة موحدة وواضحة.</p>
          </div>
          <button type="button" onClick={openAddModal} className="rounded-2xl bg-sky-600 px-4 py-2.5 text-sm font-medium text-white">
            + إضافة مستخدم
          </button>
        </div>
      </div>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:grid-cols-[1.4fr_0.8fr]">
        <div>
          <div className="mb-3 inline-flex rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">أدوار وصلاحيات</div>
          <h2 className="text-2xl font-semibold text-slate-900">إدارة كاملة لحسابات النظام</h2>
          <p className="mt-2 text-sm text-slate-600">أضف مستخدمين جدد، حدّد الأدوار، وخصص صلاحيات الصفحات والعمليات بدقة من شاشة واحدة.</p>
        </div>
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">إجمالي المستخدمين</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{stats.total}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">حسابات Admin</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{stats.admins}</div>
          </div>
          <div className="rounded-2xl bg-slate-50 p-4">
            <div className="text-sm text-slate-500">إجمالي الصلاحيات</div>
            <div className="mt-2 text-2xl font-semibold text-slate-900">{stats.permissions}</div>
          </div>
        </div>
      </div>

      <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex flex-1 items-center rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2">
            <span className="ml-2 text-slate-400">⌕</span>
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              className="w-full bg-transparent text-right outline-none"
              placeholder="بحث بالاسم أو البريد..."
            />
          </div>
          <select
            value={roleFilter}
            onChange={(event) => setRoleFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right outline-none"
          >
            <option value="">كل الأدوار</option>
            <option value="admin">Admin</option>
            <option value="manager">Manager</option>
            <option value="coach">Coach</option>
            <option value="accountant">Accountant</option>
          </select>
          <button type="button" onClick={openAddModal} className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-medium text-white">
            إضافة مستخدم
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xl font-semibold text-slate-900">قائمة المستخدمين</h3>
            <span className="rounded-full bg-sky-100 px-3 py-1 text-sm font-medium text-sky-700">{filteredUsers.length} مستخدم</span>
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-right">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3">كود الدخول</th>
                <th className="px-4 py-3">المستخدم</th>
                <th className="px-4 py-3">البريد</th>
                <th className="px-4 py-3">الدور</th>
                <th className="px-4 py-3">الفرع</th>
                <th className="px-4 py-3">الحالة</th>
                <th className="px-4 py-3">الوصول</th>
                <th className="px-4 py-3">الصلاحيات</th>
                <th className="px-4 py-3">الإجراءات</th>
              </tr>
            </thead>
            <tbody>
              {filteredUsers.length ? (
                filteredUsers.map((user) => {
                  const isActive = user.active !== false;
                  return (
                    <tr key={user.id} className="border-t border-slate-100 text-sm text-slate-700">
                      <td className="px-4 py-3 font-mono font-semibold text-sky-700">{user.id}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-3">
                          <img src={user.photo || logo} alt={user.name} className="h-10 w-10 rounded-full object-cover" />
                          <div>
                            <div className="font-medium text-slate-900">{user.name}</div>
                            <div className="text-xs text-slate-500">{user.phone || '—'}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3">{user.email}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${normalizeRole(user.role) === 'admin' ? 'bg-rose-100 text-rose-700' : 'bg-sky-100 text-sky-700'}`}>
                          {roleLabel(user.role)}
                        </span>
                      </td>
                      <td className="px-4 py-3">{user.branch || user.branchName || 'كل الفروع'}</td>
                      <td className="px-4 py-3">
                        <span className={`rounded-full px-2.5 py-1 text-xs font-medium ${isActive ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-700'}`}>
                          {isActive ? 'نشط' : 'موقف'}
                        </span>
                      </td>
                      <td className="px-4 py-3">{user.access?.length || 0}</td>
                      <td className="px-4 py-3">{user.permissions?.length || 0}</td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap gap-2">
                          {normalizeRole(user.role) === 'coach' ? (
                            <button type="button" onClick={() => sendCoachCode(user)} className="rounded-xl border border-emerald-300 px-3 py-1.5 text-sm text-emerald-700">
                              WhatsApp
                            </button>
                          ) : null}
                          <button type="button" onClick={() => toggleStatus(user.id)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm">
                            {isActive ? 'تجميد' : 'تنشيط'}
                          </button>
                          <button type="button" onClick={() => openEditModal(user)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm">
                            تعديل
                          </button>
                          <button type="button" onClick={() => deleteUser(user.id)} className="rounded-xl border border-rose-300 px-3 py-1.5 text-sm text-rose-600">
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-8 text-center text-slate-500">لا توجد نتائج مطابقة</td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

{isModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-2 sm:p-4">
          <div className="flex max-h-[95vh] w-full max-w-2xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl sm:rounded-3xl sm:p-5">
            <div className="flex shrink-0 items-center justify-between border-b border-slate-100 px-4 py-3 sm:mb-3 sm:border-0 sm:px-0 sm:py-0">
              <h3 className="text-base font-semibold text-slate-900 sm:text-lg">{editingId ? 'تعديل مستخدم' : 'إضافة مستخدم'}</h3>
              <button type="button" onClick={closeModal} className="rounded-full p-1.5 text-slate-500 hover:bg-slate-100">✕</button>
            </div>
            <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto space-y-3 px-4 py-3 sm:space-y-4 sm:px-0 sm:py-0">
              <div className="grid gap-3 sm:grid-cols-2">
                <div className="text-center sm:col-span-2">
                  <label className="inline-flex cursor-pointer flex-col items-center gap-1">
                    <img src={photoPreview || logo} alt="preview" className="h-14 w-14 rounded-full border border-slate-200 object-cover" />
                    <span className="rounded-full bg-sky-600 px-2 py-0.5 text-xs text-white">رفع صورة</span>
                    <input type="file" accept="image/*" onChange={handlePhotoChange} className="hidden" />
                  </label>
                </div>

                <label className="block text-xs text-slate-700">
                  الاسم
                  <input value={form.name} onChange={(event) => setForm((prev) => ({ ...prev, name: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none" required />
                </label>
                <label className="block text-xs text-slate-700">
                  رقم الهاتف
                  <input value={form.phone} onChange={(event) => setForm((prev) => ({ ...prev, phone: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none" placeholder="اختياري" />
                </label>
                <label className="block text-xs text-slate-700">
                  البريد
                  <input type="email" value={form.email} onChange={(event) => setForm((prev) => ({ ...prev, email: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none" required />
                </label>
                <label className="block text-xs text-slate-700">
                  كلمة المرور
                  <input type="password" value={form.password} onChange={(event) => setForm((prev) => ({ ...prev, password: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none" placeholder={editingId ? 'اتركها فارغة' : ''} />
                </label>
                <label className="block text-xs text-slate-700">
                  الدور
                  <select value={form.role} onChange={(event) => applyRoleDefaults(event.target.value as UserRole)} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none">
                    <option value="admin">Admin</option>
                    <option value="manager">Manager</option>
                    <option value="coach">Coach</option>
                    <option value="accountant">Accountant</option>
                  </select>
                </label>
                <label className="block text-xs text-slate-700">
                  الفرع
                  <select value={form.branch} onChange={(event) => setForm((prev) => ({ ...prev, branch: event.target.value }))} className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-1.5 text-sm outline-none">
                    <option value="">كل الفروع</option>
                    {branches.map((branch) => (
                      <option key={branch.id || branch.name} value={branch.id || branch.name || ''}>{branch.name}</option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="grid gap-3 sm:grid-cols-2">
                <div className="rounded-xl border border-slate-200 p-3">
                  <h4 className="mb-2 text-xs font-semibold text-slate-900">صلاحيات الوصول للصفحات</h4>
                  <div className="space-y-1">
                    {accessOptions.map((access) => (
                      <label key={access.value} className="flex items-center gap-2 text-xs text-slate-700">
                        <input
                          type="checkbox"
                          checked={form.access.includes(access.value)}
                          onChange={(event) => {
                            setForm((prev) => ({
                              ...prev,
                              access: event.target.checked ? [...prev.access, access.value] : prev.access.filter((item) => item !== access.value),
                            }));
                          }}
                        />
                        {access.label}
                      </label>
                    ))}
                  </div>
                </div>

                <div className="rounded-xl border border-slate-200 p-3">
                  <h4 className="mb-2 text-xs font-semibold text-slate-900">صلاحيات العمليات</h4>
                  <div className="max-h-48 space-y-2 overflow-auto">
                    {permissionGroups.map((group) => (
                      <div key={group.title}>
                        <div className="mb-1 text-xs font-semibold text-sky-700">{group.title}</div>
                        <div className="space-y-1">
                          {group.values.map((value) => (
                            <label key={value} className="flex items-center gap-2 text-xs text-slate-700">
                              <input
                                type="checkbox"
                                checked={form.permissions.includes(value)}
                                onChange={(event) => {
                                  setForm((prev) => ({
                                    ...prev,
                                    permissions: event.target.checked ? [...prev.permissions, value] : prev.permissions.filter((item) => item !== value),
                                  }));
                                }}
                              />
                              {value}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              <div className="sticky bottom-0 flex justify-end gap-2 border-t border-slate-100 bg-white pb-1 pt-3 sm:border-0 sm:pb-0 sm:pt-0">
                <button type="button" onClick={closeModal} className="rounded-xl border border-slate-300 px-3 py-1.5 text-xs text-slate-700">
                  إلغاء
                </button>
                <button type="submit" className="rounded-xl bg-sky-600 px-3 py-1.5 text-xs font-medium text-white">
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`fixed left-1/2 top-6 z-[80] -translate-x-1/2 rounded-2xl px-4 py-3 text-sm font-medium text-white ${toast.type === 'success' ? 'bg-emerald-600' : toast.type === 'warning' ? 'bg-amber-600' : 'bg-rose-600'}`}>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { Plus, SearchSm, Phone01, Trash01, User01, CalendarCheck01 } from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';
import Pagination from '@/components/Pagination';
import { useAuth } from '@/contexts/AuthContext';

type StaffPayType = 'hour' | 'fixed' | 'percent';

type StaffMember = {
  id: string;
  staffSerial: string;
  name: string;
  phone?: string;
  role: string;
  payType: StaffPayType;
  rate: number;
  hours: number;
  revenue: number;
};

type StaffFormState = {
  name: string;
  phone: string;
  role: string;
  payType: StaffPayType;
  rate: number;
  hours: number;
  revenue: number;
};

type FinanceRecord = {
  source?: string;
  sourceMonth?: string;
};

type SharedFinanceApi = {
  getFinances: () => FinanceRecord[];
  setFinances: (records: FinanceRecord[]) => void;
  addFinance?: (...args: unknown[]) => void;
};

declare global {
  interface Window {
    sharedFinance?: SharedFinanceApi;
  }
}

const initialFormState: StaffFormState = {
  name: '',
  phone: '',
  role: '',
  payType: 'hour',
  rate: 0,
  hours: 0,
  revenue: 0,
};

function readStoredData<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function buildEmptyForm(): StaffFormState {
  return { ...initialFormState };
}

function formatStaffSerial(sequence: number) {
  return `STF-${String(sequence).padStart(5, '0')}`;
}

function getNextStaffSequence(staff: StaffMember[]) {
  const used = new Set<number>();
  staff.forEach((member) => {
    const match = member.staffSerial.match(/^STF-(\d{5})$/);
    if (match) used.add(Number(match[1]));
  });
  for (let i = 1; i <= 99999; i += 1) {
    if (!used.has(i)) return i;
  }
  return 1;
}

const payTypeLabel = (payType: StaffPayType) => {
  if (payType === 'hour') return 'بالساعة';
  if (payType === 'fixed') return 'راتب ثابت';
  return 'نسبة ومئوية';
};

const payTypeBadgeStyle = (payType: StaffPayType) => {
  if (payType === 'hour') return 'bg-sky-50 text-sky-700 border-sky-200';
  if (payType === 'fixed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  return 'bg-amber-50 text-amber-700 border-amber-200';
};

export default function Staff() {
  const { canEdit } = useAuth();
  const canEditStaff = canEdit('staff');
  const [staff, setStaff] = useState<StaffMember[]>(() => readStoredData('staff', []));
  const [formState, setFormState] = useState<StaffFormState>(buildEmptyForm());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [payTypeFilter, setPayTypeFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    window.localStorage.setItem('staff', JSON.stringify(staff));
  }, [staff]);

  useEffect(() => {
    const loadFromApi = async () => {
      if (!window.api?.getToken?.()) return;
      try {
        const response = await window.api.getStaff();
        const apiStaff = Array.isArray(response?.data) ? (response.data as StaffMember[]) : [];
        if (apiStaff.length) {
          setStaff(apiStaff);
          window.localStorage.setItem('staff', JSON.stringify(apiStaff));
        }
      } catch {
        // fallback
      }
    };
    loadFromApi();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  const filteredStaff = useMemo(() => {
    return staff.filter((member) => {
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        member.name.toLowerCase().includes(term) ||
        (member.phone || '').includes(term) ||
        member.role.toLowerCase().includes(term) ||
        member.staffSerial.toLowerCase().includes(term);

      const matchesPayType = payTypeFilter === 'all' || member.payType === payTypeFilter;

      return matchesSearch && matchesPayType;
    });
  }, [staff, search, payTypeFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, payTypeFilter]);

  const totalPages = Math.ceil(filteredStaff.length / rowsPerPage) || 1;
  const paginatedStaff = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredStaff.slice(start, start + rowsPerPage);
  }, [filteredStaff, currentPage]);

  const metrics = useMemo(() => {
    let hour = 0;
    let fixed = 0;
    let percent = 0;

    staff.forEach((member) => {
      if (member.payType === 'hour') {
        hour += member.rate * member.hours;
      } else if (member.payType === 'percent') {
        percent += (member.rate / 100) * member.revenue;
      } else {
        fixed += member.rate;
      }
    });

    return { total: staff.length, hour, fixed, percent, grandTotal: hour + fixed + percent };
  }, [staff]);

  const handleEdit = (index: number) => {
    const member = staff[index];
    setEditingIndex(index);
    setFormState({
      name: member.name,
      phone: member.phone ?? '',
      role: member.role,
      payType: member.payType,
      rate: member.rate,
      hours: member.hours,
      revenue: member.revenue,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingIndex(null);
    setFormState(buildEmptyForm());
  };

  const handleSubmit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const staffPayload = {
      name: formState.name,
      phone: formState.phone,
      role: formState.role,
      pay_type: formState.payType,
      rate: formState.rate,
      hours: formState.hours,
      revenue: formState.revenue,
    };

    try {
      if (editingIndex !== null) {
        const member = staff[editingIndex];
        if (window.api?.updateStaff && member.id) {
          await window.api.updateStaff(member.id, staffPayload);
        }
        setStaff((current) =>
          current.map((m, index) => (index === editingIndex ? { ...m, ...formState } : m))
        );
        showToast('تم تعديل بيانات الموظف بنجاح');
      } else {
        let newId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
        const newSerial = formatStaffSerial(getNextStaffSequence(staff));

        if (window.api?.createStaff) {
          const response = await window.api.createStaff({ ...staffPayload, staff_serial: newSerial });
          const createResult = response as { data?: StaffMember };
          if (createResult?.data) {
            newId = createResult.data.id;
          }
        }

        setStaff((current) => [
          ...current,
          {
            id: newId,
            staffSerial: newSerial,
            ...formState,
          },
        ]);
        showToast('تم إضافة الموظف بنجاح');
      }
    } catch {
      if (editingIndex !== null) {
        setStaff((current) =>
          current.map((m, index) => (index === editingIndex ? { ...m, ...formState } : m))
        );
      } else {
        setStaff((current) => [
          ...current,
          {
            id: `${Date.now()}-${Math.random()}`,
            staffSerial: formatStaffSerial(getNextStaffSequence(current)),
            ...formState,
          },
        ]);
      }
      showToast('تم الحفظ محلياً بنجاح');
    }

    closeModal();
  };

  const handleDelete = async (index: number) => {
    if (!window.confirm('هل تريد حذف هذا الموظف؟')) return;
    const member = staff[index];
    try {
      if (window.api?.deleteStaff && member.id) {
        await window.api.deleteStaff(member.id);
      }
    } catch {
      // fallback
    }
    setStaff((current) => current.filter((_, idx) => idx !== index));
    showToast('تم حذف الموظف بنجاح');
    if (editingIndex === index) {
      setEditingIndex(null);
      setFormState(buildEmptyForm());
    }
  };

  const handleInlineUpdate = (id: string, key: 'hours' | 'revenue', value: number) => {
    setStaff((current) =>
      current.map((member) => (member.id === id ? { ...member, [key]: value } : member))
    );
  };

  const handleSendStaffWhatsApp = (member: StaffMember) => {
    if (!member.phone?.trim()) {
      showToast('لا يوجد رقم هاتف لهذا الموظف', 'error');
      return;
    }

    let cleanPhone = member.phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('01')) cleanPhone = '2' + cleanPhone;

    const calculatePay = () => {
      if (member.payType === 'hour') return member.rate * member.hours;
      if (member.payType === 'percent') return (member.rate / 100) * member.revenue;
      return member.rate;
    };

    const caption = `*إيجي سبورتنج كلوب*\n\nبيان مستحقات الموظف/المدرب: ${member.name}\nالكود: ${member.staffSerial}\nالوظيفة: ${member.role}\nنوع التعاقد: ${payTypeLabel(member.payType)}\nالمبلغ المحسوب: ${calculatePay()} ج.م\n\nشكراً لجهودكم المتميزة ⚽`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(caption)}`, '_blank');
  };

  return (
    <div dir="rtl" className="space-y-5 font-sans">
      {/* Toast Notification */}
      {toast ? (
        <div
          className={`fixed right-6 top-6 z-50 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl transition-all ${
            toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
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
              <AppIcon icon={User01} className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">إدارة الطاقم والمدربين</h1>
              <p className="text-xs text-slate-500">متابعة رواتب ومستحقات المدربين والموظفين بدقة</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEditStaff && (
              <button
                type="button"
                onClick={() => {
                  setEditingIndex(null);
                  setFormState(buildEmptyForm());
                  setIsModalOpen(true);
                }}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                <Plus className="h-4 w-4" />
                إضافة موظف
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
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-right">
            <span className="text-xs font-medium text-slate-500">إجمالي الطاقم</span>
            <p className="mt-1 text-xl font-bold text-slate-900">{metrics.total}</p>
          </div>
          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-right">
            <span className="text-xs font-medium text-sky-600">بالساعة</span>
            <p className="mt-1 text-xl font-bold text-sky-700">{metrics.hour.toLocaleString()} ج</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-right">
            <span className="text-xs font-medium text-emerald-600">رواتب ثابتة</span>
            <p className="mt-1 text-xl font-bold text-emerald-700">{metrics.fixed.toLocaleString()} ج</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-right">
            <span className="text-xs font-medium text-amber-600">عمولات ونسب</span>
            <p className="mt-1 text-xl font-bold text-amber-700">{metrics.percent.toLocaleString()} ج</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative flex items-center sm:col-span-2">
            <SearchSm className="absolute right-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="بحث باسم الموظف، الكود أو الوظيفة..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-9 pl-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
            />
          </div>

          <select
            value={payTypeFilter}
            onChange={(e) => setPayTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none"
          >
            <option value="all">جميع أنواع التعاقد</option>
            <option value="hour">بالساعة فقط</option>
            <option value="fixed">راتب ثابت فقط</option>
            <option value="percent">نسبة ومئوية فقط</option>
          </select>
        </div>
      </div>

      {/* ── Content View (Cards or Table) ── */}
      {viewMode === 'cards' ? (
        /* ── Compact Cards View ── */
        paginatedStaff.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
            لا يوجد موظفون يطابقون البحث.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedStaff.map((member) => {
              const originalIndex = staff.findIndex((m) => m.id === member.id);
              const calculatedPay =
                member.payType === 'hour'
                  ? member.rate * member.hours
                  : member.payType === 'percent'
                  ? (member.rate / 100) * member.revenue
                  : member.rate;

              return (
                <div
                  key={member.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold text-xs">
                          {member.name.charAt(0) || 'م'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-slate-900 text-sm">{member.name}</h3>
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                              {member.staffSerial}
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400">{member.role || 'عضو طاقم'}</p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${payTypeBadgeStyle(
                          member.payType
                        )}`}
                      >
                        {payTypeLabel(member.payType)}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                        <span className="text-slate-500">الهاتف:</span>
                        <span className="font-mono text-slate-800">{member.phone || '-'}</span>
                      </div>

                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                        <span className="text-slate-500">المستحق الحسابي:</span>
                        <span className="font-bold text-emerald-600">{calculatedPay.toLocaleString()} ج.م</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => handleSendStaffWhatsApp(member)}
                      className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 transition"
                      title="واتساب"
                    >
                      <AppIcon icon={Phone01} className="h-4 w-4" />
                    </button>

                    {canEditStaff && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => handleEdit(originalIndex)}
                          className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDelete(originalIndex)}
                          className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 transition"
                          title="حذف"
                        >
                          <AppIcon icon={Trash01} className="h-4 w-4" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )
      ) : (
        /* ── Compact Table View ── */
        <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full text-right text-xs divide-y divide-slate-200">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-4 py-3 font-semibold">الكود</th>
                  <th className="px-4 py-3 font-semibold">الاسم</th>
                  <th className="px-4 py-3 font-semibold">الهاتف</th>
                  <th className="px-4 py-3 font-semibold">الوظيفة</th>
                  <th className="px-4 py-3 font-semibold">نوع التعاقد</th>
                  <th className="px-4 py-3 font-semibold">القيمة/المعدل</th>
                  <th className="px-4 py-3 font-semibold">الساعات/الإيراد</th>
                  <th className="px-4 py-3 font-semibold">الإجمالي</th>
                  <th className="px-4 py-3 text-center font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedStaff.map((member) => {
                  const originalIndex = staff.findIndex((m) => m.id === member.id);
                  const calculatedPay =
                    member.payType === 'hour'
                      ? member.rate * member.hours
                      : member.payType === 'percent'
                      ? (member.rate / 100) * member.revenue
                      : member.rate;

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-mono font-medium text-slate-700">{member.staffSerial}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{member.name}</td>
                      <td className="px-4 py-3 font-mono text-slate-600">{member.phone || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{member.role}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${payTypeBadgeStyle(
                            member.payType
                          )}`}
                        >
                          {payTypeLabel(member.payType)}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-800">{member.rate} ج</td>
                      <td className="px-4 py-3">
                        {member.payType === 'hour' ? (
                          <input
                            type="number"
                            value={member.hours}
                            onChange={(e) => handleInlineUpdate(member.id, 'hours', Number(e.target.value))}
                            className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center font-bold text-slate-900 outline-none focus:border-sky-500"
                          />
                        ) : member.payType === 'percent' ? (
                          <input
                            type="number"
                            value={member.revenue}
                            onChange={(e) => handleInlineUpdate(member.id, 'revenue', Number(e.target.value))}
                            className="w-20 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 text-center font-bold text-slate-900 outline-none focus:border-sky-500"
                          />
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-bold text-emerald-600">{calculatedPay.toLocaleString()} ج</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSendStaffWhatsApp(member)}
                            className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 transition"
                            title="واتساب"
                          >
                            <AppIcon icon={Phone01} className="h-4 w-4" />
                          </button>

                          {canEditStaff && (
                            <button
                              type="button"
                              onClick={() => handleEdit(originalIndex)}
                              className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                            >
                              تعديل
                            </button>
                          )}
                          {canEditStaff && (
                            <button
                              type="button"
                              onClick={() => handleDelete(originalIndex)}
                              className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 transition"
                              title="حذف"
                            >
                              <AppIcon icon={Trash01} className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredStaff.length === 0 && (
                  <tr>
                    <td colSpan={9} className="px-4 py-10 text-center text-slate-400 text-xs">
                      لا يوجد موظفون يطابقون البحث.
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
        totalItems={filteredStaff.length}
        onPageChange={setCurrentPage}
        label="موظف"
      />

      {/* ── Modal Dialog: Add / Edit Staff ── */}
      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-sky-50 p-2.5 text-sky-600">
                  <AppIcon icon={User01} className="h-5 w-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingIndex !== null ? 'تعديل بيانات الموظف' : 'إضافة موظف جديد'}
                </h2>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            <form id="staffModalForm" onSubmit={handleSubmit} className="space-y-4 p-5 text-right text-xs">
              <div>
                <label className="block mb-1 font-semibold text-slate-700">اسم الموظف / المدرب</label>
                <input
                  required
                  value={formState.name}
                  placeholder="مثال: كابتن أحمد محمود"
                  onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">رقم الهاتف</label>
                <input
                  value={formState.phone}
                  placeholder="01000000000"
                  onChange={(e) => setFormState((prev) => ({ ...prev, phone: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">الوظيفة / التخصص</label>
                <input
                  required
                  value={formState.role}
                  placeholder="مدرب كرة قدم / إداري"
                  onChange={(e) => setFormState((prev) => ({ ...prev, role: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">نوع التعاقد</label>
                <select
                  value={formState.payType}
                  onChange={(e) => setFormState((prev) => ({ ...prev, payType: e.target.value as StaffPayType }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none"
                >
                  <option value="hour">بالساعة</option>
                  <option value="fixed">راتب ثابت</option>
                  <option value="percent">نسبة ومئوية</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 font-semibold text-slate-700">القيمة / المبلع</label>
                  <input
                    type="number"
                    min={0}
                    value={formState.rate === 0 ? '' : formState.rate}
                    onChange={(e) => setFormState((prev) => ({ ...prev, rate: Math.max(0, Number(e.target.value)) }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-semibold text-slate-700">
                    {formState.payType === 'percent' ? 'الإيراد المحسوب' : 'الساعات المحسوبة'}
                  </label>
                  <input
                    type="number"
                    min={0}
                    value={formState.payType === 'percent' ? (formState.revenue === 0 ? '' : formState.revenue) : (formState.hours === 0 ? '' : formState.hours)}
                    onChange={(e) => {
                      const val = Math.max(0, Number(e.target.value));
                      setFormState((prev) => ({
                        ...prev,
                        hours: prev.payType === 'hour' ? val : prev.hours,
                        revenue: prev.payType === 'percent' ? val : prev.revenue,
                      }));
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  />
                </div>
              </div>
            </form>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                إلغاء
              </button>
              <button
                type="submit"
                form="staffModalForm"
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 transition"
              >
                {editingIndex !== null ? 'حفظ التعديلات' : 'إضافة الموظف'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

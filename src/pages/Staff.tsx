import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { BarChartSquare02, Gift02, MessageChatCircle, Phone01 } from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';
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

export default function Staff() {
  const { canEdit } = useAuth();
  const canEditStaff = canEdit('staff');
  const [staff, setStaff] = useState<StaffMember[]>(() => readStoredData('staff', []));
  const [formState, setFormState] = useState<StaffFormState>(buildEmptyForm());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  useEffect(() => {
    window.localStorage.setItem('staff', JSON.stringify(staff));
  }, [staff]);

  useEffect(() => {
    const sync = () => setStaff(readStoredData('staff', []));
    window.addEventListener('storage', sync);
    const loadFromApi = async () => {
      if (!window.api?.getToken?.() || !window.api?.getStaff) return;
      try {
        const response = await window.api.getStaff();
        if (response?.data && Array.isArray(response.data) && response.data.length > 0) {
          const apiStaff = response.data as StaffMember[];
          setStaff(apiStaff);
          window.localStorage.setItem('staff', JSON.stringify(apiStaff));
        }
      } catch {
        // fallback to localStorage
      }
    };
    loadFromApi();
    return () => window.removeEventListener('storage', sync);
  }, []);

  const metrics = useMemo(() => {
    return staff.reduce(
      (acc, member) => {
        if (member.payType === 'hour') acc.hour += member.rate * member.hours;
        if (member.payType === 'fixed') acc.fixed += member.rate;
        if (member.payType === 'percent') acc.percent += (member.rate / 100) * member.revenue;
        return acc;
      },
      { hour: 0, fixed: 0, percent: 0 }
    );
  }, [staff]);

  const handleEdit = (index: number) => {
    const member = staff[index];
    setEditingIndex(index);
    setFormState({
      name: member.name,
      phone: member.phone || '',
      role: member.role,
      payType: member.payType,
      rate: member.rate,
      hours: member.hours,
      revenue: member.revenue,
    });
    setIsModalOpen(true);
  };

  const openStaffModal = () => {
    setEditingIndex(null);
    setFormState(buildEmptyForm());
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
          current.map((member, index) => (index === editingIndex ? { ...member, ...formState } : member))
        );
      } else {
        let newId = typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `${Date.now()}-${Math.random()}`;
        const newSerial = formatStaffSerial(getNextStaffSequence(staff));

        if (window.api?.createStaff) {
          const response = await window.api.createStaff({ ...staffPayload, staff_serial: newSerial });
          const createResult = response as { data?: StaffMember };
          if (createResult?.data) {
            const created = createResult.data;
            newId = created.id;
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
      }
    } catch {
      // fallback local save
      if (editingIndex !== null) {
        setStaff((current) =>
          current.map((member, index) => (index === editingIndex ? { ...member, ...formState } : member))
        );
      } else {
        setStaff((current) => [
          ...current,
          {
            id: typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
              ? crypto.randomUUID()
              : `${Date.now()}-${Math.random()}`,
            staffSerial: formatStaffSerial(getNextStaffSequence(current)),
            ...formState,
          },
        ]);
      }
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
    if (editingIndex === index) {
      setEditingIndex(null);
      setFormState(buildEmptyForm());
    }
  };

  const handleInlineUpdate = (index: number, key: 'hours' | 'revenue', value: number) => {
    setStaff((current) =>
      current.map((member, idx) => (idx === index ? { ...member, [key]: value } : member))
    );
  };

  const handleSyncStaffPayments = (showAlert = false) => {
    const today = new Date();
    const monthKey = today.toISOString().slice(0, 7);
    const monthStart = `${monthKey}-01`;
    const sharedFinance = window.sharedFinance;

    if (!sharedFinance?.setFinances) {
      if (showAlert) window.alert('لم يتم العثور على نظام المزامنة (sharedFinance)');
      return;
    }

    const currentFinances = sharedFinance.getFinances() || [];
    const filtered = currentFinances.filter((record: FinanceRecord) => {
      return !(record?.source === 'staff_salary_sync' && record?.sourceMonth === monthKey);
    });

    const newRecords = staff.map((member) => {
      const amount = member.payType === 'hour'
        ? member.rate * member.hours
        : member.payType === 'percent'
          ? (member.rate / 100) * member.revenue
          : member.rate;

      return {
        type: 'expense',
        category: 'رواتب',
        relatedTo: member.name,
        amount,
        date: monthStart,
        description: `راتب ${member.name} (${monthKey})`,
        source: 'staff_salary_sync',
        sourceMonth: monthKey,
        sourceKey: `staff_salary_sync:${monthKey}:${member.id}`,
      };
    });

    sharedFinance.setFinances([...filtered, ...newRecords]);
    if (showAlert) window.alert('تمت المزامنة بنجاح');
  };

  const handleSendStaffWhatsApp = (member: StaffMember) => {
    if (!member.phone?.trim()) {
      window.alert('لا يوجد رقم هاتف لهذا الشخص');
      return;
    }

    let cleanPhone = member.phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('01')) cleanPhone = '2' + cleanPhone;

    const portalUrl = `${window.location.origin}${window.location.pathname.replace(/\/[^/]*$/, '/')}`;
    const text = `أهلاً ${member.name}%0Aكود الموظف: ${member.staffSerial}%0A${portalUrl}`;
    window.open(`https://wa.me/${cleanPhone}?text=${encodeURIComponent(text)}`, '_blank');
  };

  const scrollToTable = (id: string) => {
    document.getElementById(id)?.scrollIntoView({ behavior: 'smooth' });
  };


  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 text-slate-500">
              <AppIcon icon={MessageChatCircle} className="text-slate-500" />
              <span className="text-sm">إدارة المدربين والموظفين</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">لوحة الموارد البشرية</h1>
            <p className="mt-2 text-sm text-slate-600">أضف الموظفين والمدربين، راقب التكاليف، وزامن الرواتب مع الحسابات المالية.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => handleSyncStaffPayments(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
            >
              <AppIcon icon={Gift02} className="text-white" />
              مزامنة الرواتب
            </button>
            {canEditStaff && (
              <button
                type="button"
                onClick={openStaffModal}
                className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                <span className="text-lg">+</span>
                ضيف موظف
              </button>
            )}
          </div>
        </div>
      </div>

      {isModalOpen && (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl ring-1 ring-slate-200">
            <div className="flex items-start justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">
                  {editingIndex !== null ? 'تعديل موظف' : 'ضيف موظف'}
                </h2>
                <p className="mt-1 text-sm text-slate-500">املأ بيانات الموظف ثم اضغط حفظ.</p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="text-2xl leading-none text-slate-500 transition hover:text-slate-900"
              >
                ×
              </button>
            </div>

            <form id="staffModalForm" onSubmit={handleSubmit} className="grid gap-4 p-6 sm:grid-cols-2">
              <div className="space-y-4">
                <label className="block text-right text-sm font-medium text-slate-700">
                  الاسم الكامل
                  <input
                    value={formState.name}
                    placeholder='احمد حسين'
                    onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                    required
                  />
                </label>
                <label className="block text-right text-sm font-medium text-slate-700">
                  رقم الهاتف
                  <input
                    value={formState.phone}
                    placeholder="01234567890"
                    inputMode="numeric"
                    type="tel"
                    maxLength={11}
                    minLength={11}
                    pattern="[0-9]{11}"
                    required
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, '').slice(0, 11);
                      setFormState((prev) => ({ ...prev, phone: digits }));
                    }}
                    className={`mt-2 w-full rounded-3xl border px-4 py-3 text-right text-sm text-slate-900 outline-none ${formState.phone.length > 0 && formState.phone.length !== 11
                        ? 'border-red-400 bg-red-50'
                        : 'border-slate-200 bg-slate-50'
                      }`}
                  />
                  {formState.phone.length > 0 && formState.phone.length !== 11 && (
                    <p className="mt-1 text-xs text-red-500 text-right">
                      يجب أن يكون رقم الهاتف 11 رقماً بالضبط — أدخلت {formState.phone.length}/11
                    </p>
                  )}
                </label>
                <label className="block text-right text-sm font-medium text-slate-700">
                  الوظيفة
                  <input
                    value={formState.role}
                    placeholder='مدرب'
                    onChange={(event) => setFormState((prev) => ({ ...prev, role: event.target.value }))}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                    required
                  />
                </label>
                <label className="block text-right text-sm font-medium text-slate-700">
                  نوع التعاقد
                  <select
                    value={formState.payType}
                    onChange={(event) => setFormState((prev) => ({ ...prev, payType: event.target.value as StaffPayType }))}
                    className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                  >
                    <option value="hour">بالساعة</option>
                    <option value="fixed">راتب ثابت</option>
                    <option value="percent">نسبة</option>
                  </select>
                </label>
                <div className="grid gap-4 sm:grid-cols-2">
                  <label className="block text-right text-sm font-medium text-slate-700">
                    القيمة
                    <input
                      value={formState.rate === 0 ? '' : formState.rate}
                      onChange={(event) => setFormState((prev) => ({ ...prev, rate: Math.max(0, Number(event.target.value)) }))}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                      type="number"
                      min={0}
                    />
                  </label>
                  <label className="block text-right text-sm font-medium text-slate-700">
                    الساعات / الإيراد
                    <input
                      value={(() => { const v = formState.payType === 'percent' ? formState.revenue : formState.hours; return v === 0 ? '' : v; })()}
                      onChange={(event) => {
                        const value = Math.max(0, Number(event.target.value));
                        setFormState((prev) => ({
                          ...prev,
                          hours: prev.payType === 'hour' ? value : prev.hours,
                          revenue: prev.payType === 'percent' ? value : prev.revenue,
                        }));
                      }}
                      className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                      type="number"
                      min={0}
                      placeholder={formState.payType === 'percent' ? 'إيراد الشهر' : 'عدد الساعات'}
                    />
                  </label>
                </div>
              </div>

            </form>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                إلغاء
              </button>
              <button
                type="submit"
                form="staffModalForm"
                className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                {editingIndex !== null ? 'حفظ التعديلات' : 'ضيف موظف'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-3">
        <div
          className="cursor-pointer rounded-3xl bg-slate-950 p-6 text-white shadow-sm shadow-slate-200/10 transition hover:bg-slate-900"
          onClick={() => scrollToTable('hourTable')}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-300">المدربون بالساعة</div>
              <div className="mt-3 text-3xl font-semibold">{metrics.hour.toLocaleString()} ج</div>
            </div>
            <div className="rounded-3xl bg-slate-800 p-3">
              <AppIcon icon={BarChartSquare02} className="text-white" />
            </div>
          </div>
          <div className="mt-4 text-sm text-slate-400">إجمالي مستحقات هذا القسم</div>
        </div>
        <div
          className="cursor-pointer rounded-3xl bg-emerald-50 p-6 shadow-sm shadow-slate-200 transition hover:bg-emerald-100"
          onClick={() => scrollToTable('fixedTable')}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">الرواتب الثابتة</div>
              <div className="mt-3 text-3xl font-semibold text-slate-900">{metrics.fixed.toLocaleString()} ج</div>
            </div>
            <div className="rounded-3xl bg-emerald-100 p-3 text-emerald-700">
              <i className="fa-solid fa-money-bill" />
            </div>
          </div>
          <div className="mt-4 text-sm text-slate-500">الموظفون أصحاب الراتب الشهري</div>
        </div>
        <div
          className="cursor-pointer rounded-3xl bg-amber-50 p-6 shadow-sm shadow-slate-200 transition hover:bg-amber-100"
          onClick={() => scrollToTable('percentTable')}
        >
          <div className="flex items-center justify-between">
            <div>
              <div className="text-sm text-slate-500">العمولات والنسب</div>
              <div className="mt-3 text-3xl font-semibold text-slate-900">{metrics.percent.toLocaleString()} ج</div>
            </div>
            <div className="rounded-3xl bg-amber-100 p-3 text-amber-700">
              <i className="fa-solid fa-percent" />
            </div>
          </div>
          <div className="mt-4 text-sm text-slate-500">المبالغ المحسوبة حسب الإيراد</div>
        </div>
      </div>



      <div className="space-y-6">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">المدربين بالساعة</h2>
              <p className="mt-1 text-sm text-slate-500">مرتبطة بعدد الساعات والمستحقات.</p>
            </div>
            <span className="rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">{staff.filter((member) => member.payType === 'hour').length} شخص</span>
          </div>
          <div className="min-w-full overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 text-right font-medium">الكود</th>
                  <th className="px-6 py-4 text-right font-medium">الاسم</th>
                  <th className="px-6 py-4 text-right font-medium">الهاتف</th>
                  <th className="px-6 py-4 text-right font-medium">الوظيفة</th>
                  <th className="px-6 py-4 text-right font-medium">قيمة الساعة</th>
                  <th className="px-6 py-4 text-right font-medium">الساعات</th>
                  <th className="px-6 py-4 text-right font-medium">الإجمالي</th>
                  <th className="px-6 py-4 text-center font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {staff.filter((member) => member.payType === 'hour').map((member, index) => {
                  const total = member.rate * member.hours;
                  return (
                    <tr key={member.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-slate-900">{member.staffSerial}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{member.name}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{member.phone || '-'}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{member.role}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{member.rate}</td>
                      <td className="px-6 py-4 text-right">
                        <input
                          value={member.hours}
                          onChange={(event) => handleInlineUpdate(index, 'hours', Number(event.target.value))}
                          className="w-20 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-sm text-slate-900 outline-none"
                          type="number"
                        />
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-slate-900">{total.toLocaleString()} ج</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendStaffWhatsApp(member)}
                            className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                            title="إرسال واتساب"
                          >
                            <AppIcon icon={Phone01} className="text-white" />
                          </button>
                          {canEditStaff && (
                            <button
                              type="button"
                              onClick={() => handleEdit(index)}
                              className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                            >
                              تعديل
                            </button>
                          )}
                          {canEditStaff && (
                            <button
                              type="button"
                              onClick={() => handleDelete(index)}
                              className="rounded-2xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-200"
                            >
                              حذف
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {staff.filter((member) => member.payType === 'hour').length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                      لا يوجد موظفين بالساعة بعد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
          <div className="grid gap-6">


            <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
              <h3 className="text-base font-semibold text-slate-900">إحصائيات أساسية</h3>
              <div className="mt-4 space-y-3 text-sm text-slate-600">
                <div>إجمالي المدربين بالساعة: {staff.filter((member) => member.payType === 'hour').length}</div>
                <div>إجمالي الموظفين برواتب ثابتة: {staff.filter((member) => member.payType === 'fixed').length}</div>
                <div>إجمالي العاملين بالنسبة: {staff.filter((member) => member.payType === 'percent').length}</div>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-6">
        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">الموظفين برواتب ثابتة</h2>
              <p className="mt-1 text-sm text-slate-500">دفعات شهرية ثابتة.</p>
            </div>
            <span className="rounded-full bg-emerald-100 px-4 py-2 text-sm font-semibold text-emerald-700">{staff.filter((member) => member.payType === 'fixed').length} شخص</span>
          </div>
          <div className="min-w-full overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 text-right font-medium">الكود</th>
                  <th className="px-6 py-4 text-right font-medium">الاسم</th>
                  <th className="px-6 py-4 text-right font-medium">الهاتف</th>
                  <th className="px-6 py-4 text-right font-medium">الوظيفة</th>
                  <th className="px-6 py-4 text-right font-medium">الراتب</th>
                  <th className="px-6 py-4 text-center font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {staff.filter((member) => member.payType === 'fixed').map((member) => {
                  const overallIndex = staff.findIndex((item) => item.id === member.id);
                  return (
                    <tr key={member.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-slate-900">{member.staffSerial}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{member.name}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{member.phone || '-'}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{member.role}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-slate-900">{member.rate.toLocaleString()} ج</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendStaffWhatsApp(member)}
                            className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                          >
                            واتساب
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(overallIndex)}
                            className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(overallIndex)}
                            className="rounded-2xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-200"
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {staff.filter((member) => member.payType === 'fixed').length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-6 py-10 text-center text-slate-500">
                      لا يوجد موظفين برواتب ثابتة بعد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>

        <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
          <div className="flex flex-col gap-4 border-b border-slate-200 bg-slate-50 px-6 py-5 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-slate-900">العاملين بالنسبة</h2>
              <p className="mt-1 text-sm text-slate-500">يتم الحساب حسب الإيراد.</p>
            </div>
            <span className="rounded-full bg-amber-100 px-4 py-2 text-sm font-semibold text-amber-700">{staff.filter((member) => member.payType === 'percent').length} شخص</span>
          </div>
          <div className="min-w-full overflow-x-auto">
            <table className="min-w-full divide-y divide-slate-200 text-sm">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-6 py-4 text-right font-medium">الكود</th>
                  <th className="px-6 py-4 text-right font-medium">الاسم</th>
                  <th className="px-6 py-4 text-right font-medium">الهاتف</th>
                  <th className="px-6 py-4 text-right font-medium">الوظيفة</th>
                  <th className="px-6 py-4 text-right font-medium">النسبة %</th>
                  <th className="px-6 py-4 text-right font-medium">الإيراد</th>
                  <th className="px-6 py-4 text-right font-medium">المستحق</th>
                  <th className="px-6 py-4 text-center font-medium">إجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200 bg-white">
                {staff.filter((member) => member.payType === 'percent').map((member) => {
                  const total = (member.rate / 100) * member.revenue;
                  const overallIndex = staff.findIndex((item) => item.id === member.id);
                  return (
                    <tr key={member.id} className="hover:bg-slate-50">
                      <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-slate-900">{member.staffSerial}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{member.name}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{member.phone || '-'}</td>
                      <td className="px-6 py-4 text-right text-slate-600">{member.role}</td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-slate-900">{member.rate}%</td>
                      <td className="px-6 py-4 text-right">
                        <input
                          value={member.revenue}
                          onChange={(event) => handleInlineUpdate(overallIndex, 'revenue', Number(event.target.value))}
                          className="w-28 rounded-2xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-sm text-slate-900 outline-none"
                          type="number"
                        />
                      </td>
                      <td className="whitespace-nowrap px-6 py-4 text-right text-slate-900">{total.toLocaleString()} ج</td>
                      <td className="px-6 py-4 text-center">
                        <div className="flex flex-wrap justify-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleSendStaffWhatsApp(member)}
                            className="rounded-2xl bg-emerald-600 px-3 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                          >
                            واتساب
                          </button>
                          <button
                            type="button"
                            onClick={() => handleEdit(overallIndex)}
                            className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(overallIndex)}
                            className="rounded-2xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-200"
                          >
                            حذف
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
                {staff.filter((member) => member.payType === 'percent').length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-6 py-10 text-center text-slate-500">
                      لا يوجد موظفين بالنسبة بعد.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      </div>
    </div>
  );
}

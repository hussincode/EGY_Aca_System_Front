import { type FormEvent, useEffect, useMemo, useState } from 'react';
import { BarChartSquare02, Bell03, Gift02, MessageChatCircle, Phone01, SearchSm } from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';

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

const STAFF_KEY = 'academy_staff';

function readStoredStaff(): StaffMember[] {
  if (typeof window === 'undefined') return [];
  const saved = window.localStorage.getItem(STAFF_KEY);
  if (!saved) return [];
  try {
    return JSON.parse(saved) as StaffMember[];
  } catch {
    return [];
  }
}

function buildEmptyForm(): StaffFormState {
  return {
    name: '',
    phone: '',
    role: '',
    payType: 'hour',
    rate: 0,
    hours: 0,
    revenue: 0,
  };
}

function ensureSerial(staff: StaffMember[]): StaffMember[] {
  const used = new Set<number>();
  staff.forEach((member) => {
    const match = member.staffSerial.match(/^STF-(\d{3})$/);
    if (match) used.add(Number(match[1]));
  });

  let next = 1;
  return staff.map((member) => {
    if (member.staffSerial && /^STF-\d{3}$/.test(member.staffSerial)) {
      return member;
    }
    while (used.has(next)) next += 1;
    const serial = `STF-${String(next).padStart(3, '0')}`;
    used.add(next);
    next += 1;
    return { ...member, staffSerial: serial };
  });
}

export default function Staff() {
  const [staff, setStaff] = useState<StaffMember[]>(() => ensureSerial(readStoredStaff()));
  const [formState, setFormState] = useState<StaffFormState>(buildEmptyForm());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);

  useEffect(() => {
    window.localStorage.setItem(STAFF_KEY, JSON.stringify(staff));
  }, [staff]);

  const metrics = useMemo(() => {
    return staff.reduce(
      (acc, member) => {
        const amount = member.payType === 'hour'
          ? member.rate * member.hours
          : member.payType === 'percent'
          ? (member.rate / 100) * member.revenue
          : member.rate;

        if (member.payType === 'hour') acc.hour += amount;
        if (member.payType === 'fixed') acc.fixed += amount;
        if (member.payType === 'percent') acc.percent += amount;
        return acc;
      },
      { hour: 0, fixed: 0, percent: 0 },
    );
  }, [staff]);

  const handleSubmit = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!formState.name.trim() || !formState.role.trim()) {
      window.alert('الاسم والوظيفة مطلوبان');
      return;
    }

    const payload: StaffMember = {
      id: editingIndex !== null && staff[editingIndex]?.id ? staff[editingIndex].id : Date.now().toString(),
      staffSerial: editingIndex !== null && staff[editingIndex]?.staffSerial
        ? staff[editingIndex].staffSerial
        : 'STF-000',
      name: formState.name.trim(),
      phone: formState.phone.trim(),
      role: formState.role.trim(),
      payType: formState.payType,
      rate: formState.rate,
      hours: formState.hours,
      revenue: formState.revenue,
    };

    setStaff((current) => {
      const normalized = ensureSerial([
        ...current.slice(0, editingIndex ?? current.length),
        payload,
        ...current.slice((editingIndex ?? current.length) + 1),
      ]);
      return editingIndex !== null
        ? normalized
        : normalized;
    });

    setEditingIndex(null);
    setFormState(buildEmptyForm());
  };

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
  };

  const handleDelete = (index: number) => {
    if (!window.confirm('هل تريد حذف هذا الموظف؟')) return;
    setStaff((current) => current.filter((_, idx) => idx !== index));
    if (editingIndex === index) {
      setEditingIndex(null);
      setFormState(buildEmptyForm());
    }
  };

  const handleInlineUpdate = (index: number, key: 'hours' | 'revenue', value: number) => {
    setStaff((current) => current.map((member, idx) => (idx === index ? { ...member, [key]: value } : member)));
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

  const formTitle = editingIndex !== null ? 'تعديل موظف' : 'إضافة موظف';

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
            <button
              type="button"
              onClick={() => {
                const form = document.getElementById('staffForm') as HTMLFormElement | null;
                form?.requestSubmit();
              }}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <span className="text-lg">+</span>
              حفظ الموظف
            </button>
          </div>
        </div>
      </div>

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

      <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div>
            <p className="text-sm font-semibold text-slate-500">{formTitle}</p>
            <p className="mt-2 text-sm text-slate-600">كل بيانات التعاقد الأساسية في نموذج واحد.</p>
          </div>
          <span className="inline-flex items-center rounded-full bg-slate-100 px-4 py-2 text-sm font-semibold text-slate-700">
            متصل بالحسابات المالية
          </span>
        </div>

        <form id="staffForm" onSubmit={handleSubmit} className="mt-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-[1fr_0.75fr]">
          <div className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-right text-sm font-medium text-slate-700">
                الاسم الكامل
                <input
                  value={formState.name}
                  onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                  required
                />
              </label>
              <label className="block text-right text-sm font-medium text-slate-700">
                رقم الهاتف
                <input
                  value={formState.phone}
                  onChange={(event) => setFormState((prev) => ({ ...prev, phone: event.target.value }))}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                  type="tel"
                />
              </label>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-right text-sm font-medium text-slate-700">
                الوظيفة
                <input
                  value={formState.role}
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
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <label className="block text-right text-sm font-medium text-slate-700">
                القيمة
                <input
                  value={formState.rate}
                  onChange={(event) => setFormState((prev) => ({ ...prev, rate: Number(event.target.value) }))}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                  type="number"
                />
              </label>
              <label className="block text-right text-sm font-medium text-slate-700">
                الساعات / الإيراد
                <input
                  value={formState.payType === 'percent' ? formState.revenue : formState.hours}
                  onChange={(event) => {
                    const value = Number(event.target.value);
                    setFormState((prev) => ({
                      ...prev,
                      hours: prev.payType === 'hour' ? value : prev.hours,
                      revenue: prev.payType === 'percent' ? value : prev.revenue,
                    }));
                  }}
                  className="mt-2 w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                  type="number"
                  placeholder={formState.payType === 'percent' ? 'إيراد الشهر' : 'عدد الساعات'}
                />
              </label>
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <div className="flex items-center gap-3 text-right">
              <div className="rounded-2xl bg-slate-900 p-3 text-white">
                <AppIcon icon={Bell03} className="text-white" />
              </div>
              <div>
                <p className="text-sm font-semibold text-slate-900">سجل الموظف</p>
                <p className="mt-1 text-sm text-slate-500">إدارة بيانات التعاقد ومشاركة كود الموظف.</p>
              </div>
            </div>

            <div className="mt-6 space-y-3 text-right text-sm text-slate-600">
              <div>اسم الموظف، الهاتف، والوظيفة يمكن تعديلهم في أي وقت.</div>
              <div>يمكن تغيير النوع بين بالساعة، راتب ثابت، ونسبة.</div>
              <div>اضغط حفظ لحفظ البيانات محلياً ومزامنتها لاحقاً.</div>
            </div>

            <div className="mt-6 flex flex-wrap gap-3">
              <button type="submit" form="staffForm" className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700">
                <AppIcon icon={SearchSm} className="text-white" />
                حفظ
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingIndex(null);
                  setFormState(buildEmptyForm());
                }}
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
              >
                إلغاء
              </button>
            </div>
          </div>
        </form>
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
                          <button
                            type="button"
                            onClick={() => handleEdit(index)}
                            className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDelete(index)}
                            className="rounded-2xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-200"
                          >
                            حذف
                          </button>
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
              <div className="flex items-center gap-3">
                <div className="rounded-2xl bg-slate-900 p-3 text-white">
                  <AppIcon icon={Gift02} className="text-white" />
                </div>
                <div>
                  <h3 className="text-base font-semibold text-slate-900">معلومات سريعة</h3>
                  <p className="mt-1 text-sm text-slate-500">يمكنك تعديل الحقول مباشرة أو استخدام نموذج الإضافة.</p>
                </div>
              </div>
            </div>

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

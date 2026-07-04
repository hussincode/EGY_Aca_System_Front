import { useEffect, useMemo, useState, type ChangeEvent, type Dispatch, type FormEvent, type SetStateAction } from 'react';
import { jsPDF } from 'jspdf';

type FinanceType = 'income' | 'expense';

type FinanceEntry = {
  id?: string;
  type: FinanceType;
  category: string;
  branch?: string;
  branchId?: string;
  branchName?: string;
  relatedTo?: string;
  amount: number | string;
  date: string;
  description?: string;
  createdBy?: {
    id?: string;
    name?: string;
    email?: string;
    role?: string;
  } | null;
};

type Branch = {
  id?: string;
  name?: string;
};

type FinanceForm = {
  type: FinanceType | '';
  category: string;
  branch: string;
  relatedTo: string;
  amount: string;
  date: string;
  description: string;
};

const rowsPerPage = 25;

function readStoredData<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const stored = window.localStorage.getItem(key);
  if (!stored) return fallback;

  try {
    return JSON.parse(stored) as T;
  } catch {
    return fallback;
  }
}

function formatMoney(value: number) {
  return value.toLocaleString('en-US') + ' ج';
}

function formatMonthLabel(monthKey: string) {
  const [, month] = monthKey.split('-');
  const names: Record<string, string> = {
    '01': 'يناير',
    '02': 'فبراير',
    '03': 'مارس',
    '04': 'أبريل',
    '05': 'مايو',
    '06': 'يونيو',
    '07': 'يوليو',
    '08': 'أغسطس',
    '09': 'سبتمبر',
    '10': 'أكتوبر',
    '11': 'نوفمبر',
    '12': 'ديسمبر',
  };
  return `${names[month || ''] || month || monthKey} ${monthKey.split('-')[0]}`;
}

const emptyForm: FinanceForm = {
  type: '',
  category: '',
  branch: '',
  relatedTo: '',
  amount: '',
  date: new Date().toISOString().split('T')[0],
  description: '',
};

export default function FinancePage() {
  const [finances, setFinances] = useState<FinanceEntry[]>(() => readStoredData('finances', []));
  const [branches, setBranches] = useState<Branch[]>(() => readStoredData('branches', []));
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FinanceForm>(emptyForm);
  const [search, setSearch] = useState('');
  const [filterType, setFilterType] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  useEffect(() => {
    const syncFromStorage = () => {
      setFinances(readStoredData('finances', []));
      setBranches(readStoredData('branches', []));
    };

    const onCustomSync = (event: Event) => {
      const customEvent = event as CustomEvent<{ key?: string; value?: unknown }>;
      if (customEvent.detail?.key === 'finances') {
        setFinances(Array.isArray(customEvent.detail.value) ? customEvent.detail.value : []);
      }
      if (customEvent.detail?.key === 'branches') {
        setBranches(Array.isArray(customEvent.detail.value) ? customEvent.detail.value : []);
      }
    };

    window.addEventListener('storage', syncFromStorage);
    window.addEventListener('app:sync', onCustomSync as EventListener);
    return () => {
      window.removeEventListener('storage', syncFromStorage);
      window.removeEventListener('app:sync', onCustomSync as EventListener);
    };
  }, []);

  const handleFilterValueChange = (setter: Dispatch<SetStateAction<string>>) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    setter(event.target.value);
    setCurrentPage(1);
  };

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2400);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    finances.forEach((entry) => {
      if (!entry.date) return;
      const month = String(entry.date).slice(0, 7);
      if (month) months.add(month);
    });
    return Array.from(months).sort((a, b) => b.localeCompare(a));
  }, [finances]);

  const filteredFinances = useMemo(() => {
    const query = search.trim().toLowerCase();
    return finances.filter((entry) => {
      const description = String(entry.description || '').toLowerCase();
      const matchesDescription = !query || description.includes(query);
      const matchesType = !filterType || entry.type === filterType;
      const matchesCategory = !filterCategory || entry.category === filterCategory;
      const matchesBranch = !filterBranch || entry.branch === filterBranch || entry.branchName === filterBranch;
      const matchesMonth = !filterMonth || (entry.date && String(entry.date).startsWith(filterMonth));
      return matchesDescription && matchesType && matchesCategory && matchesBranch && matchesMonth;
    });
  }, [finances, search, filterType, filterCategory, filterBranch, filterMonth]);

  const summary = useMemo(() => {
    const income = filteredFinances
      .filter((entry) => entry.type === 'income')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

    const expenses = filteredFinances
      .filter((entry) => entry.type === 'expense')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

    const membershipIncome = filteredFinances
      .filter((entry) => entry.type === 'income' && entry.category === 'عضويات')
      .reduce((sum, entry) => sum + Number(entry.amount || 0), 0);

    return {
      income,
      expenses,
      balance: income - expenses,
      membershipIncome,
    };
  }, [filteredFinances]);

  const totalPages = Math.max(1, Math.ceil(filteredFinances.length / rowsPerPage));
  const paginatedFinances = filteredFinances.slice((currentPage - 1) * rowsPerPage, currentPage * rowsPerPage);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
  };

  const persistFinances = (nextFinances: FinanceEntry[]) => {
    setFinances(nextFinances);
    window.localStorage.setItem('finances', JSON.stringify(nextFinances));
  };

  const openModal = (entry?: FinanceEntry) => {
    if (entry) {
      setEditingId(entry.id ?? null);
      setForm({
        type: entry.type,
        category: entry.category,
        branch: entry.branchId || entry.branchName || entry.branch || '',
        relatedTo: entry.relatedTo || '',
        amount: String(entry.amount ?? ''),
        date: String(entry.date || '').slice(0, 10),
        description: entry.description || '',
      });
    } else {
      setEditingId(null);
      setForm(emptyForm);
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setForm(emptyForm);
  };

  const handleSubmit = (event: FormEvent) => {
    event.preventDefault();

    const amountNumber = Number(form.amount);
    if (!form.type || !form.category || !form.relatedTo || Number.isNaN(amountNumber) || !form.date) {
      showToast('يرجى تعبئة جميع الحقول المطلوبة', 'error');
      return;
    }

    const branch = branches.find((item) => item.id === form.branch);
    const payload: FinanceEntry = {
      id: editingId || (typeof crypto !== 'undefined' && 'randomUUID' in crypto ? crypto.randomUUID() : `${Date.now()}`),
      type: form.type,
      category: form.category,
      branch: branch?.name || form.branch,
      branchId: branch?.id || '',
      branchName: branch?.name || '',
      relatedTo: form.relatedTo,
      amount: amountNumber,
      date: form.date,
      description: form.description,
      createdBy: (() => {
        try {
          const user = JSON.parse(window.localStorage.getItem('loggedInUser') || 'null');
          return user ? { id: user.id || '', name: user.name || user.email || 'مستخدم محلي', email: user.email || '', role: user.roleKey || user.role || '' } : null;
        } catch {
          return null;
        }
      })(),
    };

    const nextFinances = editingId
      ? finances.map((entry) => (entry.id === editingId ? payload : entry))
      : [...finances, payload];

    persistFinances(nextFinances);
    showToast(editingId ? 'تم تعديل الحركة المالية' : 'تم إضافة الحركة المالية');
    closeModal();
    window.dispatchEvent(new CustomEvent('app:sync', { detail: { key: 'finances', value: nextFinances } }));
  };

  const handleDelete = (entryId?: string) => {
    if (!entryId) return;
    if (!window.confirm('هل تريد حذف هذه الحركة المالية؟')) return;

    const nextFinances = finances.filter((entry) => entry.id !== entryId);
    persistFinances(nextFinances);
    showToast('تم حذف الحركة المالية');
    window.dispatchEvent(new CustomEvent('app:sync', { detail: { key: 'finances', value: nextFinances } }));
  };

  const syncToDashboard = () => {
    window.localStorage.setItem('finances', JSON.stringify(finances));
    window.dispatchEvent(new CustomEvent('app:sync', { detail: { key: 'finances', value: finances } }));
    showToast('تمت المزامنة مع لوحة التحكم');
  };

  const exportToCsv = () => {
    if (!filteredFinances.length) {
      showToast('لا توجد بيانات للتصدير', 'warning');
      return;
    }

    const rows = [
      ['التاريخ', 'النوع', 'الفئة', 'الفرع', 'الاسم/الجهة', 'المبلغ', 'الملاحظات'],
      ...filteredFinances.map((entry) => [
        entry.date,
        entry.type === 'income' ? 'دخل' : 'مصروف',
        entry.category,
        entry.branchName || entry.branch || '-',
        entry.relatedTo || '-',
        entry.amount,
        entry.description || '-',
      ]),
    ];

    const csv = rows
      .map((row) => row.map((value) => `"${String(value).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'الماليات.csv';
    link.click();
    URL.revokeObjectURL(url);
    showToast('تم تصدير الملف بنجاح');
  };

  const exportPdf = (entry: FinanceEntry) => {
    const canvas = document.createElement('canvas');
    canvas.width = 600;
    canvas.height = 400;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.direction = 'rtl';
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = entry.type === 'income' ? '#dcfce7' : '#fee2e2';
    ctx.fillRect(0, 0, canvas.width, 80);

    ctx.fillStyle = '#1e293b';
    ctx.font = 'bold 24px Cairo, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(entry.type === 'income' ? 'سند قبض' : 'سند صرف', canvas.width / 2, 50);

    ctx.textAlign = 'right';
    ctx.font = '16px Cairo, sans-serif';
    const startX = 550;
    let y = 120;

    const drawLine = (label: string, value: string) => {
      ctx.fillStyle = '#64748b';
      ctx.fillText(`${label}:`, startX, y);
      ctx.fillStyle = '#000';
      ctx.fillText(value, startX - 120, y);
      y += 40;
    };

    drawLine('التاريخ', String(entry.date || '-'));
    drawLine('الفرع', entry.branchName || entry.branch || '-');
    drawLine('الجهة/الاسم', entry.relatedTo || '-');
    drawLine('المبلغ', `${Number(entry.amount || 0).toLocaleString()} ج.م`);
    drawLine('الوصف', entry.description || '-');

    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF('l', 'mm', 'a5');
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    doc.save(`finance_${entry.date}.pdf`);
  };

  return (
    <div className="space-y-6" dir="rtl">
      <div className="flex flex-col gap-4 rounded-3xl border border-slate-200 bg-white p-6 shadow-sm lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-sm font-medium text-slate-500">الإيرادات والمصروفات</p>
          <h1 className="text-3xl font-semibold text-slate-900">النظام المالي للأكاديمية</h1>
        </div>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={syncToDashboard} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm font-medium text-slate-700 transition hover:bg-slate-100">
            ↻ مزامنة مع الداشبورد
          </button>
          <button type="button" onClick={() => openModal()} className="rounded-2xl bg-emerald-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-emerald-700">
            + إضافة حركة
          </button>
          <button type="button" onClick={exportToCsv} className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-sky-700">
            ⬇ Excel
          </button>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
          <p className="text-sm text-emerald-600">إجمالي الدخل</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatMoney(summary.income)}</p>
        </div>
        <div className="rounded-3xl border border-rose-200 bg-rose-50 p-5 shadow-sm">
          <p className="text-sm text-rose-600">إجمالي المصروفات</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatMoney(summary.expenses)}</p>
        </div>
        <div className="rounded-3xl border border-sky-200 bg-sky-50 p-5 shadow-sm">
          <p className="text-sm text-sky-600">الرصيد الحالي</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatMoney(summary.balance)}</p>
        </div>
        <div className="rounded-3xl border border-violet-200 bg-violet-50 p-5 shadow-sm">
          <p className="text-sm text-violet-600">دخل العضويات</p>
          <p className="mt-3 text-3xl font-semibold text-slate-900">{formatMoney(summary.membershipIncome)}</p>
        </div>
      </div>

      <div className="grid gap-4 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm md:grid-cols-2 xl:grid-cols-5">
        <label className="text-sm text-slate-600">
          <span className="mb-2 block">بحث بالوصف</span>
          <input
            value={search}
            onChange={handleFilterValueChange(setSearch)}
            className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
            placeholder="بحث بالوصف..."
          />
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-2 block">الشهر</span>
          <select
            value={filterMonth}
            onChange={handleFilterValueChange(setFilterMonth)}
            className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
          >
            <option value="">كل الأشهر</option>
            {monthOptions.map((month) => (
              <option key={month} value={month}>
                {formatMonthLabel(month)}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-2 block">النوع</span>
          <select
            value={filterType}
            onChange={handleFilterValueChange(setFilterType)}
            className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
          >
            <option value="">الكل</option>
            <option value="income">دخل</option>
            <option value="expense">مصروف</option>
          </select>
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-2 block">الفرع</span>
          <select
            value={filterBranch}
            onChange={handleFilterValueChange(setFilterBranch)}
            className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
          >
            <option value="">كل الفروع</option>
            {branches.map((branch) => (
              <option key={branch.id || branch.name} value={branch.name || ''}>
                {branch.name}
              </option>
            ))}
          </select>
        </label>
        <label className="text-sm text-slate-600">
          <span className="mb-2 block">الفئة</span>
          <select
            value={filterCategory}
            onChange={handleFilterValueChange(setFilterCategory)}
            className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
          >
            <option value="">الكل</option>
            <option value="رواتب">رواتب</option>
            <option value="عضويات">عضويات</option>
            <option value="اشتراكات">اشتراكات</option>
            <option value="مصاريف أخرى">مصاريف أخرى</option>
          </select>
        </label>
      </div>

      <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
        <div className="border-b border-slate-200 px-6 py-4">
          <h2 className="text-xl font-semibold text-slate-900">سجل الحركات المالية</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full text-right">
            <thead className="bg-slate-50 text-sm text-slate-600">
              <tr>
                <th className="px-4 py-3">التاريخ</th>
                <th className="px-4 py-3">النوع</th>
                <th className="px-4 py-3">الفئة</th>
                <th className="px-4 py-3">الفرع</th>
                <th className="px-4 py-3">الاسم/الجهة</th>
                <th className="px-4 py-3">تم بواسطة</th>
                <th className="px-4 py-3">المبلغ</th>
                <th className="px-4 py-3">الملاحظات</th>
                <th className="px-4 py-3">إجراءات</th>
              </tr>
            </thead>
            <tbody>
              {paginatedFinances.length ? (
                paginatedFinances.map((entry) => (
                  <tr key={entry.id} className="border-t border-slate-100 text-sm text-slate-700">
                    <td className="px-4 py-3">{entry.date}</td>
                    <td className="px-4 py-3">{entry.type === 'income' ? 'دخل' : 'مصروف'}</td>
                    <td className="px-4 py-3">{entry.category}</td>
                    <td className="px-4 py-3">{entry.branchName || entry.branch || '-'}</td>
                    <td className="px-4 py-3">{entry.relatedTo || '-'}</td>
                    <td className="px-4 py-3">{entry.createdBy?.name || entry.createdBy?.email || '-'}</td>
                    <td className="px-4 py-3">{Number(entry.amount || 0).toLocaleString()}</td>
                    <td className="px-4 py-3">{entry.description || '-'}</td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap gap-2">
                        <button type="button" onClick={() => openModal(entry)} className="rounded-xl border border-slate-300 px-3 py-1.5 text-sm hover:bg-slate-100">
                          تعديل
                        </button>
                        <button type="button" onClick={() => handleDelete(entry.id)} className="rounded-xl border border-rose-300 px-3 py-1.5 text-sm text-rose-600 hover:bg-rose-50">
                          حذف
                        </button>
                        <button type="button" onClick={() => exportPdf(entry)} className="rounded-xl bg-sky-600 px-3 py-1.5 text-sm text-white hover:bg-sky-700">
                          PDF
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    لا توجد نتائج مطابقة للبحث
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {filteredFinances.length > rowsPerPage ? (
          <div className="flex items-center justify-center gap-3 border-t border-slate-200 px-6 py-4">
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.max(1, page - 1))}
              disabled={currentPage === 1}
              className="rounded-2xl border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              السابق
            </button>
            <span className="text-sm text-slate-500">صفحة {currentPage} من {totalPages}</span>
            <button
              type="button"
              onClick={() => setCurrentPage((page) => Math.min(totalPages, page + 1))}
              disabled={currentPage === totalPages}
              className="rounded-2xl border border-slate-300 px-3 py-2 text-sm disabled:cursor-not-allowed disabled:opacity-50"
            >
              التالي
            </button>
          </div>
        ) : null}
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-semibold text-slate-900">{editingId ? 'تعديل حركة مالية' : 'إضافة حركة مالية'}</h3>
              <button type="button" onClick={closeModal} className="text-slate-500 hover:text-slate-800">
                ✕
              </button>
            </div>
            <form className="space-y-4" onSubmit={handleSubmit}>
              <select
                value={form.type}
                onChange={(event) => setForm((prev) => ({ ...prev, type: event.target.value as FinanceType }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
                required
              >
                <option value="">اختر النوع</option>
                <option value="income">دخل</option>
                <option value="expense">مصروف</option>
              </select>

              <select
                value={form.category}
                onChange={(event) => setForm((prev) => ({ ...prev, category: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
                required
              >
                <option value="">اختر الفئة</option>
                <option value="رواتب">رواتب</option>
                <option value="عضويات">عضويات</option>
                <option value="اشتراكات">اشتراكات</option>
                <option value="مصاريف أخرى">مصاريف أخرى</option>
              </select>

              <select
                value={form.branch}
                onChange={(event) => setForm((prev) => ({ ...prev, branch: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
              >
                <option value="">اختر الفرع</option>
                {branches.map((branch) => (
                  <option key={branch.id || branch.name} value={branch.id || branch.name || ''}>
                    {branch.name}
                  </option>
                ))}
              </select>

              <input
                value={form.relatedTo}
                onChange={(event) => setForm((prev) => ({ ...prev, relatedTo: event.target.value }))}
                placeholder="الاسم أو الجهة"
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
                required
              />

              <input
                type="number"
                value={form.amount}
                onChange={(event) => setForm((prev) => ({ ...prev, amount: event.target.value }))}
                placeholder="المبلغ"
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
                required
              />

              <input
                type="date"
                value={form.date}
                onChange={(event) => setForm((prev) => ({ ...prev, date: event.target.value }))}
                className="w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
                required
              />

              <textarea
                value={form.description}
                onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                placeholder="ملاحظات"
                className="min-h-24 w-full rounded-2xl border border-slate-200 px-3 py-2 outline-none focus:border-sky-500"
              />

              <div className="flex justify-end gap-3">
                <button type="button" onClick={closeModal} className="rounded-2xl border border-slate-300 px-4 py-2 text-sm text-slate-700">
                  إلغاء
                </button>
                <button type="submit" className="rounded-2xl bg-sky-600 px-4 py-2 text-sm font-medium text-white">
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {toast ? (
        <div className={`fixed left-1/2 top-6 z-[80] -translate-x-1/2 rounded-2xl px-4 py-3 text-sm font-medium shadow-lg ${toast.type === 'error' ? 'bg-rose-600 text-white' : toast.type === 'warning' ? 'bg-amber-500 text-white' : 'bg-emerald-600 text-white'}`}>
          {toast.message}
        </div>
      ) : null}
    </div>
  );
}

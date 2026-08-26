import { useEffect, useMemo, useState, type ChangeEvent, type FormEvent } from 'react';
import { jsPDF } from 'jspdf';
import { Plus, SearchSm, Trash01, File02, CreditCard01 } from '@untitledui/icons';
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip as RechartsTooltip,
  CartesianGrid,
  Legend,
} from 'recharts';
import AppIcon from '@/components/AppIcon';
import Pagination from '@/components/Pagination';
import { useAuth } from '@/contexts/AuthContext';

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

const rowsPerPage = 10;

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

function normalizeFinanceFromApi(row: Record<string, unknown>): FinanceEntry | null {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    type: (String(row.type || '') as FinanceType),
    category: String(row.category || ''),
    branch: String(row.branch || row.branchName || ''),
    branchId: String(row.branch_id || row.branchId || ''),
    branchName: String(row.branchName || row.branch || ''),
    relatedTo: String(row.related_to || row.relatedTo || ''),
    amount: Number(row.amount || 0),
    date: String(row.date || '').slice(0, 10),
    description: String(row.description || ''),
  };
}

export default function Finance() {
  const { canEdit } = useAuth();
  const canEditFinance = canEdit('finance');

  const [finances, setFinances] = useState<FinanceEntry[]>(() => readStoredData('finances', []));
  const [branches, setBranches] = useState<Branch[]>(() => readStoredData('branches', []));

  const [search, setSearch] = useState('');
  const [filterMonth, setFilterMonth] = useState('');
  const [filterType, setFilterType] = useState<FinanceType | ''>('');
  const [filterBranch, setFilterBranch] = useState('');
  const [filterCategory, setFilterCategory] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  // Period / Date Range filter states
  const [periodMode, setPeriodMode] = useState<'all' | 'yearly' | 'monthly' | 'custom'>('all');
  const [selectedYear, setSelectedYear] = useState<string>(() => new Date().getFullYear().toString());
  const [selectedMonth, setSelectedMonth] = useState<string>(() => new Date().toISOString().slice(0, 7));
  const [startDate, setStartDate] = useState<string>('');
  const [endDate, setEndDate] = useState<string>('');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formData, setFormData] = useState<FinanceForm>(emptyForm);

  const [currentPage, setCurrentPage] = useState(1);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  useEffect(() => {
    const loadFromApi = async () => {
      const api = window.api;
      if (!api?.getToken?.()) return;

      try {
        const [resFinances, resBranches] = await Promise.all([
          api.getFinanceRecords?.(),
          api.getBranches?.(),
        ]);

        const serverFinances = Array.isArray((resFinances as { data?: unknown[] })?.data)
          ? ((resFinances as { data?: unknown[] }).data || [])
          : [];
        const mappedFinances = serverFinances
          .map((item) => normalizeFinanceFromApi(item as Record<string, unknown>))
          .filter((item): item is FinanceEntry => Boolean(item && item.id));

        if (mappedFinances.length > 0) {
          setFinances(mappedFinances);
          window.localStorage.setItem('finances', JSON.stringify(mappedFinances));
        }

        const serverBranches = Array.isArray((resBranches as { data?: unknown[] })?.data)
          ? ((resBranches as { data?: unknown[] }).data || [])
          : [];
        if (serverBranches.length > 0) {
          const mappedBranches = serverBranches.map((item) => {
            const b = item as Record<string, unknown>;
            return { id: String(b.id || ''), name: String(b.name || '') };
          });
          setBranches(mappedBranches);
          window.localStorage.setItem('branches', JSON.stringify(mappedBranches));
        }
      } catch {
        // Fallback to local storage
      }
    };

    loadFromApi();
  }, []);

  useEffect(() => {
    const handleSync = () => {
      setFinances(readStoredData('finances', []));
    };
    window.addEventListener('storage', handleSync);
    window.addEventListener('app:sync', handleSync);
    return () => {
      window.removeEventListener('storage', handleSync);
      window.removeEventListener('app:sync', handleSync);
    };
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
  };

  const persistFinances = (nextFinances: FinanceEntry[]) => {
    setFinances(nextFinances);
    window.localStorage.setItem('finances', JSON.stringify(nextFinances));
  };

  const yearOptions = useMemo(() => {
    const years = new Set<string>();
    finances.forEach((entry) => {
      if (entry.date) {
        years.add(entry.date.slice(0, 4));
      }
    });
    if (years.size === 0) years.add(new Date().getFullYear().toString());
    return Array.from(years).sort().reverse();
  }, [finances]);

  const monthOptions = useMemo(() => {
    const months = new Set<string>();
    finances.forEach((entry) => {
      if (entry.date) {
        months.add(entry.date.slice(0, 7));
      }
    });
    if (months.size === 0) months.add(new Date().toISOString().slice(0, 7));
    return Array.from(months).sort().reverse();
  }, [finances]);

  const categoryOptions = useMemo(() => {
    const cats = new Set<string>();
    finances.forEach((entry) => {
      if (entry.category) cats.add(entry.category);
    });
    return Array.from(cats);
  }, [finances]);

  const filteredFinances = useMemo(() => {
    return finances.filter((entry) => {
      const matchesSearch =
        !search ||
        (entry.description || '').toLowerCase().includes(search.toLowerCase()) ||
        (entry.relatedTo || '').toLowerCase().includes(search.toLowerCase()) ||
        (entry.category || '').toLowerCase().includes(search.toLowerCase());

      const matchesType = !filterType || entry.type === filterType;
      const matchesBranch =
        !filterBranch ||
        entry.branch === filterBranch ||
        entry.branchName === filterBranch ||
        entry.branchId === filterBranch;
      const matchesCategory = !filterCategory || entry.category === filterCategory;

      let matchesPeriod = true;
      const dateStr = (entry.date || '').slice(0, 10);

      if (periodMode === 'yearly') {
        matchesPeriod = dateStr.startsWith(selectedYear);
      } else if (periodMode === 'monthly') {
        matchesPeriod = dateStr.startsWith(selectedMonth);
      } else if (periodMode === 'custom') {
        if (startDate && dateStr < startDate) matchesPeriod = false;
        if (endDate && dateStr > endDate) matchesPeriod = false;
      }

      const matchesMonthFallback = !filterMonth || dateStr.startsWith(filterMonth);

      return matchesSearch && matchesType && matchesBranch && matchesCategory && matchesPeriod && matchesMonthFallback;
    });
  }, [finances, search, filterType, filterBranch, filterCategory, periodMode, selectedYear, selectedMonth, startDate, endDate, filterMonth]);

  useEffect(() => {
    setCurrentPage(1);
  }, [search, filterMonth, filterType, filterBranch, filterCategory, periodMode, selectedYear, selectedMonth, startDate, endDate]);

  const chartData = useMemo(() => {
    const buckets: Record<string, { name: string; income: number; expense: number }> = {};

    filteredFinances.forEach((entry) => {
      let key = 'أخرى';
      if (entry.date) {
        if (periodMode === 'yearly' || periodMode === 'all') {
          key = entry.date.slice(0, 7);
        } else {
          key = entry.date.slice(0, 10);
        }
      }

      if (!buckets[key]) {
        buckets[key] = { name: key, income: 0, expense: 0 };
      }
      const amount = Number(entry.amount || 0);
      if (entry.type === 'income') {
        buckets[key].income += amount;
      } else if (entry.type === 'expense') {
        buckets[key].expense += amount;
      }
    });

    return Object.values(buckets).sort((a, b) => a.name.localeCompare(b.name));
  }, [filteredFinances, periodMode]);

  const categoryBreakdown = useMemo(() => {
    const catMap: Record<string, number> = {};
    filteredFinances.forEach((entry) => {
      const amt = Number(entry.amount || 0);
      const cat = entry.category || 'عام';
      catMap[cat] = (catMap[cat] || 0) + amt;
    });
    return Object.entries(catMap)
      .map(([name, value]) => ({ name, value }))
      .sort((a, b) => b.value - a.value);
  }, [filteredFinances]);

  const summary = useMemo(() => {
    let income = 0;
    let expenses = 0;
    let membershipIncome = 0;

    filteredFinances.forEach((entry) => {
      const amount = Number(entry.amount || 0);
      if (entry.type === 'income') {
        income += amount;
        if (entry.category === 'عضويات') {
          membershipIncome += amount;
        }
      } else if (entry.type === 'expense') {
        expenses += amount;
      }
    });

    return {
      income,
      expenses,
      balance: income - expenses,
      membershipIncome,
    };
  }, [filteredFinances]);

  const totalPages = Math.ceil(filteredFinances.length / rowsPerPage) || 1;
  const paginatedFinances = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredFinances.slice(start, start + rowsPerPage);
  }, [filteredFinances, currentPage]);

  const openModal = (entry?: FinanceEntry) => {
    if (entry) {
      setEditingId(entry.id || null);
      setFormData({
        type: entry.type,
        category: entry.category,
        branch: entry.branch || entry.branchName || '',
        relatedTo: entry.relatedTo || '',
        amount: String(entry.amount),
        date: entry.date,
        description: entry.description || '',
      });
    } else {
      setEditingId(null);
      setFormData({
        ...emptyForm,
        date: new Date().toISOString().split('T')[0],
      });
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingId(null);
    setFormData(emptyForm);
  };

  const handleFormChange = (
    field: keyof FinanceForm
  ) => (event: ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    setFormData((prev) => ({ ...prev, [field]: event.target.value }));
  };

  const handleSave = async (event: FormEvent) => {
    event.preventDefault();

    if (!formData.type || !formData.category || !formData.amount || !formData.date) {
      showToast('يرجى استكمال الحقول المطلوبة', 'warning');
      return;
    }

    const payload = {
      type: formData.type as FinanceType,
      category: formData.category,
      branch: formData.branch,
      relatedTo: formData.relatedTo,
      amount: Number(formData.amount),
      date: formData.date,
      description: formData.description,
    };

    let nextFinances = [...finances];

    if (window.api?.getToken()) {
      try {
        if (editingId) {
          await window.api.updateFinance?.(editingId, payload);
          nextFinances = nextFinances.map((f) => (f.id === editingId ? { ...f, ...payload } : f));
          showToast('تم تعديل الحركة بنجاح');
        } else {
          const res = await window.api.createFinance?.(payload);
          const newEntry = (res as { data?: FinanceEntry })?.data;
          nextFinances = [newEntry || { ...payload, id: `fin_${Date.now()}` }, ...nextFinances];
          showToast('تم إضافة الحركة بنجاح');
        }
      } catch (error) {
        console.error('Failed to save finance via API', error);
        showToast('تعذر الحفظ عبر الباك إند، تم الحفظ محلياً', 'warning');
      }
    } else {
      if (editingId) {
        nextFinances = nextFinances.map((f) => (f.id === editingId ? { ...f, ...payload } : f));
        showToast('تم تعديل الحركة محلياً');
      } else {
        nextFinances = [{ ...payload, id: `fin_${Date.now()}` }, ...nextFinances];
        showToast('تم إضافة الحركة محلياً');
      }
    }

    persistFinances(nextFinances);
    closeModal();
  };

  const handleDelete = async (entryId: string) => {
    if (!window.confirm('هل أنت متأكد من حذف هذه الحركة المالية؟')) return;

    if (window.api?.getToken()) {
      try {
        await window.api.deleteFinance?.(entryId);
      } catch (error) {
        console.error('Failed to delete finance via API', error);
      }
    }

    const nextFinances = finances.filter((entry) => entry.id !== entryId);
    persistFinances(nextFinances);
    showToast('تم حذف الحركة المالية بنجاح');
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
    showToast('تم تصدير ملف CSV بنجاح');
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
              <AppIcon icon={CreditCard01} className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">النظام المالي والمصروفات</h1>
              <p className="text-xs text-slate-500">إدارة ومتابعة جميع الإيرادات والمصروفات والصافي المالي</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEditFinance && (
              <button
                type="button"
                onClick={() => openModal()}
                className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
              >
                <Plus className="h-4 w-4" />
                إضافة حركة
              </button>
            )}
            <button
              type="button"
              onClick={exportToCsv}
              className="rounded-xl bg-sky-600 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-sky-700"
            >
              Excel ⬇
            </button>
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
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-right">
            <span className="text-xs font-medium text-emerald-600">إجمالي الدخل</span>
            <p className="mt-1 text-xl font-bold text-emerald-700">{formatMoney(summary.income)}</p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 text-right">
            <span className="text-xs font-medium text-rose-600">إجمالي المصروفات</span>
            <p className="mt-1 text-xl font-bold text-rose-600">{formatMoney(summary.expenses)}</p>
          </div>
          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-right">
            <span className="text-xs font-medium text-sky-600">الرصيد الصافي</span>
            <p className="mt-1 text-xl font-bold text-sky-700">{formatMoney(summary.balance)}</p>
          </div>
          <div className="rounded-xl border border-purple-100 bg-purple-50/50 p-3 text-right">
            <span className="text-xs font-medium text-purple-600">دخل العضويات</span>
            <p className="mt-1 text-xl font-bold text-purple-700">{formatMoney(summary.membershipIncome)}</p>
          </div>
        </div>
      </div>

      {/* ── Mini Dashboard Charts & Category Analysis ── */}
      <div className="grid gap-4 lg:grid-cols-[1.8fr_1fr]">
        {/* Bar Chart Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
          <div className="mb-3 flex items-center justify-between border-b border-slate-100 pb-3">
            <div>
              <h3 className="font-bold text-slate-900 text-sm">مؤشر حركة الإيرادات والمصروفات</h3>
              <p className="text-[11px] text-slate-400">تحليل رصيد الدخل والمصروف بناءً على تصفية الفترة</p>
            </div>
            <span className="inline-flex rounded-full bg-sky-50 px-2.5 py-1 text-[11px] font-semibold text-sky-700">
              {periodMode === 'all' && 'كل الأوقات'}
              {periodMode === 'yearly' && `السنة: ${selectedYear}`}
              {periodMode === 'monthly' && `الشهر: ${formatMonthLabel(selectedMonth)}`}
              {periodMode === 'custom' && `من ${startDate || 'البداية'} إلى ${endDate || 'اليوم'}`}
            </span>
          </div>
          <div className="h-60 w-full">
            {chartData.length === 0 ? (
              <div className="flex h-full items-center justify-center text-xs text-slate-400">
                لا توجد بيانات مالية بالفترة المحددة
              </div>
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={chartData} margin={{ top: 10, right: 10, left: 10, bottom: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="name" stroke="#94a3b8" fontSize={11} tickLine={false} />
                  <YAxis stroke="#94a3b8" fontSize={11} tickLine={false} tickFormatter={(v) => `${v}`} />
                  <RechartsTooltip
                    formatter={(value: number) => [`${value.toLocaleString()} ج.م`, '']}
                    contentStyle={{ backgroundColor: '#0f172a', borderColor: '#1e293b', borderRadius: '12px', color: '#fff', fontSize: '12px' }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px', paddingTop: '8px' }} />
                  <Bar dataKey="income" name="الدخل 📈" fill="#10b981" radius={[6, 6, 0, 0]} />
                  <Bar dataKey="expense" name="المصروفات 📉" fill="#f43f5e" radius={[6, 6, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            )}
          </div>
        </div>

        {/* Category Summary Breakdown Card */}
        <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm flex flex-col justify-between">
          <div>
            <div className="mb-3 border-b border-slate-100 pb-3">
              <h3 className="font-bold text-slate-900 text-sm">توزيع الفئات المالية</h3>
              <p className="text-[11px] text-slate-400">أعلى الفئات مساهمة بالحسابات</p>
            </div>

            <div className="space-y-2 max-h-44 overflow-y-auto pr-1">
              {categoryBreakdown.length === 0 ? (
                <p className="text-xs text-slate-400 text-center py-6">لا توجد بيانات فئات</p>
              ) : (
                categoryBreakdown.map((item) => (
                  <div key={item.name} className="flex items-center justify-between rounded-xl bg-slate-50 p-2.5">
                    <span className="text-xs font-semibold text-slate-700">{item.name}</span>
                    <span className="text-xs font-bold text-slate-900">{formatMoney(item.value)}</span>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="mt-3 border-t border-slate-100 pt-3 flex items-center justify-between text-xs">
            <span className="text-slate-500 font-medium">إجمالي الحركات:</span>
            <span className="font-bold text-sky-700 bg-sky-50 px-2.5 py-1 rounded-lg">{filteredFinances.length} حركة</span>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Card with Period Controls ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-3">
          <div className="flex items-center gap-2">
            <span className="text-xs font-bold text-slate-700">تصفية الفترة:</span>
            <div className="inline-flex rounded-xl bg-slate-100 p-1">
              <button
                type="button"
                onClick={() => setPeriodMode('all')}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${periodMode === 'all' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                الكل 🌐
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('yearly')}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${periodMode === 'yearly' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                سنوي 📅
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('monthly')}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${periodMode === 'monthly' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                شهري 🗓️
              </button>
              <button
                type="button"
                onClick={() => setPeriodMode('custom')}
                className={`rounded-lg px-3 py-1 text-xs font-semibold transition ${periodMode === 'custom' ? 'bg-sky-600 text-white shadow-sm' : 'text-slate-600 hover:text-slate-900'}`}
              >
                من يوم لليوم ⏱️
              </button>
            </div>
          </div>

          {/* Dynamic Period Control Inputs */}
          <div className="flex flex-wrap items-center gap-2">
            {periodMode === 'yearly' && (
              <select
                value={selectedYear}
                onChange={(e) => setSelectedYear(e.target.value)}
                className="rounded-xl border border-sky-300 bg-sky-50/70 px-3 py-1.5 text-xs font-bold text-sky-800 outline-none"
              >
                {yearOptions.map((year) => (
                  <option key={year} value={year}>سنة {year}</option>
                ))}
              </select>
            )}

            {periodMode === 'monthly' && (
              <select
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="rounded-xl border border-sky-300 bg-sky-50/70 px-3 py-1.5 text-xs font-bold text-sky-800 outline-none"
              >
                {monthOptions.map((month) => (
                  <option key={month} value={month}>{formatMonthLabel(month)}</option>
                ))}
              </select>
            )}

            {periodMode === 'custom' && (
              <div className="flex items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  من:
                  <input
                    type="date"
                    value={startDate}
                    onChange={(e) => setStartDate(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-sky-500"
                  />
                </label>
                <label className="flex items-center gap-1.5 text-xs font-medium text-slate-600">
                  إلى:
                  <input
                    type="date"
                    value={endDate}
                    onChange={(e) => setEndDate(e.target.value)}
                    className="rounded-lg border border-slate-200 bg-white px-2 py-1 text-xs text-slate-800 outline-none focus:border-sky-500"
                  />
                </label>
              </div>
            )}
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative flex items-center">
            <SearchSm className="absolute right-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالوصف، الجهة أو الفئة..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-9 pl-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
            />
          </div>

          <select
            value={filterType}
            onChange={(e) => setFilterType(e.target.value as FinanceType | '')}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-sky-500 focus:bg-white"
          >
            <option value="">كل المعاملات (دخل/مصروف)</option>
            <option value="income">دخل فقط 📈</option>
            <option value="expense">مصروف فقط 📉</option>
          </select>

          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-sky-500 focus:bg-white"
          >
            <option value="">كل الفروع</option>
            {branches.map((b) => (
              <option key={b.id || b.name} value={b.name || ''}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={filterCategory}
            onChange={(e) => setFilterCategory(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-sky-500 focus:bg-white"
          >
            <option value="">كل الفئات</option>
            {categoryOptions.map((cat) => (
              <option key={cat} value={cat}>{cat}</option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Content View (Cards or Table) ── */}
      {viewMode === 'cards' ? (
        /* ── Compact Cards View ── */
        paginatedFinances.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
            لا توجد حركات مالية تطابق البحث.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedFinances.map((entry) => {
              const isIncome = entry.type === 'income';

              return (
                <div
                  key={entry.id || `${entry.date}_${entry.amount}`}
                  className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                    isIncome ? 'border-emerald-100' : 'border-rose-100'
                  }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <span className="font-mono text-[11px] text-slate-400">{entry.date}</span>
                        <h3 className="font-bold text-slate-900 text-sm mt-0.5">
                          {entry.relatedTo || entry.category || 'معاملة مالية'}
                        </h3>
                      </div>

                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${
                          isIncome
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-rose-50 text-rose-700 border-rose-200'
                        }`}
                      >
                        {isIncome ? 'دخل 📈' : 'مصروف 📉'}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                        <span className="text-slate-500">المبلغ:</span>
                        <span className={`font-bold text-sm ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                          {Number(entry.amount).toLocaleString()} ج.م
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                        <span className="text-slate-500">الفئة والفرع:</span>
                        <span className="font-medium text-slate-800">
                          {entry.category} {entry.branch ? `• ${entry.branch}` : ''}
                        </span>
                      </div>

                      {entry.description ? (
                        <div className="bg-slate-50 p-2 rounded-lg text-slate-500 text-[11px]">
                          {entry.description}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <button
                      type="button"
                      onClick={() => exportPdf(entry)}
                      className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 transition"
                      title="طباعة السند"
                    >
                      <AppIcon icon={File02} className="h-4 w-4" />
                    </button>

                    {canEditFinance && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openModal(entry)}
                          className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                        >
                          تعديل
                        </button>
                        {entry.id && (
                          <button
                            type="button"
                            onClick={() => handleDelete(entry.id!)}
                            className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 transition"
                            title="حذف"
                          >
                            <AppIcon icon={Trash01} className="h-4 w-4" />
                          </button>
                        )}
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
                  <th className="px-4 py-3 font-semibold">التاريخ</th>
                  <th className="px-4 py-3 font-semibold">النوع</th>
                  <th className="px-4 py-3 font-semibold">الفئة</th>
                  <th className="px-4 py-3 font-semibold">الفرع</th>
                  <th className="px-4 py-3 font-semibold">الجهة/الاسم</th>
                  <th className="px-4 py-3 font-semibold">المبلغ</th>
                  <th className="px-4 py-3 font-semibold">الملاحظات</th>
                  <th className="px-4 py-3 text-center font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedFinances.map((entry) => {
                  const isIncome = entry.type === 'income';

                  return (
                    <tr key={entry.id || `${entry.date}_${entry.amount}`} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-mono text-slate-600">{entry.date}</td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                            isIncome
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-rose-50 text-rose-700 border-rose-200'
                          }`}
                        >
                          {isIncome ? 'دخل 📈' : 'مصروف 📉'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-medium text-slate-800">{entry.category}</td>
                      <td className="px-4 py-3 text-slate-600">{entry.branchName || entry.branch || '-'}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{entry.relatedTo || '-'}</td>
                      <td className={`px-4 py-3 font-bold ${isIncome ? 'text-emerald-600' : 'text-rose-600'}`}>
                        {Number(entry.amount).toLocaleString()} ج
                      </td>
                      <td className="px-4 py-3 text-slate-500 max-w-[200px] truncate">{entry.description || '-'}</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => exportPdf(entry)}
                            className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200 transition"
                            title="سند PDF"
                          >
                            <AppIcon icon={File02} className="h-4 w-4" />
                          </button>

                          {canEditFinance && (
                            <button
                              type="button"
                              onClick={() => openModal(entry)}
                              className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                            >
                              تعديل
                            </button>
                          )}
                          {canEditFinance && entry.id && (
                            <button
                              type="button"
                              onClick={() => handleDelete(entry.id!)}
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

                {paginatedFinances.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-xs">
                      لا توجد حركات مالية تطابق البحث.
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
        totalItems={filteredFinances.length}
        onPageChange={setCurrentPage}
        label="حركة"
      />

      {/* ── Modal Dialog: Add / Edit Finance ── */}
      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-sky-50 p-2.5 text-sky-600">
                  <AppIcon icon={CreditCard01} className="h-5 w-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingId ? 'تعديل حركة مالية' : 'إضافة حركة مالية جديدة'}
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

            <form id="financeModalForm" onSubmit={handleSave} className="space-y-4 p-5 text-right text-xs">
              <div>
                <label className="block mb-1 font-semibold text-slate-700">نوع الحركة</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, type: 'income' }))}
                    className={`rounded-xl py-2.5 text-center font-bold transition border ${
                      formData.type === 'income'
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    إيراد / دخل 📈
                  </button>
                  <button
                    type="button"
                    onClick={() => setFormData((prev) => ({ ...prev, type: 'expense' }))}
                    className={`rounded-xl py-2.5 text-center font-bold transition border ${
                      formData.type === 'expense'
                        ? 'bg-rose-600 text-white border-rose-600 shadow-xs'
                        : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                    }`}
                  >
                    مصروفات 📉
                  </button>
                </div>
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">الفئة</label>
                <input
                  required
                  value={formData.category}
                  placeholder="مثال: رواتب / اشتراكات / صيانة"
                  onChange={handleFormChange('category')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">الفرع</label>
                <select
                  value={formData.branch}
                  onChange={handleFormChange('branch')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none"
                >
                  <option value="">-- اختر الفرع --</option>
                  {branches.map((b) => (
                    <option key={b.id || b.name} value={b.name || ''}>
                      {b.name}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">الجهة / الاسم المرتبط</label>
                <input
                  value={formData.relatedTo}
                  placeholder="اسم الشخص أو المورد..."
                  onChange={handleFormChange('relatedTo')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 font-semibold text-slate-700">المبلغ (ج.م)</label>
                  <input
                    type="number"
                    min={0}
                    required
                    value={formData.amount}
                    placeholder="0"
                    onChange={handleFormChange('amount')}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-semibold text-slate-700">التاريخ</label>
                  <input
                    type="date"
                    required
                    value={formData.date}
                    onChange={handleFormChange('date')}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  />
                </div>
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">الوصف / ملاحظات</label>
                <textarea
                  rows={2}
                  value={formData.description}
                  placeholder="تفاصيل إضافية عن الحركة المالية..."
                  onChange={handleFormChange('description')}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                />
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
                form="financeModalForm"
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 transition"
              >
                حفظ الحركة
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

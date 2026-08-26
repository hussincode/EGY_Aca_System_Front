import { useEffect, useMemo, useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import { Plus, SearchSm, Phone01, Trash01, User01, MessageChatCircle } from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

type LeadStatus = 'new' | 'contact' | 'trial' | 'interested' | 'not' | 'convert';
type LeadScore = 'hot' | 'mid' | 'cold';

type Lead = {
  id: string;
  name: string;
  parent?: string;
  phone?: string;
  sport?: string;
  age?: string | number;
  branch?: string;
  branch_id?: string;
  source?: string;
  score?: LeadScore;
  followDate?: string;
  tags?: string[];
  notes?: string;
  status?: LeadStatus;
  created_at?: string;
};

type Player = {
  id: string;
  name?: string;
  phone?: string;
  game?: string;
  source?: string;
};

type LeadFormState = {
  name: string;
  parent: string;
  phone: string;
  sport: string;
  age: string;
  branch: string;
  source: string;
  score: LeadScore;
  followDate: string;
  tags: string;
  notes: string;
};

const initialFormState: LeadFormState = {
  name: '',
  parent: '',
  phone: '',
  sport: '',
  age: '',
  branch: '',
  source: '',
  score: 'hot',
  followDate: '',
  tags: '',
  notes: '',
};

const LEADS_KEY = 'leads';
const BRANCHES_KEY = 'branches';

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

function createLeadId() {
  return `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function normalizeLead(lead: Partial<Lead> & { id?: string }): Lead {
  return {
    id: lead.id || createLeadId(),
    name: lead.name || '-',
    parent: lead.parent || '',
    phone: lead.phone || '',
    sport: lead.sport || '',
    age: lead.age || '',
    branch: lead.branch || '',
    source: lead.source || '',
    score: lead.score || 'hot',
    followDate: lead.followDate || '',
    tags: Array.isArray(lead.tags) ? lead.tags : [],
    notes: lead.notes || '',
    status: lead.status || 'new',
    branch_id: lead.branch_id || '',
    created_at: lead.created_at || '',
  };
}

function normalizeLeadFromDb(row: Record<string, unknown> | null | undefined): Lead | null {
  if (!row) return null;
  return normalizeLead({
    id: String(row.id || ''),
    name: String(row.name || ''),
    parent: String(row.parent || ''),
    phone: String(row.phone || ''),
    sport: String(row.interest || row.sport || ''),
    branch: String(row.branch_name || row.branch || ''),
    branch_id: String(row.branch_id || ''),
    source: String(row.source || ''),
    score: (row.score as LeadScore) || 'hot',
    followDate: String(row.followDate || ''),
    notes: String(row.notes || ''),
    status: (row.status as LeadStatus) || 'new',
    created_at: String(row.created_at || ''),
  });
}

function getStatusLabel(status?: LeadStatus) {
  switch (status) {
    case 'new':
      return 'جديد';
    case 'contact':
      return 'تم التواصل';
    case 'trial':
      return 'تمرين تجريبي';
    case 'interested':
      return 'مهتم جداً';
    case 'not':
      return 'غير مهتم';
    case 'convert':
      return 'تم التحويل للاعب';
    default:
      return 'جديد';
  }
}

function getStatusBadgeStyle(status?: LeadStatus) {
  switch (status) {
    case 'new':
      return 'bg-sky-50 text-sky-700 border-sky-200';
    case 'contact':
      return 'bg-blue-50 text-blue-700 border-blue-200';
    case 'trial':
      return 'bg-purple-50 text-purple-700 border-purple-200';
    case 'interested':
      return 'bg-amber-50 text-amber-700 border-amber-200';
    case 'not':
      return 'bg-slate-100 text-slate-600 border-slate-200';
    case 'convert':
      return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    default:
      return 'bg-slate-100 text-slate-600 border-slate-200';
  }
}

export default function Leads() {
  const navigate = useNavigate();
  const { canEdit } = useAuth();
  const canEditLeads = canEdit('leads');

  const [leads, setLeads] = useState<Lead[]>(() => {
    const raw = readStoredData<unknown[]>(LEADS_KEY, []);
    return raw.map((item) => normalizeLead(item as Partial<Lead>));
  });

  const [branches, setBranches] = useState<Array<{ id: string; name: string }>>(() =>
    readStoredData(BRANCHES_KEY, [])
  );

  const [search, setSearch] = useState('');
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [filterScore, setFilterScore] = useState<string>('all');
  const [filterBranch, setFilterBranch] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [formState, setFormState] = useState<LeadFormState>(initialFormState);

  const [bulkBranch, setBulkBranch] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [isSendingBulk, setIsSendingBulk] = useState(false);
  const [bulkStatus, setBulkStatus] = useState('');

  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'warning' } | null>(null);

  // Load from API on mount
  useEffect(() => {
    const loadData = async () => {
      const api = window.api;

      if (api?.getBranches && api?.getToken?.()) {
        try {
          const res = (await api.getBranches()) as { data?: Array<{ id: string; name: string }> };
          if (Array.isArray(res?.data) && res.data.length) {
            setBranches(res.data);
            window.localStorage.setItem(BRANCHES_KEY, JSON.stringify(res.data));
          }
        } catch {
          // fallback
        }
      }

      if (!api?.getLeads || !api?.getToken?.()) {
        return;
      }

      try {
        const response = (await api.getLeads()) as { data?: unknown[] };
        const serverLeads = Array.isArray(response?.data) ? response.data : [];
        const mapped = serverLeads
          .map((item) => normalizeLeadFromDb(item as Record<string, unknown>))
          .filter((item): item is Lead => Boolean(item && item.id));

        if (mapped.length > 0) {
          const localLeads = readStoredData<unknown[]>(LEADS_KEY, []).map((item) =>
            normalizeLead(item as Partial<Lead>)
          );
          const merged = [
            ...mapped,
            ...localLeads.filter((local) => !mapped.some((server) => server.id === local.id)),
          ];
          setLeads(merged);
          window.localStorage.setItem(LEADS_KEY, JSON.stringify(merged));
        }
      } catch {
        // fallback
      }
    };

    loadData();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' | 'warning' = 'success') => {
    setToast({ message, type });
  };

  const filteredLeads = useMemo(() => {
    return leads.filter((lead) => {
      const term = search.trim().toLowerCase();
      const matchesSearch =
        !term ||
        lead.name.toLowerCase().includes(term) ||
        (lead.parent || '').toLowerCase().includes(term) ||
        (lead.phone || '').includes(term) ||
        (lead.sport || '').toLowerCase().includes(term) ||
        (lead.notes || '').toLowerCase().includes(term);

      const matchesStatus = filterStatus === 'all' || lead.status === filterStatus;
      const matchesScore = filterScore === 'all' || lead.score === filterScore;
      const matchesBranch = filterBranch === 'all' || lead.branch === filterBranch;

      return matchesSearch && matchesStatus && matchesScore && matchesBranch;
    });
  }, [leads, search, filterStatus, filterScore, filterBranch]);

  const stats = useMemo(() => {
    const total = leads.length;
    const newCount = leads.filter((item) => item.status === 'new').length;
    const intCount = leads.filter((item) => item.status === 'interested').length;
    const convCount = leads.filter((item) => item.status === 'convert').length;
    const hotCount = leads.filter((item) => item.score === 'hot').length;
    return { total, newCount, intCount, convCount, hotCount };
  }, [leads]);

  const openAddModal = () => {
    setEditingLeadId(null);
    setFormState(initialFormState);
    setIsModalOpen(true);
  };

  const openEditModal = (lead: Lead) => {
    setEditingLeadId(lead.id);
    setFormState({
      name: lead.name || '',
      parent: lead.parent || '',
      phone: lead.phone || '',
      sport: lead.sport || '',
      age: String(lead.age || ''),
      branch: lead.branch || '',
      source: lead.source || '',
      score: lead.score || 'hot',
      followDate: lead.followDate || '',
      tags: (lead.tags || []).join(', '),
      notes: lead.notes || '',
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingLeadId(null);
    setFormState(initialFormState);
  };

  const saveLeadToDb = async (leadData: Lead) => {
    const api = window.api;
    if (!api?.getToken?.()) return;

    try {
      if (editingLeadId && api.updateLead) {
        await api.updateLead(editingLeadId, {
          name: leadData.name,
          phone: leadData.phone,
          interest: leadData.sport,
          status: leadData.status,
          notes: leadData.notes,
        });
      } else if (api.createLead) {
        const selectedBranchObj = branches.find((b) => b.name === leadData.branch);
        await api.createLead({
          name: leadData.name,
          phone: leadData.phone || '',
          interest: leadData.sport,
          status: leadData.status,
          branch_id: selectedBranchObj?.id || undefined,
          notes: leadData.notes,
        });
      }
    } catch {
      // fallback
    }
  };

  const handleSaveLead = async (event: FormEvent) => {
    event.preventDefault();

    if (!formState.name.trim()) {
      showToast('يرجى كتابة اسم العميل', 'warning');
      return;
    }

    const currentLead = editingLeadId ? leads.find((l) => l.id === editingLeadId) : null;
    const leadData: Lead = {
      id: editingLeadId || createLeadId(),
      name: formState.name.trim(),
      parent: formState.parent.trim(),
      phone: formState.phone.trim(),
      sport: formState.sport.trim(),
      age: formState.age.trim(),
      branch: formState.branch.trim(),
      source: formState.source.trim(),
      score: formState.score,
      followDate: formState.followDate,
      tags: formState.tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      notes: formState.notes.trim(),
      status: currentLead?.status || 'new',
    };

    await saveLeadToDb(leadData);

    setLeads((prev) => {
      const next = editingLeadId
        ? prev.map((lead) => (lead.id === editingLeadId ? leadData : lead))
        : [leadData, ...prev];
      window.localStorage.setItem(LEADS_KEY, JSON.stringify(next));
      return next;
    });

    showToast(editingLeadId ? 'تم تعديل العميل بنجاح' : 'تم إضافة العميل بنجاح');
    closeModal();
  };

  const handleRemoveLead = async (leadId: string) => {
    if (!window.confirm('هل تريد حذف هذا العميل؟')) return;

    const api = window.api;
    if (api?.deleteLead && api?.getToken?.()) {
      try {
        await api.deleteLead(leadId);
      } catch {
        // fallback
      }
    }

    setLeads((prev) => {
      const next = prev.filter((lead) => lead.id !== leadId);
      window.localStorage.setItem(LEADS_KEY, JSON.stringify(next));
      return next;
    });
    showToast('تم حذف العميل بنجاح');
  };

  const handleChangeStatus = async (leadId: string, status: LeadStatus) => {
    const api = window.api;
    if (api?.updateLead && api?.getToken?.()) {
      try {
        await api.updateLead(leadId, { status });
      } catch {
        // fallback
      }
    }

    setLeads((prev) => {
      const next = prev.map((lead) => (lead.id === leadId ? { ...lead, status } : lead));
      window.localStorage.setItem(LEADS_KEY, JSON.stringify(next));
      return next;
    });
    showToast(`تم تغيير الحالة إلى ${getStatusLabel(status)}`);
  };

  const handleSendLeadWhatsApp = (phone?: string, name?: string) => {
    if (!phone?.trim()) {
      showToast('لا يوجد رقم هاتف لهذا العميل', 'warning');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const finalPhone = cleanPhone.startsWith('01') ? `2${cleanPhone}` : cleanPhone;
    const message = encodeURIComponent(`أهلاً ${name || 'العزيز'}، نود التواصل معكم من أكاديمية إيجي سبورتنج كـلوب ⚽`);
    window.open(`https://wa.me/${finalPhone}?text=${message}`, '_blank');
  };

  const handleSendBulkWhatsApp = async () => {
    if (!bulkBranch) {
      showToast('اختر فرعاً أولاً', 'warning');
      return;
    }

    if (!bulkMessage.trim()) {
      showToast('اكتب نص الرسالة أولاً', 'warning');
      return;
    }

    const targets = leads.filter((lead) => lead.branch === bulkBranch && lead.phone && lead.status !== 'convert');
    if (!targets.length) {
      showToast('لا يوجد عملاء مناسبين للإرسال في هذا الفرع', 'warning');
      return;
    }

    if (!window.confirm(`هل تريد إرسال الرسالة إلى ${targets.length} عميل؟`)) return;

    setIsSendingBulk(true);
    setBulkStatus(`جاري الإرسال إلى ${targets.length} عميل...`);

    for (const lead of targets) {
      const cleanPhone = (lead.phone || '').replace(/\D/g, '');
      const finalPhone = cleanPhone.startsWith('01') ? `2${cleanPhone}` : cleanPhone;
      const msg = encodeURIComponent(bulkMessage);
      window.open(`https://wa.me/${finalPhone}?text=${msg}`, '_blank');
      await new Promise((resolve) => window.setTimeout(resolve, 400));
    }

    setBulkStatus(`تم الانتهاء من الإرسال إلى ${targets.length} عميل.`);
    setIsSendingBulk(false);
    showToast('تم الإرسال الجماعي بنجاح');
  };

  const handleConvertToClient = (lead: Lead) => {
    const players = readStoredData<Player[]>('players', []);
    players.push({
      id: Date.now().toString(),
      name: lead.name,
      phone: lead.phone,
      game: lead.sport,
      source: lead.source,
    });

    window.localStorage.setItem('players', JSON.stringify(players));
    setLeads((prev) => {
      const next = prev.map((item) => (item.id === lead.id ? { ...item, status: 'convert' as LeadStatus } : item));
      window.localStorage.setItem(LEADS_KEY, JSON.stringify(next));
      return next;
    });
    showToast('تم تحويل العميل إلى لاعب مسجل ⚽');
    navigate('/players');
  };

  return (
    <div dir="rtl" className="space-y-5 font-sans">
      {/* Toast Notification */}
      {toast ? (
        <div
          className={`fixed right-6 top-6 z-50 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl transition-all ${toast.type === 'success' ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
            }`}
        >
          {toast.message}
        </div>
      ) : null}

      {/* ── Compact Header Card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-50 p-3 text-sky-600">🎯</div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">إدارة العملاء المحتملين (Leads)</h1>
              <p className="text-xs text-slate-500">تتبع واستقطاب العملاء المحتملين وتحويلهم إلى لاعبين</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEditLeads && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                <Plus className="h-4 w-4" />
                إضافة عميل
              </button>
            )}
            <button
              type="button"
              onClick={() => {
                const csv = [
                  ['الاسم', 'ولي الأمر', 'الهاتف', 'الرياضة', 'العمر', 'الفرع', 'المصدر', 'الحالة'].join(','),
                  ...filteredLeads.map((l) =>
                    [l.name, l.parent || '', l.phone || '', l.sport || '', l.age || '', l.branch || '', l.source || '', getStatusLabel(l.status)].join(',')
                  ),
                ].join('\n');
                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'leads.csv';
                link.click();
              }}
              className="rounded-xl bg-emerald-600 px-3.5 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
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
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-5">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-right">
            <span className="text-xs font-medium text-slate-500">إجمالي العملاء</span>
            <p className="mt-1 text-xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-right">
            <span className="text-xs font-medium text-sky-600">عملاء جدد</span>
            <p className="mt-1 text-xl font-bold text-sky-700">{stats.newCount}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-right">
            <span className="text-xs font-medium text-amber-600">مهتم جداً</span>
            <p className="mt-1 text-xl font-bold text-amber-700">{stats.intCount}</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-right">
            <span className="text-xs font-medium text-emerald-600">تم التحويل للاعب</span>
            <p className="mt-1 text-xl font-bold text-emerald-700">{stats.convCount}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-rose-100 bg-rose-50/50 p-3 text-right sm:col-span-1">
            <span className="text-xs font-medium text-rose-600">ساخن 🔥</span>
            <p className="mt-1 text-xl font-bold text-rose-600">{stats.hotCount}</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <div className="relative flex items-center">
            <SearchSm className="absolute right-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="بحث بالاسم، ولي الأمر، الهاتف..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-9 pl-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
            />
          </div>

          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none"
          >
            <option value="all">كل الحالات</option>
            <option value="new">جديد</option>
            <option value="contact">تم التواصل</option>
            <option value="trial">تمرين تجريبي</option>
            <option value="interested">مهتم جداً</option>
            <option value="not">غير مهتم</option>
            <option value="convert">تم التحويل للاعب</option>
          </select>

          <select
            value={filterScore}
            onChange={(e) => setFilterScore(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none"
          >
            <option value="all">جميع مستويات الاهتمام</option>
            <option value="hot">ساخن 🔥</option>
            <option value="mid">متوسط ⚡</option>
            <option value="cold">بارد ❄️</option>
          </select>

          <select
            value={filterBranch}
            onChange={(e) => setFilterBranch(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none"
          >
            <option value="all">كل الفروع</option>
            {branches.map((b) => (
              <option key={b.id || b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* ── Bulk WhatsApp Bar ── */}
      <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-4 shadow-sm space-y-3">
        <div className="flex items-center gap-2 text-xs font-bold text-emerald-800">
          <AppIcon icon={MessageChatCircle} className="h-4 w-4 text-emerald-600" />
          <span>إرسال رسالة واتساب جماعية لعملاء فرع معين</span>
        </div>
        <div className="grid gap-3 sm:grid-cols-3 items-center">
          <select
            value={bulkBranch}
            onChange={(e) => setBulkBranch(e.target.value)}
            className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
          >
            <option value="">-- اختر الفرع المستهدف --</option>
            {branches.map((b) => (
              <option key={b.id || b.name} value={b.name}>
                {b.name}
              </option>
            ))}
          </select>

          <input
            value={bulkMessage}
            onChange={(e) => setBulkMessage(e.target.value)}
            placeholder="نص الرسالة الجماعية..."
            className="rounded-xl border border-emerald-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none"
          />

          <button
            type="button"
            disabled={isSendingBulk}
            onClick={handleSendBulkWhatsApp}
            className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white shadow-xs hover:bg-emerald-700 transition disabled:opacity-50"
          >
            {isSendingBulk ? 'جاري الإرسال...' : 'إرسال جماعي 💬'}
          </button>
        </div>
        {bulkStatus ? <p className="text-[11px] text-emerald-700 font-medium">{bulkStatus}</p> : null}
      </div>

      {/* ── Content View (Cards or Table) ── */}
      {viewMode === 'cards' ? (
        /* ── Compact Cards View ── */
        filteredLeads.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
            لا يوجد عملاء يطابقون البحث.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredLeads.map((lead) => {
              const isConverted = lead.status === 'convert';

              return (
                <div
                  key={lead.id}
                  className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${isConverted ? 'border-emerald-200 bg-emerald-50/10' : 'border-slate-200'
                    }`}
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-slate-900 text-sm">{lead.name}</h3>
                          {lead.score === 'hot' ? (
                            <span className="text-xs">🔥</span>
                          ) : lead.score === 'mid' ? (
                            <span className="text-xs">⚡</span>
                          ) : null}
                        </div>
                        {lead.parent ? <p className="text-[11px] text-slate-400">ولي الأمر: {lead.parent}</p> : null}
                      </div>

                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${getStatusBadgeStyle(
                          lead.status
                        )}`}
                      >
                        {getStatusLabel(lead.status)}
                      </span>
                    </div>

                    <div className="mt-3 space-y-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                        <span className="text-slate-500">الرياضة والفرع:</span>
                        <span className="font-medium text-slate-800">
                          {lead.sport || 'رياضة عامة'} {lead.branch ? `• ${lead.branch}` : ''}
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                        <span className="text-slate-500">الهاتف:</span>
                        <span className="font-mono text-slate-800">{lead.phone || '-'}</span>
                      </div>

                      {lead.notes ? (
                        <div className="bg-slate-50 p-2 rounded-lg text-slate-500 text-[11px]">
                          {lead.notes}
                        </div>
                      ) : null}
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => handleSendLeadWhatsApp(lead.phone, lead.name)}
                        className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 transition"
                        title="واتساب"
                      >
                        <AppIcon icon={Phone01} className="h-4 w-4" />
                      </button>

                      {canEditLeads && !isConverted && (
                        <button
                          type="button"
                          onClick={() => handleConvertToClient(lead)}
                          className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 transition"
                        >
                          تحويل للاعب ⚽
                        </button>
                      )}
                    </div>

                    {canEditLeads && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => openEditModal(lead)}
                          className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                        >
                          تعديل
                        </button>
                        <button
                          type="button"
                          onClick={() => handleRemoveLead(lead.id)}
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
                  <th className="px-4 py-3 font-semibold">الاسم</th>
                  <th className="px-4 py-3 font-semibold">ولي الأمر</th>
                  <th className="px-4 py-3 font-semibold">الهاتف</th>
                  <th className="px-4 py-3 font-semibold">الرياضة</th>
                  <th className="px-4 py-3 font-semibold">الفرع</th>
                  <th className="px-4 py-3 font-semibold">الاهتمام</th>
                  <th className="px-4 py-3 font-semibold">الحالة</th>
                  <th className="px-4 py-3 text-center font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredLeads.map((lead) => {
                  const isConverted = lead.status === 'convert';

                  return (
                    <tr key={lead.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-bold text-slate-900">{lead.name}</td>
                      <td className="px-4 py-3 text-slate-600">{lead.parent || '-'}</td>
                      <td className="px-4 py-3 font-mono text-slate-700">{lead.phone || '-'}</td>
                      <td className="px-4 py-3 text-slate-700">{lead.sport || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{lead.branch || '-'}</td>
                      <td className="px-4 py-3 font-semibold">
                        {lead.score === 'hot' ? '🔥 ساخن' : lead.score === 'mid' ? '⚡ متوسط' : '❄️ بارد'}
                      </td>
                      <td className="px-4 py-3">
                        <select
                          disabled={!canEditLeads}
                          value={lead.status || 'new'}
                          onChange={(e) => handleChangeStatus(lead.id, e.target.value as LeadStatus)}
                          className={`rounded-lg border px-2 py-1 text-[10px] font-bold outline-none cursor-pointer ${getStatusBadgeStyle(
                            lead.status
                          )}`}
                        >
                          <option value="new">جديد</option>
                          <option value="contact">تم التواصل</option>
                          <option value="trial">تمرين تجريبي</option>
                          <option value="interested">مهتم جداً</option>
                          <option value="not">غير مهتم</option>
                          <option value="convert">تم التحويل للاعب</option>
                        </select>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => handleSendLeadWhatsApp(lead.phone, lead.name)}
                            className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 transition"
                            title="واتساب"
                          >
                            <AppIcon icon={Phone01} className="h-4 w-4" />
                          </button>

                          {canEditLeads && !isConverted && (
                            <button
                              type="button"
                              onClick={() => handleConvertToClient(lead)}
                              className="rounded-lg bg-emerald-600 px-2 py-1 text-[10px] font-bold text-white hover:bg-emerald-700 transition"
                            >
                              تحويل للاعب
                            </button>
                          )}

                          {canEditLeads && (
                            <button
                              type="button"
                              onClick={() => openEditModal(lead)}
                              className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                            >
                              تعديل
                            </button>
                          )}
                          {canEditLeads && (
                            <button
                              type="button"
                              onClick={() => handleRemoveLead(lead.id)}
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

                {filteredLeads.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-10 text-center text-slate-400 text-xs">
                      لا يوجد عملاء يطابقون البحث.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Modal Dialog: Add / Edit Lead ── */}
      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-sky-50 p-2.5 text-sky-600">
                  <AppIcon icon={User01} className="h-5 w-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingLeadId ? 'تعديل بيانات العميل' : 'إضافة عميل محتمل جديد'}
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

            <form id="leadModalForm" onSubmit={handleSaveLead} className="space-y-4 p-5 text-right text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 font-semibold text-slate-700">اسم المشترك/اللاعب</label>
                  <input
                    required
                    value={formState.name}
                    placeholder="اسم العميل..."
                    onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  />
                </div>

                <div>
                  <label className="block mb-1 font-semibold text-slate-700">ولي الأمر</label>
                  <input
                    value={formState.parent}
                    placeholder="اسم ولي الأمر..."
                    onChange={(e) => setFormState((prev) => ({ ...prev, parent: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
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
                  <label className="block mb-1 font-semibold text-slate-700">الرياضة / اللعبة</label>
                  <input
                    value={formState.sport}
                    placeholder="مثال: كرة القدم"
                    onChange={(e) => setFormState((prev) => ({ ...prev, sport: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block mb-1 font-semibold text-slate-700">الفرع</label>
                  <select
                    value={formState.branch}
                    onChange={(e) => setFormState((prev) => ({ ...prev, branch: e.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none"
                  >
                    <option value="">-- اختر الفرع --</option>
                    {branches.map((b) => (
                      <option key={b.id || b.name} value={b.name}>
                        {b.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block mb-1 font-semibold text-slate-700">مستوى الاهتمام</label>
                  <select
                    value={formState.score}
                    onChange={(e) => setFormState((prev) => ({ ...prev, score: e.target.value as LeadScore }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none"
                  >
                    <option value="hot">ساخن 🔥</option>
                    <option value="mid">متوسط ⚡</option>
                    <option value="cold">بارد ❄️</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">ملاحظات / أفكار التوزيع</label>
                <textarea
                  rows={2}
                  value={formState.notes}
                  placeholder="أي تفاصيل عن اهتمام العميل..."
                  onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
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
                form="leadModalForm"
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 transition"
              >
                {editingLeadId ? 'حفظ التعديلات' : 'إضافة العميل'}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

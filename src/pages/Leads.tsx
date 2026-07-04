import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';

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
  source?: string;
  score?: LeadScore;
  followDate?: string;
  tags?: string[];
  notes?: string;
  status?: LeadStatus;
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
  };
}

function getScoreLabel(score?: LeadScore) {
  return {
    hot: 'ساخن',
    mid: 'متوسط',
    cold: 'بارد',
  }[score || 'cold'];
}

function getStatusLabel(status?: LeadStatus) {
  return {
    new: 'جديد',
    contact: 'تم التواصل',
    trial: 'حجز تجربة',
    interested: 'مهتم',
    not: 'غير مهتم',
    convert: 'تم التحويل',
  }[status || 'new'];
}

function getStatusClasses(status?: LeadStatus) {
  switch (status) {
    case 'convert':
      return 'bg-emerald-100 text-emerald-700';
    case 'interested':
      return 'bg-sky-100 text-sky-700';
    case 'trial':
      return 'bg-violet-100 text-violet-700';
    case 'contact':
      return 'bg-amber-100 text-amber-700';
    case 'not':
      return 'bg-rose-100 text-rose-700';
    default:
      return 'bg-slate-100 text-slate-700';
  }
}

export default function Leads() {
  const navigate = useNavigate();
  const [leads, setLeads] = useState<Lead[]>(() => readStoredData('leads', []).map(normalizeLead));
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [tagFilter, setTagFilter] = useState('');
  const [bulkBranch, setBulkBranch] = useState('');
  const [bulkMessage, setBulkMessage] = useState('');
  const [bulkStatus, setBulkStatus] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLeadId, setEditingLeadId] = useState<string | null>(null);
  const [formState, setFormState] = useState<LeadFormState>(initialFormState);
  const [isSendingBulk, setIsSendingBulk] = useState(false);

  useEffect(() => {
    window.localStorage.setItem('leads', JSON.stringify(leads));
  }, [leads]);

  useEffect(() => {
    const onStorage = () => {
      const stored = readStoredData<Partial<Lead>[]>('leads', []);
      setLeads(stored.map(normalizeLead));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const branchOptions = useMemo(() => {
    return [...new Set(leads.map((lead) => lead.branch).filter(Boolean))] as string[];
  }, [leads]);

  const filteredLeads = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    const tag = tagFilter.trim().toLowerCase();

    return leads.filter((lead) => {
      const leadName = (lead.name || '').toLowerCase();
      const leadTags = (lead.tags || []).join(',').toLowerCase();
      const matchesSearch = !search || leadName.includes(search) || (lead.phone || '').includes(search);
      const matchesStatus = !statusFilter || lead.status === statusFilter;
      const matchesBranch = !branchFilter || lead.branch === branchFilter;
      const matchesTag = !tag || leadTags.includes(tag);
      return matchesSearch && matchesStatus && matchesBranch && matchesTag;
    });
  }, [branchFilter, leads, searchTerm, statusFilter, tagFilter]);

  const stats = useMemo(() => {
    return leads.reduce(
      (acc, lead) => {
        acc.total += 1;
        if (lead.status === 'new') acc.newCount += 1;
        if (lead.status === 'interested') acc.intCount += 1;
        if (lead.status === 'convert') acc.convCount += 1;
        if (lead.score === 'hot') acc.hotCount += 1;
        return acc;
      },
      { total: 0, newCount: 0, intCount: 0, convCount: 0, hotCount: 0 },
    );
  }, [leads]);

  const resetModal = () => {
    setFormState(initialFormState);
    setEditingLeadId(null);
  };

  const openAddModal = () => {
    resetModal();
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
    resetModal();
  };

  const handleSaveLead = () => {
    if (!formState.name.trim()) {
      window.alert('أدخل اسم العميل أولاً');
      return;
    }

    const tags = formState.tags
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);

    const leadData: Lead = {
      id: editingLeadId || createLeadId(),
      name: formState.name.trim(),
      parent: formState.parent.trim(),
      phone: formState.phone.trim(),
      sport: formState.sport.trim(),
      age: formState.age,
      branch: formState.branch.trim(),
      source: formState.source.trim(),
      score: formState.score,
      followDate: formState.followDate,
      tags,
      notes: formState.notes.trim(),
      status: editingLeadId ? (leads.find((lead) => lead.id === editingLeadId)?.status || 'new') : 'new',
    };

    setLeads((prev) => {
      if (editingLeadId) {
        return prev.map((lead) => (lead.id === editingLeadId ? leadData : lead));
      }
      return [leadData, ...prev];
    });

    closeModal();
  };

  const handleRemoveLead = (leadId: string) => {
    if (!window.confirm('هل تريد حذف هذا العميل؟')) return;
    setLeads((prev) => prev.filter((lead) => lead.id !== leadId));
  };

  const handleChangeStatus = (leadId: string, status: LeadStatus) => {
    setLeads((prev) => prev.map((lead) => (lead.id === leadId ? { ...lead, status } : lead)));
  };

  const handleSendLeadWhatsApp = (phone?: string, name?: string) => {
    if (!phone) {
      window.alert('لا يوجد رقم هاتف لهذا العميل');
      return;
    }

    const cleanPhone = phone.replace(/\D/g, '');
    const finalPhone = cleanPhone.startsWith('01') ? `2${cleanPhone}` : cleanPhone;
    const message = encodeURIComponent(`أهلاً ${name || 'العزيز'}، نود التواصل معكم من أكاديمية إيجي سبورتنج كـلوب ⚽`);
    window.open(`https://wa.me/${finalPhone}?text=${message}`, '_blank');
  };

  const handleSendBulkWhatsApp = async () => {
    if (!bulkBranch) {
      window.alert('اختر فرعاً أولاً');
      return;
    }

    if (!bulkMessage.trim()) {
      window.alert('اكتب نص الرسالة أولاً');
      return;
    }

    const targets = leads.filter((lead) => lead.branch === bulkBranch && lead.phone && lead.status !== 'convert');
    if (!targets.length) {
      window.alert('لا يوجد عملاء مناسبين للإرسال في هذا الفرع');
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
    setLeads((prev) => prev.map((item) => (item.id === lead.id ? { ...item, status: 'convert' } : item)));
    window.alert('تم تحويل العميل إلى لاعب');
    navigate('/players');
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-500">إدارة العملاء المحتملين</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">العملاء المحتملين</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              onClick={openAddModal}
              className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              + إضافة عميل
            </button>
            <button
              type="button"
              onClick={() => {
                const csv = [
                  ['الاسم', 'ولي الأمر', 'الهاتف', 'الرياضة', 'العمر', 'الفرع', 'المصدر', 'الحالة'].join(','),
                  ...filteredLeads.map((lead) =>
                    [
                      lead.name,
                      lead.parent || '',
                      lead.phone || '',
                      lead.sport || '',
                      lead.age || '',
                      lead.branch || '',
                      lead.source || '',
                      getStatusLabel(lead.status),
                    ].join(','),
                  ),
                ].join('\n');

                const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
                const url = URL.createObjectURL(blob);
                const link = document.createElement('a');
                link.href = url;
                link.download = 'leads.csv';
                link.click();
                URL.revokeObjectURL(url);
              }}
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Excel
            </button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">الإجمالي</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.total}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">جدد</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.newCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">مهتم</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.intCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">تم التحويل</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.convCount}</p>
        </div>
        <div className="rounded-3xl border border-slate-200 bg-white p-4 shadow-sm">
          <p className="text-sm text-slate-500">ساخن</p>
          <p className="mt-2 text-3xl font-semibold text-slate-900">{stats.hotCount}</p>
        </div>
      </div>

      <div className="rounded-3xl border border-emerald-200 bg-emerald-50 p-5 shadow-sm">
        <h2 className="text-lg font-semibold text-emerald-800">إرسال رسالة جماعية لفرع محدد</h2>
        <div className="mt-4 grid gap-4 lg:grid-cols-[1fr_2fr_auto]">
          <label className="space-y-2 text-sm text-slate-700">
            الفرع المستهدف
            <select
              value={bulkBranch}
              onChange={(event) => setBulkBranch(event.target.value)}
              className="w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-right"
            >
              <option value="">-- اختر فرعاً --</option>
              {branchOptions.map((branch) => (
                <option key={branch} value={branch}>
                  {branch}
                </option>
              ))}
            </select>
          </label>
          <label className="space-y-2 text-sm text-slate-700">
            نص الرسالة
            <textarea
              value={bulkMessage}
              onChange={(event) => setBulkMessage(event.target.value)}
              placeholder="اكتب رسالتك هنا..."
              className="min-h-[44px] w-full rounded-2xl border border-slate-200 bg-white px-3 py-3 text-right"
            />
          </label>
          
        </div>
        <button
            type="button"
            onClick={handleSendBulkWhatsApp}
            disabled={isSendingBulk}
            className="p-20 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-emerald-400"
          >
            {isSendingBulk ? 'جارٍ الإرسال...' : 'إرسال للكل'}
          </button>
        {bulkStatus ? <p className="mt-3 text-sm text-emerald-700">{bulkStatus}</p> : null}
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
        <div className="grid gap-4 lg:grid-cols-4">
          <input
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
            placeholder="بحث..."
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-700"
          />
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-700"
          >
            <option value="">كل الحالات</option>
            <option value="new">جديد</option>
            <option value="contact">تم التواصل</option>
            <option value="trial">حجز تجربة</option>
            <option value="interested">مهتم</option>
            <option value="not">غير مهتم</option>
            <option value="convert">تم التحويل</option>
          </select>
          <select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-700"
          >
            <option value="">كل الفروع</option>
            {branchOptions.map((branch) => (
              <option key={branch} value={branch}>
                {branch}
              </option>
            ))}
          </select>
          <input
            value={tagFilter}
            onChange={(event) => setTagFilter(event.target.value)}
            placeholder="بحث بالـ Tags"
            className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-700"
          />
        </div>

        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-right">الاسم</th>
                <th className="px-4 py-3 text-right">ولي الأمر</th>
                <th className="px-4 py-3 text-right">الهاتف</th>
                <th className="px-4 py-3 text-right">الرياضة</th>
                <th className="px-4 py-3 text-right">العمر</th>
                <th className="px-4 py-3 text-right">الفرع</th>
                <th className="px-4 py-3 text-right">المصدر</th>
                <th className="px-4 py-3 text-right">التقييم</th>
                <th className="px-4 py-3 text-right">المتابعة</th>
                <th className="px-4 py-3 text-right">Tags</th>
                <th className="px-4 py-3 text-right">الحالة</th>
                <th className="px-4 py-3 text-center">إجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredLeads.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-4 py-8 text-center text-slate-500">
                    لا يوجد عملاء مطابقين للبحث
                  </td>
                </tr>
              ) : (
                filteredLeads.map((lead) => (
                  <tr key={lead.id}>
                    <td className="px-4 py-3 font-semibold text-slate-900">{lead.name}</td>
                    <td className="px-4 py-3 text-slate-600">{lead.parent || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{lead.phone || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{lead.sport || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{lead.age || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{lead.branch || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{lead.source || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">{getScoreLabel(lead.score)}</td>
                    <td className="px-4 py-3 text-slate-600">{lead.followDate || '-'}</td>
                    <td className="px-4 py-3 text-slate-600">
                      {lead.tags?.length
                        ? lead.tags.map((tag) => (
                            <span key={tag} className="ml-2 rounded-full bg-slate-100 px-2 py-1 text-xs">
                              {tag}
                            </span>
                          ))
                        : '-'}
                    </td>
                    <td className="px-4 py-3">
                      <select
                        value={lead.status || 'new'}
                        onChange={(event) => handleChangeStatus(lead.id, event.target.value as LeadStatus)}
                        className={`rounded-full border-none px-3 py-2 text-sm font-medium ${getStatusClasses(lead.status)}`}
                      >
                        <option value="new">جديد</option>
                        <option value="contact">تم التواصل</option>
                        <option value="trial">حجز تجربة</option>
                        <option value="interested">مهتم</option>
                        <option value="not">غير مهتم</option>
                        <option value="convert">تم التحويل</option>
                      </select>
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap justify-center gap-2">
                        <button type="button" onClick={() => handleSendLeadWhatsApp(lead.phone, lead.name)} className="rounded-xl bg-emerald-600 px-3 py-2 text-sm font-semibold text-white">
                          واتساب
                        </button>
                        <button type="button" onClick={() => handleConvertToClient(lead)} className="rounded-xl bg-sky-600 px-3 py-2 text-sm font-semibold text-white">
                          تحويل
                        </button>
                        <button type="button" onClick={() => openEditModal(lead)} className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white">
                          تعديل
                        </button>
                        <button type="button" onClick={() => handleRemoveLead(lead.id)} className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white">
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
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-slate-900">{editingLeadId ? 'تعديل العميل' : 'إضافة عميل'}</h2>
              <button type="button" onClick={closeModal} className="text-slate-500 transition hover:text-slate-900">
                ×
              </button>
            </div>
            <div className="grid gap-4 p-6 md:grid-cols-2">
              <label className="space-y-2 text-sm text-slate-700">
                اسم اللاعب
                <input value={formState.name} onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-right" />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                اسم ولي الأمر
                <input value={formState.parent} onChange={(event) => setFormState((prev) => ({ ...prev, parent: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-right" />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                رقم الهاتف
                <input value={formState.phone} onChange={(event) => setFormState((prev) => ({ ...prev, phone: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-right" />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                الرياضة
                <input value={formState.sport} onChange={(event) => setFormState((prev) => ({ ...prev, sport: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-right" />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                العمر
                <input type="number" value={formState.age} onChange={(event) => setFormState((prev) => ({ ...prev, age: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-right" />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                الفرع
                <input value={formState.branch} onChange={(event) => setFormState((prev) => ({ ...prev, branch: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-right" />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                المصدر
                <input value={formState.source} onChange={(event) => setFormState((prev) => ({ ...prev, source: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-right" />
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                التقييم
                <select value={formState.score} onChange={(event) => setFormState((prev) => ({ ...prev, score: event.target.value as LeadScore }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-right">
                  <option value="hot">ساخن</option>
                  <option value="mid">متوسط</option>
                  <option value="cold">بارد</option>
                </select>
              </label>
              <label className="space-y-2 text-sm text-slate-700">
                تاريخ المتابعة
                <input type="date" value={formState.followDate} onChange={(event) => setFormState((prev) => ({ ...prev, followDate: event.target.value }))} className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-right" />
              </label>
              <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
                Tags
                <input value={formState.tags} onChange={(event) => setFormState((prev) => ({ ...prev, tags: event.target.value }))} placeholder="مثال: VIP, Trial" className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-right" />
              </label>
              <label className="space-y-2 text-sm text-slate-700 md:col-span-2">
                ملاحظات
                <textarea value={formState.notes} onChange={(event) => setFormState((prev) => ({ ...prev, notes: event.target.value }))} className="min-h-[90px] w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-right" />
              </label>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button type="button" onClick={closeModal} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                إلغاء
              </button>
              <button type="button" onClick={handleSaveLead} className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white">
                حفظ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
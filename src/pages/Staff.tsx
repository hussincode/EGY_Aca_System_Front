import { useEffect, useMemo, useState } from 'react';
import { Plus, SearchSm, Phone01, Trash01, User01, CreditCard01, Calendar } from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';
import Pagination from '@/components/Pagination';
import { useAuth } from '@/contexts/AuthContext';
import { recordFinanceTransaction } from '@/utils/sharedFinance';

export type StaffPayType = 'hour' | 'fixed' | 'percent';

export type StaffMember = {
  id: string;
  staffSerial: string;
  name: string;
  phone?: string;
  role: string;
  branch?: string;
  branchId?: string;
  payType: StaffPayType;
  rate: number;
  hours: number;
  revenue: number;
  advance: number; // السلف / الاستلاف
};

type Branch = {
  id?: string;
  name?: string;
};

type StaffFormState = {
  name: string;
  phone: string;
  role: string;
  branch: string;
  payType: StaffPayType;
  rate: number;
  hours: number;
  revenue: number;
  advance: number;
  recordToFinance: boolean;
};

const initialFormState: StaffFormState = {
  name: '',
  phone: '',
  role: '',
  branch: '',
  payType: 'hour',
  rate: 0,
  hours: 0,
  revenue: 0,
  advance: 0,
  recordToFinance: false,
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

function normalizeStaffMember(item: any, fallbackIndex = 1, branchesList: Branch[] = []): StaffMember {
  if (!item || typeof item !== 'object') {
    return {
      id: `${Date.now()}-${Math.random()}`,
      staffSerial: formatStaffSerial(fallbackIndex),
      name: '',
      phone: '',
      role: '',
      branch: '',
      branchId: '',
      payType: 'hour',
      rate: 0,
      hours: 0,
      revenue: 0,
      advance: 0,
    };
  }

  const id = String(item.id || item.uuid || `${Date.now()}-${Math.random()}`);
  const serialRaw = item.staffSerial || item.staff_serial || item.serial || formatStaffSerial(fallbackIndex);
  const staffSerial = String(serialRaw).trim() || formatStaffSerial(fallbackIndex);
  const name = String(item.name || '').trim();
  const phone = item.phone != null ? String(item.phone).trim() : '';
  const role = String(item.role || '').trim();
  const bId = String(item.branch_id || item.branchId || '');
  const bNameRaw = String(item.branch || item.branch_name || item.branchName || '').trim();

  let finalBranch = bNameRaw;
  if (!finalBranch && bId && branchesList.length) {
    const match = branchesList.find((b) => b.id && b.id.toLowerCase() === bId.toLowerCase());
    if (match?.name) finalBranch = match.name;
  }

  let payType: StaffPayType = 'hour';
  const rawPayType = String(item.payType || item.pay_type || '').toLowerCase();
  if (rawPayType === 'fixed' || rawPayType === 'percent' || rawPayType === 'hour') {
    payType = rawPayType as StaffPayType;
  }

  const rate = Number(item.rate) || 0;
  const hours = Number(item.hours) || 0;
  const revenue = Number(item.revenue) || 0;
  const advance = Number(item.advance) || 0;

  return {
    id,
    staffSerial,
    name,
    phone,
    role,
    branch: finalBranch,
    branchId: bId,
    payType,
    rate,
    hours,
    revenue,
    advance,
  };
}

function getNextStaffSequence(staffList: StaffMember[]) {
  const used = new Set<number>();
  if (Array.isArray(staffList)) {
    staffList.forEach((member) => {
      const serial = member?.staffSerial || (member as any)?.staff_serial || '';
      const match = String(serial).match(/(\d+)/);
      if (match) {
        const num = parseInt(match[1], 10);
        if (!isNaN(num)) used.add(num);
      }
    });
  }
  for (let i = 1; i <= 99999; i += 1) {
    if (!used.has(i)) return i;
  }
  return 1;
}

const payTypeLabel = (payType?: StaffPayType) => {
  if (payType === 'fixed') return 'راتب ثابت';
  if (payType === 'percent') return 'نسبة ومئوية';
  return 'بالساعة';
};

const payTypeBadgeStyle = (payType?: StaffPayType) => {
  if (payType === 'fixed') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (payType === 'percent') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-sky-50 text-sky-700 border-sky-200';
};

export default function Staff() {
  const { canEdit } = useAuth();
  const canEditStaff = canEdit('staff');

  const [branches, setBranches] = useState<Branch[]>(() => readStoredData('branches', []));
  const [staff, setStaff] = useState<StaffMember[]>(() => {
    try {
      const initialBranches = readStoredData<Branch[]>('branches', []);
      const stored = readStoredData<any[]>('staff', []);
      return Array.isArray(stored) ? stored.map((item, idx) => normalizeStaffMember(item, idx + 1, initialBranches)) : [];
    } catch {
      return [];
    }
  });

  const [formState, setFormState] = useState<StaffFormState>(buildEmptyForm());
  const [editingIndex, setEditingIndex] = useState<number | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [payTypeFilter, setPayTypeFilter] = useState<string>('all');
  const [branchFilter, setBranchFilter] = useState<string>('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  useEffect(() => {
    try {
      window.localStorage.setItem('staff', JSON.stringify(staff));
    } catch (e) {
      console.warn('Failed to save staff to localStorage:', e);
    }
  }, [staff]);

  useEffect(() => {
    let isMounted = true;
    const loadFromApi = async () => {
      let currentBranches = readStoredData<Branch[]>('branches', []);
      if (window.api?.getBranches && window.api?.getToken?.()) {
        try {
          const res = await window.api.getBranches();
          const serverBranches = Array.isArray(res?.data) ? res.data : [];
          if (serverBranches.length > 0) {
            currentBranches = serverBranches.map((b: any) => ({
              id: String(b.id || ''),
              name: String(b.name || ''),
            }));
            if (isMounted) {
              setBranches(currentBranches);
              window.localStorage.setItem('branches', JSON.stringify(currentBranches));
            }
          }
        } catch {}
      }

      if (!window.api?.getToken?.() || !window.api?.getStaff) return;
      try {
        const response = await window.api.getStaff();
        const rawData = response?.data;
        if (Array.isArray(rawData) && isMounted) {
          const normalized = rawData.map((item, idx) => normalizeStaffMember(item, idx + 1, currentBranches));
          setStaff(normalized);
          window.localStorage.setItem('staff', JSON.stringify(normalized));
        }
      } catch (err) {
        console.warn('Could not load staff from API, using cached data:', err);
      }
    };
    loadFromApi();
    return () => {
      isMounted = false;
    };
  }, []);

  // ── Automatic Monthly Salary Recording (أول كل شهر تلقائياً) ──
  useEffect(() => {
    if (!staff || staff.length === 0) return;

    const currentMonthKey = new Date().toISOString().slice(0, 7); // e.g. "2026-09"
    const lastProcessedMonth = window.localStorage.getItem('staff_salaries_last_processed_month');

    if (lastProcessedMonth !== currentMonthKey) {
      // Auto-record all staff salaries for this new month
      let recordedCount = 0;
      let totalAmount = 0;
      const todayDate = `${currentMonthKey}-01`;

      staff.forEach((member) => {
        const rate = Number(member.rate) || 0;
        const hours = Number(member.hours) || 0;
        const revenue = Number(member.revenue) || 0;
        const advance = Number(member.advance) || 0;

        const grossPay =
          member.payType === 'hour'
            ? rate * hours
            : member.payType === 'percent'
              ? (rate / 100) * revenue
              : rate;

        const netPay = Math.max(0, grossPay - advance);

        if (netPay > 0 || grossPay > 0) {
          const matchedBranch = branches.find((b) => b.name === member.branch || b.id === member.branchId);
          const branchName = matchedBranch?.name || member.branch || 'الفرع الرئيسي';
          const branchId = matchedBranch?.id || member.branchId || '';

          recordFinanceTransaction({
            type: 'expense',
            amount: netPay,
            category: 'رواتب',
            branch: branchName,
            branchId,
            branchName,
            relatedTo: member.name,
            description: `راتب شهر ${currentMonthKey} - ${member.name} (${member.role}) | الراتب: ${grossPay} ج | سلف مستقطعة: ${advance} ج | الصافي: ${netPay} ج`,
            date: todayDate,
          });

          recordedCount += 1;
          totalAmount += netPay;
        }
      });

      if (recordedCount > 0) {
        window.localStorage.setItem('staff_salaries_last_processed_month', currentMonthKey);
        setToast({
          message: `تم ترحيل رواتب شهر (${currentMonthKey}) تلقائياً كمصروفات بالمالية بإجمالي ${totalAmount.toLocaleString()} ج.م 🗓️💸`,
          type: 'success',
        });
      }
    }
  }, [staff, branches]);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 3000);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  const filteredStaff = useMemo(() => {
    if (!Array.isArray(staff)) return [];
    return staff.filter((member) => {
      if (!member) return false;
      const term = (search || '').trim().toLowerCase();
      const name = (member.name || '').toLowerCase();
      const phone = (member.phone || '').toLowerCase();
      const role = (member.role || '').toLowerCase();
      const serial = (member.staffSerial || '').toLowerCase();

      const matchesSearch =
        !term ||
        name.includes(term) ||
        phone.includes(term) ||
        role.includes(term) ||
        serial.includes(term);

      const matchesPayType = payTypeFilter === 'all' || (member.payType || 'hour') === payTypeFilter;
      const matchesBranch =
        branchFilter === 'all' ||
        (member.branch || '').toLowerCase() === branchFilter.toLowerCase() ||
        member.branchId === branchFilter;

      return matchesSearch && matchesPayType && matchesBranch;
    });
  }, [staff, search, payTypeFilter, branchFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, payTypeFilter, branchFilter]);

  const totalPages = Math.ceil(filteredStaff.length / rowsPerPage) || 1;
  const paginatedStaff = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredStaff.slice(start, start + rowsPerPage);
  }, [filteredStaff, currentPage]);

  const calculateMemberGrossPay = (member: StaffMember) => {
    const rate = Number(member.rate) || 0;
    const hours = Number(member.hours) || 0;
    const revenue = Number(member.revenue) || 0;
    if (member.payType === 'hour') return rate * hours;
    if (member.payType === 'percent') return (rate / 100) * revenue;
    return rate;
  };

  const calculateMemberNetPay = (member: StaffMember) => {
    const gross = calculateMemberGrossPay(member);
    const advance = Number(member.advance) || 0;
    return Math.max(0, gross - advance);
  };

  const metrics = useMemo(() => {
    let grossTotal = 0;
    let advanceTotal = 0;
    let netTotal = 0;

    if (Array.isArray(staff)) {
      staff.forEach((member) => {
        if (!member) return;
        const gross = calculateMemberGrossPay(member);
        const adv = Number(member.advance) || 0;
        const net = Math.max(0, gross - adv);

        grossTotal += gross;
        advanceTotal += adv;
        netTotal += net;
      });
    }

    return { total: staff.length, grossTotal, advanceTotal, netTotal };
  }, [staff]);

  const handlePaySalary = (member: StaffMember) => {
    const gross = calculateMemberGrossPay(member);
    const advance = Number(member.advance) || 0;
    const netPay = Math.max(0, gross - advance);

    if (netPay <= 0 && gross <= 0) {
      showToast('المبلغ المستحق يجب أن يكون أكبر من 0', 'error');
      return;
    }

    if (
      !window.confirm(
        `تفاصيل صرف المستحقات للموظف: ${member.name}\n- الراتب الإجمالي: ${gross.toLocaleString()} ج.م\n- السلف المستقطعة: ${advance.toLocaleString()} ج.م\n- صافي المبلغ للصرف: ${netPay.toLocaleString()} ج.م\n\nهل تريد تأكيد الصرف وترحيله للمالية؟`
      )
    ) {
      return;
    }

    const matchedBranch = branches.find((b) => b.name === member.branch || b.id === member.branchId);
    const branchName = matchedBranch?.name || member.branch || 'الفرع الرئيسي';
    const branchId = matchedBranch?.id || member.branchId || '';

    recordFinanceTransaction({
      type: 'expense',
      amount: netPay,
      category: 'رواتب',
      branch: branchName,
      branchId,
      branchName,
      relatedTo: member.name,
      description: `صرف راتب ${member.name} (${member.role}) | الراتب: ${gross} ج | سلف: ${advance} ج | الصافي: ${netPay} ج`,
      date: new Date().toISOString().split('T')[0],
    });

    showToast(`تم صرف وتسجيل صافي راتب ${member.name} (${netPay.toLocaleString()} ج.م) كمصروف في المالية بنجاح 💸`, 'success');
  };

  const handleManualMonthSync = () => {
    const currentMonthKey = new Date().toISOString().slice(0, 7);
    const activeWithPay = staff.filter((member) => calculateMemberGrossPay(member) > 0);

    if (activeWithPay.length === 0) {
      showToast('لا توجد مستحقات مالية للصرف حالياً', 'info');
      return;
    }

    if (
      !window.confirm(
        `هل تريد ترحيل وصرف رواتب شهر (${currentMonthKey}) لجميع الموظفين (${activeWithPay.length} موظف)؟\n- إجمالي الرواتب: ${metrics.grossTotal.toLocaleString()} ج.م\n- إجمالي السلف المستقطعة: ${metrics.advanceTotal.toLocaleString()} ج.م\n- صافي المبلغ المالي: ${metrics.netTotal.toLocaleString()} ج.م`
      )
    ) {
      return;
    }

    const today = new Date().toISOString().split('T')[0];
    activeWithPay.forEach((member) => {
      const gross = calculateMemberGrossPay(member);
      const advance = Number(member.advance) || 0;
      const netPay = Math.max(0, gross - advance);

      const matchedBranch = branches.find((b) => b.name === member.branch || b.id === member.branchId);
      const branchName = matchedBranch?.name || member.branch || 'الفرع الرئيسي';
      const branchId = matchedBranch?.id || member.branchId || '';

      recordFinanceTransaction({
        type: 'expense',
        amount: netPay,
        category: 'رواتب',
        branch: branchName,
        branchId,
        branchName,
        relatedTo: member.name,
        description: `راتب شهر ${currentMonthKey} - ${member.name} (${member.role}) | الراتب: ${gross} ج | سلف: ${advance} ج | الصافي: ${netPay} ج`,
        date: today,
      });
    });

    window.localStorage.setItem('staff_salaries_last_processed_month', currentMonthKey);
    showToast(`تم ترحيل رواتب ${activeWithPay.length} موظف بصافي ${metrics.netTotal.toLocaleString()} ج.م للمالية بنجاح ✅`, 'success');
  };

  const handleEdit = (index: number) => {
    const member = staff[index];
    if (!member) return;
    setEditingIndex(index);
    setFormState({
      name: member.name || '',
      phone: member.phone ?? '',
      role: member.role || '',
      branch: member.branch || '',
      payType: member.payType || 'hour',
      rate: member.rate || 0,
      hours: member.hours || 0,
      revenue: member.revenue || 0,
      advance: member.advance || 0,
      recordToFinance: false,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingIndex(null);
    setFormState(buildEmptyForm());
  };

  const handleSubmit = async () => {
    const trimmedName = formState.name.trim();
    const trimmedRole = formState.role.trim();

    if (!trimmedName) {
      showToast('اسم الموظف مطلوب', 'error');
      return;
    }
    if (!trimmedRole) {
      showToast('الوظيفة مطلوبة', 'error');
      return;
    }

    const matchedBranch = branches.find((b) => b.name === formState.branch || b.id === formState.branch);
    const branchName = matchedBranch?.name || formState.branch || '';
    const branchId = matchedBranch?.id || (formState.branch.includes('-') ? formState.branch : '');

    try {
      if (editingIndex !== null && staff[editingIndex]) {
        const targetMember = staff[editingIndex];
        const staffPayload = {
          name: trimmedName,
          phone: formState.phone.trim() || null,
          role: trimmedRole,
          branch_id: branchId || null,
          pay_type: formState.payType,
          rate: Number(formState.rate) || 0,
          hours: Number(formState.hours) || 0,
          revenue: Number(formState.revenue) || 0,
          advance: Number(formState.advance) || 0,
        };

        if (window.api?.updateStaff && targetMember.id) {
          try {
            await window.api.updateStaff(targetMember.id, staffPayload);
          } catch (apiErr) {
            console.warn('API update failed, updating locally:', apiErr);
          }
        }

        setStaff((current) =>
          current.map((m, index) =>
            index === editingIndex
              ? {
                  ...m,
                  name: trimmedName,
                  phone: formState.phone.trim(),
                  role: trimmedRole,
                  branch: branchName,
                  branchId,
                  payType: formState.payType,
                  rate: Number(formState.rate) || 0,
                  hours: Number(formState.hours) || 0,
                  revenue: Number(formState.revenue) || 0,
                  advance: Number(formState.advance) || 0,
                }
              : m
          )
        );

        if (formState.recordToFinance) {
          const gross =
            formState.payType === 'hour'
              ? Number(formState.rate) * Number(formState.hours)
              : formState.payType === 'percent'
                ? (Number(formState.rate) / 100) * Number(formState.revenue)
                : Number(formState.rate);

          const net = Math.max(0, gross - Number(formState.advance || 0));

          if (net > 0) {
            recordFinanceTransaction({
              type: 'expense',
              amount: net,
              category: 'رواتب',
              branch: branchName || 'الفرع الرئيسي',
              branchId,
              branchName: branchName || 'الفرع الرئيسي',
              relatedTo: trimmedName,
              description: `صرف راتب: ${trimmedName} (${trimmedRole}) | الراتب: ${gross} ج | سلف: ${formState.advance} ج | الصافي: ${net} ج`,
              date: new Date().toISOString().split('T')[0],
            });
          }
        }

        showToast('تم تعديل بيانات الموظف بنجاح');
      } else {
        const nextSeq = getNextStaffSequence(staff);
        const newSerial = formatStaffSerial(nextSeq);

        let newId =
          typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
            ? crypto.randomUUID()
            : `${Date.now()}-${Math.random()}`;

        const staffPayload = {
          staff_serial: newSerial,
          name: trimmedName,
          phone: formState.phone.trim() || null,
          role: trimmedRole,
          branch_id: branchId || null,
          pay_type: formState.payType,
          rate: Number(formState.rate) || 0,
          hours: Number(formState.hours) || 0,
          revenue: Number(formState.revenue) || 0,
          advance: Number(formState.advance) || 0,
        };

        if (window.api?.createStaff) {
          try {
            const response = await window.api.createStaff(staffPayload);
            const serverData = (response as any)?.data;
            if (serverData?.id) {
              newId = serverData.id;
            }
          } catch (apiErr) {
            console.warn('API create failed, adding locally:', apiErr);
          }
        }

        const newMember: StaffMember = {
          id: newId,
          staffSerial: newSerial,
          name: trimmedName,
          phone: formState.phone.trim(),
          role: trimmedRole,
          branch: branchName,
          branchId,
          payType: formState.payType,
          rate: Number(formState.rate) || 0,
          hours: Number(formState.hours) || 0,
          revenue: Number(formState.revenue) || 0,
          advance: Number(formState.advance) || 0,
        };

        setStaff((current) => [...current, newMember]);

        if (formState.recordToFinance) {
          const gross =
            formState.payType === 'hour'
              ? Number(formState.rate) * Number(formState.hours)
              : formState.payType === 'percent'
                ? (Number(formState.rate) / 100) * Number(formState.revenue)
                : Number(formState.rate);

          const net = Math.max(0, gross - Number(formState.advance || 0));

          if (net > 0) {
            recordFinanceTransaction({
              type: 'expense',
              amount: net,
              category: 'رواتب',
              branch: branchName || 'الفرع الرئيسي',
              branchId,
              branchName: branchName || 'الفرع الرئيسي',
              relatedTo: trimmedName,
              description: `صرف راتب: ${trimmedName} (${trimmedRole}) | الراتب: ${gross} ج | سلف: ${formState.advance} ج | الصافي: ${net} ج`,
              date: new Date().toISOString().split('T')[0],
            });
          }
        }

        showToast('تم إضافة الموظف بنجاح');
      }
    } catch (err) {
      console.error('Unhandled error in handleSubmit:', err);
      showToast('حدث خطأ أثناء حفظ البيانات', 'error');
    } finally {
      closeModal();
    }
  };

  const handleDelete = async (index: number) => {
    if (!window.confirm('هل تريد حذف هذا الموظف؟')) return;
    const member = staff[index];
    if (!member) return;

    try {
      if (window.api?.deleteStaff && member.id) {
        await window.api.deleteStaff(member.id);
      }
    } catch (apiErr) {
      console.warn('API delete failed, removing locally:', apiErr);
    }

    setStaff((current) => current.filter((_, idx) => idx !== index));
    showToast('تم حذف الموظف بنجاح');
    if (editingIndex === index) {
      setEditingIndex(null);
      setFormState(buildEmptyForm());
    }
  };

  const handleInlineUpdate = (id: string, key: 'hours' | 'revenue' | 'advance', value: number) => {
    const safeVal = Math.max(0, value || 0);
    setStaff((current) =>
      current.map((member) => (member.id === id ? { ...member, [key]: safeVal } : member))
    );

    if (window.api?.updateStaff) {
      void window.api.updateStaff(id, { [key]: safeVal });
    }
  };

  const handleSendStaffWhatsApp = (member: StaffMember) => {
    if (!member.phone?.trim()) {
      showToast('لا يوجد رقم هاتف لهذا الموظف', 'error');
      return;
    }

    let cleanPhone = member.phone.replace(/\D/g, '');
    if (cleanPhone.startsWith('01')) cleanPhone = '2' + cleanPhone;

    const gross = calculateMemberGrossPay(member);
    const advance = Number(member.advance) || 0;
    const net = Math.max(0, gross - advance);

    const caption = `*إيجي سبورتنج كلوب*\n\nبيان مستحقات الموظف/المدرب: ${member.name}\nالكود: ${member.staffSerial}\nالوظيفة: ${member.role}\nالفرع: ${member.branch || 'الرئيسي'}\nنوع التعاقد: ${payTypeLabel(member.payType)}\nالراتب الإجمالي: ${gross.toLocaleString()} ج.م\nالسلف المستقطعة: ${advance.toLocaleString()} ج.م\n*الصافي المستحق للصرف: ${net.toLocaleString()} ج.م*\n\nشكراً لجهودكم المتميزة ⚽`;
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
              <h1 className="text-xl font-bold text-slate-900">إدارة الطاقم والمدربين والرواتب</h1>
              <p className="text-xs text-slate-500">
                تسجيل السلف، احتساب الصافي، والترحيل التلقائي أول كل شهر إلى المالية
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEditStaff && (
              <button
                type="button"
                onClick={handleManualMonthSync}
                className="inline-flex items-center gap-1.5 rounded-xl border border-emerald-300 bg-emerald-50 px-3.5 py-2.5 text-xs font-bold text-emerald-700 shadow-xs transition hover:bg-emerald-100"
                title="ترحيل وصرف رواتب الشهر الحالي لجميع الطاقم للمالية"
              >
                <Calendar className="h-4 w-4 text-emerald-600" />
                ترحيل رواتب الشهر للمالية 🗓️
              </button>
            )}
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
            <p className="mt-1 text-xl font-bold text-slate-900">{metrics.total} موظف</p>
          </div>
          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-right">
            <span className="text-xs font-medium text-sky-600">إجمالي الرواتب الأصلية</span>
            <p className="mt-1 text-xl font-bold text-sky-700">{metrics.grossTotal.toLocaleString()} ج</p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 text-right">
            <span className="text-xs font-medium text-rose-600">إجمالي السلف والاستلاف</span>
            <p className="mt-1 text-xl font-bold text-rose-700">-{metrics.advanceTotal.toLocaleString()} ج</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-right">
            <span className="text-xs font-medium text-emerald-600">صافي المستحق للصرف</span>
            <p className="mt-1 text-xl font-bold text-emerald-700">{metrics.netTotal.toLocaleString()} ج</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative flex items-center">
            <SearchSm className="absolute right-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="بحث باسم الموظف، الكود أو الوظيفة..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-9 pl-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
            />
          </div>

          <select
            value={branchFilter}
            onChange={(e) => setBranchFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-sky-500 focus:bg-white"
          >
            <option value="all">كل الفروع</option>
            {branches.map((b) => (
              <option key={b.id || b.name} value={b.name || ''}>
                {b.name}
              </option>
            ))}
          </select>

          <select
            value={payTypeFilter}
            onChange={(e) => setPayTypeFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-sky-500 focus:bg-white"
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
              const gross = calculateMemberGrossPay(member);
              const advance = Number(member.advance) || 0;
              const netPay = Math.max(0, gross - advance);

              return (
                <div
                  key={member.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-slate-100 text-slate-700 font-bold text-xs">
                          {member.name ? member.name.charAt(0) : 'م'}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <h3 className="font-bold text-slate-900 text-sm">{member.name || 'بدون اسم'}</h3>
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                              {member.staffSerial || '-'}
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
                        <span className="text-slate-500">الفرع:</span>
                        <span className="font-semibold text-sky-800 bg-sky-50 px-2 py-0.5 rounded border border-sky-100">
                          {member.branch || 'الفرع الرئيسي'}
                        </span>
                      </div>

                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                        <span className="text-slate-500">الراتب المستحق:</span>
                        <span className="font-bold text-slate-800">{gross.toLocaleString()} ج.م</span>
                      </div>

                      <div className="flex items-center justify-between bg-rose-50/50 p-2 rounded-lg border border-rose-100">
                        <span className="text-rose-600 font-medium">السلف / الاستلاف:</span>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            value={member.advance ?? 0}
                            onChange={(e) => handleInlineUpdate(member.id, 'advance', Number(e.target.value))}
                            className="w-16 rounded border border-rose-200 bg-white px-1.5 py-0.5 text-center font-bold text-rose-700 outline-none"
                            placeholder="0"
                          />
                          <span className="text-[10px] text-rose-600 font-bold">ج.م</span>
                        </div>
                      </div>

                      <div className="flex items-center justify-between bg-emerald-50 p-2 rounded-lg border border-emerald-200">
                        <span className="font-bold text-emerald-800">الصافي آخر الشهر:</span>
                        <span className="font-extrabold text-sm text-emerald-700">{netPay.toLocaleString()} ج.م</span>
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        type="button"
                        onClick={() => handleSendStaffWhatsApp(member)}
                        className="rounded-lg bg-emerald-50 p-1.5 text-emerald-700 hover:bg-emerald-100 transition"
                        title="إرسال بيان بالواتساب"
                      >
                        <AppIcon icon={Phone01} className="h-4 w-4" />
                      </button>

                      {canEditStaff && (
                        <button
                          type="button"
                          onClick={() => handlePaySalary(member)}
                          className="rounded-lg border border-emerald-300 bg-emerald-600 px-2.5 py-1 text-xs font-bold text-white hover:bg-emerald-700 shadow-xs transition"
                          title="صرف الصافي وتسجيله كمصروف في المالية"
                        >
                          صرف الصافي 💵
                        </button>
                      )}
                    </div>

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
                  <th className="px-3 py-3 font-semibold">الكود</th>
                  <th className="px-3 py-3 font-semibold">الاسم</th>
                  <th className="px-3 py-3 font-semibold">الفرع</th>
                  <th className="px-3 py-3 font-semibold">الوظيفة</th>
                  <th className="px-3 py-3 font-semibold">نوع التعاقد</th>
                  <th className="px-3 py-3 font-semibold">المعدل/القيمة</th>
                  <th className="px-3 py-3 font-semibold">ساعات/إيراد</th>
                  <th className="px-3 py-3 font-semibold">الراتب الأصلي</th>
                  <th className="px-3 py-3 font-semibold text-rose-600">السلف / استلاف</th>
                  <th className="px-3 py-3 font-semibold text-emerald-700">الصافي للصرف</th>
                  <th className="px-3 py-3 text-center font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedStaff.map((member) => {
                  const originalIndex = staff.findIndex((m) => m.id === member.id);
                  const rate = Number(member.rate) || 0;
                  const gross = calculateMemberGrossPay(member);
                  const advance = Number(member.advance) || 0;
                  const netPay = Math.max(0, gross - advance);

                  return (
                    <tr key={member.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-3 py-3 font-mono font-medium text-slate-700">{member.staffSerial || '-'}</td>
                      <td className="px-3 py-3 font-bold text-slate-900">{member.name || 'بدون اسم'}</td>
                      <td className="px-3 py-3">
                        <span className="inline-flex rounded-lg bg-sky-50 px-2 py-0.5 text-xs font-bold text-sky-800 border border-sky-100">
                          {member.branch || 'الفرع الرئيسي'}
                        </span>
                      </td>
                      <td className="px-3 py-3 text-slate-700">{member.role || '-'}</td>
                      <td className="px-3 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${payTypeBadgeStyle(
                            member.payType
                          )}`}
                        >
                          {payTypeLabel(member.payType)}
                        </span>
                      </td>
                      <td className="px-3 py-3 font-semibold text-slate-800">{rate} ج</td>
                      <td className="px-3 py-3">
                        {member.payType === 'hour' ? (
                          <input
                            type="number"
                            min={0}
                            value={member.hours ?? 0}
                            onChange={(e) => handleInlineUpdate(member.id, 'hours', Number(e.target.value))}
                            className="w-14 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 text-center font-bold text-slate-900 outline-none focus:border-sky-500"
                          />
                        ) : member.payType === 'percent' ? (
                          <input
                            type="number"
                            min={0}
                            value={member.revenue ?? 0}
                            onChange={(e) => handleInlineUpdate(member.id, 'revenue', Number(e.target.value))}
                            className="w-16 rounded-lg border border-slate-200 bg-slate-50 px-1.5 py-1 text-center font-bold text-slate-900 outline-none focus:border-sky-500"
                          />
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>
                      <td className="px-3 py-3 font-bold text-slate-800">{gross.toLocaleString()} ج</td>
                      <td className="px-3 py-3">
                        <input
                          type="number"
                          min={0}
                          value={member.advance ?? 0}
                          onChange={(e) => handleInlineUpdate(member.id, 'advance', Number(e.target.value))}
                          className="w-16 rounded-lg border border-rose-200 bg-rose-50/60 px-1.5 py-1 text-center font-bold text-rose-700 outline-none focus:border-rose-500 focus:bg-white"
                          placeholder="0"
                        />
                      </td>
                      <td className="px-3 py-3 font-extrabold text-emerald-600 bg-emerald-50/40">
                        {netPay.toLocaleString()} ج
                      </td>
                      <td className="px-3 py-3">
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
                              onClick={() => handlePaySalary(member)}
                              className="rounded-lg border border-emerald-300 bg-emerald-600 px-2 py-1 text-[11px] font-bold text-white hover:bg-emerald-700 transition"
                              title="صرف الصافي وتسجيله في المالية"
                            >
                              صرف 💵
                            </button>
                          )}

                          {canEditStaff && (
                            <button
                              type="button"
                              onClick={() => handleEdit(originalIndex)}
                              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
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
                    <td colSpan={11} className="px-4 py-10 text-center text-slate-400 text-xs">
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

            <div className="space-y-4 p-5 text-right text-xs">
              <div>
                <label className="block mb-1 font-semibold text-slate-700">
                  اسم الموظف / المدرب <span className="text-rose-500">*</span>
                </label>
                <input
                  value={formState.name}
                  placeholder="مثال: كابتن أحمد محمود"
                  onChange={(e) => setFormState((prev) => ({ ...prev, name: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">الفرع</label>
                <select
                  value={formState.branch}
                  onChange={(e) => setFormState((prev) => ({ ...prev, branch: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-sky-500 focus:bg-white"
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
                <label className="block mb-1 font-semibold text-slate-700">
                  رقم الهاتف
                  <span
                    className={`mr-1 text-[10px] font-normal ${
                      formState.phone.length >= 11 ? 'text-emerald-500' : 'text-slate-400'
                    }`}
                  >
                    ({formState.phone.length}/12)
                  </span>
                </label>
                <input
                  value={formState.phone}
                  placeholder="01000000000 أو 201000000000"
                  inputMode="numeric"
                  maxLength={12}
                  onChange={(e) => {
                    const digits = e.target.value.replace(/\D/g, '').slice(0, 12);
                    setFormState((prev) => ({ ...prev, phone: digits }));
                  }}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">
                  الوظيفة / التخصص <span className="text-rose-500">*</span>
                </label>
                <input
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
                  <label className="block mb-1 font-semibold text-slate-700">القيمة / الراتب (ج.م)</label>
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
                    value={
                      formState.payType === 'percent'
                        ? formState.revenue === 0
                          ? ''
                          : formState.revenue
                        : formState.hours === 0
                        ? ''
                        : formState.hours
                    }
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

              {/* Advance input */}
              <div>
                <label className="block mb-1 font-semibold text-rose-700">
                  السلف / الاستلاف المستقطع (ج.م)
                </label>
                <input
                  type="number"
                  min={0}
                  value={formState.advance === 0 ? '' : formState.advance}
                  placeholder="0"
                  onChange={(e) => setFormState((prev) => ({ ...prev, advance: Math.max(0, Number(e.target.value)) }))}
                  className="w-full rounded-xl border border-rose-200 bg-rose-50/50 px-3 py-2.5 text-xs font-bold text-rose-800 outline-none focus:border-rose-500 focus:bg-white"
                />
                <p className="mt-1 text-[11px] text-slate-400">
                  يتم خصم هذا المبلغ تلقائياً من إجمالي الراتب ليصبح الصافي المستحق للصرف واضحاً.
                </p>
              </div>

              {/* Sync to finance option */}
              <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3">
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={formState.recordToFinance}
                    onChange={(e) => setFormState((prev) => ({ ...prev, recordToFinance: e.target.checked }))}
                    className="h-4 w-4 rounded text-emerald-600 focus:ring-emerald-500"
                  />
                  <span className="font-semibold text-xs text-emerald-800">
                    تسجيل وصرف صافي هذا الراتب كمصروف حالي في قسم المالية 💵
                  </span>
                </label>
              </div>

              <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 -mx-5 -mb-5 px-5 py-3 mt-4">
                <button
                  type="button"
                  onClick={closeModal}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={() => { void handleSubmit(); }}
                  className="rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 transition"
                >
                  {editingIndex !== null ? 'حفظ التعديلات' : 'إضافة الموظف'}
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import {
  CreditCard01,
  Plus,
  SearchSm,
  Calendar,
  Clock,
  MessageChatCircle,
  File02,
  Trash01,
} from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';
import { useAuth } from '@/contexts/AuthContext';

/* ── Types ──────────────────────────────────────────────────── */
type FinanceRecordLike = {
  id?: string;
  source?: string;
  sourceId?: string;
  description?: string;
  category?: string;
  relatedTo?: string;
  [key: string]: unknown;
};

type Player = {
  id: string;
  name: string;
  branch?: string;
  branchId?: string;
  playerSerial?: string;
  playerBarcodeValue?: string;
  phone?: string;
  schedule?: string;
  trainingTime?: string;
};

type Game = { id: string; name: string };
type Branch = { id: string; name: string };

type SubscriptionRecord = {
  id: string;
  playerId: string;
  player: string;
  playerCode?: string;
  game: string;
  branch?: string;
  branchId?: string;
  schedule?: string;
  trainingTime?: string;
  sessions: number;
  subscriptionValue: number;
  paidAmount: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'expired' | 'cancelled';
  invoiceNumber?: string;
};

type SubscriptionFormState = {
  id: string;
  playerId: string;
  game: string;
  schedule: string[];
  trainingTimeStart: string;
  trainingTimeEnd: string;
  sessions: number;
  subscriptionValue: number;
  paidAmount: number;
  startDate: string;
  endDate: string;
  invoiceNumber: string;
};

type RenewFormState = {
  subId: string;
  startDate: string;
  endDate: string;
  sessions: number;
  price: number;
  paidAmount: number;
  invoiceNumber: string;
};

const TRAINING_DAYS = [
  'السبت',
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
];

const emptyFormState: SubscriptionFormState = {
  id: '',
  playerId: '',
  game: '',
  schedule: [],
  trainingTimeStart: '',
  trainingTimeEnd: '',
  sessions: 0,
  subscriptionValue: 0,
  paidAmount: 0,
  startDate: '',
  endDate: '',
  invoiceNumber: '',
};

const emptyRenewState: RenewFormState = {
  subId: '',
  startDate: '',
  endDate: '',
  sessions: 0,
  price: 0,
  paidAmount: 0,
  invoiceNumber: '',
};

/* ── Helpers ────────────────────────────────────────────────── */
function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  if (!value) return fallback;
  try { return JSON.parse(value) as T; } catch { return fallback; }
}

function formatTimeTo12h(timeStr: string) {
  if (!timeStr || !timeStr.includes(':')) return timeStr;
  const [hoursText, minutes] = timeStr.split(':');
  let hours = Number(hoursText);
  const ampm = hours >= 12 ? 'مساءً' : 'صباحاً';
  hours = hours % 12 || 12;
  return `${hours}:${minutes} ${ampm}`;
}

function normalizeCode(value: string | undefined) {
  return String(value || '').trim().toUpperCase();
}

function buildWhatsAppNumber(phone = '') {
  const digits = phone.replace(/\D/g, '');
  if (digits.startsWith('01') && digits.length === 11) return `2${digits}`;
  return digits;
}

function hasSubscriptionsApi() {
  return !!window?.api?.getToken?.();
}

function createStableId(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function getErrorMessage(error: unknown) {
  if (typeof error === 'string') return error;
  if (error instanceof Error) return error.message;
  return 'حدث خطأ غير متوقع';
}

function getSubscriptionTotal(subscription: SubscriptionRecord) {
  return Number(subscription.subscriptionValue || 0);
}

function getSubscriptionPaid(subscription: SubscriptionRecord) {
  return Number(subscription.paidAmount || 0);
}

function getSubscriptionRemaining(subscription: SubscriptionRecord) {
  return Math.max(0, getSubscriptionTotal(subscription) - getSubscriptionPaid(subscription));
}

export default function Subscriptions() {
  const { canEdit } = useAuth();
  const canEditSubs = canEdit('subscriptions');
  const [players, setPlayers] = useState<Player[]>(() => readStorage('players', []));
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>(() => readStorage('subscriptions', []));
  const [games, setGames] = useState<Game[]>(() => readStorage('games', []));
  const [, setBranches] = useState<Branch[]>(() => readStorage('branches', []));

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [paymentFilter, setPaymentFilter] = useState('all');
  const [branchFilter, setBranchFilter] = useState('all');
  const [gameFilter, setGameFilter] = useState('all');
  const [barcodeInput, setBarcodeInput] = useState('');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');

  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);

  const [formState, setFormState] = useState<SubscriptionFormState>(emptyFormState);
  const [renewState, setRenewState] = useState<RenewFormState>(emptyRenewState);
  const [currentInvoice, setCurrentInvoice] = useState<SubscriptionRecord | null>(null);

  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const invoiceCanvasRef = useRef<HTMLCanvasElement | null>(null);

  /* ── Load from API ─────────────────────────────────────────── */
  useEffect(() => {
    const loadFromApi = async () => {
      const api = window.api;
      if (!hasSubscriptionsApi() || !api?.getPlayers || !api?.getSubscriptions || !api?.getSports || !api?.getBranches) return;
      try {
        const [playersResponse, subsResponse, gamesResponse, branchesResponse] = await Promise.all([
          api.getPlayers(),
          api.getSubscriptions(),
          api.getSports().catch(() => ({ data: readStorage('games', []) })),
          api.getBranches().catch(() => ({ data: readStorage('branches', []) })),
        ]);

        const rawSubs = Array.isArray(subsResponse?.data) ? subsResponse.data : [];
        const normalizedSubs: SubscriptionRecord[] = rawSubs.map((item: any) => ({
          id: String(item.id || ''),
          playerId: String(item.playerId || item.player_id || ''),
          player: String(item.player || item.player_name || ''),
          playerCode: String(item.playerCode || item.player_code || item.playerSerial || ''),
          game: String(item.game || item.game_name || ''),
          branch: String(item.branch || item.branch_name || ''),
          branchId: String(item.branchId || item.branch_id || ''),
          schedule: String(item.schedule || ''),
          trainingTime: String(item.trainingTime || item.training_time || ''),
          sessions: Number(item.sessions || 0),
          subscriptionValue: Number(item.subscriptionValue ?? item.subscription_value ?? 0),
          paidAmount: Number(item.paidAmount ?? item.paid_amount ?? 0),
          startDate: String(item.startDate || item.start_date || ''),
          endDate: String(item.endDate || item.end_date || ''),
          status: item.status === 'cancelled' ? 'cancelled' : item.status === 'expired' ? 'expired' : 'active',
          invoiceNumber: String(item.invoiceNumber || item.invoice_number || ''),
        }));

        setPlayers((playersResponse.data as Player[]) || []);
        setSubscriptions(normalizedSubs);
        setGames((gamesResponse.data as Game[]) || []);
        setBranches((branchesResponse.data as Branch[]) || []);

        window.localStorage.setItem('players', JSON.stringify(playersResponse.data || []));
        window.localStorage.setItem('subscriptions', JSON.stringify(normalizedSubs));
        window.localStorage.setItem('games', JSON.stringify(gamesResponse.data || []));
        window.localStorage.setItem('branches', JSON.stringify(branchesResponse.data || []));
      } catch {
        setPlayers(readStorage('players', []));
        setSubscriptions(readStorage('subscriptions', []));
        setGames(readStorage('games', []));
        setBranches(readStorage('branches', []));
      }
    };

    loadFromApi();
  }, []);

  useEffect(() => {
    const handleStorage = (event: StorageEvent) => {
      if (['players', 'subscriptions', 'games', 'branches'].includes(event.key || '')) {
        setPlayers(readStorage('players', []));
        setSubscriptions(readStorage('subscriptions', []));
        setGames(readStorage('games', []));
        setBranches(readStorage('branches', []));
      }
    };
    window.addEventListener('storage', handleStorage);
    return () => window.removeEventListener('storage', handleStorage);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2600);
    return () => window.clearTimeout(timer);
  }, [toast]);

  /* ── Render Invoice Canvas ─────────────────────────────────── */
  useEffect(() => {
    if (!currentInvoice || !invoiceCanvasRef.current) return;
    const canvas = invoiceCanvasRef.current;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const renderInvoice = async () => {
      const width = 800;
      const height = 1200;
      canvas.width = width;
      canvas.height = height;
      ctx.setTransform(1, 0, 0, 1, 0, 0);
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, width, height);

      ctx.fillStyle = '#2563eb';
      ctx.fillRect(0, 0, width, 120);

      ctx.fillStyle = '#ffffff';
      ctx.font = 'bold 28px Cairo';
      ctx.textAlign = 'right';
      ctx.fillText('أكاديمية إيجي سبورتنج', width - 30, 55);
      ctx.font = '18px Cairo';
      ctx.fillText('فاتورة اشتراك إلكترونية', width - 30, 90);

      ctx.fillStyle = '#0f172a';
      ctx.font = '16px Cairo';
      ctx.textAlign = 'right';
      let y = 160;
      const drawField = (label: string, value: string, valueColor = '#0f172a') => {
        ctx.fillStyle = '#64748b';
        ctx.fillText(`${label}:`, width - 30, y);
        ctx.fillStyle = valueColor;
        ctx.font = 'bold 18px Cairo';
        ctx.fillText(value, width - 240, y);
        ctx.strokeStyle = '#e2e8f0';
        ctx.beginPath();
        ctx.moveTo(30, y + 12);
        ctx.lineTo(width - 30, y + 12);
        ctx.stroke();
        ctx.font = '16px Cairo';
        y += 42;
      };

      drawField('كود اللاعب', currentInvoice.playerCode || '-', '#2563eb');
      drawField('رقم الإيصال', currentInvoice.invoiceNumber || '-');
      drawField('اسم اللاعب', currentInvoice.player);
      drawField('الرياضة / النشاط', currentInvoice.game);
      drawField('أيام التدريب', currentInvoice.schedule || '-');
      drawField('توقيت التدريب', currentInvoice.trainingTime || '-');
      drawField('عدد الحصص', String(currentInvoice.sessions));
      drawField('قيمة الاشتراك', `${currentInvoice.subscriptionValue} ج.م`);
      drawField('المبلغ المدفوع', `${currentInvoice.paidAmount} ج.م`, '#16a34a');
      drawField('المتبقي', `${getSubscriptionRemaining(currentInvoice)} ج.م`, getSubscriptionRemaining(currentInvoice) > 0 ? '#ef4444' : '#16a34a');
      drawField('تاريخ البداية', currentInvoice.startDate);
      drawField('تاريخ الانتهاء', currentInvoice.endDate);

      ctx.fillStyle = '#f8fafc';
      ctx.fillRect(0, height - 80, width, 80);
      ctx.fillStyle = '#64748b';
      ctx.font = '16px Cairo';
      ctx.textAlign = 'center';
      ctx.fillText('شكراً لاختياركم أكاديمية إيجي سبورتنج - تمرين سعيد!', width / 2, height - 40);

      try {
        const qrDataUrl = await QRCode.toDataURL(currentInvoice.playerCode || '000', {
          width: 180,
          margin: 1,
          color: { dark: '#0f172a', light: '#ffffff' },
        });
        const image = new Image();
        image.src = qrDataUrl;
        image.onload = () => {
          ctx.fillStyle = '#fff';
          ctx.fillRect(40, height - 320, 180, 180);
          ctx.drawImage(image, 45, height - 315, 170, 170);
        };
      } catch { /* QR optional */ }
    };

    renderInvoice();
  }, [currentInvoice]);

  const saveToStorage = <T,>(key: string, value: T) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  };

  /* ── Calculations & Metrics ────────────────────────────────── */
  const subscriptionMetrics = useMemo(() => {
    const today = new Date();
    const items = subscriptions;
    const total = items.length;
    const active = items.filter((s) => new Date(s.endDate) >= today && s.status !== 'cancelled' && (s.sessions || 0) > 0).length;
    const paid = items.reduce((sum, s) => sum + Number(s.paidAmount || 0), 0);
    const debt = items.reduce((sum, s) => sum + getSubscriptionRemaining(s), 0);
    const expiringSoon = items.filter((s) => {
      if (s.status === 'cancelled') return false;
      const endDate = new Date(s.endDate);
      if (endDate < today) return false;
      const diffDays = Math.ceil((endDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24));
      return diffDays <= 2;
    }).length;

    return { total, active, paid, debt, expiringSoon };
  }, [subscriptions]);

  const uniqueBranchOptions = useMemo(() => {
    return Array.from(new Set(subscriptions.map((sub) => sub.branch || '').filter(Boolean))).sort();
  }, [subscriptions]);

  const uniqueGameOptions = useMemo(() => {
    return Array.from(new Set(subscriptions.map((sub) => sub.game || '').filter(Boolean))).sort();
  }, [subscriptions]);

  const filteredSubscriptions = useMemo(() => {
    const query = searchText.trim().toLowerCase();
    const today = new Date();

    return subscriptions.filter((sub) => {
      const matchesSearch = !query || sub.player.toLowerCase().includes(query) || sub.game.toLowerCase().includes(query);
      const remaining = getSubscriptionRemaining(sub);
      const isCancelled = sub.status === 'cancelled';
      const endDate = new Date(sub.endDate);
      const isExpired = isCancelled || (endDate < today && (sub.sessions || 0) <= 0);
      const isActive = !isCancelled && endDate >= today && (sub.sessions || 0) > 0;

      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = isActive;
      if (statusFilter === 'expired') matchesStatus = isExpired;
      if (statusFilter === 'cancelled') matchesStatus = isCancelled;

      let matchesPayment = true;
      if (paymentFilter === 'hasRemaining') matchesPayment = remaining > 0;
      if (paymentFilter === 'fullyPaid') matchesPayment = remaining <= 0;

      let matchesBranch = true;
      if (branchFilter !== 'all') matchesBranch = (sub.branch || '') === branchFilter;

      let matchesGame = true;
      if (gameFilter !== 'all') matchesGame = sub.game === gameFilter;

      return matchesSearch && matchesStatus && matchesPayment && matchesBranch && matchesGame;
    });
  }, [branchFilter, gameFilter, paymentFilter, searchText, statusFilter, subscriptions]);

  /* ── Modal & Handler Actions ────────────────────────────────── */
  const openAddSubscription = () => {
    setFormState({ ...emptyFormState, startDate: '', endDate: '' });
    setIsSubscriptionModalOpen(true);
  };

  const openEditSubscription = (subscription: SubscriptionRecord) => {
    const scheduleArray = subscription.schedule ? subscription.schedule.split(', ').filter(Boolean) : [];
    const [startTime, endTime] = (subscription.trainingTime || '').split(' - ');
    setFormState({
      id: subscription.id,
      playerId: subscription.playerId,
      game: subscription.game,
      schedule: scheduleArray,
      trainingTimeStart: startTime || '',
      trainingTimeEnd: endTime || '',
      sessions: subscription.sessions,
      subscriptionValue: subscription.subscriptionValue,
      paidAmount: subscription.paidAmount,
      startDate: subscription.startDate,
      endDate: subscription.endDate,
      invoiceNumber: subscription.invoiceNumber || '',
    });
    setIsSubscriptionModalOpen(true);
  };

  const closeSubscriptionModal = () => {
    setIsSubscriptionModalOpen(false);
    setFormState(emptyFormState);
  };

  const updateForm = (field: keyof SubscriptionFormState, value: string | number | string[]) => {
    setFormState((prev) => ({ ...prev, [field]: value }));
  };

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  const saveSubscriptionToState = async (subscription: SubscriptionRecord, paymentDelta: number) => {
    const nextSubs = subscriptions.some((sub) => sub.id === subscription.id)
      ? subscriptions.map((sub) => (sub.id === subscription.id ? subscription : sub))
      : [...subscriptions, subscription];

    setSubscriptions(nextSubs);
    saveToStorage('subscriptions', nextSubs);

    if (paymentDelta > 0) {
      await recordSubscriptionRevenue(subscription, paymentDelta, `اشتراك ${subscription.game}`, subscription.startDate);
    }
  };

  const handleSubscriptionSave = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    if (!formState.playerId || !formState.game || !formState.startDate || !formState.endDate) {
      showToast('الرجاء ملء الحقول المطلوبة', 'error');
      return;
    }

    if (formState.paidAmount > formState.subscriptionValue) {
      showToast('المبلغ المدفوع لا يمكن أن يكون أكبر من قيمة الاشتراك', 'error');
      return;
    }

    const selectedPlayer = players.find((player) => player.id === formState.playerId);
    const existingSubscription = subscriptions.find((sub) => sub.id === formState.id);
    const paymentDelta = Math.max(0, formState.paidAmount - Number(existingSubscription?.paidAmount || 0));

    let subscription: SubscriptionRecord = {
      id: formState.id || createStableId('sub'),
      playerId: selectedPlayer?.id || formState.playerId || existingSubscription?.playerId || '',
      player: selectedPlayer?.name || existingSubscription?.player || '',
      playerCode:
        selectedPlayer?.playerSerial ||
        selectedPlayer?.playerBarcodeValue ||
        existingSubscription?.playerCode ||
        `P${createStableId('player').slice(-5)}`,
      game: formState.game,
      branch: selectedPlayer?.branch || existingSubscription?.branch || '',
      branchId: selectedPlayer?.branchId || existingSubscription?.branchId || '',
      schedule: formState.schedule.join(', '),
      trainingTime:
        formState.trainingTimeStart && formState.trainingTimeEnd
          ? `${formState.trainingTimeStart} - ${formState.trainingTimeEnd}`
          : '',
      sessions: formState.sessions,
      subscriptionValue: formState.subscriptionValue,
      paidAmount: formState.paidAmount,
      startDate: formState.startDate,
      endDate: formState.endDate,
      status: existingSubscription?.status === 'cancelled' ? 'cancelled' : 'active',
      invoiceNumber: formState.invoiceNumber.trim(),
    };

    try {
      const api = window.api;
      if (hasSubscriptionsApi() && api) {
        if (formState.id) {
          await api.updateSubscription?.(subscription.id, subscription);
        } else {
          const response = await api.createSubscription?.(subscription);
          const serverSubscription = (response as { data?: { id?: string } } | undefined)?.data;
          if (serverSubscription?.id) {
            subscription = { ...subscription, id: serverSubscription.id };
          }
        }
      }

      await saveSubscriptionToState(subscription, paymentDelta);

      if (selectedPlayer) {
        const nextPlayers = players.map((player) =>
          player.id === selectedPlayer.id
            ? { ...player, schedule: subscription.schedule, trainingTime: subscription.trainingTime }
            : player,
        );
        setPlayers(nextPlayers);
        saveToStorage('players', nextPlayers);
      }

      closeSubscriptionModal();
      showToast('تم حفظ الاشتراك بنجاح', 'success');
      if (!formState.id) {
        processAndSendInvoice(subscription, `تم تسجيل اشتراك ${subscription.game} بنجاح ✅`);
      }
    } catch (error) {
      showToast(getErrorMessage(error) || 'فشل حفظ الاشتراك', 'error');
    }
  };

  const deleteSubscription = async (id: string) => {
    if (!window.confirm('هل تريد حذف هذا الاشتراك؟')) return;
    const subscriptionToDelete = subscriptions.find((sub) => sub.id === id);
    if (!subscriptionToDelete) return;

    try {
      const api = window.api;
      if (hasSubscriptionsApi() && api?.deleteSubscription) {
        await api.deleteSubscription(id);
      }
      const nextSubs = subscriptions.filter((sub) => sub.id !== id);
      setSubscriptions(nextSubs);
      saveToStorage('subscriptions', nextSubs);
      await removeSubscriptionRevenue(subscriptionToDelete);
      showToast('تم حذف الاشتراك', 'success');
    } catch (error) {
      showToast(getErrorMessage(error) || 'فشل حذف الاشتراك', 'error');
    }
  };

  const recordSubscriptionRevenue = async (
    subscription: SubscriptionRecord,
    amount: number,
    description: string,
    date: string,
  ) => {
    if (amount <= 0) return;
    const financeRecord = {
      type: 'income',
      category: 'اشتراكات',
      branch: subscription.branchId || subscription.branch || '',
      branchName: subscription.branch || '',
      relatedTo: subscription.player || '',
      amount: Number(amount) || 0,
      date: date || new Date().toISOString().split('T')[0],
      description,
      source: 'subscription',
      sourceId: String(subscription.id),
      sourceKey: `subscription:${subscription.id}:${Date.now()}`,
    };

    if (window.api?.createFinance) {
      await window.api.createFinance(financeRecord);
      return;
    }
    if (window.sharedFinance?.addFinance) {
      window.sharedFinance.addFinance(
        'income',
        financeRecord.amount,
        financeRecord.category,
        financeRecord.relatedTo,
        financeRecord.description,
        financeRecord.date,
      );
    }
  };

  const removeSubscriptionRevenue = async (subscription: SubscriptionRecord) => {
    const sourceId = String(subscription.id);
    const matchesLegacy = (record: Record<string, unknown>) => {
      const description = String(record?.description || '');
      const isSubscription = String(record?.category || '') === 'اشتراكات';
      return isSubscription && String(record?.relatedTo || '') === String(subscription.player || '') && description.includes(subscription.game || '');
    };

    if (window.api?.getFinanceRecords && window.api?.deleteFinance) {
      const financeResponse = await window.api.getFinanceRecords();
      const items = Array.isArray(financeResponse?.data) ? (financeResponse.data as FinanceRecordLike[]) : [];
      const linked = items.filter((record) => String(record.source || '') === 'subscription' && String(record.sourceId || '') === sourceId);
      for (const record of linked) {
        if (record.id) await window.api.deleteFinance(record.id);
      }
      return;
    }

    const currentFinances = readStorage('finances', [] as Record<string, unknown>[]);
    const nextFinances = currentFinances.filter((record) => !matchesLegacy(record));
    if (window.syncManager?.update) {
      window.syncManager.update('finances', nextFinances);
    } else {
      saveToStorage('finances', nextFinances);
    }
  };

  const findPlayerByCode = (code: string) => {
    const normalized = normalizeCode(code);
    if (!normalized) return null;
    return players.find(
      (player) =>
        normalizeCode(player.playerSerial) === normalized ||
        normalizeCode(player.playerBarcodeValue) === normalized ||
        normalizeCode(player.id) === normalized,
    );
  };

  const handleBarcodeSubmit = () => {
    const player = findPlayerByCode(barcodeInput);
    if (!player) {
      showToast('لم يتم العثور على لاعب بهذا الباركود', 'error');
      return;
    }

    const matches = subscriptions.filter((s) => s.playerId === player.id || s.player === player.name);
    if (matches.length) {
      setSearchText(player.name);
      showToast(`تم العثور على ${matches.length} اشتراك للاعب ${player.name}`, 'success');
    } else {
      setFormState({
        ...emptyFormState,
        playerId: player.id,
        startDate: new Date().toISOString().slice(0, 10),
        endDate: new Date(new Date().setMonth(new Date().getMonth() + 1)).toISOString().slice(0, 10),
      });
      setIsSubscriptionModalOpen(true);
      showToast(`تم اختيار اللاعب ${player.name} لإضافة اشتراك جديد`, 'success');
    }
    setBarcodeInput('');
  };

  const openRenewModal = (subscription: SubscriptionRecord) => {
    const today = new Date().toISOString().slice(0, 10);
    const nextMonth = new Date();
    nextMonth.setMonth(nextMonth.getMonth() + 1);
    setRenewState({
      subId: subscription.id,
      startDate: today,
      endDate: nextMonth.toISOString().slice(0, 10),
      sessions: subscription.sessions || 0,
      price: subscription.subscriptionValue || 0,
      paidAmount: 0,
      invoiceNumber: '',
    });
    setIsRenewModalOpen(true);
  };

  const confirmRenewal = async () => {
    if (!renewState.subId) return;
    try {
      if (!window.api?.renewSubscription) throw new Error('API غير جاهز');
      await window.api.renewSubscription(renewState.subId, {
        startDate: renewState.startDate,
        endDate: renewState.endDate,
        sessions: renewState.sessions,
        price: renewState.price,
        paidAmount: renewState.paidAmount,
        invoiceNumber: renewState.invoiceNumber,
      });
      setIsRenewModalOpen(false);
      showToast('تم تجديد الاشتراك بنجاح وأرشفة السجل القديم', 'success');
      setTimeout(() => window.location.reload(), 300);
    } catch (error) {
      showToast(getErrorMessage(error) || 'فشل التجديد', 'error');
    }
  };

  const collectRemainingPayment = async (subscription: SubscriptionRecord) => {
    const remaining = getSubscriptionRemaining(subscription);
    if (remaining <= 0) {
      showToast('هذا الاشتراك مسدد بالكامل', 'success');
      return;
    }

    const entered = window.prompt(`المتبقي على ${subscription.player} هو ${remaining} ج\nاكتب المبلغ الذي تم سداده الآن:`, String(remaining));
    if (entered === null) return;
    const amount = Number(entered);
    if (!Number.isFinite(amount) || amount <= 0 || amount > remaining) {
      showToast('أدخل مبلغًا صحيحًا أكبر من صفر ولا يزيد عن المتبقي', 'error');
      return;
    }

    const updated = { ...subscription, paidAmount: getSubscriptionPaid(subscription) + amount };
    try {
      const api = window.api;
      if (hasSubscriptionsApi() && api?.updateSubscription) {
        await api.updateSubscription(subscription.id, updated);
      }
      const nextSubs = subscriptions.map((sub) => (sub.id === subscription.id ? updated : sub));
      setSubscriptions(nextSubs);
      saveToStorage('subscriptions', nextSubs);
      await recordSubscriptionRevenue(updated, amount, `سداد متبقي اشتراك ${updated.game}`, new Date().toISOString().split('T')[0]);
      showToast(`تم تسجيل دفعة ${amount} ج بنجاح`, 'success');
      processAndSendInvoice(updated, `تم سداد دفعة ${amount} ج لاشتراك ${updated.game} 💵`);
    } catch (error) {
      showToast(getErrorMessage(error) || 'فشل تسجيل الدفعة', 'error');
    }
  };

  const refundSubscription = async (subscription: SubscriptionRecord) => {
    const paid = Number(subscription.paidAmount || 0);
    const refundAmountStr = window.prompt(
      `إلغاء اشتراك ${subscription.player}\nالمبلغ المدفوع: ${paid} ج.م\n\nأدخل مبلغ الاسترداد (أدخل 0 للإلغاء فقط بدون استرداد مالي):`,
      String(paid),
    );
    if (refundAmountStr === null) return;
    const refundAmount = Number(refundAmountStr);
    if (isNaN(refundAmount) || refundAmount < 0 || refundAmount > paid) {
      showToast('مبلغ الاسترداد غير صحيح', 'error');
      return;
    }

    if (!window.confirm(`هل أنت متأكد من إلغاء الاشتراك${refundAmount > 0 ? ` واسترداد ${refundAmount} ج.م` : ''}؟`)) return;

    const updated: SubscriptionRecord = { ...subscription, status: 'cancelled', sessions: 0 };
    try {
      const api = window.api;
      if (hasSubscriptionsApi() && api?.updateSubscription) {
        await api.updateSubscription(subscription.id, updated);
      }
      const nextSubs = subscriptions.map((sub) => (sub.id === subscription.id ? updated : sub));
      setSubscriptions(nextSubs);
      saveToStorage('subscriptions', nextSubs);
      if (refundAmount > 0) {
        const date = new Date().toISOString().split('T')[0];
        if (window.api?.createFinance) {
          await window.api.createFinance({
            type: 'expense',
            category: 'استرداد اشتراك',
            branch: subscription.branchId || '',
            branchName: subscription.branch || '',
            relatedTo: subscription.player,
            amount: refundAmount,
            date,
            description: `استرداد اشتراك ${subscription.game} (${subscription.player})`,
            source: 'refund',
          });
        } else if (window.sharedFinance?.addFinance) {
          window.sharedFinance.addFinance('expense', refundAmount, 'استرداد اشتراك', subscription.branch || '', `استرداد اشتراك ${subscription.game} (${subscription.player})`, date);
        }
      }
      showToast('تم إلغاء الاشتراك بنجاح', 'success');
    } catch (error) {
      showToast(getErrorMessage(error) || 'فشل الإلغاء', 'error');
    }
  };

  const showInvoice = (subscription: SubscriptionRecord) => {
    setCurrentInvoice(subscription);
    setIsInvoiceModalOpen(true);
  };

  const processAndSendInvoice = async (subscription: SubscriptionRecord, customCaption?: string) => {
    const player = players.find((item) => item.id === subscription.playerId || item.name === subscription.player);
    let phone = player?.phone || '';
    if (!phone) return;
    phone = buildWhatsAppNumber(phone);
    const caption = `*إيجي سبورتنج كلوب*\n\n${customCaption || `فاتورة اشتراك: ${subscription.player}`}\nاللعبة: ${subscription.game}\nالمبلغ المدفوع: ${subscription.paidAmount} ج.م\nالمتبقي: ${getSubscriptionRemaining(subscription)} ج.م\nتاريخ الانتهاء: ${subscription.endDate}\n\nشكراً لاشتراككم معنا ⚽`;
    if (phone) {
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(caption)}`, '_blank');
    }
  };

  const sendInvoiceWhatsApp = async () => {
    if (!currentInvoice) return;
    const player = players.find((item) => item.id === currentInvoice.playerId || item.name === currentInvoice.player);
    let phone = player?.phone || '';
    if (!phone) {
      const entered = window.prompt('لم يتم العثور على رقم هاتف للاعب. يرجى إدخال الرقم (مثال: 2010...):');
      if (!entered) return;
      phone = entered;
    }
    phone = buildWhatsAppNumber(phone);
    const canvas = invoiceCanvasRef.current;
    if (!canvas) return;
    const imgData = canvas.toDataURL('image/jpeg', 0.9);
    const caption = `*فاتورة اشتراك رقمية*\n\nاللاعب: ${currentInvoice.player}\nاللعبة: ${currentInvoice.game}\nالمبلغ المدفوع: ${currentInvoice.paidAmount} ج.م\nالمتبقي: ${getSubscriptionRemaining(currentInvoice)} ج.م\nتاريخ الانتهاء: ${currentInvoice.endDate}\n\nشكراً لاشتراككم معنا في إيجي سبورتنج كلوب ⚽`;
    if (window.api && typeof window.api.sendInvoiceNotification === 'function') {
      try {
        await window.api.sendInvoiceNotification(phone, imgData, caption);
        showToast('تم إرسال الفاتورة بنجاح ✅', 'success');
        return;
      } catch {
        window.open(`https://wa.me/${phone}?text=${encodeURIComponent(caption)}`, '_blank');
        return;
      }
    }
    window.open(`https://wa.me/${phone}?text=${encodeURIComponent(caption)}`, '_blank');
  };

  const downloadInvoiceJPG = () => {
    if (!currentInvoice || !invoiceCanvasRef.current) {
      showToast('لا توجد بيانات فاتورة لتحميلها', 'error');
      return;
    }
    const link = document.createElement('a');
    link.download = `فاتورة_${currentInvoice.player}_${new Date().toISOString().slice(0, 10)}.jpg`;
    link.href = invoiceCanvasRef.current.toDataURL('image/jpeg', 1.0);
    link.click();
    showToast('تم حفظ الفاتورة كصورة بنجاح', 'success');
  };

  const exportInvoicePDF = () => {
    if (!currentInvoice || !invoiceCanvasRef.current) {
      showToast('لا توجد بيانات فاتورة لتحميلها', 'error');
      return;
    }
    const canvas = invoiceCanvasRef.current;
    const imgData = canvas.toDataURL('image/png');
    const doc = new jsPDF('p', 'mm', 'a5');
    const pdfWidth = doc.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;
    doc.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    doc.save(`فاتورة_${currentInvoice.player || 'اشتراك'}_${currentInvoice.playerCode || ''}.pdf`);
    showToast('تم تجهيز ملف PDF بنجاح', 'success');
  };

  const closeModals = () => {
    setIsSubscriptionModalOpen(false);
    setIsRenewModalOpen(false);
    setIsInvoiceModalOpen(false);
    setCurrentInvoice(null);
  };

  const handleTrainingDayToggle = (day: string) => {
    setFormState((prev) => {
      const schedule = prev.schedule.includes(day)
        ? prev.schedule.filter((item) => item !== day)
        : [...prev.schedule, day];
      return { ...prev, schedule };
    });
  };

  const formattedSchedule = (sub: SubscriptionRecord) => sub.schedule || '-';
  const formattedTrainingTime = (sub: SubscriptionRecord) => {
    if (sub.trainingTime?.includes(' - ')) {
      const [start, end] = sub.trainingTime.split(' - ');
      return `${formatTimeTo12h(start)} - ${formatTimeTo12h(end)}`;
    }
    return sub.trainingTime || '-';
  };

  const statusLabel = (status: SubscriptionRecord['status']) => {
    if (status === 'cancelled') return 'ملغي';
    if (status === 'active') return 'نشط';
    return 'منتهي';
  };

  const statusBadgeStyle = (status: SubscriptionRecord['status']) => {
    if (status === 'cancelled') return 'bg-slate-100 text-slate-600 border-slate-200';
    if (status === 'active') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
    return 'bg-rose-50 text-rose-700 border-rose-200';
  };

  return (
    <div dir="rtl" className="space-y-5 font-sans">
      {/* Toast */}
      {toast ? (
        <div className={`fixed right-6 top-6 z-50 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl transition-all ${
          toast.type === 'success' ? 'bg-emerald-600 text-white' : toast.type === 'error' ? 'bg-rose-600 text-white' : 'bg-sky-600 text-white'
        }`}>
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
              <h1 className="text-xl font-bold text-slate-900">إدارة الاشتراكات</h1>
              <p className="text-xs text-slate-500">متابعة دقيقة لاشتراكات وتدريبات ومستحقات اللاعبين</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEditSubs && (
              <button
                type="button"
                onClick={openAddSubscription}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                <Plus className="h-4 w-4" />
                إضافة اشتراك
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
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-right">
            <span className="text-xs font-medium text-slate-500">إجمالي الاشتراكات</span>
            <p className="mt-1 text-xl font-bold text-slate-900">{subscriptionMetrics.total}</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-right">
            <span className="text-xs font-medium text-emerald-600">نشطة</span>
            <p className="mt-1 text-xl font-bold text-emerald-700">{subscriptionMetrics.active}</p>
          </div>
          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-right">
            <span className="text-xs font-medium text-sky-600">المحصل</span>
            <p className="mt-1 text-xl font-bold text-sky-700">{subscriptionMetrics.paid.toLocaleString()} ج</p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 text-right">
            <span className="text-xs font-medium text-rose-600">المتبقي (ديون)</span>
            <p className="mt-1 text-xl font-bold text-rose-600">{subscriptionMetrics.debt.toLocaleString()} ج</p>
          </div>
          <div className="col-span-2 rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-right sm:col-span-1">
            <span className="text-xs font-medium text-amber-600">تنتهي قريباً (يومان)</span>
            <p className="mt-1 text-xl font-bold text-amber-700">{subscriptionMetrics.expiringSoon}</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm space-y-3">
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
          {/* Search text */}
          <div className="relative flex items-center lg:col-span-2">
            <SearchSm className="absolute right-3 h-4 w-4 text-slate-400" />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="بحث باسم اللاعب أو اللعبة..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-9 pl-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
            />
          </div>

          {/* Game filter */}
          <select
            value={gameFilter}
            onChange={(event) => setGameFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none"
          >
            <option value="all">كل الألعاب</option>
            {uniqueGameOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none"
          >
            <option value="all">كل الحالات</option>
            <option value="active">نشط</option>
            <option value="expired">منتهي</option>
            <option value="cancelled">ملغي</option>
          </select>

          {/* Branch filter */}
          <select
            value={branchFilter}
            onChange={(event) => setBranchFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none"
          >
            <option value="all">كل الفروع</option>
            {uniqueBranchOptions.map((name) => (
              <option key={name} value={name}>{name}</option>
            ))}
          </select>

          {/* Payment filter */}
          <select
            value={paymentFilter}
            onChange={(event) => setPaymentFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none"
          >
            <option value="all">جميع حالات الدفع</option>
            <option value="hasRemaining">عليها متبقي</option>
            <option value="fullyPaid">مسدد بالكامل</option>
          </select>
        </div>

        {/* Barcode scanner sub-bar */}
        <div className="flex items-center gap-2 pt-2 border-t border-slate-100">
          <input
            value={barcodeInput}
            onChange={(event) => setBarcodeInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleBarcodeSubmit()}
            placeholder="مسح باركود أو كود اللاعب (اضغط Enter)"
            className="flex-1 rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
          />
          <button
            type="button"
            onClick={handleBarcodeSubmit}
            className="rounded-xl bg-slate-800 px-4 py-2 text-xs font-semibold text-white transition hover:bg-slate-900"
          >
            بحث باركود
          </button>
        </div>
      </div>

      {/* ── Content View (Cards or Table) ── */}
      {viewMode === 'cards' ? (
        /* ── Compact Cards View ── */
        filteredSubscriptions.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
            لا توجد اشتراكات ممتثلة للبحث.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {filteredSubscriptions.map((sub) => {
              const remaining = getSubscriptionRemaining(sub);
              const endDate = new Date(sub.endDate);
              const isCancelled = sub.status === 'cancelled';
              const isActive = !isCancelled && endDate >= new Date() && sub.sessions > 0;
              const hasBalance = remaining > 0 && !isCancelled;
              const isExpiringSoon = !isCancelled && isActive && Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 2;

              return (
                <div
                  key={sub.id}
                  className={`group relative flex flex-col justify-between rounded-2xl border bg-white p-4 shadow-sm transition hover:shadow-md ${
                    hasBalance ? 'border-rose-200 bg-rose-50/20' : 'border-slate-200'
                  }`}
                >
                  {/* Top card header */}
                  <div>
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div>
                        <div className="flex items-center gap-1.5">
                          <h3 className="font-bold text-slate-900 text-base">{sub.player}</h3>
                          {sub.playerCode && (
                            <span className="rounded-md bg-slate-100 px-1.5 py-0.5 text-[10px] font-mono text-slate-600">
                              {sub.playerCode}
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
                          <span className="font-medium text-sky-700 bg-sky-50 px-2 py-0.5 rounded-md">
                            ⚽ {sub.game}
                          </span>
                          {sub.branch && <span className="text-slate-400">• {sub.branch}</span>}
                          {sub.invoiceNumber && <span className="text-slate-400"># {sub.invoiceNumber}</span>}
                        </div>
                      </div>

                      <span className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusBadgeStyle(sub.status)}`}>
                        {statusLabel(sub.status)}
                      </span>
                    </div>

                    {/* Schedule & Time */}
                    <div className="mt-3 grid grid-cols-2 gap-2 text-xs text-slate-600">
                      <div className="flex items-center gap-1 bg-slate-50 p-2 rounded-lg">
                        <AppIcon icon={Calendar} className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{formattedSchedule(sub)}</span>
                      </div>
                      <div className="flex items-center gap-1 bg-slate-50 p-2 rounded-lg">
                        <AppIcon icon={Clock} className="h-3.5 w-3.5 text-slate-400 flex-shrink-0" />
                        <span className="truncate">{formattedTrainingTime(sub)}</span>
                      </div>
                    </div>

                    {/* Metrics Grid */}
                    <div className="mt-3 grid grid-cols-3 gap-2 rounded-xl bg-slate-50/80 p-2.5 text-center text-xs">
                      <div>
                        <span className="text-[10px] text-slate-400 block">الحصص</span>
                        <span className="font-bold text-slate-800">{sub.sessions}</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">المدفوع</span>
                        <span className="font-bold text-emerald-600">{sub.paidAmount} ج</span>
                      </div>
                      <div>
                        <span className="text-[10px] text-slate-400 block">المتبقي</span>
                        <span className={`font-bold ${remaining > 0 ? 'text-rose-600' : 'text-slate-700'}`}>
                          {remaining} ج
                        </span>
                      </div>
                    </div>

                    {/* Dates */}
                    <div className="mt-3 flex items-center justify-between text-[11px] text-slate-400 border-t border-slate-100 pt-2">
                      <span>من: {sub.startDate || '-'}</span>
                      <span>إلى: {sub.endDate || '-'}</span>
                    </div>
                  </div>

                  {/* Actions Footer Toolbar */}
                  <div className="mt-4 flex items-center gap-1.5 border-t border-slate-100 pt-3 text-xs">
                    {canEditSubs && (
                      <button
                        type="button"
                        onClick={() => openEditSubscription(sub)}
                        disabled={isCancelled}
                        title="تعديل"
                        className="flex-1 rounded-lg border border-slate-200 py-1.5 font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-40"
                      >
                        تعديل
                      </button>
                    )}
                    {canEditSubs && remaining > 0 && !isCancelled && (
                      <button
                        type="button"
                        onClick={() => collectRemainingPayment(sub)}
                        className="flex-1 rounded-lg bg-amber-500 py-1.5 font-semibold text-slate-900 hover:bg-amber-600"
                      >
                        سداد
                      </button>
                    )}
                    {canEditSubs && (!isActive || isExpiringSoon) && !isCancelled && (
                      <button
                        type="button"
                        onClick={() => openRenewModal(sub)}
                        className="flex-1 rounded-lg bg-emerald-600 py-1.5 font-semibold text-white hover:bg-emerald-700"
                      >
                        تجديد
                      </button>
                    )}
                    {canEditSubs && !isCancelled && (
                      <button
                        type="button"
                        onClick={() => refundSubscription(sub)}
                        title="إلغاء واسترداد"
                        className="flex-1 rounded-lg bg-rose-600 py-1.5 font-semibold text-white hover:bg-rose-700"
                      >
                        إلغاء
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => showInvoice(sub)}
                      title="الفاتورة"
                      className="rounded-lg bg-slate-100 p-1.5 text-slate-600 hover:bg-slate-200"
                    >
                      <AppIcon icon={File02} className="h-4 w-4" />
                    </button>
                    <button
                      type="button"
                      onClick={() => processAndSendInvoice(sub)}
                      title="واتساب"
                      className="rounded-lg bg-emerald-100 p-1.5 text-emerald-700 hover:bg-emerald-200"
                    >
                      <AppIcon icon={MessageChatCircle} className="h-4 w-4" />
                    </button>
                    {canEditSubs && (
                      <button
                        type="button"
                        onClick={() => deleteSubscription(sub.id)}
                        title="حذف"
                        className="rounded-lg bg-slate-100 p-1.5 text-rose-600 hover:bg-rose-100"
                      >
                        <AppIcon icon={Trash01} className="h-4 w-4" />
                      </button>
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
                  <th className="px-4 py-3 font-semibold">الإيصال</th>
                  <th className="px-4 py-3 font-semibold">كود اللاعب</th>
                  <th className="px-4 py-3 font-semibold">اللاعب</th>
                  <th className="px-4 py-3 font-semibold">اللعبة</th>
                  <th className="px-4 py-3 font-semibold">أيام التدريب</th>
                  <th className="px-4 py-3 font-semibold">الحصص</th>
                  <th className="px-4 py-3 font-semibold">القيم (اشتراك / مدفوع / متبقي)</th>
                  <th className="px-4 py-3 font-semibold">المدة</th>
                  <th className="px-4 py-3 font-semibold">الحالة</th>
                  <th className="px-4 py-3 text-center font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {filteredSubscriptions.map((sub) => {
                  const remaining = getSubscriptionRemaining(sub);
                  const isCancelled = sub.status === 'cancelled';
                  return (
                    <tr key={sub.id} className="hover:bg-slate-50/70">
                      <td className="px-4 py-3 font-mono font-medium text-slate-700">{sub.invoiceNumber || '-'}</td>
                      <td className="px-4 py-3 font-mono text-slate-500">{sub.playerCode || '-'}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{sub.player}</td>
                      <td className="px-4 py-3 text-slate-700">{sub.game}</td>
                      <td className="px-4 py-3 text-slate-600">{formattedSchedule(sub)}</td>
                      <td className="px-4 py-3 font-bold text-slate-800">{sub.sessions}</td>
                      <td className="px-4 py-3">
                        <span className="text-slate-700">{sub.subscriptionValue}ج</span> /{' '}
                        <span className="text-emerald-600 font-semibold">{sub.paidAmount}ج</span> /{' '}
                        <span className={`font-semibold ${remaining > 0 ? 'text-rose-600' : 'text-slate-400'}`}>{remaining}ج</span>
                      </td>
                      <td className="px-4 py-3 text-slate-500">{sub.startDate} إلى {sub.endDate}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${statusBadgeStyle(sub.status)}`}>
                          {statusLabel(sub.status)}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1">
                          {canEditSubs && (
                            <button
                              type="button"
                              onClick={() => openEditSubscription(sub)}
                              disabled={isCancelled}
                              className="rounded-lg bg-slate-100 px-2 py-1 text-[11px] font-semibold text-slate-700 hover:bg-slate-200 disabled:opacity-40"
                            >
                              تعديل
                            </button>
                          )}
                          {canEditSubs && remaining > 0 && !isCancelled && (
                            <button
                              type="button"
                              onClick={() => collectRemainingPayment(sub)}
                              className="rounded-lg bg-amber-500 px-2 py-1 text-[11px] font-semibold text-slate-900 hover:bg-amber-600"
                            >
                              سداد
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => showInvoice(sub)}
                            className="rounded-lg bg-sky-100 px-2 py-1 text-[11px] font-semibold text-sky-700 hover:bg-sky-200"
                          >
                            فاتورة
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* ── Add / Edit Modal ── */}
      {isSubscriptionModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-xl max-h-[calc(100vh-3rem)] overflow-y-auto rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">
                  {formState.id ? 'تعديل الاشتراك' : 'إضافة اشتراك جديد'}
                </h2>
                <p className="text-xs text-slate-500">ادخل بيانات الاشتراك كاملة ثم اضغط حفظ</p>
              </div>
              <button type="button" onClick={closeSubscriptionModal} className="text-slate-400 hover:text-slate-800 text-xl font-bold">
                ×
              </button>
            </div>

            <form onSubmit={handleSubscriptionSave} className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">اللاعب</label>
                <select
                  value={formState.playerId}
                  onChange={(event) => updateForm('playerId', event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-right outline-none"
                >
                  <option value="">اختر اللاعب</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} {player.playerSerial ? `- ${player.playerSerial}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">اللعبة</label>
                <select
                  value={formState.game}
                  onChange={(event) => updateForm('game', event.target.value)}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-right outline-none"
                >
                  <option value="">اختر اللعبة</option>
                  {games.map((game) => (
                    <option key={game.id} value={game.name}>{game.name}</option>
                  ))}
                </select>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="font-semibold text-slate-700">أيام التدريب</label>
                <div className="flex flex-wrap gap-2">
                  {TRAINING_DAYS.map((day) => (
                    <label key={day} className="flex items-center gap-1.5 rounded-xl border border-slate-200 bg-slate-50 px-3 py-1.5 text-slate-700 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={formState.schedule.includes(day)}
                        onChange={() => handleTrainingDayToggle(day)}
                        className="h-3.5 w-3.5 rounded border-slate-300"
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </div>

              <div className="sm:col-span-2 space-y-1">
                <label className="font-semibold text-slate-700">توقيت التدريب (اختياري)</label>
                <div className="flex items-center gap-2">
                  <input
                    value={formState.trainingTimeStart}
                    onChange={(event) => updateForm('trainingTimeStart', event.target.value)}
                    type="time"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-right outline-none"
                  />
                  <span className="text-slate-400">إلى</span>
                  <input
                    value={formState.trainingTimeEnd}
                    onChange={(event) => updateForm('trainingTimeEnd', event.target.value)}
                    type="time"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2 text-right outline-none"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">عدد الحصص</label>
                <input
                  value={formState.sessions === 0 ? '' : formState.sessions}
                  onChange={(event) => updateForm('sessions', Math.max(0, Number(event.target.value)))}
                  type="number"
                  min={0}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-right outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">قيمة الاشتراك</label>
                <input
                  value={formState.subscriptionValue === 0 ? '' : formState.subscriptionValue}
                  onChange={(event) => updateForm('subscriptionValue', Math.max(0, Number(event.target.value)))}
                  type="number"
                  min={0}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-right outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">المبلغ المدفوع</label>
                <input
                  value={formState.paidAmount === 0 ? '' : formState.paidAmount}
                  onChange={(event) => updateForm('paidAmount', Math.max(0, Number(event.target.value)))}
                  type="number"
                  min={0}
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-right outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">تاريخ البداية</label>
                <input
                  value={formState.startDate}
                  onChange={(event) => updateForm('startDate', event.target.value)}
                  type="date"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-right outline-none"
                />
              </div>

              <div className="space-y-1">
                <label className="font-semibold text-slate-700">تاريخ الانتهاء</label>
                <input
                  value={formState.endDate}
                  onChange={(event) => updateForm('endDate', event.target.value)}
                  type="date"
                  required
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-right outline-none"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-slate-700">رقم الإيصال (اختياري)</label>
                <input
                  value={formState.invoiceNumber}
                  onChange={(event) => updateForm('invoiceNumber', event.target.value)}
                  type="text"
                  placeholder="12345"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-right outline-none"
                />
              </div>

              <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeSubscriptionModal}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="submit"
                  className="rounded-xl bg-sky-600 px-5 py-2 font-semibold text-white hover:bg-sky-700"
                >
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* ── Renew Modal ── */}
      {isRenewModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">تجديد الاشتراك</h2>
                <p className="text-xs text-slate-500">سيتم تجديد الاشتراك وأرشفة السجل السابق تلقائياً</p>
              </div>
              <button type="button" onClick={closeModals} className="text-slate-400 hover:text-slate-800 text-xl font-bold">
                ×
              </button>
            </div>
            <div className="mt-4 grid gap-3 sm:grid-cols-2 text-xs">
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">تاريخ البدء</label>
                <input
                  value={renewState.startDate}
                  onChange={(event) => setRenewState((prev) => ({ ...prev, startDate: event.target.value }))}
                  type="date"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-right outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">تاريخ الانتهاء</label>
                <input
                  value={renewState.endDate}
                  onChange={(event) => setRenewState((prev) => ({ ...prev, endDate: event.target.value }))}
                  type="date"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-right outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">عدد الحصص</label>
                <input
                  value={renewState.sessions}
                  onChange={(event) => setRenewState((prev) => ({ ...prev, sessions: Number(event.target.value) }))}
                  type="number"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-right outline-none"
                />
              </div>
              <div className="space-y-1">
                <label className="font-semibold text-slate-700">قيمة الاشتراك</label>
                <input
                  value={renewState.price}
                  onChange={(event) => setRenewState((prev) => ({ ...prev, price: Number(event.target.value) }))}
                  type="number"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-right outline-none"
                />
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="font-semibold text-slate-700">المبلغ المدفوع الآن</label>
                <input
                  value={renewState.paidAmount}
                  onChange={(event) => setRenewState((prev) => ({ ...prev, paidAmount: Number(event.target.value) }))}
                  type="number"
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 p-2.5 text-right outline-none"
                />
              </div>
              <div className="sm:col-span-2 flex justify-end gap-2 pt-3 border-t border-slate-100">
                <button
                  type="button"
                  onClick={closeModals}
                  className="rounded-xl border border-slate-200 px-4 py-2 font-semibold text-slate-700 hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={confirmRenewal}
                  className="rounded-xl bg-emerald-600 px-5 py-2 font-semibold text-white hover:bg-emerald-700"
                >
                  تأكيد التجديد
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── Invoice Modal ── */}
      {isInvoiceModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl rounded-2xl bg-white p-5 shadow-2xl">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900">معاينة الفاتورة الرقمية</h2>
                <p className="text-xs text-slate-500">طباعة، تنزيل أو مشاركة الفاتورة عبر واتساب</p>
              </div>
              <button type="button" onClick={closeModals} className="text-slate-400 hover:text-slate-800 text-xl font-bold">
                ×
              </button>
            </div>
            <div className="mt-4 text-center">
              <canvas ref={invoiceCanvasRef} width={800} height={1200} className="mx-auto max-h-[55vh] w-auto rounded-xl border border-slate-200 shadow-sm" />
            </div>
            <div className="mt-4 flex flex-wrap justify-center gap-2 border-t border-slate-100 pt-3">
              <button
                type="button"
                onClick={sendInvoiceWhatsApp}
                className="rounded-xl bg-emerald-600 px-4 py-2 text-xs font-semibold text-white hover:bg-emerald-700"
              >
                مشاركة واتساب 💬
              </button>
              <button
                type="button"
                onClick={downloadInvoiceJPG}
                className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white hover:bg-sky-700"
              >
                تنزيل صورة JPG
              </button>
              <button
                type="button"
                onClick={exportInvoicePDF}
                className="rounded-xl bg-violet-600 px-4 py-2 text-xs font-semibold text-white hover:bg-violet-700"
              >
                تنزيل PDF
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

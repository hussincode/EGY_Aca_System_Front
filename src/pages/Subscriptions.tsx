import { useEffect, useMemo, useRef, useState } from 'react';
import { jsPDF } from 'jspdf';
import QRCode from 'qrcode';
import { CreditCard01, Plus, SearchSm, Wallet01 } from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';

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

function readStorage<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const value = window.localStorage.getItem(key);
  if (!value) return fallback;
  try {
    return JSON.parse(value) as T;
  } catch {
    return fallback;
  }
}

function formatTimeTo12h(timeStr: string) {
  if (!timeStr || !timeStr.includes(':')) return timeStr;
  const [hoursText, minutes] = timeStr.split(':');
  let hours = Number(hoursText);
  const ampm = hours >= 12 ? 'مساءً' : 'صباحاً';
  hours = hours % 12;
  hours = hours || 12;
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
  const [isSubscriptionModalOpen, setIsSubscriptionModalOpen] = useState(false);
  const [isRenewModalOpen, setIsRenewModalOpen] = useState(false);
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [formState, setFormState] = useState<SubscriptionFormState>(emptyFormState);
  const [renewState, setRenewState] = useState<RenewFormState>(emptyRenewState);
  const [currentInvoice, setCurrentInvoice] = useState<SubscriptionRecord | null>(null);
  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);
  const invoiceCanvasRef = useRef<HTMLCanvasElement | null>(null);

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

        setPlayers((playersResponse.data as Player[]) || []);
        setSubscriptions((subsResponse.data as SubscriptionRecord[]) || []);
        setGames((gamesResponse.data as Game[]) || []);
        setBranches((branchesResponse.data as Branch[]) || []);

        window.localStorage.setItem('players', JSON.stringify(playersResponse.data || []));
        window.localStorage.setItem('subscriptions', JSON.stringify(subsResponse.data || []));
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
      drawField(
        'أيام التدريب',
        currentInvoice.schedule || '-',
      );
      drawField(
        'توقيت التدريب',
        currentInvoice.trainingTime || '-',
      );
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
      } catch {
        // QR code generation failed; do nothing.
      }
    };

    renderInvoice();
  }, [currentInvoice]);

  const saveToStorage = <T,>(key: string, value: T) => {
    window.localStorage.setItem(key, JSON.stringify(value));
  };

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
    return Array.from(new Set(subscriptions.map((sub) => sub.branch || '').filter((branch) => branch))).sort();
  }, [subscriptions]);

  const uniqueGameOptions = useMemo(() => {
    return Array.from(new Set(subscriptions.map((sub) => sub.game || '').filter((game) => game))).sort();
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

    const subscription: SubscriptionRecord = {
      id: formState.id || createStableId('sub'),
      playerId: selectedPlayer?.id || '',
      player: selectedPlayer?.name || '',
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
          await api.createSubscription?.(subscription);
        }
      }

      await saveSubscriptionToState(subscription, paymentDelta);

      if (selectedPlayer) {
        const nextPlayers = players.map((player) =>
          player.id === selectedPlayer.id
            ? {
                ...player,
                schedule: subscription.schedule,
                trainingTime: subscription.trainingTime,
              }
            : player,
        );
        setPlayers(nextPlayers);
        saveToStorage('players', nextPlayers);
        const api = window.api;
        if (hasSubscriptionsApi() && api?.updatePlayer) {
          await api.updatePlayer(selectedPlayer.id, {
            schedule: subscription.schedule,
            trainingTime: subscription.trainingTime,
          });
        }
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
    if (!subscriptionToDelete) {
      showToast('الاشتراك غير موجود', 'error');
      return;
    }

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

    if (amount <= 0) return;
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
        if (record.id) {
          await window.api.deleteFinance(record.id);
        }
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

    const matches = subscriptions.filter((subscription) => subscription.playerId === player.id || subscription.player === player.name);
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
      price: subscription.subscriptionValue || subscription.subscriptionValue,
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
    if (window.api?.getToken && typeof window.api.sendInvoiceNotification === 'function') {
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

  const statusClasses = (status: SubscriptionRecord['status']) => {
    if (status === 'cancelled') return 'bg-slate-100 text-slate-600 line-through';
    if (status === 'active') return 'bg-emerald-100 text-emerald-700';
    return 'bg-rose-100 text-rose-700';
  };

  return (
    <div className="space-y-6">
      {toast ? (
        <div className={`fixed right-6 top-6 z-50 rounded-3xl px-4 py-3 text-sm font-semibold shadow-xl ${
          toast.type === 'success'
            ? 'bg-emerald-600 text-white'
            : toast.type === 'error'
            ? 'bg-rose-600 text-white'
            : 'bg-sky-600 text-white'
        }`}>
          {toast.message}
        </div>
      ) : null}

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
          <div>
            <div className="flex items-center gap-3 text-slate-500">
              <AppIcon icon={CreditCard01} />
              <span className="text-sm font-semibold">إدارة الاشتراكات</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">الاشتراكات</h1>
            <p className="mt-2 text-sm text-slate-500">متابعة الاشتراكات، الدفعات، والحالة الحالية لكل لاعب من شاشة واحدة.</p>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={openAddSubscription}
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              <Plus className="h-4 w-4" />
              إضافة اشتراك
            </button>
            <button
              type="button"
              onClick={() => window.alert('Export غير مدعوم في النسخة الحالية')}
              className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700 transition hover:border-slate-300"
            >
              <AppIcon icon={Wallet01} />
              Excel
            </button>
          </div>
        </div>

        <div className="mt-8 grid gap-4 lg:grid-cols-5">
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">إجمالي الاشتراكات</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{subscriptionMetrics.total}</p>
            <p className="mt-2 text-sm text-slate-500">عدد السجلات الحالية</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">الاشتراكات النشطة</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{subscriptionMetrics.active}</p>
            <p className="mt-2 text-sm text-slate-500">بحسب تاريخ الانتهاء</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">المبالغ المحصلة</p>
            <p className="mt-4 text-3xl font-semibold text-slate-900">{subscriptionMetrics.paid.toLocaleString()} ج</p>
            <p className="mt-2 text-sm text-slate-500">إجمالي المدفوع من كل الاشتراكات</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">إجمالي الديون (المتبقي)</p>
            <p className="mt-4 text-3xl font-semibold text-rose-600">{subscriptionMetrics.debt.toLocaleString()} ج</p>
            <p className="mt-2 text-sm text-slate-500">المبالغ المتبقية غير المحصلة</p>
          </div>
          <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5">
            <p className="text-sm text-slate-500">تنتهي خلال يومين</p>
            <p className="mt-4 text-3xl font-semibold text-amber-600">{subscriptionMetrics.expiringSoon}</p>
            <p className="mt-2 text-sm text-slate-500">اشتراكات نشطة أوشكت على الانتهاء</p>
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="grid gap-3 lg:grid-cols-[1.8fr_1fr] xl:grid-cols-[2fr_1.2fr]">
          <div className="flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-600">
            <SearchSm className="h-5 w-5" />
            <input
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="بحث عن لاعب أو لعبة..."
              className="w-full bg-transparent text-right text-sm outline-none"
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <select
              value={gameFilter}
              onChange={(event) => setGameFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-right"
            >
              <option value="all">كل الألعاب</option>
              {uniqueGameOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-right"
            >
              <option value="all">كل الفروع</option>
              {uniqueBranchOptions.map((name) => (
                <option key={name} value={name}>{name}</option>
              ))}
            </select>
            <select
              value={statusFilter}
              onChange={(event) => setStatusFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-right"
            >
              <option value="all">كل الحالات</option>
              <option value="active">نشط</option>
              <option value="expired">منتهي</option>
              <option value="cancelled">ملغي</option>
            </select>
            <select
              value={paymentFilter}
              onChange={(event) => setPaymentFilter(event.target.value)}
              className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-right"
            >
              <option value="all">كل مبالغ الاشتراكات</option>
              <option value="hasRemaining">عليهم مبالغ متبقية</option>
              <option value="fullyPaid">مسدد بالكامل</option>
            </select>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <input
            value={barcodeInput}
            onChange={(event) => setBarcodeInput(event.target.value)}
            onKeyDown={(event) => event.key === 'Enter' && handleBarcodeSubmit()}
            placeholder="مسح أو إدخال باركود اللاعب"
            className="min-w-[220px] rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm outline-none"
          />
          <button
            type="button"
            onClick={handleBarcodeSubmit}
            className="rounded-2xl bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
          >
            بحث باركود
          </button>
          <button
            type="button"
            onClick={openAddSubscription}
            className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
          >
            إضافة اشتراك
          </button>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm ring-1 ring-slate-200">
        <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <p className="text-sm text-slate-500">قائمة الاشتراكات</p>
            <p className="mt-1 text-base font-semibold text-slate-900">{filteredSubscriptions.length} اشتراك</p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-slate-600">
              <tr>
                <th className="px-3 py-3 text-right">رقم الإيصال</th>
                <th className="px-3 py-3 text-right">كود اللاعب</th>
                <th className="px-3 py-3 text-right">اللاعب</th>
                <th className="px-3 py-3 text-right">اللعبة</th>
                <th className="px-3 py-3 text-right">أيام التدريب</th>
                <th className="px-3 py-3 text-right">توقيت التدريب</th>
                <th className="px-3 py-3 text-right">عدد الحصص</th>
                <th className="px-3 py-3 text-right">قيمة الاشتراك</th>
                <th className="px-3 py-3 text-right">المبلغ المدفوع</th>
                <th className="px-3 py-3 text-right">المتبقي</th>
                <th className="px-3 py-3 text-right">تاريخ البداية</th>
                <th className="px-3 py-3 text-right">تاريخ الانتهاء</th>
                <th className="px-3 py-3 text-right">الحالة</th>
                <th className="px-3 py-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredSubscriptions.length === 0 ? (
                <tr>
                  <td colSpan={14} className="px-4 py-10 text-center text-slate-500">
                    لا توجد اشتراكات حتى الآن
                  </td>
                </tr>
              ) : (
                filteredSubscriptions.map((sub) => {
                  const remaining = getSubscriptionRemaining(sub);
                  const endDate = new Date(sub.endDate);
                  const isCancelled = sub.status === 'cancelled';
                  const isActive = !isCancelled && endDate >= new Date() && sub.sessions > 0;
                  const hasBalance = remaining > 0 && !isCancelled;
                  const isExpiringSoon = !isCancelled && isActive && Math.ceil((endDate.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24)) <= 2;

                  return (
                    <tr key={sub.id} className={hasBalance ? 'bg-rose-50' : ''}>
                      <td className="px-3 py-3 font-semibold text-slate-800">{sub.invoiceNumber || '-'}</td>
                      <td className="px-3 py-3 text-slate-700">{sub.playerCode || ''}</td>
                      <td className="px-3 py-3 text-slate-900">{sub.player}</td>
                      <td className="px-3 py-3 text-slate-700">{sub.game}</td>
                      <td className="px-3 py-3 text-slate-700">{formattedSchedule(sub)}</td>
                      <td className="px-3 py-3 text-slate-700">{formattedTrainingTime(sub)}</td>
                      <td className="px-3 py-3 text-slate-700">{sub.sessions}</td>
                      <td className="px-3 py-3 text-slate-700">{sub.subscriptionValue}</td>
                      <td className="px-3 py-3 text-slate-700">{sub.paidAmount || 0}</td>
                      <td className="px-3 py-3 text-slate-700">{remaining}</td>
                      <td className="px-3 py-3 text-slate-700">{sub.startDate}</td>
                      <td className="px-3 py-3 text-slate-700">{sub.endDate}</td>
                      <td className="px-3 py-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${statusClasses(sub.status)}`}>
                          {statusLabel(sub.status)}
                        </span>
                      </td>
                      <td className="px-3 py-3">
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() => openEditSubscription(sub)}
                            disabled={isCancelled}
                            className="rounded-2xl bg-violet-600 px-2 py-2 text-xs font-semibold text-white transition hover:bg-violet-700 disabled:cursor-not-allowed disabled:opacity-50"
                          >
                            تعديل
                          </button>
                          {remaining > 0 ? (
                            <button
                              type="button"
                              onClick={() => collectRemainingPayment(sub)}
                              className="rounded-2xl bg-amber-500 px-2 py-2 text-xs font-semibold text-slate-900 transition hover:bg-amber-600"
                            >
                              سداد
                            </button>
                          ) : (
                            <div />
                          )}
                          {(!isActive || isExpiringSoon) && !isCancelled ? (
                            <button
                              type="button"
                              onClick={() => openRenewModal(sub)}
                              className="rounded-2xl bg-emerald-600 px-2 py-2 text-xs font-semibold text-white transition hover:bg-emerald-700"
                            >
                              تجديد
                            </button>
                          ) : (
                            <div />
                          )}
                          {!isCancelled ? (
                            <button
                              type="button"
                              onClick={() => refundSubscription(sub)}
                              className="rounded-2xl bg-rose-600 px-2 py-2 text-xs font-semibold text-white transition hover:bg-rose-700"
                            >
                              إلغاء
                            </button>
                          ) : (
                            <div />
                          )}
                          <button
                            type="button"
                            onClick={() => deleteSubscription(sub.id)}
                            className="rounded-2xl bg-slate-700 px-2 py-2 text-xs font-semibold text-white transition hover:bg-slate-800"
                          >
                            حذف
                          </button>
                          <button
                            type="button"
                            onClick={() => showInvoice(sub)}
                            className="rounded-2xl bg-sky-600 px-2 py-2 text-xs font-semibold text-white transition hover:bg-sky-700"
                          >
                            فاتورة
                          </button>
                          <button
                            type="button"
                            onClick={() => processAndSendInvoice(sub)}
                            className="rounded-2xl bg-emerald-500 px-2 py-2 text-xs font-semibold text-slate-900 transition hover:bg-emerald-600"
                          >
                            واتساب
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {isSubscriptionModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl max-h-[calc(100vh-4rem)] overflow-y-auto rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">
                  {formState.id ? 'تعديل الاشتراك' : 'إضافة اشتراك'}
                </h2>
                <p className="mt-2 text-sm text-slate-500">املأ بيانات الاشتراك واضغط حفظ.</p>
              </div>
              <button type="button" onClick={closeSubscriptionModal} className="text-slate-500 transition hover:text-slate-900">
                ×
              </button>
            </div>
            <form onSubmit={handleSubscriptionSave} className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">اللاعب</label>
                <select
                  value={formState.playerId}
                  onChange={(event) => updateForm('playerId', event.target.value)}
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm"
                >
                  <option value="">اختر اللاعب</option>
                  {players.map((player) => (
                    <option key={player.id} value={player.id}>
                      {player.name} {player.playerSerial ? `- ${player.playerSerial}` : ''}
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">اللعبة</label>
                <select
                  value={formState.game}
                  onChange={(event) => updateForm('game', event.target.value)}
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm"
                >
                  <option value="">اختر اللعبة</option>
                  {games.map((game) => (
                    <option key={game.id} value={game.name}>{game.name}</option>
                  ))}
                </select>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-slate-700">أيام التدريب</label>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                  {TRAINING_DAYS.map((day) => (
                    <label key={day} className="flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700">
                      <input
                        type="checkbox"
                        checked={formState.schedule.includes(day)}
                        onChange={() => handleTrainingDayToggle(day)}
                        className="h-4 w-4 rounded border-slate-300"
                      />
                      {day}
                    </label>
                  ))}
                </div>
              </div>

              <div className="lg:col-span-2">
                <label className="block text-sm font-semibold text-slate-700">توقيت التدريب (اختياري)</label>
                <div className="flex flex-col gap-3 sm:flex-row">
                  <input
                    value={formState.trainingTimeStart}
                    onChange={(event) => updateForm('trainingTimeStart', event.target.value)}
                    type="time"
                    title="من"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm"
                  />
                  <span className="flex items-center justify-center text-sm text-slate-500">إلى</span>
                  <input
                    value={formState.trainingTimeEnd}
                    onChange={(event) => updateForm('trainingTimeEnd', event.target.value)}
                    type="time"
                    title="إلى"
                    className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm"
                  />
                </div>
              </div>

              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">عدد الحصص</label>
                <input
                  value={formState.sessions}
                  onChange={(event) => updateForm('sessions', Number(event.target.value))}
                  type="number"
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm"
                />
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">قيمة الاشتراك</label>
                <input
                  value={formState.subscriptionValue}
                  onChange={(event) => updateForm('subscriptionValue', Number(event.target.value))}
                  type="number"
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm"
                />
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">المبلغ المدفوع</label>
                <input
                  value={formState.paidAmount}
                  onChange={(event) => updateForm('paidAmount', Number(event.target.value))}
                  type="number"
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm"
                />
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">تاريخ البداية</label>
                <input
                  value={formState.startDate}
                  onChange={(event) => updateForm('startDate', event.target.value)}
                  type="date"
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm"
                />
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">تاريخ الانتهاء</label>
                <input
                  value={formState.endDate}
                  onChange={(event) => updateForm('endDate', event.target.value)}
                  type="date"
                  required
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm"
                />
              </div>
              <div className="space-y-3 lg:col-span-2">
                <label className="block text-sm font-semibold text-slate-700">رقم الإيصال (يدوي)</label>
                <input
                  value={formState.invoiceNumber}
                  onChange={(event) => updateForm('invoiceNumber', event.target.value)}
                  type="text"
                  placeholder="مثلاً: 12345"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm"
                />
              </div>

              <div className="lg:col-span-2 flex flex-wrap gap-3">
                <button type="button" onClick={closeSubscriptionModal} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  إلغاء
                </button>
                <button type="submit" className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700">
                  حفظ
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {isRenewModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">تجديد الاشتراك وأرشفة القديم</h2>
                <p className="mt-2 text-sm text-slate-500">حدد البيانات الجديدة للتجديد.</p>
              </div>
              <button type="button" onClick={closeModals} className="text-slate-500 transition hover:text-slate-900">
                ×
              </button>
            </div>
            <div className="mt-6 grid gap-4 lg:grid-cols-2">
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">تاريخ البدء الجديد</label>
                <input
                  value={renewState.startDate}
                  onChange={(event) => setRenewState((prev) => ({ ...prev, startDate: event.target.value }))}
                  type="date"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm"
                />
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">تاريخ الانتهاء الجديد</label>
                <input
                  value={renewState.endDate}
                  onChange={(event) => setRenewState((prev) => ({ ...prev, endDate: event.target.value }))}
                  type="date"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm"
                />
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">عدد الحصص</label>
                <input
                  value={renewState.sessions}
                  onChange={(event) => setRenewState((prev) => ({ ...prev, sessions: Number(event.target.value) }))}
                  type="number"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm"
                />
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">قيمة الاشتراك الجديد</label>
                <input
                  value={renewState.price}
                  onChange={(event) => setRenewState((prev) => ({ ...prev, price: Number(event.target.value) }))}
                  type="number"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm"
                />
              </div>
              <div className="space-y-3">
                <label className="block text-sm font-semibold text-slate-700">المبلغ المدفوع الآن</label>
                <input
                  value={renewState.paidAmount}
                  onChange={(event) => setRenewState((prev) => ({ ...prev, paidAmount: Number(event.target.value) }))}
                  type="number"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm"
                />
              </div>
              <div className="space-y-3 lg:col-span-2">
                <label className="block text-sm font-semibold text-slate-700">رقم إيصال التجديد</label>
                <input
                  value={renewState.invoiceNumber}
                  onChange={(event) => setRenewState((prev) => ({ ...prev, invoiceNumber: event.target.value }))}
                  type="text"
                  placeholder="رقم إيصال السداد الجديد"
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm"
                />
              </div>
              <div className="lg:col-span-2 flex flex-wrap gap-3">
                <button type="button" onClick={closeModals} className="rounded-2xl border border-slate-200 px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50">
                  إلغاء
                </button>
                <button type="button" onClick={confirmRenewal} className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700">
                  تأكيد التجديد
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isInvoiceModalOpen ? (
        <div className="fixed inset-0 z-40 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-3xl rounded-3xl bg-white p-6 shadow-2xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-2xl font-semibold text-slate-900">فاتورة الاشتراك</h2>
                <p className="mt-2 text-sm text-slate-500">اعرض الفاتورة أو قم بتنزيلها أو إرسالها عبر واتساب.</p>
              </div>
              <button type="button" onClick={closeModals} className="text-slate-500 transition hover:text-slate-900">
                ×
              </button>
            </div>
            <div className="mt-6 text-center">
              <canvas ref={invoiceCanvasRef} width={800} height={1200} className="mx-auto max-w-full rounded-3xl border border-slate-200" />
            </div>
            <div className="mt-6 flex flex-wrap justify-center gap-3">
              <button
                type="button"
                onClick={sendInvoiceWhatsApp}
                className="rounded-2xl bg-emerald-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
              >
                واتساب
              </button>
              <button
                type="button"
                onClick={downloadInvoiceJPG}
                className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                حفظ JPG
              </button>
              <button
                type="button"
                onClick={exportInvoicePDF}
                className="rounded-2xl bg-violet-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-violet-700"
              >
                تحميل PDF
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

import { useEffect, useMemo, useRef, useState } from 'react';
import { Bell03, SearchSm, Phone01, CalendarCheck01, Gift02 } from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';

type SubscriptionPlan = 'monthly' | '3months' | '6months';

type PlayerSubscription = {
  plan: SubscriptionPlan;
  value: number;
  status: 'active' | 'cancelled' | 'expired';
};

type Player = {
  id: string;
  name: string;
  age?: number;
  phone?: string;
  game?: string;
  branch?: string;
  status?: 'paid' | 'due';
  ambId?: string;
  photo?: string;
  schedule?: string;
  memberType?: 'none' | 'annual' | 'federation';
  memberId?: string;
  memberExpiry?: string;
  memberValue?: number;
  subscription?: PlayerSubscription;
  playerSerial?: string;
  playerBarcodeValue?: string;
  joined?: boolean;
  joinDate?: string;
};

type Branch = { id: string; name: string };
type Game = { id: string; name: string };
type TrainingSchedule = { id: string; branch?: string | { id: string }; sport?: string | { id: string }; day?: string; startTime?: string; endTime?: string };
type AttendanceRecord = { id: string; playerId: string; status: 'present' | 'absent' | string; date: string };
type SubscriptionRecord = { id: string; playerId?: string; player?: string; status?: string; sessions?: number; endDate?: string };

type PlayerFormState = {
  name: string;
  age?: number;
  phone: string;
  game: string;
  branch: string;
  schedule: string;
  status: 'paid' | 'due';
  ambId: string;
  memberType: 'none' | 'annual' | 'federation';
  memberId: string;
  memberExpiry: string;
  memberValue: number;
  subscriptionPlan: SubscriptionPlan;
  subscriptionValue: number;
  photo: string;
  playerSerial: string;
  playerBarcodeValue: string;
};

const initialFormState: PlayerFormState = {
  name: '',
  age: undefined,
  phone: '',
  game: '',
  branch: '',
  schedule: '',
  status: 'due',
  ambId: '',
  memberType: 'none',
  memberId: '',
  memberExpiry: '',
  memberValue: 0,
  subscriptionPlan: 'monthly',
  subscriptionValue: 0,
  photo: '',
  playerSerial: '',
  playerBarcodeValue: '',
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

function formatPlayerSerial(sequence: number) {
  return `PLY-${String(sequence).padStart(6, '0')}`;
}

function formatPlayerBarcodeValue(sequence: number) {
  return `EGY${String(sequence).padStart(6, '0')}`;
}

export default function Players() {
  const [players, setPlayers] = useState<Player[]>(() => readStoredData('players', []));
  const [branches, setBranches] = useState<Branch[]>(() => readStoredData('branches', []));
  const [games, setGames] = useState<Game[]>(() => readStoredData('games', []));
  const [schedules, setSchedules] = useState<TrainingSchedule[]>(() => readStoredData('trainingSchedules', []));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => readStoredData('attendanceRecords', []));
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>(() => readStoredData('subscriptions', []));
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [gameFilter, setGameFilter] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState('');
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [isCameraModalOpen, setIsCameraModalOpen] = useState(false);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [formState, setFormState] = useState<PlayerFormState>(initialFormState);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [videoFacingMode, setVideoFacingMode] = useState<'environment' | 'user'>('environment');
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    window.localStorage.setItem('players', JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    window.localStorage.setItem('branches', JSON.stringify(branches));
  }, [branches]);

  useEffect(() => {
    window.localStorage.setItem('games', JSON.stringify(games));
  }, [games]);

  useEffect(() => {
    window.localStorage.setItem('trainingSchedules', JSON.stringify(schedules));
  }, [schedules]);

  useEffect(() => {
    window.localStorage.setItem('attendanceRecords', JSON.stringify(attendance));
  }, [attendance]);

  useEffect(() => {
    window.localStorage.setItem('subscriptions', JSON.stringify(subscriptions));
  }, [subscriptions]);

  useEffect(() => {
    const sync = () => {
      setPlayers(readStoredData('players', []));
      setBranches(readStoredData('branches', []));
      setGames(readStoredData('games', []));
      setSchedules(readStoredData('trainingSchedules', []));
      setAttendance(readStoredData('attendanceRecords', []));
      setSubscriptions(readStoredData('subscriptions', []));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = window.setTimeout(() => setToastMessage(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  const activeSubscriptionPlayerSet = useMemo(() => {
    const set = new Set<string>();
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    subscriptions.forEach((sub) => {
      const endDate = sub.endDate ? new Date(sub.endDate) : null;
      const hasSessions = Number(sub.sessions || 0) > 0;
      const isNotExpired = endDate ? endDate >= today : false;
      const isCancelled = sub.status === 'cancelled';

      if (!isCancelled && hasSessions && isNotExpired) {
        if (sub.playerId) set.add(String(sub.playerId));
        if (sub.player) set.add(String(sub.player));
      }
    });

    return set;
  }, [subscriptions]);

  const filteredPlayers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return players.filter((player) => {
      const matchesSearch =
        !search ||
        player.name.toLowerCase().includes(search) ||
        String(player.phone || '').includes(search);
      const matchesBranch = !branchFilter || player.branch === branchFilter;
      const matchesGame = !gameFilter || player.game === gameFilter;
      const hasActiveSub = activeSubscriptionPlayerSet.has(String(player.id)) || activeSubscriptionPlayerSet.has(player.name);
      const matchesSub = subStatusFilter === 'no-sub' ? !hasActiveSub : true;
      return matchesSearch && matchesBranch && matchesGame && matchesSub;
    });
  }, [players, searchTerm, branchFilter, gameFilter, subStatusFilter, activeSubscriptionPlayerSet]);

  const getUsedSequences = (items: Player[]) => {
    const set = new Set<number>();
    items.forEach((item) => {
      const match = item.playerSerial?.match(/^PLY-(\d{6})$/);
      if (match) set.add(Number(match[1]));
    });
    return set;
  };

  const getNextAvailableSequence = (items: Player[]) => {
    const used = getUsedSequences(items);
    for (let i = 1; i <= 3000; i += 1) {
      if (!used.has(i)) return i;
    }
    return 1;
  };

  const ensurePlayerIdentity = (player: Player) => {
    const normalized = { ...player };
    const existingSequence = normalized.playerSerial?.match(/^PLY-(\d{6})$/)?.[1];
    const sequence = existingSequence ? Number(existingSequence) : getNextAvailableSequence(players);
    normalized.playerSerial = formatPlayerSerial(sequence);
    normalized.playerBarcodeValue = normalized.playerBarcodeValue || formatPlayerBarcodeValue(sequence);
    if (!normalized.memberId && normalized.memberType && normalized.memberType !== 'none') {
      normalized.memberId = normalized.playerSerial;
    }
    return normalized;
  };

  const handleOpenPlayerModal = (player?: Player) => {
    if (player) {
      setCurrentPlayerId(player.id);
      setFormState({
        name: player.name,
        age: player.age,
        phone: player.phone || '',
        game: player.game || '',
        branch: player.branch || '',
        schedule: player.schedule || '',
        status: player.status || 'due',
        ambId: player.ambId || '',
        memberType: player.memberType || 'none',
        memberId: player.memberId || '',
        memberExpiry: player.memberExpiry || '',
        memberValue: player.memberValue || 0,
        subscriptionPlan: player.subscription?.plan || 'monthly',
        subscriptionValue: player.subscription?.value || 0,
        photo: player.photo || '',
        playerSerial: player.playerSerial || '',
        playerBarcodeValue: player.playerBarcodeValue || '',
      });
    } else {
      setCurrentPlayerId(null);
      setFormState(initialFormState);
    }
    setFormError(null);
    setIsPlayerModalOpen(true);
  };

  const handleClosePlayerModal = () => {
    setIsPlayerModalOpen(false);
    setCurrentPlayerId(null);
    setFormState(initialFormState);
    setFormError(null);
  };

  const handleSavePlayer = () => {
    if (!formState.name.trim()) {
      setFormError('أدخل اسم اللاعب');
      return;
    }
    if (!formState.game.trim()) {
      setFormError('اختر اللعبة');
      return;
    }

    setFormError(null);

    const playerPayload: Player = {
      id: currentPlayerId || Date.now().toString(),
      name: formState.name.trim(),
      age: formState.age,
      phone: formState.phone.trim(),
      game: formState.game,
      branch: formState.branch,
      schedule: formState.schedule,
      status: formState.status,
      ambId: formState.ambId.trim(),
      memberType: formState.memberType,
      memberId: formState.memberId.trim(),
      memberExpiry: formState.memberExpiry,
      memberValue: formState.memberValue,
      subscription: {
        plan: formState.subscriptionPlan,
        value: formState.subscriptionValue,
        status: 'active',
      },
      photo: formState.photo,
      playerSerial: formState.playerSerial,
      playerBarcodeValue: formState.playerBarcodeValue,
      joined: true,
      joinDate: new Date().toLocaleDateString('ar-EG'),
    };

    const normalized = ensurePlayerIdentity(playerPayload);

    if (currentPlayerId) {
      setPlayers((prev) => prev.map((player) => (player.id === currentPlayerId ? normalized : player)));
    } else {
      setPlayers((prev) => [...prev, normalized]);
    }

    setToastMessage('تم حفظ اللاعب بنجاح');
    handleClosePlayerModal();
  };

  const handleDeletePlayer = (playerId?: string) => {
    const idToDelete = playerId || currentPlayerId;
    if (!idToDelete) return;
    if (!window.confirm('هل تريد حذف هذا اللاعب؟')) return;
    setPlayers((prev) => prev.filter((player) => player.id !== idToDelete));
    setToastMessage('تم حذف اللاعب');
    if (!playerId) handleClosePlayerModal();
  };

  const handlePhotoChange = (file?: File) => {
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      setFormState((prev) => ({ ...prev, photo: String(reader.result || '') }));
    };
    reader.readAsDataURL(file);
  };

  const handleOpenCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: videoFacingMode }, audio: false });
      cameraStreamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setIsCameraModalOpen(true);
    } catch {
      setToastMessage('لا يمكن فتح الكاميرا');
    }
  };

  const handleCloseCamera = () => {
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }
    setIsCameraModalOpen(false);
  };

  const takeSnapshot = () => {
    if (!videoRef.current) return;
    const video = videoRef.current;
    const canvas = canvasRef.current || document.createElement('canvas');
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    if (videoFacingMode === 'user') {
      ctx.translate(canvas.width, 0);
      ctx.scale(-1, 1);
    }
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.8);
    setFormState((prev) => ({ ...prev, photo: dataUrl }));
    handleCloseCamera();
    setToastMessage('تم التقاط الصورة');
  };

  const toggleCameraFacing = () => {
    setVideoFacingMode((prev) => (prev === 'environment' ? 'user' : 'environment'));
  };

  const assignCodesToExistingPlayers = () => {
    const needsCodes = players.filter((player) => !player.playerSerial || !player.playerSerial.startsWith('PLY-'));
    if (!needsCodes.length) {
      setToastMessage('كل اللاعبين لديهم أكواد بالفعل');
      return;
    }
    const updated = players.map((player) => ensurePlayerIdentity(player));
    setPlayers(updated);
    setToastMessage(`تم توليد أكواد ${needsCodes.length} لاعب`);
  };

  const branchStats = useMemo(() => {
    const monthKey = new Date().toISOString().slice(0, 7);
    const result: Record<string, Array<{ name: string; photo?: string; rate: number }>> = {};
    players.forEach((player) => {
      const branch = player.branch || 'الفرع الرئيسي';
      const logs = attendance.filter((record) => record.playerId === player.id && record.date.startsWith(monthKey));
      const present = logs.filter((record) => record.status === 'present').length;
      const total = logs.filter((record) => record.status === 'present' || record.status === 'absent').length;
      const rate = total > 0 ? Math.round((present / total) * 100) : 0;
      if (total > 0) {
        if (!result[branch]) result[branch] = [];
        result[branch].push({ name: player.name, photo: player.photo, rate });
      }
    });
    return result;
  }, [attendance, players]);

  const topCommitment = useMemo(() => {
    return Object.entries(branchStats).map(([branch, list]) => ({
      branch,
      players: [...list].sort((a, b) => b.rate - a.rate).slice(0, 3),
    }));
  }, [branchStats]);

  const handleSendBulkWhatsApp = () => {
    const targets = filteredPlayers.filter((player) => player.phone?.trim());
    if (!targets.length) {
      setToastMessage('لا يوجد لاعبين بأرقام هاتف صالحة');
      return;
    }
    const message = window.prompt(`رسالة سيتم إرسالها لـ ${targets.length} لاعبين:`) || '';
    if (!message) return;
    targets.forEach((player) => {
      const cleanPhone = String(player.phone).replace(/\D/g, '');
      const phone = cleanPhone.startsWith('01') ? `2${cleanPhone}` : cleanPhone;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
      setTimeout(() => {}, 300);
    });
  };

  const handleSendReminder = () => {
    const targets = filteredPlayers.filter((player) => player.phone?.trim());
    if (!targets.length) {
      setToastMessage('لا يوجد لاعبين لإرسال التذكير لهم');
      return;
    }
    const defaultMsg = `👋 أهلاً بيك 👋\n\nمفتقدينك في التمرين...\n📲 01094967738`;
    const message = window.prompt(`رسالة التذكير لـ ${targets.length} لاعب:`, defaultMsg) || '';
    if (!message) return;
    targets.forEach((player) => {
      const cleanPhone = String(player.phone).replace(/\D/g, '');
      const phone = cleanPhone.startsWith('01') ? `2${cleanPhone}` : cleanPhone;
      window.open(`https://wa.me/${phone}?text=${encodeURIComponent(message)}`, '_blank');
    });
  };

  const handleExportPlayers = () => {
    const csv = [`الاسم,العمر,رقم الهاتف,اللعبة,الفرع,الحالة المالية`];
    filteredPlayers.forEach((player) => {
      csv.push(`${player.name},${player.age || ''},${player.phone || ''},${player.game || ''},${player.branch || ''},${player.status || ''}`);
    });
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'players.csv';
    link.click();
    URL.revokeObjectURL(url);
  };

  const headRow = (
    <tr>
      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">الصورة</th>
      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">الاسم</th>
      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">العمر</th>
      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">رقم الهاتف</th>
      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">اللعبة</th>
      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">الفرع</th>
      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">الحالة المالية</th>
      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">نسبة الحضور</th>
      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">السفير</th>
      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">النقاط</th>
      <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-slate-500">المكافآت</th>
      <th className="px-4 py-3 text-center text-xs font-semibold uppercase tracking-wide text-slate-500">الإجراءات</th>
    </tr>
  );

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
        <div className="flex flex-col gap-6 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <div className="flex items-center gap-3 text-slate-500">
              <AppIcon icon={Bell03} className="text-slate-500" />
              <span className="text-sm">إدارة اللاعبين</span>
            </div>
            <h1 className="mt-3 text-3xl font-semibold text-slate-900">قائمة اللاعبين</h1>
            <p className="mt-2 text-sm text-slate-600">تحكم في بيانات اللاعبين، الاشتراكات، والحضور من هنا.</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <AppIcon icon={Gift02} className="text-white" />
              تقرير الالتزام
            </button>
            <button
              type="button"
              onClick={() => handleOpenPlayerModal()}
              className="inline-flex items-center gap-2 rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              <span className="text-lg">+</span>
              إضافة لاعب
            </button>
          </div>
        </div>
      </div>

      {toastMessage ? (
        <div className="rounded-3xl bg-slate-900 px-4 py-3 text-sm text-white">{toastMessage}</div>
      ) : null}

      <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
        <div className="grid gap-4 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr]">
            <div className="flex items-center gap-3 rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3">
              <AppIcon icon={SearchSm} className="text-slate-500" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="بحث بالاسم أو الهاتف..."
                className="w-full border-none bg-transparent text-sm text-slate-900 outline-none placeholder:text-slate-400"
              />
            </div>

            <select
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
              className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800"
            >
              <option value="">كل الفروع</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.name}> {branch.name}</option>
              ))}
            </select>

            <select
              value={gameFilter}
              onChange={(event) => setGameFilter(event.target.value)}
              className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800"
            >
              <option value="">كل الألعاب</option>
              {games.map((game) => (
                <option key={game.id} value={game.name}>{game.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center gap-3 justify-end">
            <select
              value={subStatusFilter}
              onChange={(event) => setSubStatusFilter(event.target.value)}
              className="rounded-3xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-800"
            >
              <option value="">كل اللاعبين</option>
              <option value="no-sub">بدون اشتراك نشط</option>
            </select>
            <button
              type="button"
              onClick={() => {
                const removedCount = players.filter((player) => !player.branch || !player.branch.trim()).length;
                setPlayers((prev) => prev.filter((player) => Boolean(player.branch && player.branch.trim())));
                setToastMessage(removedCount > 0 ? `تم حذف ${removedCount} لاعب بدون فرع` : 'لا يوجد لاعبين بدون فرع');
              }}
              className="rounded-3xl border border-rose-300 bg-rose-50 px-4 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-100"
            >
              حذف لاعبين بدون فرع
            </button>
            <button
              type="button"
              onClick={assignCodesToExistingPlayers}
              className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              توليد أكواد اللاعبين
            </button>
            <button
              type="button"
              onClick={handleExportPlayers}
              className="rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-700 transition hover:bg-slate-100"
            >
              Excel
            </button>
            <button
              type="button"
              onClick={handleSendBulkWhatsApp}
              className="rounded-3xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
            >
              <AppIcon icon={Phone01} className="text-white" />
              رسالة جماعية
            </button>
            {subStatusFilter === 'no-sub' ? (
              <button
                type="button"
                onClick={handleSendReminder}
                className="rounded-3xl bg-amber-500 px-4 py-3 text-sm font-semibold text-white transition hover:bg-amber-600"
              >
                <AppIcon icon={Bell03} className="text-white" />
                تذكير بالاشتراك
              </button>
            ) : null}
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-lg font-semibold text-slate-900">قائمة اللاعبين</h2>
          <span className="rounded-full bg-slate-100 px-3 py-2 text-sm font-semibold text-slate-700">{filteredPlayers.length} لاعب</span>
        </div>
        <div className="mt-6 overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">{headRow}</thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredPlayers.length === 0 ? (
                <tr>
                  <td colSpan={12} className="px-6 py-10 text-center text-slate-500">لا توجد لاعبين حتى الآن</td>
                </tr>
              ) : (
                filteredPlayers.map((player) => {
                  const attendanceForPlayer = attendance.filter((record) => record.playerId === player.id);
                  const presentCount = attendanceForPlayer.filter((record) => record.status === 'present').length;
                  const totalMarked = attendanceForPlayer.filter((record) => ['present', 'absent'].includes(record.status)).length;
                  const rate = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;
                  return (
                    <tr key={player.id} className="hover:bg-slate-50">
                      <td className="px-4 py-4 text-right">
                        <img src={player.photo || '/logo.jpg'} alt={player.name} className="h-10 w-10 rounded-full object-cover" />
                      </td>
                      <td className="px-4 py-4 text-right font-semibold text-slate-900">{player.name}</td>
                      <td className="px-4 py-4 text-right">{player.age ?? '-'}</td>
                      <td className="px-4 py-4 text-right">{player.phone || '-'}</td>
                      <td className="px-4 py-4 text-right">{player.game || '-'}</td>
                      <td className="px-4 py-4 text-right">{player.branch || '-'}</td>
                      <td className="px-4 py-4 text-right">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${player.status === 'paid' ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'}`}>
                          {player.status === 'paid' ? 'مسدد' : 'مديون'}
                        </span>
                      </td>
                      <td className="px-4 py-4 text-right">
                        <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-2 ${rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${rate}%` }} />
                        </div>
                        <div className="mt-1 text-xs text-slate-500">{rate}%</div>
                      </td>
                      <td className="px-4 py-4 text-right">{player.ambId || '-'}</td>
                      <td className="px-4 py-4 text-right">{player.ambId ? 0 : 0}</td>
                      <td className="px-4 py-4 text-right">-</td>
                      <td className="px-4 py-4 text-center">
                        <div className="inline-flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleOpenPlayerModal(player)}
                            className="rounded-2xl bg-slate-100 px-3 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-200"
                          >
                            تعديل
                          </button>
                          <button
                            type="button"
                            onClick={() => handleDeletePlayer(player.id)}
                            className="rounded-2xl bg-rose-100 px-3 py-2 text-xs font-semibold text-rose-700 transition hover:bg-rose-200"
                          >
                            حذف
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

      {isPlayerModalOpen ? (
        <div className="fixed inset-0 z-50 grid place-items-center bg-slate-950/75 p-4">
          <div className="flex max-h-[95vh] w-full max-w-5xl flex-col overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-slate-900">{currentPlayerId ? 'تعديل بيانات اللاعب' : 'إضافة لاعب'}</h2>
              <button type="button" onClick={handleClosePlayerModal} className="text-slate-500 transition hover:text-slate-900">×</button>
            </div>
            <div className="overflow-y-auto p-6">
              {formError ? (
                <div className="mb-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm font-medium text-rose-700">
                  {formError}
                </div>
              ) : null}
              <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
                <div className="space-y-4 pr-1">
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                      الاسم
                      <input
                        type="text"
                        value={formState.name}
                        onChange={(event) => {
                          setFormState((prev) => ({ ...prev, name: event.target.value }));
                          if (formError) setFormError(null);
                        }}
                        placeholder="مثلاً: أحمد محمد"
                        className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                      />
                    </label>
                    <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                      العمر
                      <input
                        type="number"
                        value={formState.age ?? ''}
                        onChange={(event) => setFormState((prev) => ({ ...prev, age: event.target.value ? Number(event.target.value) : undefined }))}
                        className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                      />
                    </label>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                      رقم الهاتف
                      <input
                        type="tel"
                        value={formState.phone}
                        onChange={(event) => setFormState((prev) => ({ ...prev, phone: event.target.value }))}
                        placeholder="مثلاً: 01012345678"
                        className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                      />
                    </label>
                    <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                      اللعبة
                      <select
                        value={formState.game}
                        onChange={(event) => {
                          setFormState((prev) => ({ ...prev, game: event.target.value }));
                          if (formError) setFormError(null);
                        }}
                        className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                      >
                        <option value="">-- اختر لعبة --</option>
                        {games.map((game) => (
                          <option key={game.id} value={game.name}>{game.name}</option>
                        ))}
                      </select>
                    </label>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                        الفرع
                        <select
                          value={formState.branch}
                          onChange={(event) => setFormState((prev) => ({ ...prev, branch: event.target.value }))}
                          className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-right text-sm text-slate-900 outline-none"
                        >
                          <option value="">-- اختر فرع --</option>
                          {branches.map((branch) => (
                            <option key={branch.id} value={branch.name}>{branch.name}</option>
                          ))}
                        </select>
                      </label>
                      <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                        مواعيد التدريب
                        <input
                          value={formState.schedule}
                          onChange={(event) => setFormState((prev) => ({ ...prev, schedule: event.target.value }))}
                          placeholder="مثلاً: السبت والثلاثاء 4 عصراً"
                          className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-right text-sm text-slate-900 outline-none"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                      الحالة المالية
                      <select
                        value={formState.status}
                        onChange={(event) => setFormState((prev) => ({ ...prev, status: event.target.value as 'paid' | 'due' }))}
                        className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                      >
                        <option value="paid">مسدد</option>
                        <option value="due">مديون</option>
                      </select>
                    </label>
                    <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                      رمز السفير
                      <input
                        value={formState.ambId}
                        onChange={(event) => setFormState((prev) => ({ ...prev, ambId: event.target.value }))}
                        placeholder="REF1234"
                        className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                      />
                    </label>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="mb-4 flex items-center gap-3">
                      <AppIcon icon={CalendarCheck01} className="text-slate-500" />
                      <h3 className="font-semibold text-slate-900">بيانات العضوية</h3>
                    </div>
                    <div className="grid gap-4 md:grid-cols-2">
                      <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                        نوع العضوية
                        <select
                          value={formState.memberType}
                          onChange={(event) => setFormState((prev) => ({ ...prev, memberType: event.target.value as PlayerFormState['memberType'] }))}
                          className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-right text-sm text-slate-900 outline-none"
                        >
                          <option value="none">بدون عضوية</option>
                          <option value="annual">عضوية سنوية (أكاديمية)</option>
                          <option value="federation">عضوية اتحاد (لاعب مسجل)</option>
                        </select>
                      </label>
                      <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                        رقم العضوية/الاتحاد
                        <input
                          value={formState.memberId}
                          onChange={(event) => setFormState((prev) => ({ ...prev, memberId: event.target.value }))}
                          placeholder="رقم العضوية أو الاتحاد"
                          className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-right text-sm text-slate-900 outline-none"
                        />
                      </label>
                      <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                        تاريخ انتهاء العضوية
                        <input
                          type="date"
                          value={formState.memberExpiry}
                          onChange={(event) => setFormState((prev) => ({ ...prev, memberExpiry: event.target.value }))}
                          className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-right text-sm text-slate-900 outline-none"
                        />
                      </label>
                      <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                        قيمة العضوية السنوية
                        <input
                          type="number"
                          value={formState.memberValue}
                          onChange={(event) => setFormState((prev) => ({ ...prev, memberValue: Number(event.target.value) }))}
                          className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-right text-sm text-slate-900 outline-none"
                          placeholder="0"
                        />
                      </label>
                    </div>
                  </div>
                  <div className="grid gap-4 md:grid-cols-2">
                    <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                      نوع الاشتراك
                      <select
                        value={formState.subscriptionPlan}
                        onChange={(event) => setFormState((prev) => ({ ...prev, subscriptionPlan: event.target.value as SubscriptionPlan }))}
                        className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                      >
                        <option value="monthly">شهري</option>
                        <option value="3months">3 أشهر</option>
                        <option value="6months">6 أشهر</option>
                      </select>
                    </label>
                    <label className="space-y-2 text-right text-sm font-medium text-slate-700">
                      قيمة الاشتراك (EGP)
                      <input
                        type="number"
                        value={formState.subscriptionValue}
                        onChange={(event) => setFormState((prev) => ({ ...prev, subscriptionValue: Number(event.target.value) }))}
                        className="w-full rounded-3xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-900 outline-none"
                        placeholder="100"
                      />
                    </label>
                  </div>
                </div>
                <div className="space-y-6">
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4 text-center">
                    <img
                      src={formState.photo || '/logo.jpg'}
                      alt="صورة اللاعب"
                      className="mx-auto h-24 w-24 rounded-full object-cover"
                    />
                    <div className="mt-4 flex items-center justify-center gap-3">
                      <label className="inline-flex cursor-pointer items-center justify-center rounded-full bg-slate-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800">
                        رفع صورة
                        <input
                          type="file"
                          accept="image/*"
                          className="hidden"
                          onChange={(event) => handlePhotoChange(event.target.files?.[0] ?? undefined)}
                        />
                      </label>
                      <button
                        type="button"
                        onClick={handleOpenCamera}
                        className="inline-flex items-center justify-center rounded-full bg-emerald-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-emerald-700"
                      >
                        الكاميرا
                      </button>
                    </div>
                  </div>
                  <div className="rounded-3xl border border-slate-200 bg-slate-50 p-4">
                    <div className="space-y-2 text-right text-sm font-medium text-slate-700">
                      <label>الرقم التسلسلي</label>
                      <input value={formState.playerSerial} readOnly className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-right text-sm text-slate-900 outline-none" />
                    </div>
                    <div className="space-y-2 text-right text-sm font-medium text-slate-700 mt-4">
                      <label>قيمة الباركود</label>
                      <input value={formState.playerBarcodeValue} readOnly className="w-full rounded-3xl border border-slate-200 bg-white px-4 py-3 text-right text-sm text-slate-900 outline-none" />
                    </div>
                  </div>
                </div>
              </div>
            </div>
            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button
                type="button"
                onClick={() => handleDeletePlayer()}
                className="rounded-2xl bg-rose-100 px-5 py-3 text-sm font-semibold text-rose-700 transition hover:bg-rose-200"
              >
                حذف
              </button>
              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={handleClosePlayerModal}
                  className="rounded-2xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSavePlayer}
                  className="rounded-2xl bg-sky-600 px-5 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                  حفظ
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {isReportModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4">
          <div className="w-full max-w-3xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <div>
                <h2 className="text-xl font-semibold text-slate-900">اللاعبين الأكثر التزاماً</h2>
                <p className="text-sm text-slate-500">أعلى ثلاث لاعبين لكل فرع حسب نسبة الحضور.</p>
              </div>
              <button type="button" onClick={() => setIsReportModalOpen(false)} className="text-slate-500 transition hover:text-slate-900">×</button>
            </div>
            <div className="space-y-4 p-6">
              {topCommitment.length === 0 ? (
                <div className="rounded-3xl border border-slate-200 bg-slate-50 p-6 text-center text-slate-500">لا توجد سجلات حضور مسجلة لهذا الشهر.</div>
              ) : (
                topCommitment.map((branchData) => (
                  <div key={branchData.branch} className="rounded-3xl border border-slate-200 p-5">
                    <div className="mb-4 flex items-center gap-3 text-slate-700">
                      <AppIcon icon={Gift02} className="text-emerald-600" />
                      <h3 className="font-semibold">فرع: {branchData.branch}</h3>
                    </div>
                    <div className="space-y-3">
                      {branchData.players.map((player, index) => (
                        <div key={player.name} className="flex items-center justify-between rounded-3xl bg-slate-50 p-4">
                          <div className="flex items-center gap-3">
                            <div className={`inline-flex h-10 w-10 items-center justify-center rounded-full ${index === 0 ? 'bg-amber-400' : 'bg-slate-200'}`}>
                              {index === 0 ? '👑' : index + 1}
                            </div>
                            <div>
                              <p className="font-semibold text-slate-900">{player.name}</p>
                              <p className="text-sm text-slate-500">نسبة الحضور: {player.rate}%</p>
                            </div>
                          </div>
                          <span className="text-sm font-semibold text-emerald-700">{player.rate}%</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      ) : null}

      {isCameraModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-slate-900">التقاط صورة اللاعب</h2>
              <button type="button" onClick={handleCloseCamera} className="text-slate-500 transition hover:text-slate-900">×</button>
            </div>
            <div className="p-6">
              <div className="rounded-3xl bg-slate-950 p-4">
                <video ref={videoRef} className="h-[320px] w-full rounded-3xl object-cover" autoPlay muted playsInline />
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={toggleCameraFacing}
                  className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-semibold text-slate-700 transition hover:bg-slate-100"
                >
                  تبديل الكاميرا
                </button>
                <button
                  type="button"
                  onClick={takeSnapshot}
                  className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
                >
                  التقاط الصورة
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
}

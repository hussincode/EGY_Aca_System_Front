import { useEffect, useMemo, useRef, useState } from 'react';
import {
  CalendarCheck01,
  Plus,
  SearchSm,
  Calendar,
  Clock,
  Trash01,
  User01,
} from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';
import Pagination from '@/components/Pagination';
import { useAuth } from '@/contexts/AuthContext';

/* ── Types ──────────────────────────────────────────────────── */
type AttendanceRecord = {
  id: string;
  player_id: string;
  subscription_id?: string;
  date: string;
  status: 'present' | 'absent' | 'late';
  player_name?: string;
  subscription_schedule?: string;
  notes?: string;
  phone?: string;
};

type Player = {
  id: string;
  name: string;
  phone?: string;
  schedule?: string;
  game?: string;
  branch?: string;
  playerSerial?: string;
  playerBarcodeValue?: string;
};

type SubscriptionRecord = {
  id: string;
  playerId?: string;
  player?: string;
  schedule?: string;
  game?: string;
  branch?: string;
  status?: string;
  phone?: string;
  sessions?: number;
};

type DisplayItem = {
  id: string;
  player_id: string;
  player_name: string;
  phone?: string;
  game?: string;
  branch?: string;
  schedule?: string;
  date: string;
  status: 'present' | 'absent' | 'late' | 'unrecorded';
  notes?: string;
  isRecorded: boolean;
  recordId?: string;
};

const ATTENDANCE_KEY = 'attendanceRecords';
const PLAYERS_KEY = 'players';
const SUBSCRIPTIONS_KEY = 'subscriptions';

const DAYS_OF_WEEK_AR = ['الأحد', 'الاثنين', 'الثلاثاء', 'الأربعاء', 'الخميس', 'الجمعة', 'السبت'];

const TRAINING_DAYS = [
  'السبت',
  'الأحد',
  'الاثنين',
  'الثلاثاء',
  'الأربعاء',
  'الخميس',
  'الجمعة',
];

/* ── Helpers ────────────────────────────────────────────────── */
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

function saveToStorage<T>(key: string, data: T) {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(key, JSON.stringify(data));
}

function getTodayString(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getArabicDayOfWeek(dateStr: string): string {
  if (!dateStr) return '';
  const date = new Date(dateStr + 'T00:00:00');
  if (isNaN(date.getTime())) return '';
  return DAYS_OF_WEEK_AR[date.getDay()];
}

function matchesDay(scheduleStr: string | undefined | null, targetDayName: string): boolean {
  if (!scheduleStr || !targetDayName) return false;
  const s = scheduleStr.toLowerCase();

  if (targetDayName === 'السبت') return s.includes('سبت') || s.includes('sat');
  if (targetDayName === 'الأحد' || targetDayName === 'الاحد') return s.includes('أحد') || s.includes('احد') || s.includes('sun');
  if (targetDayName === 'الاثنين' || targetDayName === 'الإثنين') return s.includes('اثنين') || s.includes('إثنين') || s.includes('mon');
  if (targetDayName === 'الثلاثاء') return s.includes('ثلاثاء') || s.includes('tue');
  if (targetDayName === 'الأربعاء' || targetDayName === 'الاربعاء') return s.includes('أربعاء') || s.includes('اربعاء') || s.includes('wed');
  if (targetDayName === 'الخميس') return s.includes('خميس') || s.includes('thu');
  if (targetDayName === 'الجمعة') return s.includes('جمعة') || s.includes('fri');

  return s.includes(targetDayName.toLowerCase());
}

function normalizeAttendanceFromDb(row: Record<string, unknown> | null | undefined): AttendanceRecord | null {
  if (!row) return null;
  return {
    id: String(row.id || ''),
    player_id: String(row.player_id || ''),
    subscription_id: String(row.subscription_id || '') || undefined,
    date: String(row.date || getTodayString()),
    status: (row.status as AttendanceRecord['status']) || 'present',
    player_name: String(row.player_name || ''),
    subscription_schedule: String(row.subscription_schedule || '') || undefined,
    notes: String(row.notes || '') || undefined,
    phone: String(row.phone || '') || undefined,
  };
}

const statusLabel = (status: DisplayItem['status']) => {
  if (status === 'present') return 'حاضر';
  if (status === 'absent') return 'غائب';
  if (status === 'late') return 'متأخر';
  return 'لم يُسجل';
};

const statusBadgeStyle = (status: DisplayItem['status']) => {
  if (status === 'present') return 'bg-emerald-50 text-emerald-700 border-emerald-200';
  if (status === 'absent') return 'bg-rose-50 text-rose-700 border-rose-200';
  if (status === 'late') return 'bg-amber-50 text-amber-700 border-amber-200';
  return 'bg-slate-100 text-slate-500 border-slate-200 border-dashed';
};

export default function Attendance() {
  const { canEdit } = useAuth();
  const canEditAttendance = canEdit('attendance');

  const todayStr = useMemo(() => getTodayString(), []);
  const todayDayName = useMemo(() => getArabicDayOfWeek(todayStr), [todayStr]);

  const [records, setRecords] = useState<AttendanceRecord[]>(() => readStorage(ATTENDANCE_KEY, []));
  const [players, setPlayers] = useState<Player[]>(() => readStorage(PLAYERS_KEY, []));
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>(() => readStorage(SUBSCRIPTIONS_KEY, []));

  const [searchText, setSearchText] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [dateFilter, setDateFilter] = useState(todayStr);
  const [dayFilter, setDayFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [formState, setFormState] = useState({
    player_id: '',
    player_name: '',
    status: 'present' as AttendanceRecord['status'],
    date: todayStr,
    notes: '',
  });

  const [toast, setToast] = useState<{ type: 'success' | 'error' | 'info'; message: string } | null>(null);

  // QR Code Scanner States
  const [isScannerModalOpen, setIsScannerModalOpen] = useState(false);
  const [scannedCodeInput, setScannedCodeInput] = useState('');
  const [isCameraActive, setIsCameraActive] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Load from API on mount
  useEffect(() => {
    const loadData = async () => {
      const api = window.api;

      // Load Players for lookup
      if (api?.getPlayers && api?.getToken?.()) {
        try {
          const res = (await api.getPlayers()) as { data?: Player[] };
          if (Array.isArray(res?.data) && res.data.length > 0) {
            setPlayers(res.data);
            saveToStorage(PLAYERS_KEY, res.data);
          }
        } catch (err) {
          console.error('Failed to load players for attendance', err);
        }
      }

      // Load Subscriptions for schedules lookup
      if (api?.getSubscriptions && api?.getToken?.()) {
        try {
          const res = (await api.getSubscriptions()) as { data?: SubscriptionRecord[] };
          if (Array.isArray(res?.data) && res.data.length > 0) {
            setSubscriptions(res.data);
            saveToStorage(SUBSCRIPTIONS_KEY, res.data);
          }
        } catch (err) {
          console.error('Failed to load subscriptions for attendance', err);
        }
      }

      // Load Attendance Records
      if (!api?.getAttendance || !api?.getToken?.()) {
        setRecords(readStorage(ATTENDANCE_KEY, []));
        return;
      }

      try {
        const response = (await api.getAttendance()) as { data?: unknown[] };
        const serverRecords = Array.isArray(response?.data) ? response.data : [];
        const mapped = serverRecords
          .map((item) => normalizeAttendanceFromDb(item as Record<string, unknown>))
          .filter((item): item is AttendanceRecord => Boolean(item && item.id));

        if (mapped.length > 0) {
          const localRecords = readStorage<AttendanceRecord[]>(ATTENDANCE_KEY, []);
          const merged = [
            ...mapped,
            ...localRecords.filter((local) => !mapped.some((server) => server.id === local.id)),
          ];
          setRecords(merged);
          saveToStorage(ATTENDANCE_KEY, merged);
        }
      } catch (error) {
        console.error('Failed to load attendance from API', error);
        setRecords(readStorage(ATTENDANCE_KEY, []));
      }
    };

    loadData();
  }, []);

  // Sync to localStorage
  useEffect(() => {
    saveToStorage(ATTENDANCE_KEY, records);
  }, [records]);

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'environment' } });
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
        setIsCameraActive(true);
      }
    } catch {
      showToast('تعذر فتح الكاميرا. يرجى استخدام القارئ أو كتابة الكود', 'info');
    }
  };

  const stopCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
      const stream = videoRef.current.srcObject as MediaStream;
      stream.getTracks().forEach((track) => track.stop());
      videoRef.current.srcObject = null;
    }
    setIsCameraActive(false);
  };

  useEffect(() => {
    return () => {
      stopCamera();
    };
  }, []);

  const showToast = (message: string, type: 'success' | 'error' | 'info' = 'success') => {
    setToast({ message, type });
  };

  // Helper to get player's scheduled days string
  const getPlayerScheduleStr = (player: Player) => {
    if (player.schedule) return player.schedule;
    const playerSubs = subscriptions.filter(
      (s) => s.playerId === player.id || s.player === player.name || (player.phone && s.phone === player.phone)
    );
    const subSchedules = playerSubs.map((s) => s.schedule).filter(Boolean);
    return subSchedules.join(', ');
  };

  const isPlayerScheduledOnDay = (player: Player, targetDay: string) => {
    if (!targetDay) return true;
    const sch = getPlayerScheduleStr(player);
    return matchesDay(sch, targetDay);
  };

  // Build full list of players scheduled for the selected day / date + existing records
  const displayItems = useMemo(() => {
    const targetDate = dateFilter === 'all' ? todayStr : dateFilter;
    const targetDay = dayFilter !== 'all' ? dayFilter : (dateFilter !== 'all' ? getArabicDayOfWeek(targetDate) : '');

    const itemsMap = new Map<string, DisplayItem>();

    if (dateFilter !== 'all') {
      // 1. Add all players who have sessions on targetDay
      players.forEach((player) => {
        const isScheduled = targetDay ? isPlayerScheduledOnDay(player, targetDay) : true;
        if (isScheduled) {
          const sch = getPlayerScheduleStr(player);
          const existingRecord = records.find((r) => r.player_id === player.id && r.date === targetDate);
          itemsMap.set(player.id, {
            id: existingRecord ? existingRecord.id : `pending_${player.id}_${targetDate}`,
            player_id: player.id,
            player_name: player.name,
            phone: player.phone,
            game: player.game,
            branch: player.branch,
            schedule: sch,
            date: targetDate,
            status: existingRecord ? existingRecord.status : 'unrecorded',
            notes: existingRecord?.notes,
            isRecorded: Boolean(existingRecord),
            recordId: existingRecord?.id,
          });
        }
      });

      // 2. Also include any recorded entry on targetDate even if player isn't in main players list or scheduled
      records
        .filter((r) => r.date === targetDate)
        .forEach((rec) => {
          if (!itemsMap.has(rec.player_id)) {
            const matchedPlayer = players.find((p) => p.id === rec.player_id);
            itemsMap.set(rec.player_id, {
              id: rec.id,
              player_id: rec.player_id,
              player_name: rec.player_name || matchedPlayer?.name || rec.player_id,
              phone: rec.phone || matchedPlayer?.phone,
              game: matchedPlayer?.game,
              branch: matchedPlayer?.branch,
              schedule: rec.subscription_schedule || (matchedPlayer ? getPlayerScheduleStr(matchedPlayer) : ''),
              date: rec.date,
              status: rec.status,
              notes: rec.notes,
              isRecorded: true,
              recordId: rec.id,
            });
          }
        });
    } else {
      // dateFilter === 'all'
      records.forEach((rec) => {
        const matchedPlayer = players.find((p) => p.id === rec.player_id);
        const sch = rec.subscription_schedule || (matchedPlayer ? getPlayerScheduleStr(matchedPlayer) : '');

        if (dayFilter !== 'all' && !matchesDay(sch, dayFilter)) {
          return;
        }

        itemsMap.set(rec.id, {
          id: rec.id,
          player_id: rec.player_id,
          player_name: rec.player_name || matchedPlayer?.name || rec.player_id,
          phone: rec.phone || matchedPlayer?.phone,
          game: matchedPlayer?.game,
          branch: matchedPlayer?.branch,
          schedule: sch,
          date: rec.date,
          status: rec.status,
          notes: rec.notes,
          isRecorded: true,
          recordId: rec.id,
        });
      });

      // Also include today's scheduled players who haven't been recorded yet
      const todayDay = dayFilter !== 'all' ? dayFilter : todayDayName;
      players.forEach((player) => {
        const isScheduled = todayDay ? isPlayerScheduledOnDay(player, todayDay) : true;
        if (isScheduled) {
          const hasRecordToday = records.some((r) => r.player_id === player.id && r.date === todayStr);
          if (!hasRecordToday) {
            const sch = getPlayerScheduleStr(player);
            itemsMap.set(`pending_${player.id}_${todayStr}`, {
              id: `pending_${player.id}_${todayStr}`,
              player_id: player.id,
              player_name: player.name,
              phone: player.phone,
              game: player.game,
              branch: player.branch,
              schedule: sch,
              date: todayStr,
              status: 'unrecorded',
              isRecorded: false,
            });
          }
        }
      });
    }

    return Array.from(itemsMap.values());
  }, [records, players, subscriptions, dateFilter, dayFilter, todayStr, todayDayName]);

  // Filtered display items based on search and status filter
  const filteredItems = useMemo(() => {
    return displayItems.filter((item) => {
      const search = searchText.trim().toLowerCase();
      const matchesSearch =
        !search ||
        item.player_name.toLowerCase().includes(search) ||
        (item.phone || '').toLowerCase().includes(search) ||
        (item.notes || '').toLowerCase().includes(search) ||
        (item.schedule || '').toLowerCase().includes(search) ||
        item.date.includes(search);

      const matchesStatus = statusFilter === 'all' || item.status === statusFilter;

      return matchesSearch && matchesStatus;
    });
  }, [displayItems, searchText, statusFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchText, statusFilter, dateFilter, dayFilter]);

  const totalPages = Math.ceil(filteredItems.length / rowsPerPage) || 1;
  const paginatedItems = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredItems.slice(start, start + rowsPerPage);
  }, [filteredItems, currentPage]);

  // Statistics Metrics
  const totalItems = displayItems.length;
  const presentCount = displayItems.filter((r) => r.status === 'present').length;
  const absentCount = displayItems.filter((r) => r.status === 'absent').length;
  const lateCount = displayItems.filter((r) => r.status === 'late').length;
  const unrecordedCount = displayItems.filter((r) => r.status === 'unrecorded').length;
  const totalRecorded = presentCount + absentCount + lateCount;
  const attendanceRate = totalRecorded > 0 ? Math.round((presentCount / totalRecorded) * 100) : 0;

  // Unique dates for filter
  const availableDates = useMemo(() => {
    const datesSet = new Set([todayStr, ...records.map((r) => r.date)]);
    return Array.from(datesSet).sort().reverse();
  }, [records, todayStr]);

  const openAddModal = () => {
    const firstPlayer = players[0];
    setFormState({
      player_id: firstPlayer?.id || '',
      player_name: firstPlayer?.name || '',
      status: 'present',
      date: dateFilter === 'all' ? todayStr : dateFilter,
      notes: '',
    });
    setIsModalOpen(true);
  };

  const handleSelectPlayerInForm = (playerId: string) => {
    const matched = players.find((p) => p.id === playerId);
    setFormState((prev) => ({
      ...prev,
      player_id: playerId,
      player_name: matched ? matched.name : prev.player_name,
    }));
  };

  const handleSaveAttendance = async () => {
    if (!formState.player_id && !formState.player_name.trim()) {
      showToast('يرجى اختيار أو كتابة اسم اللاعب', 'error');
      return;
    }

    const matchedPlayer = players.find((p) => p.id === formState.player_id);
    const displayName = matchedPlayer ? matchedPlayer.name : formState.player_name || formState.player_id;

    const newRecord: AttendanceRecord = {
      id: `att_${Date.now()}`,
      player_id: formState.player_id || `custom_${Date.now()}`,
      player_name: displayName,
      phone: matchedPlayer?.phone,
      status: formState.status,
      date: formState.date,
      notes: formState.notes.trim() || undefined,
    };

    const api = window.api;
    if (api?.createAttendance && api?.getToken?.()) {
      try {
        const response = (await api.createAttendance({
          player_id: newRecord.player_id,
          status: formState.status,
          date: formState.date,
        })) as { data?: { id?: string } };
        if (response?.data?.id) {
          newRecord.id = String(response.data.id);
        }
      } catch (error) {
        console.error('Failed to save attendance to API', error);
      }
    }

    setRecords((prev) => {
      const next = [newRecord, ...prev];
      saveToStorage(ATTENDANCE_KEY, next);
      return next;
    });

    setIsModalOpen(false);
    showToast('تم تسجيل الحضور بنجاح', 'success');
  };

  /* ── QR Code Processing Engine ────────────────────────── */
  const processScanCode = (scannedValue: string) => {
    if (!scannedValue || !scannedValue.trim()) return;

    const raw = scannedValue.trim();
    let subId = '';
    let playerId = '';
    let playerSerial = raw;

    if (raw.startsWith('{') && raw.endsWith('}')) {
      try {
        const obj = JSON.parse(raw);
        subId = obj.subId || '';
        playerId = obj.playerId || '';
        playerSerial = obj.code || obj.playerSerial || playerSerial;
      } catch {}
    } else if (raw.startsWith('SUB:')) {
      const parts = raw.split(':');
      subId = parts[1] || '';
      playerId = parts[2] || '';
      if (parts[3]) playerSerial = parts[3];
    }

    let matchedSub = subscriptions.find(
      (s) => s.id === subId || (playerId && s.playerId === playerId)
    );

    let matchedPlayer = players.find(
      (p) =>
        (playerId && p.id === playerId) ||
        (matchedSub && (p.id === matchedSub.playerId || p.name === matchedSub.player)) ||
        p.playerSerial === playerSerial ||
        p.playerBarcodeValue === playerSerial ||
        p.id === playerSerial
    );

    if (!matchedSub && matchedPlayer) {
      matchedSub = subscriptions.find(
        (s) => (s.playerId === matchedPlayer.id || s.player === matchedPlayer.name) && s.status !== 'cancelled'
      );
    }

    if (!matchedPlayer && !matchedSub) {
      showToast(`لم يتم العثور على أي لاعب أو اشتراك بهذا الـ QR Code (${playerSerial})`, 'error');
      return;
    }

    const playerName = matchedPlayer?.name || matchedSub?.player || 'اللاعب';
    const targetPlayerId = matchedPlayer?.id || matchedSub?.playerId || `custom_${Date.now()}`;
    const totalSessions = Number(matchedSub?.sessions || 0);

    // RULE 1: Session Limit Check ("لو عنده تلات ايام لازم اسكان ال qr code تلات مرات بس")
    if (matchedSub && totalSessions > 0) {
      const currentAttendedCount = records.filter(
        (r) =>
          (r.subscription_id === matchedSub.id || r.player_id === targetPlayerId) &&
          (r.status === 'present' || r.status === 'late')
      ).length;

      if (currentAttendedCount >= totalSessions) {
        showToast(
          `⛔ استوفى اللاعب ${playerName} كامل حصص هذا الاشتراك (${currentAttendedCount} من ${totalSessions} حصص). لا يمكن تسجيل حضور إضافي!`,
          'error'
        );
        return;
      }
    }

    // RULE 2: Scheduled Day Check ("لو عنده يوم الحد و جي في يوم تاني غيره يسال الي بيعمل scan: ده مش اليوم المحدد هل ترغب ان تسجله اليوم")
    const scheduledDaysStr = matchedSub?.schedule || (matchedPlayer ? getPlayerScheduleStr(matchedPlayer) : '');
    const isTodayScheduled = scheduledDaysStr ? matchesDay(scheduledDaysStr, todayDayName) : true;

    if (scheduledDaysStr && !isTodayScheduled) {
      const confirmChoice = window.confirm(
        `⚠️ تمرين اللاعب (${playerName}) ليس محدد اليوم (${todayDayName}).\nالأيام المحددة للاعب: (${scheduledDaysStr})\n\nده مش اليوم المحدد هل ترغب ان تسجله اليوم؟`
      );
      if (!confirmChoice) {
        showToast(`تم التراجع عن تسجيل حضور ${playerName}`, 'info');
        return;
      }
    }

    const existingRecordToday = records.find(
      (r) => r.player_id === targetPlayerId && r.date === todayStr
    );

    if (existingRecordToday && existingRecordToday.status === 'present') {
      showToast(`ℹ️ اللاعب ${playerName} مسجل حضور بالفعل اليوم!`, 'info');
      return;
    }

    const newRecord: AttendanceRecord = {
      id: existingRecordToday?.id || `att_${Date.now()}`,
      player_id: targetPlayerId,
      subscription_id: matchedSub?.id,
      player_name: playerName,
      phone: matchedPlayer?.phone,
      subscription_schedule: scheduledDaysStr,
      status: 'present',
      date: todayStr,
      notes: 'تم التسجيل عن طريق QR Code 📷',
    };

    if (window.api?.createAttendance && window.api?.getToken?.()) {
      void window.api.createAttendance({
        player_id: newRecord.player_id,
        status: 'present',
        date: todayStr,
        subscription_id: matchedSub?.id,
      });
    }

    setRecords((prev) => {
      const next = [newRecord, ...prev.filter((r) => !(r.player_id === targetPlayerId && r.date === todayStr))];
      saveToStorage(ATTENDANCE_KEY, next);
      return next;
    });

    const attendedSoFar = records.filter(r => (r.subscription_id === matchedSub?.id || r.player_id === targetPlayerId) && (r.status === 'present' || r.status === 'late')).length + 1;
    const sessionBadge = totalSessions > 0 ? ` (حصة ${attendedSoFar} من ${totalSessions})` : '';

    showToast(`✅ تم تسجيل حضور ${playerName} بنجاح!${sessionBadge}`, 'success');
    setScannedCodeInput('');
  };

  /* ── Automatic Absence Engine ─────────────────────────── */
  const handleAutoAbsenceUnrecorded = () => {
    const targetDate = dateFilter === 'all' ? todayStr : dateFilter;
    const unrecordedItems = displayItems.filter((item) => item.status === 'unrecorded');

    if (unrecordedItems.length === 0) {
      showToast('لا يوجد لاعبين متبقيين بدون تسجيل لهذا اليوم', 'info');
      return;
    }

    if (
      !window.confirm(
        `هل تريد تسجيل غياب تلقائي لجميع اللاعبين المتبقين بدون تسجيل (${unrecordedItems.length} لاعب) بتاريخ ${targetDate}؟`
      )
    ) {
      return;
    }

    const newAbsenceRecords: AttendanceRecord[] = unrecordedItems.map((item) => ({
      id: `att_absent_${item.player_id}_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      player_id: item.player_id,
      player_name: item.player_name,
      phone: item.phone,
      subscription_schedule: item.schedule,
      status: 'absent',
      date: targetDate,
      notes: 'تسجيل غياب تلقائي عند انتهاء اليوم',
    }));

    if (window.api?.createAttendance && window.api?.getToken?.()) {
      newAbsenceRecords.forEach((rec) => {
        void window.api.createAttendance({
          player_id: rec.player_id,
          status: 'absent',
          date: rec.date,
        });
      });
    }

    setRecords((prev) => {
      const next = [...newAbsenceRecords, ...prev];
      saveToStorage(ATTENDANCE_KEY, next);
      return next;
    });

    showToast(`تم تسجيل غياب تلقائي لـ ${unrecordedItems.length} لاعب بنجاح 📋`, 'success');
  };

  const handleSetStatus = async (item: DisplayItem, newStatus: AttendanceRecord['status']) => {
    if (!canEditAttendance) return;

    if (item.isRecorded && item.recordId) {
      if (item.status === newStatus) return;

      const api = window.api;
      if (api?.updateAttendance && api?.getToken?.()) {
        try {
          await api.updateAttendance(item.recordId, { status: newStatus });
        } catch (error) {
          console.error('Failed to update status on API', error);
        }
      }

      setRecords((prev) =>
        prev.map((rec) => (rec.id === item.recordId ? { ...rec, status: newStatus } : rec))
      );
      showToast(`تم تعديل حالة ${item.player_name} إلى: ${statusLabel(newStatus)}`, 'success');
    } else {
      // Create record for unrecorded item
      const newRecord: AttendanceRecord = {
        id: `att_${Date.now()}_${Math.floor(Math.random() * 1000)}`,
        player_id: item.player_id,
        player_name: item.player_name,
        phone: item.phone,
        subscription_schedule: item.schedule,
        status: newStatus,
        date: item.date,
      };

      const api = window.api;
      if (api?.createAttendance && api?.getToken?.()) {
        try {
          const response = (await api.createAttendance({
            player_id: item.player_id,
            status: newStatus,
            date: item.date,
          })) as { data?: { id?: string } };
          if (response?.data?.id) {
            newRecord.id = String(response.data.id);
          }
        } catch (error) {
          console.error('Failed to save attendance to API', error);
        }
      }

      setRecords((prev) => {
        const next = [newRecord, ...prev];
        saveToStorage(ATTENDANCE_KEY, next);
        return next;
      });

      showToast(`تم تسجيل ${item.player_name} (${statusLabel(newStatus)}) بنجاح`, 'success');
    }
  };

  const handleDeleteAttendance = async (recordId?: string) => {
    if (!recordId) return;
    if (!window.confirm('هل تريد إلغاء تسجيل هذا السجل؟')) return;

    const api = window.api;
    if (api?.deleteAttendance && api?.getToken?.()) {
      try {
        await api.deleteAttendance(recordId);
      } catch (error) {
        console.error('Failed to delete attendance from API', error);
      }
    }

    setRecords((prev) => {
      const next = prev.filter((record) => record.id !== recordId);
      saveToStorage(ATTENDANCE_KEY, next);
      return next;
    });
    showToast('تم إلغاء التسجيل بنجاح', 'success');
  };

  const currentActiveDayName =
    dayFilter !== 'all'
      ? dayFilter
      : dateFilter !== 'all'
      ? getArabicDayOfWeek(dateFilter)
      : todayDayName;

  return (
    <div dir="rtl" className="space-y-5 font-sans">
      {/* Toast Notification */}
      {toast ? (
        <div
          className={`fixed right-6 top-6 z-50 rounded-2xl px-4 py-3 text-sm font-semibold shadow-xl transition-all ${
            toast.type === 'success'
              ? 'bg-emerald-600 text-white'
              : toast.type === 'error'
              ? 'bg-rose-600 text-white'
              : 'bg-sky-600 text-white'
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
              <AppIcon icon={CalendarCheck01} className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">إدارة الحضور والغياب</h1>
              <p className="text-xs text-slate-500">
                جدول حصص اليوم:{' '}
                <span className="font-bold text-sky-700 underline">
                  يوم {currentActiveDayName} ({dateFilter === 'all' ? 'جميع التواريخ' : dateFilter})
                </span>
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {canEditAttendance && (
              <>
                <button
                  type="button"
                  onClick={() => setIsScannerModalOpen(true)}
                  className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-emerald-700"
                >
                  <span>📷</span>
                  مسح QR Code للحضور
                </button>
                <button
                  type="button"
                  onClick={handleAutoAbsenceUnrecorded}
                  className="inline-flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-3.5 py-2.5 text-xs font-bold text-rose-700 transition hover:bg-rose-100"
                >
                  <span>⚠️</span>
                  تسجيل غياب تلقائي للمتبقين ({unrecordedCount})
                </button>
                <button
                  type="button"
                  onClick={openAddModal}
                  className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
                >
                  <Plus className="h-4 w-4" />
                  تسجيل حضور يدوي
                </button>
              </>
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

        {/* Stat Cards Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-right">
            <span className="text-xs font-medium text-slate-500">إجمالي اللاعبين المقرّرين</span>
            <p className="mt-1 text-xl font-bold text-slate-900">{totalItems}</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-right">
            <span className="text-xs font-medium text-emerald-600">حاضر</span>
            <p className="mt-1 text-xl font-bold text-emerald-700">{presentCount}</p>
          </div>
          <div className="rounded-xl border border-rose-100 bg-rose-50/50 p-3 text-right">
            <span className="text-xs font-medium text-rose-600">غائب</span>
            <p className="mt-1 text-xl font-bold text-rose-600">{absentCount}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-right">
            <span className="text-xs font-medium text-amber-600">متأخر</span>
            <p className="mt-1 text-xl font-bold text-amber-700">{lateCount}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-slate-100/60 p-3 text-right">
            <span className="text-xs font-medium text-slate-500">لم يُسجل بعد</span>
            <p className="mt-1 text-xl font-bold text-slate-700">{unrecordedCount}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-right sm:col-span-1">
            <span className="text-xs font-medium text-sky-600">نسبة الحضور</span>
            <p className="mt-1 text-xl font-bold text-sky-700">{attendanceRate}%</p>
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
              placeholder="بحث باسم اللاعب، الهاتف، أيام التمرين..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-9 pl-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
            />
          </div>

          {/* Date filter */}
          <select
            value={dateFilter}
            onChange={(event) => {
              setDateFilter(event.target.value);
            }}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-sky-500"
          >
            <option value={todayStr}>
              اليوم ({todayDayName} - {todayStr})
            </option>
            <option value="all">جميع التواريخ</option>
            {availableDates
              .filter((d) => d !== todayStr)
              .map((d) => (
                <option key={d} value={d}>
                  {getArabicDayOfWeek(d)} ({d})
                </option>
              ))}
          </select>

          {/* Day of Week filter */}
          <select
            value={dayFilter}
            onChange={(event) => setDayFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-sky-500"
          >
            <option value="all">كل الأيام</option>
            {TRAINING_DAYS.map((day) => (
              <option key={day} value={day}>
                يوم {day}
              </option>
            ))}
          </select>

          {/* Status filter */}
          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none focus:border-sky-500"
          >
            <option value="all">كل الحالات ({totalItems})</option>
            <option value="present">حاضر ({presentCount})</option>
            <option value="absent">غائب ({absentCount})</option>
            <option value="late">متأخر ({lateCount})</option>
            <option value="unrecorded">لم يُسجل ({unrecordedCount})</option>
          </select>
        </div>
      </div>

      {/* ── Content View (Cards or Table) ── */}
      {viewMode === 'cards' ? (
        /* ── Compact Cards View ── */
        paginatedItems.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
            لا يوجد لاعبين لديهم حصص في هذا اليوم أو ينطبق عليهم البحث.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedItems.map((item) => {
              return (
                <div
                  key={item.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div>
                    {/* Top Card Header */}
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-2.5">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-sky-100 text-sky-800 font-bold text-xs">
                          {item.player_name.charAt(0) || 'ل'}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">{item.player_name}</h3>
                          {item.phone ? <p className="text-[11px] text-slate-400">{item.phone}</p> : null}
                        </div>
                      </div>

                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-xs font-bold ${statusBadgeStyle(
                          item.status
                        )}`}
                      >
                        {statusLabel(item.status)}
                      </span>
                    </div>

                    {/* Info Section */}
                    <div className="mt-3 space-y-2 text-xs text-slate-600">
                      <div className="flex items-center justify-between bg-slate-50 p-2 rounded-lg">
                        <span className="text-slate-500">التاريخ:</span>
                        <div className="flex items-center gap-1 font-mono font-medium text-slate-800">
                          <AppIcon icon={Clock} className="h-3.5 w-3.5 text-slate-400" />
                          <span>
                            {getArabicDayOfWeek(item.date)} ({item.date})
                          </span>
                        </div>
                      </div>

                      {item.schedule ? (
                        <div className="bg-sky-50/50 p-2 rounded-lg text-sky-800 text-[11px]">
                          <span className="font-bold text-sky-900">أيام التمرين: </span>
                          <span>{item.schedule}</span>
                        </div>
                      ) : null}

                      {item.notes ? (
                        <div className="bg-slate-50 p-2 rounded-lg text-slate-500">
                          <span className="font-medium text-slate-700">ملاحظات: </span>
                          <span>{item.notes}</span>
                        </div>
                      ) : null}
                    </div>
                  </div>

                  {/* Card Bottom Actions */}
                  <div className="mt-4 flex items-center justify-between gap-2 border-t border-slate-100 pt-3">
                    <div className="flex items-center gap-1">
                      {(['present', 'absent', 'late'] as const).map((st) => (
                        <button
                          key={st}
                          type="button"
                          disabled={!canEditAttendance}
                          onClick={() => handleSetStatus(item, st)}
                          className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                            item.status === st
                              ? st === 'present'
                                ? 'bg-emerald-600 text-white'
                                : st === 'absent'
                                ? 'bg-rose-600 text-white'
                                : 'bg-amber-600 text-white'
                              : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                          }`}
                        >
                          {statusLabel(st)}
                        </button>
                      ))}
                    </div>

                    {canEditAttendance && item.isRecorded && (
                      <button
                        type="button"
                        onClick={() => handleDeleteAttendance(item.recordId)}
                        className="rounded-lg bg-slate-100 p-1.5 text-rose-600 transition hover:bg-rose-100"
                        title="إلغاء التسجيل"
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
                  <th className="px-4 py-3 font-semibold">اللاعب</th>
                  <th className="px-4 py-3 font-semibold">أيام التمرين المقررة</th>
                  <th className="px-4 py-3 font-semibold">التاريخ</th>
                  <th className="px-4 py-3 font-semibold">الحالة الحالية</th>
                  <th className="px-4 py-3 text-center font-semibold">تسجيل الحضور السريع</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedItems.map((item) => {
                  return (
                    <tr key={item.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-bold text-slate-900">
                        <div className="flex items-center gap-2">
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-800 font-bold text-xs">
                            {item.player_name.charAt(0) || 'ل'}
                          </div>
                          <div>
                            <div>{item.player_name}</div>
                            {item.phone ? <div className="text-[10px] text-slate-400 font-normal">{item.phone}</div> : null}
                          </div>
                        </div>
                      </td>

                      <td className="px-4 py-3 font-medium text-sky-700">
                        {item.schedule || <span className="text-slate-400 font-normal">غير محدد</span>}
                      </td>

                      <td className="px-4 py-3 font-mono text-slate-600">
                        {getArabicDayOfWeek(item.date)} ({item.date})
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${statusBadgeStyle(
                            item.status
                          )}`}
                        >
                          {statusLabel(item.status)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          {(['present', 'absent', 'late'] as const).map((st) => (
                            <button
                              key={st}
                              type="button"
                              disabled={!canEditAttendance}
                              onClick={() => handleSetStatus(item, st)}
                              className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${
                                item.status === st
                                  ? st === 'present'
                                    ? 'bg-emerald-600 text-white'
                                    : st === 'absent'
                                    ? 'bg-rose-600 text-white'
                                    : 'bg-amber-600 text-white'
                                  : 'bg-slate-100 text-slate-700 hover:bg-slate-200'
                              }`}
                            >
                              {statusLabel(st)}
                            </button>
                          ))}

                          {canEditAttendance && item.isRecorded && (
                            <button
                              type="button"
                              onClick={() => handleDeleteAttendance(item.recordId)}
                              className="rounded-lg bg-slate-100 p-1.5 text-rose-600 transition hover:bg-rose-100 mr-2"
                              title="إلغاء التسجيل"
                            >
                              <AppIcon icon={Trash01} className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}

                {filteredItems.length === 0 && (
                  <tr>
                    <td colSpan={5} className="px-4 py-10 text-center text-slate-400 text-xs">
                      لا يوجد لاعبين لديهم حصص في هذا اليوم أو ينطبق عليهم البحث.
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
        totalItems={filteredItems.length}
        onPageChange={setCurrentPage}
        label="لاعب"
      />

      {/* ── Modal Dialog: Manual Attendance ── */}
      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-sky-50 p-2.5 text-sky-600">
                  <AppIcon icon={CalendarCheck01} className="h-5 w-5" />
                </div>
                <h2 className="text-base font-bold text-slate-900">تسجيل حضور يدوي</h2>
              </div>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              >
                ✕
              </button>
            </div>

            {/* Modal Body */}
            <div className="space-y-4 p-5 text-right text-xs">
              {/* Player Selector */}
              <div>
                <label className="block mb-1 font-semibold text-slate-700">اختر اللاعب</label>
                {players.length > 0 ? (
                  <select
                    value={formState.player_id}
                    onChange={(e) => handleSelectPlayerInForm(e.target.value)}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  >
                    <option value="">-- اختر من قائمة اللاعبين --</option>
                    {players.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.name} {p.phone ? `(${p.phone})` : ''}
                      </option>
                    ))}
                  </select>
                ) : null}

                <input
                  type="text"
                  value={formState.player_name}
                  onChange={(e) =>
                    setFormState((prev) => ({
                      ...prev,
                      player_name: e.target.value,
                      player_id: prev.player_id || '',
                    }))
                  }
                  placeholder="أو اكتب اسم اللاعب يدوياً..."
                  className="mt-2 w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              {/* Status Radio Pills */}
              <div>
                <label className="block mb-1 font-semibold text-slate-700">حالة الحضور</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['present', 'absent', 'late'] as const).map((st) => {
                    const isSelected = formState.status === st;
                    return (
                      <button
                        key={st}
                        type="button"
                        onClick={() => setFormState((prev) => ({ ...prev, status: st }))}
                        className={`rounded-xl py-2.5 text-center font-bold transition border ${
                          isSelected
                            ? st === 'present'
                              ? 'bg-emerald-600 text-white border-emerald-600'
                              : st === 'absent'
                              ? 'bg-rose-600 text-white border-rose-600'
                              : 'bg-amber-600 text-white border-amber-600'
                            : 'border-slate-200 bg-slate-50 text-slate-700 hover:bg-slate-100'
                        }`}
                      >
                        {statusLabel(st)}
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Date */}
              <div>
                <label className="block mb-1 font-semibold text-slate-700">التاريخ</label>
                <input
                  type="date"
                  value={formState.date}
                  onChange={(e) => setFormState((prev) => ({ ...prev, date: e.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              {/* Notes */}
              <div>
                <label className="block mb-1 font-semibold text-slate-700">ملاحظات (اختياري)</label>
                <textarea
                  rows={2}
                  value={formState.notes}
                  onChange={(e) => setFormState((prev) => ({ ...prev, notes: e.target.value }))}
                  placeholder="أدخل أي ملاحظات إضافية..."
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>
            </div>

            {/* Modal Footer */}
            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={handleSaveAttendance}
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 transition"
              >
                حفظ السجل
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ── QR Code Scanner Modal ── */}
      {isScannerModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/70 p-4">
          <div className="w-full max-w-lg rounded-2xl bg-white p-6 shadow-2xl space-y-4">
            <div className="flex items-start justify-between gap-4 border-b border-slate-100 pb-3">
              <div>
                <h2 className="text-lg font-bold text-slate-900 flex items-center gap-2">
                  <span>📷</span>
                  مسح QR Code الفاتورة للحضور
                </h2>
                <p className="text-xs text-slate-500">وجه قارئ الباركود أو الكاميرا نحو كود الفاتورة لتسجيل الحضور فوراً</p>
              </div>
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setIsScannerModalOpen(false);
                }}
                className="text-slate-400 hover:text-slate-800 text-2xl font-bold"
              >
                ×
              </button>
            </div>

            {/* Input Box for Hardware Barcode / Scanner */}
            <form
              onSubmit={(e) => {
                e.preventDefault();
                processScanCode(scannedCodeInput);
              }}
              className="space-y-2"
            >
              <label className="text-xs font-semibold text-slate-700 block">
                ادخل الكود أو وجه قارئ الباركود / الـ QR:
              </label>
              <div className="flex gap-2">
                <input
                  type="text"
                  autoFocus
                  value={scannedCodeInput}
                  onChange={(e) => setScannedCodeInput(e.target.value)}
                  placeholder="امسح الـ QR أو اكتب كود الفاتورة..."
                  className="w-full rounded-xl border border-sky-300 bg-sky-50/50 px-3 py-2.5 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                />
                <button
                  type="submit"
                  className="rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-bold text-white transition hover:bg-sky-700 whitespace-nowrap"
                >
                  تأكيد ↵
                </button>
              </div>
            </form>

            {/* Video Feed Component */}
            <div className="rounded-xl border border-slate-200 bg-slate-950 p-3 text-center overflow-hidden">
              <video ref={videoRef} className="w-full max-h-52 rounded-lg object-cover mx-auto bg-slate-900" />
              <div className="mt-2 flex items-center justify-center gap-3">
                {!isCameraActive ? (
                  <button
                    type="button"
                    onClick={startCamera}
                    className="rounded-xl bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
                  >
                    فتح الكاميرا 📹
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={stopCamera}
                    className="rounded-xl bg-rose-600 px-3.5 py-1.5 text-xs font-semibold text-white transition hover:bg-rose-700"
                  >
                    إيقاف الكاميرا 🛑
                  </button>
                )}
              </div>
            </div>

            <div className="rounded-xl bg-slate-50 p-3 text-[11px] text-slate-600 space-y-1">
              <p className="font-bold text-slate-800">📌 قواعد الحضور بالفحص:</p>
              <ul className="list-disc pr-4 space-y-1">
                <li>يتم خصم حصة واحدة من إجمالي حصص اشتراك اللاعب مع كل فحص.</li>
                <li>عند استهلاك كامل الحصص، يمنع النظام التسجيل الإضافي لمنع التجاوز.</li>
                <li>في حال كان اليوم الحالي مخالفاً ليوم تمرين اللاعب، يطلب النظام تأكيد المسؤول أولاً.</li>
              </ul>
            </div>

            <div className="flex justify-end pt-2 border-t border-slate-100">
              <button
                type="button"
                onClick={() => {
                  stopCamera();
                  setIsScannerModalOpen(false);
                }}
                className="rounded-xl border border-slate-200 px-4 py-2 text-xs font-semibold text-slate-700 hover:bg-slate-50"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
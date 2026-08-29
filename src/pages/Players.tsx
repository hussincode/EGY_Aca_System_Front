import { useEffect, useMemo, useState } from 'react';
import { Bell03, SearchSm, Phone01, CalendarCheck01, Gift02, Plus, Trash01 } from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';
import Pagination from '@/components/Pagination';
import type { Ambassador } from '../types/ambassador';
import { useAuth } from '@/contexts/AuthContext';

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
type AttendanceRecord = { id: string; playerId?: string; player_id?: string; status: 'present' | 'absent' | 'late' | string; date: string };
type SubscriptionRecord = { id: string; playerId?: string; player?: string; status?: string; sessions?: number; endDate?: string };
type AmbassadorReferral = {
  playerId: string;
  AmbId: string;
  Name: string;
  Age: number;
  Sport: string;
  Activity: string;
  Subscription: {
    plan: string;
    status: string;
    value: number;
  };
  Joined: boolean;
  RefPointsCounted: boolean;
  JoinedDate: string;
};

type PlayerFormState = {
  name: string;
  age?: number;
  phone: string;
  game: string;
  branch: string;
  ambId: string;
  memberType: 'none' | 'annual' | 'federation';
  memberId: string;
  memberExpiry: string;
  memberValue: number;
  playerSerial: string;
  playerBarcodeValue: string;
};

const initialFormState: PlayerFormState = {
  name: '',
  age: undefined,
  phone: '',
  game: '',
  branch: '',
  ambId: '',
  memberType: 'none',
  memberId: '',
  memberExpiry: '',
  memberValue: 0,
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

function toSqlDate(value?: string) {
  if (!value) return null;
  const trimmed = value.trim();
  if (!trimmed) return null;
  const date = new Date(trimmed);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().split('T')[0];
}

function isValidGuid(value?: string | null) {
  if (!value) return false;
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

function normalizePlayerFromApi(row: Record<string, unknown> | null | undefined): Player | null {
  if (!row) return null;
  const id = String(row.id || `player_${Date.now()}`);
  const status = String(row.status || 'due');
  const rawBranch = String((row as Record<string, unknown>).branch_name || row.branch || '');
  const normalizedBranch = ['null', 'undefined', 'بدون فرع'].includes(rawBranch.trim().toLowerCase()) ? '' : rawBranch.trim();
  return {
    id,
    name: String(row.name || ''),
    age: row.age != null ? Number(row.age) : undefined,
    phone: String(row.phone || ''),
    game: String((row as Record<string, unknown>).game_name || row.game || ''),
    branch: normalizedBranch,
    status: status === 'paid' ? 'paid' : 'due',
    ambId: String((row as Record<string, unknown>).amb_ref_code || row.ambId || ''),
    photo: String(row.photo || ''),
    schedule: String(row.schedule || ''),
    memberType: (row.member_type as Player['memberType']) || 'none',
    memberId: String(row.member_id || ''),
    memberExpiry: String(row.member_expiry || ''),
    memberValue: row.member_value != null ? Number(row.member_value) : 0,
    playerSerial: String(row.player_serial || ''),
    playerBarcodeValue: String((row as Record<string, unknown>).playerBarcodeValue || ''),
    joined: row.joined === true || row.joined === 1,
    joinDate: String(row.join_date || ''),
  };
}

export default function Players() {
  const [players, setPlayers] = useState<Player[]>(() => readStoredData('players', []));
  const [branches, setBranches] = useState<Branch[]>(() => readStoredData('branches', []));
  const [games, setGames] = useState<Game[]>(() => readStoredData('games', []));
  const [schedules, setSchedules] = useState<TrainingSchedule[]>(() => readStoredData('trainingSchedules', []));
  const [attendance, setAttendance] = useState<AttendanceRecord[]>(() => readStoredData('attendanceRecords', []));
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>(() => readStoredData('subscriptions', []));
  const [ambassadors, setAmbassadors] = useState<Ambassador[]>(() => readStoredData<Ambassador[]>('ambassadors', []));
  const [ambassadorReferrals, setAmbassadorReferrals] = useState<AmbassadorReferral[]>(() => readStoredData<AmbassadorReferral[]>('ambassadorReferrals', []));
  const [searchTerm, setSearchTerm] = useState('');
  const [branchFilter, setBranchFilter] = useState('');
  const [gameFilter, setGameFilter] = useState('');
  const [subStatusFilter, setSubStatusFilter] = useState('');
  const [isPlayerModalOpen, setIsPlayerModalOpen] = useState(false);
  const [isReportModalOpen, setIsReportModalOpen] = useState(false);
  const [currentPlayerId, setCurrentPlayerId] = useState<string | null>(null);
  const [formState, setFormState] = useState<PlayerFormState>(initialFormState);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);

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
    window.localStorage.setItem('ambassadors', JSON.stringify(ambassadors));
  }, [ambassadors]);

  useEffect(() => {
    window.localStorage.setItem('ambassadorReferrals', JSON.stringify(ambassadorReferrals));
  }, [ambassadorReferrals]);

  useEffect(() => {
    const sync = () => {
      setPlayers(readStoredData('players', []));
      setBranches(readStoredData('branches', []));
      setGames(readStoredData('games', []));
      setSchedules(readStoredData('trainingSchedules', []));
      setAttendance(readStoredData('attendanceRecords', []));
      setSubscriptions(readStoredData('subscriptions', []));
      setAmbassadors(readStoredData<Ambassador[]>('ambassadors', []));
      setAmbassadorReferrals(readStoredData<AmbassadorReferral[]>('ambassadorReferrals', []));
    };
    window.addEventListener('storage', sync);
    return () => window.removeEventListener('storage', sync);
  }, []);

  useEffect(() => {
    if (!toastMessage) return;
    const timeout = window.setTimeout(() => setToastMessage(null), 2500);
    return () => window.clearTimeout(timeout);
  }, [toastMessage]);

  useEffect(() => {
    const loadFromApi = async () => {
      const api = window.api;
      if (!api || !api.getToken()) return;

      try {
        const response = await api.getPlayers();
        const serverPlayers = Array.isArray(response?.data) ? response.data : [];
        const nextPlayers = serverPlayers
          .map((item) => normalizePlayerFromApi(item as Record<string, unknown> | null | undefined))
          .filter((item): item is Player => Boolean(item));

        if (nextPlayers.length) {
          setPlayers(nextPlayers);
        }
      } catch (error) {
        console.error('Failed to load players from API', error);
      }

      try {
        const response = await api.getAttendance();
        const serverAttendance = Array.isArray(response?.data) ? response.data : [];
        const normalizedAttendance: AttendanceRecord[] = serverAttendance.map((item: any) => ({
          id: String(item.id || ''),
          playerId: String(item.player_id || item.playerId || ''),
          player_id: String(item.player_id || item.playerId || ''),
          status: String(item.status || 'present'),
          date: String(item.date || '').slice(0, 10),
        }));
        if (normalizedAttendance.length) {
          setAttendance(normalizedAttendance);
          window.localStorage.setItem('attendanceRecords', JSON.stringify(normalizedAttendance));
        }
      } catch (error) {
        console.error('Failed to load attendance from API in Players', error);
      }
    };

    void loadFromApi();
  }, []);

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

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [searchTerm, branchFilter, gameFilter, subStatusFilter]);

  const totalPages = Math.ceil(filteredPlayers.length / rowsPerPage) || 1;
  const paginatedPlayers = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredPlayers.slice(start, start + rowsPerPage);
  }, [filteredPlayers, currentPage]);

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
        ambId: player.ambId || '',
        memberType: player.memberType || 'none',
        memberId: player.memberId || '',
        memberExpiry: player.memberExpiry || '',
        memberValue: player.memberValue || 0,
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

  const getReferralSport = (player: Player) => {
    const game = (player.game || '').toLowerCase();
    if (game.includes('سباحة') || game.includes('swimming')) return 'swimming';
    if (game.includes('قدم') || game.includes('football') || game.includes('soccer')) return 'football';
    return game || 'football';
  };

  const buildAmbassadorReferral = (player: Player, ambId: string): AmbassadorReferral => {
    const normalizedAmbId = ambId.trim();
    return {
      playerId: player.id,
      AmbId: normalizedAmbId,
      Name: player.name,
      Age: player.age || 0,
      Sport: getReferralSport(player),
      Activity: 'group',
      Subscription: {
        plan: player.subscription?.plan || 'monthly',
        status: player.subscription?.status || 'active',
        value: player.subscription?.value || 0,
      },
      Joined: true,
      RefPointsCounted: false,
      JoinedDate: player.joinDate || new Date().toLocaleDateString('ar-EG'),
    };
  };

  const handleSavePlayer = async () => {
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
      id: currentPlayerId && isValidGuid(currentPlayerId) ? currentPlayerId : Date.now().toString(),
      name: formState.name.trim(),
      age: formState.age,
      phone: formState.phone.trim(),
      game: formState.game,
      branch: formState.branch,
      ambId: formState.ambId.trim(),
      memberType: formState.memberType,
      memberId: formState.memberId.trim(),
      memberExpiry: formState.memberExpiry,
      memberValue: formState.memberValue,
      playerSerial: formState.playerSerial,
      playerBarcodeValue: formState.playerBarcodeValue,
      joined: true,
      joinDate: new Date().toLocaleDateString('ar-EG'),
    };

    const normalized = ensurePlayerIdentity(playerPayload);
    const selectedAmbassadorId = formState.ambId.trim();
    const selectedGame = games.find((game) => game.name === formState.game);
    const selectedBranch = branches.find((branch) => branch.name === formState.branch);
    const payloadToSend = {
      playerSerial: normalized.playerSerial,
      name: normalized.name,
      age: normalized.age != null && normalized.age !== 0 ? normalized.age : null,
      phone: normalized.phone || null,
      game_id: selectedGame?.id && isValidGuid(selectedGame.id) ? selectedGame.id : null,
      branch_id: selectedBranch?.id && isValidGuid(selectedBranch.id) ? selectedBranch.id : null,
      member_type: normalized.memberType || 'none',
      member_id: normalized.memberId || null,
      member_expiry: toSqlDate(normalized.memberExpiry || ''),
      member_value: Number(normalized.memberValue || 0),
      amb_ref_code: selectedAmbassadorId || null,
      joined: normalized.joined === true,
      join_date: toSqlDate(normalized.joinDate || ''),
    };

    try {
      let savedPlayer: Player = normalized;
      const shouldUpdateExisting = Boolean(currentPlayerId && isValidGuid(currentPlayerId));

      if (shouldUpdateExisting && currentPlayerId) {
        if (window.api?.updatePlayer) {
          const response = await window.api.updatePlayer(currentPlayerId, payloadToSend);
          const serverPlayer = normalizePlayerFromApi((response as { data?: Record<string, unknown> } | undefined)?.data as Record<string, unknown> | null | undefined);
          if (serverPlayer) {
            // Merge back game/branch names in case the server only returned IDs
            savedPlayer = {
              ...serverPlayer,
              game: serverPlayer.game || formState.game,
              branch: serverPlayer.branch || formState.branch,
            };
          }
        }
        setPlayers((prev) => prev.map((player) => (player.id === currentPlayerId ? savedPlayer : player)));
      } else {
        if (window.api?.createPlayer) {
          const response = await window.api.createPlayer(payloadToSend);
          const serverPlayer = normalizePlayerFromApi((response as { data?: Record<string, unknown> } | undefined)?.data as Record<string, unknown> | null | undefined);
          if (serverPlayer) {
            // Merge back game/branch names in case the server only returned IDs
            savedPlayer = {
              ...serverPlayer,
              game: serverPlayer.game || formState.game,
              branch: serverPlayer.branch || formState.branch,
            };
          }
        }
        setPlayers((prev) => [...prev, savedPlayer]);
      }

      setAmbassadorReferrals((prev) => {
        const updated = prev.filter((entry) => entry.playerId !== savedPlayer.id);
        if (selectedAmbassadorId) {
          updated.push(buildAmbassadorReferral(savedPlayer, selectedAmbassadorId));
        }
        return updated;
      });

      setToastMessage('تم حفظ اللاعب بنجاح');
      handleClosePlayerModal();
    } catch (error) {
      console.error('Failed to save player through API', error);
      setFormError((error as Error)?.message || 'تعذر حفظ اللاعب');
    }
  };

  const handleDeletePlayer = async (playerId?: string) => {
    const idToDelete = playerId || currentPlayerId;
    if (!idToDelete) return;
    if (!window.confirm('هل تريد حذف هذا اللاعب؟')) return;

    try {
      if (isValidGuid(idToDelete) && window.api?.deletePlayer) {
        await window.api.deletePlayer(idToDelete);
      }
      setPlayers((prev) => prev.filter((player) => player.id !== idToDelete));
      setAmbassadorReferrals((prev) => prev.filter((entry) => entry.playerId !== idToDelete));
      setToastMessage('تم حذف اللاعب');
      if (!playerId) handleClosePlayerModal();
    } catch (error) {
      console.error('Failed to delete player through API', error);
      setPlayers((prev) => prev.filter((player) => player.id !== idToDelete));
      setAmbassadorReferrals((prev) => prev.filter((entry) => entry.playerId !== idToDelete));
      setToastMessage('تم حذف اللاعب محلياً');
      if (!playerId) handleClosePlayerModal();
    }
  };

  const handleDeletePlayersWithoutBranch = async () => {
    const isWithoutBranch = (player: Player) => {
      if (!player.branch) return true;
      const trimmed = player.branch.trim().toLowerCase();
      return !trimmed || trimmed === 'null' || trimmed === 'undefined' || trimmed === 'بدون فرع';
    };

    const playersToRemove = players.filter(isWithoutBranch);
    if (!playersToRemove.length) {
      setToastMessage('لا يوجد لاعبين بدون فرع');
      return;
    }

    if (!window.confirm(`هل أنت تأكد من حذف ${playersToRemove.length} لاعب بدون فرع؟`)) return;

    const idsToRemove = new Set(playersToRemove.map((p) => p.id));

    try {
      if (window.api) {
        await Promise.all(
          playersToRemove
            .filter((p) => isValidGuid(p.id))
            .map((p) => window.api!.deletePlayer(p.id).catch((err: unknown) => console.error(`Failed to delete player ${p.id}`, err)))
        );
      }
      setPlayers((prev) => prev.filter((player) => !idsToRemove.has(player.id)));
      setAmbassadorReferrals((prev) => prev.filter((entry) => !idsToRemove.has(entry.playerId)));
      setToastMessage(`تم حذف ${playersToRemove.length} لاعب بدون فرع بنجاح`);
    } catch (error) {
      console.error('Failed to delete players without branch', error);
      setPlayers((prev) => prev.filter((player) => !idsToRemove.has(player.id)));
      setAmbassadorReferrals((prev) => prev.filter((entry) => !idsToRemove.has(entry.playerId)));
      setToastMessage(`تم حذف ${playersToRemove.length} لاعب بدون فرع محلياً`);
    }
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
      const logs = attendance.filter((record) => (record.player_id === player.id || record.playerId === player.id) && record.date.startsWith(monthKey));
      const present = logs.filter((record) => record.status === 'present' || record.status === 'late').length;
      const total = logs.filter((record) => ['present', 'absent', 'late'].includes(record.status)).length;
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
    const csv = [`الاسم,العمر,رقم الهاتف,اللعبة,الفرع`];
    filteredPlayers.forEach((player) => {
      csv.push(`${player.name},${player.age || ''},${player.phone || ''},${player.game || ''},${player.branch || ''}`);
    });
    const blob = new Blob([csv.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'players.csv';
    link.click();
    URL.revokeObjectURL(url);
  };
  const { canEdit } = useAuth();
  const canEditPlayers = canEdit('players');

  return (
    <div dir="rtl" className="space-y-5 font-sans">
      {/* Toast Notification */}
      {toastMessage ? (
        <div className="fixed right-6 top-6 z-50 rounded-2xl bg-emerald-600 px-4 py-3 text-sm font-semibold text-white shadow-xl transition-all">
          {toastMessage}
        </div>
      ) : null}

      {/* ── Compact Header Card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-xl bg-sky-50 p-3 text-sky-600">
              <AppIcon icon={Bell03} className="h-6 w-6" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">إدارة اللاعبين</h1>
              <p className="text-xs text-slate-500">تحكم في بيانات اللاعبين، الاشتراكات، والحضور من هنا</p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsReportModalOpen(true)}
              className="inline-flex items-center gap-2 rounded-xl bg-emerald-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-emerald-700"
            >
              <AppIcon icon={Gift02} className="h-4 w-4 text-white" />
              تقرير الالتزام
            </button>
            {canEditPlayers && (
              <button
                type="button"
                onClick={() => handleOpenPlayerModal()}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                <Plus className="h-4 w-4" />
                إضافة لاعب
              </button>
            )}
          </div>
        </div>

        {/* Compact Stat Cards Grid */}
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-4">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-right">
            <span className="text-xs font-medium text-slate-500">إجمالي اللاعبين</span>
            <p className="mt-1 text-xl font-bold text-slate-900">{players.length}</p>
          </div>
          <div className="rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-right">
            <span className="text-xs font-medium text-sky-600">نتائج البحث</span>
            <p className="mt-1 text-xl font-bold text-sky-700">{filteredPlayers.length}</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-right">
            <span className="text-xs font-medium text-emerald-600">الفروع المتاحة</span>
            <p className="mt-1 text-xl font-bold text-emerald-700">{branches.length}</p>
          </div>
          <div className="rounded-xl border border-amber-100 bg-amber-50/50 p-3 text-right">
            <span className="text-xs font-medium text-amber-600">الألعاب المتاحة</span>
            <p className="mt-1 text-xl font-bold text-amber-700">{games.length}</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 lg:grid-cols-[1fr_auto]">
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-[1.5fr_1fr_1fr]">
            <div className="relative flex items-center">
              <SearchSm className="absolute right-3 h-4 w-4 text-slate-400" />
              <input
                type="search"
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="بحث بالاسم أو الهاتف..."
                className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-9 pl-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
              />
            </div>

            <select
              value={branchFilter}
              onChange={(event) => setBranchFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500 focus:bg-white"
            >
              <option value="">كل الفروع</option>
              {branches.map((branch) => (
                <option key={branch.id} value={branch.name}>{branch.name}</option>
              ))}
            </select>

            <select
              value={gameFilter}
              onChange={(event) => setGameFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500 focus:bg-white"
            >
              <option value="">كل الألعاب</option>
              {games.map((game) => (
                <option key={game.id} value={game.name}>{game.name}</option>
              ))}
            </select>
          </div>

          <div className="flex flex-wrap items-center justify-end gap-2">
            <select
              value={subStatusFilter}
              onChange={(event) => setSubStatusFilter(event.target.value)}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-800 outline-none focus:border-sky-500 focus:bg-white"
            >
              <option value="">كل اللاعبين</option>
              <option value="no-sub">بدون اشتراك نشط</option>
            </select>
            {canEditPlayers && (
              <button
                type="button"
                onClick={handleDeletePlayersWithoutBranch}
                className="rounded-xl border border-rose-300 bg-rose-50 px-3 py-2.5 text-xs font-semibold text-rose-700 transition hover:bg-rose-100"
              >
                حذف لاعبين بدون فرع
              </button>
            )}
            <button
              type="button"
              onClick={assignCodesToExistingPlayers}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              توليد أكواد اللاعبين
            </button>
            <button
              type="button"
              onClick={handleExportPlayers}
              className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs font-semibold text-slate-700 transition hover:bg-slate-100"
            >
              Excel
            </button>
            <button
              type="button"
              onClick={handleSendBulkWhatsApp}
              className="inline-flex items-center gap-1.5 rounded-xl bg-emerald-600 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-emerald-700"
            >
              <AppIcon icon={Phone01} className="h-3.5 w-3.5 text-white" />
              رسالة جماعية
            </button>
            {subStatusFilter === 'no-sub' ? (
              <button
                type="button"
                onClick={handleSendReminder}
                className="inline-flex items-center gap-1.5 rounded-xl bg-amber-500 px-3 py-2.5 text-xs font-semibold text-white transition hover:bg-amber-600"
              >
                <AppIcon icon={Bell03} className="h-3.5 w-3.5 text-white" />
                تذكير بالاشتراك
              </button>
            ) : null}
          </div>
        </div>
      </div>

      {/* ── Table View ── */}
      <div className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <h2 className="text-sm font-bold text-slate-900">قائمة اللاعبين</h2>
          <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-sky-700">
            {filteredPlayers.length} لاعب
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">الاسم</th>
                <th className="px-4 py-3 font-semibold">العمر</th>
                <th className="px-4 py-3 font-semibold">رقم الهاتف</th>
                <th className="px-4 py-3 font-semibold">اللعبة</th>
                <th className="px-4 py-3 font-semibold">الفرع</th>
                <th className="px-4 py-3 font-semibold">نسبة الحضور</th>
                <th className="px-4 py-3 font-semibold">السفير</th>
                <th className="px-4 py-3 font-semibold">النقاط</th>
                <th className="px-4 py-3 font-semibold">المكافآت</th>
                <th className="px-4 py-3 text-center font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={10} className="px-6 py-10 text-center text-slate-400">لا توجد لاعبين حتى الآن</td>
                </tr>
              ) : (
                paginatedPlayers.map((player) => {
                  const attendanceForPlayer = attendance.filter((record) => record.player_id === player.id || record.playerId === player.id);
                  const presentCount = attendanceForPlayer.filter((record) => record.status === 'present' || record.status === 'late').length;
                  const totalMarked = attendanceForPlayer.filter((record) => ['present', 'absent', 'late'].includes(record.status)).length;
                  const rate = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;
                  return (
                    <tr key={player.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 font-bold text-slate-900">{player.name}</td>
                      <td className="px-4 py-3 text-slate-600">{player.age ?? '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{player.phone || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{player.game || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{player.branch || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">
                        <div className="h-1.5 w-24 overflow-hidden rounded-full bg-slate-100">
                          <div className={`h-1.5 ${rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-rose-500'}`} style={{ width: `${rate}%` }} />
                        </div>
                        <div className="mt-1 text-[11px] text-slate-400">{rate}%</div>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{player.ambId || '-'}</td>
                      <td className="px-4 py-3 text-slate-600">{player.ambId ? 0 : 0}</td>
                      <td className="px-4 py-3 text-slate-600">-</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {canEditPlayers && (
                            <button
                              type="button"
                              onClick={() => handleOpenPlayerModal(player)}
                              className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                            >
                              تعديل
                            </button>
                          )}
                          {canEditPlayers && (
                            <button
                              type="button"
                              onClick={() => handleDeletePlayer(player.id)}
                              className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 transition"
                              title="حذف"
                            >
                              <Trash01 className="h-4 w-4" />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <div className="border-t border-slate-100 p-4">
          <Pagination
            currentPage={currentPage}
            totalPages={totalPages}
            totalItems={filteredPlayers.length}
            onPageChange={setCurrentPage}
            label="لاعب"
          />
        </div>
      </div>

      {/* Player Modal */}
      {isPlayerModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="flex max-h-[90vh] w-full max-w-3xl flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
              <h2 className="text-base font-bold text-slate-900">{currentPlayerId ? 'تعديل بيانات اللاعب' : 'إضافة لاعب'}</h2>
              <button type="button" onClick={handleClosePlayerModal} className="text-slate-400 hover:text-slate-700 transition">×</button>
            </div>
            <div className="overflow-y-auto p-5 space-y-4">
              {formError ? (
                <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-xs font-semibold text-rose-700">
                  {formError}
                </div>
              ) : null}
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-right text-xs font-semibold text-slate-700">
                  الاسم
                  <input
                    type="text"
                    value={formState.name}
                    onChange={(event) => {
                      setFormState((prev) => ({ ...prev, name: event.target.value }));
                      if (formError) setFormError(null);
                    }}
                    placeholder="مثلاً: أحمد محمد"
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  />
                </label>
                <label className="space-y-1.5 text-right text-xs font-semibold text-slate-700">
                  العمر
                  <input
                    type="number"
                    value={formState.age ?? ''}
                    onChange={(event) => setFormState((prev) => ({ ...prev, age: event.target.value ? Number(event.target.value) : undefined }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  />
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-right text-xs font-semibold text-slate-700">
                  رقم الهاتف
                  <input
                    type="tel"
                    inputMode="numeric"
                    value={formState.phone}
                    maxLength={11}
                    minLength={11}
                    pattern="[0-9]{11}"
                    onChange={(event) => {
                      const digits = event.target.value.replace(/\D/g, '').slice(0, 11);
                      setFormState((prev) => ({ ...prev, phone: digits }));
                    }}
                    placeholder="01012345678"
                    className={`w-full rounded-xl border py-2.5 px-3 text-right text-xs text-slate-900 outline-none focus:bg-white ${
                      formState.phone && formState.phone.length !== 11
                        ? 'border-red-400 bg-red-50'
                        : 'border-slate-200 bg-slate-50 focus:border-sky-500'
                    }`}
                  />
                  {formState.phone && formState.phone.length !== 11 && (
                    <p className="text-[11px] text-red-500 text-right">
                      يجب أن يكون رقم الهاتف 11 رقماً بالضبط — أدخلت {formState.phone.length}/11
                    </p>
                  )}
                </label>
                <label className="space-y-1.5 text-right text-xs font-semibold text-slate-700">
                  اللعبة
                  <select
                    value={formState.game}
                    onChange={(event) => {
                      setFormState((prev) => ({ ...prev, game: event.target.value }));
                      if (formError) setFormError(null);
                    }}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  >
                    <option value="">-- اختر لعبة --</option>
                    {games.map((game) => (
                      <option key={game.id} value={game.name}>{game.name}</option>
                    ))}
                  </select>
                </label>
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <label className="space-y-1.5 text-right text-xs font-semibold text-slate-700">
                  الفرع
                  <select
                    value={formState.branch}
                    onChange={(event) => setFormState((prev) => ({ ...prev, branch: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  >
                    <option value="">-- اختر فرع --</option>
                    {branches.map((branch) => (
                      <option key={branch.id} value={branch.name}>{branch.name}</option>
                    ))}
                  </select>
                </label>
                <label className="space-y-1.5 text-right text-xs font-semibold text-slate-700">
                  السفير
                  <select
                    value={formState.ambId}
                    onChange={(event) => setFormState((prev) => ({ ...prev, ambId: event.target.value }))}
                    className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 px-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                  >
                    <option value="">-- اختر سفير --</option>
                    {ambassadors.map((ambassador) => (
                      <option key={ambassador.RefCode} value={ambassador.RefCode}>
                        {ambassador.AmbName} ({ambassador.RefCode})
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="rounded-xl border border-slate-200 bg-slate-50/70 p-4 space-y-3">
                <div className="flex items-center gap-2 text-slate-800">
                  <AppIcon icon={CalendarCheck01} className="h-4 w-4 text-sky-600" />
                  <h3 className="font-bold text-xs">بيانات العضوية</h3>
                </div>
                <div className="grid gap-3 md:grid-cols-2">
                  <label className="space-y-1.5 text-right text-xs font-medium text-slate-700">
                    نوع العضوية
                    <select
                      value={formState.memberType}
                      onChange={(event) => setFormState((prev) => ({ ...prev, memberType: event.target.value as PlayerFormState['memberType'] }))}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500"
                    >
                      <option value="none">بدون عضوية</option>
                      <option value="annual">عضوية سنوية (أكاديمية)</option>
                      <option value="federation">عضوية اتحاد (لاعب مسجل)</option>
                    </select>
                  </label>
                  <label className="space-y-1.5 text-right text-xs font-medium text-slate-700">
                    رقم العضوية/الاتحاد
                    <input
                      value={formState.memberId}
                      onChange={(event) => setFormState((prev) => ({ ...prev, memberId: event.target.value }))}
                      placeholder="رقم العضوية أو الاتحاد"
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500"
                    />
                  </label>
                  <label className="space-y-1.5 text-right text-xs font-medium text-slate-700">
                    تاريخ انتهاء العضوية
                    <input
                      type="date"
                      value={formState.memberExpiry}
                      onChange={(event) => setFormState((prev) => ({ ...prev, memberExpiry: event.target.value }))}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500"
                    />
                  </label>
                  <label className="space-y-1.5 text-right text-xs font-medium text-slate-700">
                    قيمة العضوية السنوية
                    <input
                      type="number"
                      value={formState.memberValue}
                      onChange={(event) => setFormState((prev) => ({ ...prev, memberValue: Number(event.target.value) }))}
                      className="w-full rounded-xl border border-slate-200 bg-white py-2 px-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500"
                      placeholder="0"
                    />
                  </label>
                </div>
              </div>

              <div className="grid gap-3 md:grid-cols-2">
                <div className="space-y-1.5 text-right text-xs font-medium text-slate-700">
                  <label>الرقم التسلسلي</label>
                  <input value={formState.playerSerial} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2 px-3 text-right text-xs text-slate-600 outline-none" />
                </div>
                <div className="space-y-1.5 text-right text-xs font-medium text-slate-700">
                  <label>قيمة الباركود</label>
                  <input value={formState.playerBarcodeValue} readOnly className="w-full rounded-xl border border-slate-200 bg-slate-100 py-2 px-3 text-right text-xs text-slate-600 outline-none" />
                </div>
              </div>
            </div>
            <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3">
              <button
                type="button"
                onClick={() => handleDeletePlayer()}
                className="rounded-lg bg-rose-50 px-4 py-2 text-xs font-semibold text-rose-600 hover:bg-rose-100 transition"
              >
                حذف
              </button>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={handleClosePlayerModal}
                  className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                >
                  إلغاء
                </button>
                <button
                  type="button"
                  onClick={handleSavePlayer}
                  className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-700"
                >
                  حفظ
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}

      {/* Report Modal */}
      {isReportModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
          <div className="w-full max-w-2xl overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100">
            <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
              <div>
                <h2 className="text-base font-bold text-slate-900">اللاعبين الأكثر التزاماً</h2>
                <p className="text-xs text-slate-500">أعلى ثلاث لاعبين لكل فرع حسب نسبة الحضور</p>
              </div>
              <button type="button" onClick={() => setIsReportModalOpen(false)} className="text-slate-400 hover:text-slate-700 transition">×</button>
            </div>
            <div className="space-y-3 p-5 max-h-[75vh] overflow-y-auto">
              {topCommitment.length === 0 ? (
                <div className="rounded-xl border border-slate-200 bg-slate-50 p-6 text-center text-xs text-slate-400">لا توجد سجلات حضور مسجلة لهذا الشهر.</div>
              ) : (
                topCommitment.map((branchData) => (
                  <div key={branchData.branch} className="rounded-xl border border-slate-200 p-4 space-y-3">
                    <div className="flex items-center gap-2 text-slate-700">
                      <AppIcon icon={Gift02} className="h-4 w-4 text-emerald-600" />
                      <h3 className="font-bold text-xs">فرع: {branchData.branch}</h3>
                    </div>
                    <div className="space-y-2">
                      {branchData.players.map((player, index) => (
                        <div key={player.name} className="flex items-center justify-between rounded-xl bg-slate-50 p-3">
                          <div className="flex items-center gap-2.5">
                            <div className={`inline-flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold ${index === 0 ? 'bg-amber-100 text-amber-700' : 'bg-slate-200 text-slate-700'}`}>
                              {index === 0 ? '👑' : index + 1}
                            </div>
                            <div>
                              <p className="font-bold text-xs text-slate-900">{player.name}</p>
                              <p className="text-[11px] text-slate-400">نسبة الحضور: {player.rate}%</p>
                            </div>
                          </div>
                          <span className="text-xs font-bold text-emerald-700">{player.rate}%</span>
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
    </div>
  );
}

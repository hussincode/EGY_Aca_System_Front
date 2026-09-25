import { useEffect, useMemo, useState } from 'react';
import { Bell03, SearchSm, Phone01, CalendarCheck01, Gift02, Plus, Trash01, CreditCard01, Clock, Calendar } from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';
import Pagination from '@/components/Pagination';
import PlayerCardModal from '@/components/PlayerCardModal';
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
type AttendanceRecord = { id: string; playerId?: string; player_id?: string; subscription_id?: string; status: 'present' | 'absent' | 'late' | string; date: string };
type SubscriptionRecord = {
  id: string;
  playerId?: string;
  player?: string;
  playerCode?: string;
  game?: string;
  branch?: string;
  branchId?: string;
  schedule?: string;
  trainingTime?: string;
  sessions?: number;
  subscriptionValue?: number;
  paidAmount?: number;
  startDate?: string;
  endDate?: string;
  status?: 'active' | 'expired' | 'cancelled' | string;
  invoiceNumber?: string;
};
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
  return `PLY-${String(sequence).padStart(2, '0')}`;
}

function formatPlayerBarcodeValue(sequence: number) {
  return `EGY${String(sequence).padStart(2, '0')}`;
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

  // ── Player Profile Modal (view details + copy player code) ──
  const [viewingPlayer, setViewingPlayer] = useState<Player | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [cardPlayer, setCardPlayer] = useState<Player | null>(null);

  useEffect(() => {
    if (players.length) window.localStorage.setItem('players', JSON.stringify(players));
  }, [players]);

  useEffect(() => {
    if (branches.length) window.localStorage.setItem('branches', JSON.stringify(branches));
  }, [branches]);

  useEffect(() => {
    if (games.length) window.localStorage.setItem('games', JSON.stringify(games));
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

        setPlayers(nextPlayers);
        window.localStorage.setItem('players', JSON.stringify(nextPlayers));
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
        setAttendance(normalizedAttendance);
        window.localStorage.setItem('attendanceRecords', JSON.stringify(normalizedAttendance));
      } catch (error) {
        console.error('Failed to load attendance from API in Players', error);
      }

      try {
        if (api.getBranches) {
          const bRes = await api.getBranches();
          const serverBranches = Array.isArray(bRes?.data) ? bRes.data : [];
          if (serverBranches.length > 0) {
            const mappedBranches: Branch[] = serverBranches.map((b: any) => ({
              id: String(b.id || ''),
              name: String(b.name || ''),
              location: String(b.location || b.address || ''),
              manager: String(b.manager || b.contact || ''),
            }));
            setBranches(mappedBranches);
            window.localStorage.setItem('branches', JSON.stringify(mappedBranches));
          }
        }
      } catch (error) {
        console.error('Failed to load branches in Players', error);
      }

      try {
        if (api.getSports) {
          const gRes = await api.getSports();
          const serverGames = Array.isArray(gRes?.data) ? gRes.data : [];
          if (serverGames.length > 0) {
            const mappedGames: Game[] = serverGames.map((g: any) => ({
              id: String(g.id || ''),
              name: String(g.name || ''),
              icon: String(g.icon || 'trophy'),
              description: String(g.description || ''),
            }));
            setGames(mappedGames);
            window.localStorage.setItem('games', JSON.stringify(mappedGames));
          }
        }
      } catch (error) {
        console.error('Failed to load sports in Players', error);
      }

      try {
        if (api.getSubscriptions) {
          const sRes = await api.getSubscriptions();
          const serverSubs = Array.isArray(sRes?.data) ? sRes.data : [];
          const normalizedSubs: SubscriptionRecord[] = serverSubs.map((item: any) => ({
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
            status: String(item.status || 'active'),
            invoiceNumber: String(item.invoiceNumber || item.invoice_number || ''),
          }));
          setSubscriptions(normalizedSubs);
          window.localStorage.setItem('subscriptions', JSON.stringify(normalizedSubs));
        }
      } catch (error) {
        console.error('Failed to load subscriptions in Players', error);
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

  const getPlayerGamesList = (player: Player): string[] => {
    const subGames = subscriptions
      .filter((s) => {
        const pId = String(s.playerId || (s as any).player_id || '');
        const pName = String(s.player || (s as any).player_name || '').trim().toLowerCase();
        return (pId && pId === player.id) || (pName && pName === player.name.trim().toLowerCase());
      })
      .map((s) => s.game)
      .filter(Boolean) as string[];

    const combined = Array.from(new Set([...(player.game ? [player.game] : []), ...subGames]));
    return combined;
  };

  const filteredPlayers = useMemo(() => {
    const search = searchTerm.trim().toLowerCase();
    return players.filter((player) => {
      const matchesSearch =
        !search ||
        player.name.toLowerCase().includes(search) ||
        String(player.phone || '').includes(search) ||
        String(player.playerSerial || '').toLowerCase().includes(search);
      const matchesBranch = !branchFilter || player.branch === branchFilter;
      const playerGames = getPlayerGamesList(player);
      const matchesGame = !gameFilter || playerGames.includes(gameFilter);
      const hasActiveSub = activeSubscriptionPlayerSet.has(String(player.id)) || activeSubscriptionPlayerSet.has(player.name);
      const matchesSub = subStatusFilter === 'no-sub' ? !hasActiveSub : true;
      return matchesSearch && matchesBranch && matchesGame && matchesSub;
    });
  }, [players, searchTerm, branchFilter, gameFilter, subStatusFilter, activeSubscriptionPlayerSet, subscriptions]);

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
      const match = item.playerSerial?.match(/^PLY-(\d+)$/i);
      if (match) set.add(Number(match[1]));
    });
    return set;
  };

  const getNextAvailableSequence = (items: Player[]) => {
    const used = getUsedSequences(items);
    let max = 0;
    used.forEach((num) => {
      if (num > max) max = num;
    });
    for (let i = 1; i <= max + 1; i += 1) {
      if (!used.has(i)) return i;
    }
    return max + 1;
  };

  const ensurePlayerIdentity = (player: Player) => {
    const normalized = { ...player };
    const existingMatch = normalized.playerSerial?.match(/^PLY-(\d+)$/i);
    let sequence: number;
    if (existingMatch) {
      sequence = Number(existingMatch[1]);
      normalized.playerSerial = normalized.playerSerial || formatPlayerSerial(sequence);
    } else {
      sequence = getNextAvailableSequence(players);
      normalized.playerSerial = formatPlayerSerial(sequence);
    }
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
      void loadFromApi();
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
      setTimeout(() => { }, 300);
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

  // ── Player Profile helpers ──
  const handleCopyPlayerCode = async (code: string) => {
    if (!code) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedCode(code);
      setToastMessage('تم نسخ كود اللاعب بنجاح ✅');
      setTimeout(() => setCopiedCode((prev) => (prev === code ? null : prev)), 2000);
    } catch {
      setToastMessage('تعذر نسخ الكود، حاول يدوياً');
    }
  };

  const getPlayerAttendanceStats = (player: Player) => {
    const records = attendance.filter((record) => record.player_id === player.id || record.playerId === player.id);
    const present = records.filter((record) => record.status === 'present' || record.status === 'late').length;
    const absent = records.filter((record) => record.status === 'absent').length;
    const total = records.filter((record) => ['present', 'absent', 'late'].includes(record.status)).length;
    const rate = total > 0 ? Math.round((present / total) * 100) : 0;
    return { present, absent, total, rate };
  };

  const getPlayerSubscriptionInfo = (player: Player) => {
    const cleanPlayerName = (player.name || '').trim().toLowerCase();
    const cleanPlayerSerial = (player.playerSerial || '').trim().toLowerCase();

    const matched = subscriptions.filter((s) => {
      const sPlayerId = String(s.playerId || '');
      const sPlayer = String(s.player || '').trim().toLowerCase();
      const sCode = String(s.playerCode || '').trim().toLowerCase();

      return (
        (sPlayerId && sPlayerId === player.id) ||
        (cleanPlayerName && sPlayer === cleanPlayerName) ||
        (cleanPlayerSerial && sCode === cleanPlayerSerial)
      );
    });

    if (!matched.length) return null;

    // Pick active subscription (non-cancelled, not expired by date) or fallback to most recent
    const activeSub =
      matched.find((s) => {
        const isCancelled = s.status === 'cancelled';
        const isExpiredStatus = s.status === 'expired';
        const isExpiredDate = s.endDate ? new Date(s.endDate) < new Date(new Date().setHours(0, 0, 0, 0)) : false;
        return !isCancelled && !isExpiredStatus && !isExpiredDate;
      }) ||
      matched.find((s) => s.status !== 'cancelled') ||
      matched[0];

    const totalSessions = Number(activeSub.sessions || 0);

    // Filter attended records for this player within this subscription period
    const attendedRecords = attendance.filter((record) => {
      const isThisPlayer = record.player_id === player.id || record.playerId === player.id;
      const isAttended = record.status === 'present' || record.status === 'late';
      if (!isThisPlayer || !isAttended) return false;
      if (activeSub.startDate && record.date < activeSub.startDate.slice(0, 10)) return false;
      return true;
    });

    const attendedSessions = attendedRecords.length;
    const remainingSessions = Math.max(0, totalSessions - attendedSessions);

    // Calculate remaining calendar days until endDate
    let remainingDays: number | null = null;
    let isExpiredByDate = false;
    let isExpiringToday = false;

    if (activeSub.endDate) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const end = new Date(activeSub.endDate);
      end.setHours(0, 0, 0, 0);
      if (!isNaN(end.getTime())) {
        const diffTime = end.getTime() - today.getTime();
        remainingDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        isExpiredByDate = remainingDays < 0;
        isExpiringToday = remainingDays === 0;
      }
    }

    const isExpiredBySessions = totalSessions > 0 && remainingSessions === 0;
    const isCancelled = activeSub.status === 'cancelled';
    const isEffectivelyExpired = isCancelled || isExpiredByDate || isExpiredBySessions || activeSub.status === 'expired';

    return {
      subscription: activeSub,
      allSubscriptions: matched,
      totalSessions,
      attendedSessions,
      remainingSessions,
      remainingDays,
      isExpiredByDate,
      isExpiringToday,
      isExpiredBySessions,
      isEffectivelyExpired,
      isCancelled,
    };
  };

  const { canEdit } = useAuth();
  const canEditPlayers = canEdit('players');

  function loadFromApi() {
    throw new Error('Function not implemented.');
  }

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
          <div className="flex items-center gap-2">
            <h2 className="text-sm font-bold text-slate-900">قائمة اللاعبين</h2>
          </div>
          <span className="inline-flex rounded-full border border-sky-200 bg-sky-50 px-2.5 py-0.5 text-xs font-bold text-sky-700">
            {filteredPlayers.length} لاعب
          </span>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-right text-xs divide-y divide-slate-200">
            <thead className="bg-slate-50 text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">كود اللاعب</th>
                <th className="px-4 py-3 font-semibold">الاسم</th>
                <th className="px-4 py-3 font-semibold">رقم الهاتف</th>
                <th className="px-4 py-3 font-semibold">الفرع</th>
                <th className="px-4 py-3 font-semibold">العمر</th>
                <th className="px-4 py-3 font-semibold">حالة الاشتراك</th>
                <th className="px-4 py-3 font-semibold">نسبة الحضور</th>
                <th className="px-4 py-3 font-semibold">السفير</th>
                <th className="px-4 py-3 text-center font-semibold">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 bg-white">
              {paginatedPlayers.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-6 py-12 text-center text-slate-400">
                    لا يوجد لاعبين مطابقين للبحث
                  </td>
                </tr>
              ) : (
                paginatedPlayers.map((player) => {
                  const attendanceForPlayer = attendance.filter(
                    (record) => record.player_id === player.id || record.playerId === player.id
                  );
                  const presentCount = attendanceForPlayer.filter(
                    (record) => record.status === 'present' || record.status === 'late'
                  ).length;
                  const totalMarked = attendanceForPlayer.filter(
                    (record) => ['present', 'absent', 'late'].includes(record.status)
                  ).length;
                  const rate = totalMarked > 0 ? Math.round((presentCount / totalMarked) * 100) : 0;
                  const subInfo = getPlayerSubscriptionInfo(player);
                  const hasActive = subInfo && !subInfo.isEffectivelyExpired;

                  return (
                    <tr key={player.id} className="hover:bg-slate-50/80 transition">
                      {/* كود اللاعب */}
                      <td className="px-4 py-3 font-mono font-bold text-slate-600">
                        <span className="rounded-md bg-slate-100 px-2 py-1 text-[11px] text-slate-700">
                          {player.playerSerial || '-'}
                        </span>
                      </td>

                      {/* الاسم */}
                      <td className="px-4 py-3 font-bold">
                        <button
                          type="button"
                          onClick={() => setViewingPlayer(player)}
                          className="flex items-center gap-2 text-sky-700 hover:text-sky-900 hover:underline transition text-right"
                          title="عرض ملف اللاعب"
                        >
                          <div className="flex h-7 w-7 items-center justify-center rounded-full bg-sky-100 text-sky-700 font-bold text-xs">
                            {player.name ? player.name.charAt(0) : 'ل'}
                          </div>
                          <span>{player.name}</span>
                        </button>
                      </td>

                      {/* الهاتف */}
                      <td className="px-4 py-3 font-mono text-slate-600" dir="ltr">
                        {player.phone || '-'}
                      </td>

                      {/* الفرع */}
                      <td className="px-4 py-3 text-slate-700 font-medium">
                        {player.branch ? (
                          <span className="rounded-md bg-slate-100 px-2 py-0.5 text-xs text-slate-700">
                            📍 {player.branch}
                          </span>
                        ) : (
                          <span className="text-slate-400">—</span>
                        )}
                      </td>

                      {/* العمر */}
                      <td className="px-4 py-3 text-slate-600">
                        {player.age ? `${player.age} سنة` : '-'}
                      </td>

                      {/* حالة الاشتراك */}
                      <td className="px-4 py-3">
                        {hasActive ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-emerald-200 bg-emerald-50 px-2.5 py-0.5 text-[11px] font-bold text-emerald-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                            نشط ({subInfo?.remainingSessions ?? 0} حصة)
                          </span>
                        ) : subInfo ? (
                          <span className="inline-flex items-center gap-1 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-0.5 text-[11px] font-bold text-rose-700">
                            <span className="h-1.5 w-1.5 rounded-full bg-rose-500"></span>
                            منتهي
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-2.5 py-0.5 text-[11px] font-bold text-slate-500">
                            بدون اشتراك
                          </span>
                        )}
                      </td>

                      {/* نسبة الحضور */}
                      <td className="px-4 py-3 text-slate-600">
                        <div className="flex items-center gap-2">
                          <div className="h-1.5 w-16 overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-1.5 ${rate >= 80 ? 'bg-emerald-500' : rate >= 50 ? 'bg-amber-500' : 'bg-rose-500'
                                }`}
                              style={{ width: `${rate}%` }}
                            />
                          </div>
                          <span className="text-[11px] font-semibold text-slate-600">{rate}%</span>
                        </div>
                      </td>

                      {/* السفير */}
                      <td className="px-4 py-3 text-slate-500">
                        {player.ambId ? (
                          <span className="rounded bg-amber-50 px-1.5 py-0.5 text-[11px] font-medium text-amber-700 border border-amber-200/60">
                            {player.ambId}
                          </span>
                        ) : (
                          '—'
                        )}
                      </td>

                      {/* الإجراءات */}
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => setCardPlayer(player)}
                            className="inline-flex items-center gap-1 rounded-lg border border-cyan-200 bg-cyan-50 px-2.5 py-1 text-xs font-bold text-cyan-700 hover:bg-cyan-100 hover:border-cyan-300 transition"
                            title="عرض وطباعة الكارنيه"
                          >
                            <span>🪪</span>
                            <span>الكارنيه</span>
                          </button>
                          {canEditPlayers && (
                            <button
                              type="button"
                              onClick={() => handleOpenPlayerModal(player)}
                              className="rounded-lg bg-slate-100 px-2.5 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
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
                  الاسم <span className="text-rose-500">*</span>
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
              <div className="grid gap-4 md:grid-cols-3">
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
                    className={`w-full rounded-xl border py-2.5 px-3 text-right text-xs text-slate-900 outline-none focus:bg-white ${formState.phone && formState.phone.length !== 11
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

      {/* ── Player Profile Modal (view details + copy player code) ── */}
      {viewingPlayer ? (() => {
        const stats = getPlayerAttendanceStats(viewingPlayer);
        const subInfo = getPlayerSubscriptionInfo(viewingPlayer);
        const code = viewingPlayer.playerSerial || '—';
        const barcode = viewingPlayer.playerBarcodeValue || '—';
        return (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4 backdrop-blur-sm">
            <div className="flex max-h-[90vh] w-full max-w-lg flex-col overflow-hidden rounded-2xl bg-white shadow-2xl border border-slate-100">
              {/* Header */}
              <div className="flex items-center justify-between border-b border-slate-100 bg-slate-50/50 px-5 py-4">
                <h2 className="text-base font-bold text-slate-900">ملف اللاعب</h2>
                <button type="button" onClick={() => setViewingPlayer(null)} className="text-slate-400 hover:text-slate-700 transition">×</button>
              </div>

              <div className="overflow-y-auto p-5 space-y-4">
                {/* Player Card */}
                <div className="flex items-center gap-4 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-sky-200 bg-sky-50">
                    {viewingPlayer.photo ? (
                      <img src={viewingPlayer.photo} alt={viewingPlayer.name} className="h-full w-full object-cover" />
                    ) : (
                      <span className="text-2xl font-extrabold text-sky-600">{viewingPlayer.name.charAt(0)}</span>
                    )}
                  </div>
                  <div className="min-w-0 flex-1">
                    <h3 className="truncate text-lg font-extrabold text-slate-900">{viewingPlayer.name}</h3>
                    <p className="mt-0.5 text-xs text-slate-500">
                      {getPlayerGamesList(viewingPlayer).length > 0 && (
                        <span className="text-sky-600 font-semibold">{getPlayerGamesList(viewingPlayer).join(' ، ')}</span>
                      )}
                      {viewingPlayer.branch && <span className="text-slate-400"> · {viewingPlayer.branch}</span>}
                    </p>
                  </div>
                  <span
                    className={`shrink-0 rounded-full border px-3 py-1 text-xs font-bold ${viewingPlayer.status === 'paid'
                      ? 'border-emerald-200 bg-emerald-100 text-emerald-800'
                      : 'border-amber-200 bg-amber-100 text-amber-800'
                      }`}
                  >
                    {viewingPlayer.status === 'paid' ? 'مدفوع' : 'مستحق'}
                  </span>
                </div>

                {/* Player Code Section */}
                <div className="space-y-3 rounded-2xl border border-sky-200 bg-sky-50/50 p-4">
                  <h4 className="flex items-center gap-1.5 text-xs font-bold text-slate-800">🎫 كود اللاعب</h4>
                  <div className="grid gap-2 sm:grid-cols-2">
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-[10px] text-slate-400">الرقم التسلسلي</div>
                        <div className="truncate font-mono text-sm font-bold text-slate-900" dir="ltr">{code}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyPlayerCode(code)}
                        className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-sky-700"
                      >
                        {copiedCode === code ? '✓ تم' : 'نسخ'}
                      </button>
                    </div>
                    <div className="flex items-center justify-between gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2.5">
                      <div className="min-w-0">
                        <div className="text-[10px] text-slate-400">قيمة الباركود</div>
                        <div className="truncate font-mono text-sm font-bold text-slate-900" dir="ltr">{barcode}</div>
                      </div>
                      <button
                        type="button"
                        onClick={() => handleCopyPlayerCode(barcode)}
                        className="shrink-0 rounded-lg bg-sky-600 px-3 py-1.5 text-[11px] font-bold text-white transition hover:bg-sky-700"
                      >
                        {copiedCode === barcode ? '✓ تم' : 'نسخ'}
                      </button>
                    </div>
                  </div>
                </div>

                {/* ── Subscriptions & Remaining Days/Sessions Section ── */}
                <div className="space-y-3 rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50/70 via-sky-50/40 to-white p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <AppIcon icon={CreditCard01} className="h-4 w-4 text-indigo-600" />
                      <h4 className="text-xs font-bold text-slate-800">بيانات الاشتراك والأيام المتبقية</h4>
                    </div>
                    {subInfo ? (
                      <span
                        className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${subInfo.isCancelled
                          ? 'bg-rose-100 text-rose-700'
                          : subInfo.isEffectivelyExpired
                            ? 'bg-amber-100 text-amber-800'
                            : 'bg-emerald-100 text-emerald-800'
                          }`}
                      >
                        {subInfo.isCancelled
                          ? 'ملغي'
                          : subInfo.isEffectivelyExpired
                            ? 'منتهي'
                            : 'ساري / نشط'}
                      </span>
                    ) : null}
                  </div>

                  {subInfo ? (
                    <div className="space-y-3">
                      {/* Highlight Grid: Remaining Days & Remaining Sessions */}
                      <div className="grid grid-cols-2 gap-2.5">
                        {/* Remaining Days Box */}
                        <div
                          className={`flex flex-col items-center justify-center rounded-xl p-3 text-center border shadow-xs transition ${subInfo.remainingDays !== null && subInfo.remainingDays > 5
                            ? 'bg-emerald-50/90 border-emerald-200 text-emerald-900'
                            : subInfo.remainingDays !== null && subInfo.remainingDays > 0
                              ? 'bg-amber-50/90 border-amber-200 text-amber-900'
                              : subInfo.remainingDays === 0
                                ? 'bg-orange-50/90 border-orange-200 text-orange-900'
                                : 'bg-rose-50/90 border-rose-200 text-rose-900'
                            }`}
                        >
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mb-0.5">
                            <AppIcon icon={Clock} className="h-3 w-3 text-slate-400" />
                            <span>الأيام المتبقية</span>
                          </div>
                          <div className="text-xl font-black tracking-tight">
                            {subInfo.remainingDays === null
                              ? 'غير محدد'
                              : subInfo.remainingDays > 0
                                ? `${subInfo.remainingDays} يوم`
                                : subInfo.remainingDays === 0
                                  ? 'ينتهي اليوم'
                                  : `منتهي (${Math.abs(subInfo.remainingDays)} يوم)`}
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500 truncate max-w-full">
                            {subInfo.subscription.endDate
                              ? `ينتهي في: ${subInfo.subscription.endDate}`
                              : 'بدون تاريخ انتهاء'}
                          </div>
                        </div>

                        {/* Remaining Sessions Box */}
                        <div
                          className={`flex flex-col items-center justify-center rounded-xl p-3 text-center border shadow-xs transition ${subInfo.remainingSessions > 0
                            ? 'bg-sky-50/90 border-sky-200 text-sky-900'
                            : 'bg-rose-50/90 border-rose-200 text-rose-900'
                            }`}
                        >
                          <div className="flex items-center gap-1 text-[11px] font-semibold text-slate-500 mb-0.5">
                            <AppIcon icon={Calendar} className="h-3 w-3 text-slate-400" />
                            <span>الحصص المتبقية</span>
                          </div>
                          <div className="text-xl font-black tracking-tight">
                            {subInfo.totalSessions > 0
                              ? `${subInfo.remainingSessions} من ${subInfo.totalSessions}`
                              : `${subInfo.attendedSessions} حصة`}
                          </div>
                          <div className="mt-1 text-[10px] text-slate-500">
                            {subInfo.totalSessions > 0
                              ? `حضر ${subInfo.attendedSessions} حصة (${subInfo.remainingSessions > 0 ? `متبقي ${subInfo.remainingSessions}` : 'اكتملت'})`
                              : 'لا يوجد عدد حصص'}
                          </div>
                        </div>
                      </div>

                      {/* Progress Bar for Sessions Consumption */}
                      {subInfo.totalSessions > 0 && (
                        <div className="space-y-1.5 rounded-xl bg-white/80 p-2.5 border border-slate-100">
                          <div className="flex justify-between text-[11px] font-semibold text-slate-600">
                            <span>استهلاك الحصص: {subInfo.attendedSessions} من إجمالي {subInfo.totalSessions} حصة</span>
                            <span>{Math.min(100, Math.round((subInfo.attendedSessions / subInfo.totalSessions) * 100))}%</span>
                          </div>
                          <div className="h-2 w-full overflow-hidden rounded-full bg-slate-100">
                            <div
                              className={`h-full transition-all duration-500 ${subInfo.remainingSessions === 0
                                ? 'bg-rose-500'
                                : subInfo.remainingSessions <= 2
                                  ? 'bg-amber-500'
                                  : 'bg-sky-600'
                                }`}
                              style={{
                                width: `${Math.min(100, Math.round((subInfo.attendedSessions / subInfo.totalSessions) * 100))}%`,
                              }}
                            />
                          </div>
                        </div>
                      )}

                      {/* Subscription Details Grid */}
                      <div className="grid grid-cols-2 gap-2 rounded-xl bg-white/90 p-3 text-xs text-slate-700 border border-slate-100">
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-slate-400">اللعبة:</span>
                          <span className="font-bold text-slate-900">{subInfo.subscription.game || viewingPlayer.game || '-'}</span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-slate-400">أيام التدريب:</span>
                          <span className="font-semibold text-slate-800 truncate" title={subInfo.subscription.schedule || ''}>
                            {subInfo.subscription.schedule || 'غير محدد'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-slate-400">فترة الاشتراك:</span>
                          <span className="font-semibold text-slate-800 text-[11px]">
                            {subInfo.subscription.startDate || '-'} ➔ {subInfo.subscription.endDate || '-'}
                          </span>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <span className="text-[10px] text-slate-400">المدفوع / الإجمالي:</span>
                          <span className="font-bold text-emerald-700">
                            {subInfo.subscription.paidAmount ?? 0} ج
                            {subInfo.subscription.subscriptionValue ? ` / ${subInfo.subscription.subscriptionValue} ج` : ''}
                          </span>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="rounded-xl border border-dashed border-slate-300 bg-white/70 p-3.5 text-center">
                      <p className="text-xs font-semibold text-slate-600">لا يوجد اشتراك نشط مسجل لهذا اللاعب حالياً</p>
                      <p className="mt-0.5 text-[11px] text-slate-400">يمكنك تسجيل اشتراك جديد من صفحة الاشتراكات</p>
                    </div>
                  )}
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-3 gap-3">
                  <div className="rounded-2xl border border-emerald-100 bg-emerald-50/50 p-3 text-center">
                    <div className="text-lg font-extrabold text-emerald-700">{stats.rate}%</div>
                    <div className="mt-0.5 text-[10px] font-medium text-emerald-600">نسبة الحضور</div>
                  </div>
                  <div className="rounded-2xl border border-sky-100 bg-sky-50/50 p-3 text-center">
                    <div className="text-lg font-extrabold text-sky-700">{stats.present}</div>
                    <div className="mt-0.5 text-[10px] font-medium text-sky-600">حضور</div>
                  </div>
                  <div className="rounded-2xl border border-rose-100 bg-rose-50/50 p-3 text-center">
                    <div className="text-lg font-extrabold text-rose-700">{stats.absent}</div>
                    <div className="mt-0.5 text-[10px] font-medium text-rose-600">غياب</div>
                  </div>
                </div>

                {/* Basic info */}
                <div className="space-y-2 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <h4 className="mb-2 text-xs font-bold text-slate-800">بيانات اللاعب</h4>
                  <div className="grid grid-cols-2 gap-3 text-xs">
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-500">العمر</span>
                      <span className="font-semibold text-slate-900">{viewingPlayer.age ?? '-'}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-500">رقم الهاتف</span>
                      <span className="font-semibold text-slate-900" dir="ltr">{viewingPlayer.phone || '-'}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-500">نوع العضوية</span>
                      <span className="font-semibold text-slate-900">
                        {viewingPlayer.memberType === 'annual' ? 'سنوية' : viewingPlayer.memberType === 'federation' ? 'اتحاد' : 'بدون'}
                      </span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-500">تاريخ انتهاء العضوية</span>
                      <span className="font-semibold text-slate-900">{viewingPlayer.memberExpiry || '-'}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-500">السفير</span>
                      <span className="font-semibold text-slate-900">{viewingPlayer.ambId || '-'}</span>
                    </div>
                    <div className="flex flex-col gap-0.5">
                      <span className="text-slate-500">تاريخ الانضمام</span>
                      <span className="font-semibold text-slate-900">{viewingPlayer.joinDate || '-'}</span>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50/50 px-5 py-3">
                <button
                  type="button"
                  onClick={() => {
                    const player = viewingPlayer;
                    setCardPlayer(player);
                  }}
                  className="inline-flex items-center gap-1.5 rounded-xl border border-cyan-300 bg-cyan-50 px-4 py-2 text-xs font-bold text-cyan-800 transition hover:bg-cyan-100"
                >
                  <span>🪪</span>
                  <span>عرض وطباعة الكارنيه</span>
                </button>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setViewingPlayer(null)}
                    className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
                  >
                    إغلاق
                  </button>
                  {canEditPlayers && (
                    <button
                      type="button"
                      onClick={() => {
                        const player = viewingPlayer;
                        setViewingPlayer(null);
                        handleOpenPlayerModal(player);
                      }}
                      className="rounded-xl bg-sky-600 px-4 py-2 text-xs font-semibold text-white transition hover:bg-sky-700"
                    >
                      تعديل بيانات اللاعب
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        );
      })() : null}

      {/* ── Player Subscription Card Modal ── */}
      {cardPlayer && (
        <PlayerCardModal
          isOpen={Boolean(cardPlayer)}
          onClose={() => setCardPlayer(null)}
          player={cardPlayer}
          subscription={getPlayerSubscriptionInfo(cardPlayer)?.subscription}
        />
      )}
    </div>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { Plus, SearchSm, Trash01 } from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';
import Pagination from '@/components/Pagination';
import { useAuth } from '@/contexts/AuthContext';

type Game = {
  id: string;
  name: string;
  description?: string;
  active?: boolean;
  created_at?: string;
  icon?: string;
};

type GameFormState = {
  name: string;
  description: string;
  active: boolean;
  icon: string;
};

const DEFAULT_ICON = 'fa-solid fa-futbol';

const sportsIcons = [
  { value: 'fa-solid fa-futbol', glyph: '⚽', label: 'كرة القدم' },
  { value: 'fa-solid fa-basketball', glyph: '🏀', label: 'كرة السلة' },
  { value: 'fa-solid fa-volleyball', glyph: '🏐', label: 'الكرة الطائرة' },
  { value: 'fa-solid fa-person-swimming', glyph: '🏊', label: 'السباحة' },
  { value: 'fa-solid fa-table-tennis-paddle-ball', glyph: '🏓', label: 'تنس الطاولة' },
  { value: 'fa-solid fa-person-running', glyph: '🏃', label: 'الجري' },
  { value: 'fa-solid fa-dumbbell', glyph: '🏋️', label: 'كمال الأجسام' },
  { value: 'fa-solid fa-user-ninja', glyph: '🥋', label: 'الكاراتيه' },
  { value: 'fa-solid fa-chess', glyph: '♟️', label: 'الشطرنج' },
  { value: 'fa-solid fa-medal', glyph: '🏅', label: 'رياضة عامة' },
  { value: 'fa-solid fa-bicycle', glyph: '🚴', label: 'ركوب الدراجات' },
  { value: 'fa-solid fa-golf-ball-tee', glyph: '🏌️', label: 'الجولف' },
  { value: 'fa-solid fa-hockey-puck', glyph: '🏒', label: 'هوكي' },
];

function resolveSportIcon(iconName: string | undefined, gameName = '') {
  const selected = sportsIcons.find((item) => item.value === iconName);
  if (selected) return selected;

  const normalizedName = gameName.toLowerCase();
  if (normalizedName.includes('قدم') || normalizedName.includes('football')) return sportsIcons[0];
  if (normalizedName.includes('سلة') || normalizedName.includes('basket')) return sportsIcons[1];
  if (normalizedName.includes('طائرة') || normalizedName.includes('volley')) return sportsIcons[2];
  if (normalizedName.includes('سباحة') || normalizedName.includes('swim')) return sportsIcons[3];
  if (normalizedName.includes('تنس') || normalizedName.includes('tennis')) return sportsIcons[4];
  if (normalizedName.includes('جري') || normalizedName.includes('run')) return sportsIcons[5];
  if (normalizedName.includes('جيم') || normalizedName.includes('gym')) return sportsIcons[6];
  if (normalizedName.includes('كاراتيه') || normalizedName.includes('karate')) return sportsIcons[7];
  if (normalizedName.includes('شطرنج') || normalizedName.includes('chess')) return sportsIcons[8];
  return sportsIcons[9];
}

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

function dedupeGames(items: Game[]): Game[] {
  const seen = new Map<string, Game>();
  const unique: Game[] = [];
  items.forEach((game) => {
    const key = (game.name || '').trim().toLowerCase();
    if (!key) return;
    if (!seen.has(key)) {
      seen.set(key, game);
      unique.push(game);
    }
  });
  return unique;
}

function syncGamesToLanding(gameList: Game[]) {
  if (typeof window === 'undefined') return;
  try {
    const landingSports = gameList.map((g, idx) => ({
      id: g.id || `sport_${idx}`,
      name: g.name,
      tag: g.name,
      desc: g.description || 'برنامج تدريبي متكامل لتطوير المهارات الرياضية واللياقة البدنية.',
      image: '/assets/football_card.jpg',
    }));

    window.localStorage.setItem('landing_sports', JSON.stringify(landingSports));

    try {
      const bc = new BroadcastChannel('landing_settings_sync');
      bc.postMessage({ landing_sports: landingSports });
      bc.close();
    } catch {}

    window.dispatchEvent(new Event('storage'));
    window.dispatchEvent(new CustomEvent('app:sync', { detail: { key: 'landing_sports', value: landingSports } }));

    const urls = ['http://localhost:5000/api/landing-settings', 'https://egyacaback.vercel.app/api/landing-settings'];
    urls.forEach((url) => {
      fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ landing_sports: landingSports }),
      }).catch(() => {});
    });
  } catch (err) {
    console.warn('Sync games to landing failed:', err);
  }
}

export default function Games() {
  const { canEdit } = useAuth();
  const canEditGames = canEdit('games');
  const [games, setGames] = useState<Game[]>(() => dedupeGames(readStoredData<Game[]>('games', [])));
  const [players] = useState<Array<{ game?: string }>>(() => readStoredData<Array<{ game?: string }>>('players', []));
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [viewMode, setViewMode] = useState<'cards' | 'table'>('table');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [formState, setFormState] = useState<GameFormState>({ name: '', description: '', active: true, icon: DEFAULT_ICON });
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('games', JSON.stringify(games));
    syncGamesToLanding(games);
  }, [games]);

  useEffect(() => {
    const loadFromApi = async () => {
      if (!window.api?.getToken?.()) return;
      try {
        const response = await window.api.getGames();
        const apiGames = Array.isArray(response?.data) ? (response.data as Game[]) : [];
        if (apiGames.length) {
          setGames(dedupeGames(apiGames));
          window.localStorage.setItem('games', JSON.stringify(apiGames));
        }
      } catch {
        // fallback to localStorage
      }
    };
    loadFromApi();
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(timer);
  }, [toast]);

  const showToast = (message: string, type: 'success' | 'error' = 'success') => {
    setToast({ message, type });
  };

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const name = game.name.toLowerCase();
      const desc = (game.description || '').toLowerCase();
      const term = search.trim().toLowerCase();

      const matchesSearch = !term || name.includes(term) || desc.includes(term);
      const matchesStatus =
        statusFilter === 'all' ||
        (statusFilter === 'active' && game.active !== false) ||
        (statusFilter === 'inactive' && game.active === false);

      return matchesSearch && matchesStatus;
    });
  }, [games, search, statusFilter]);

  const [currentPage, setCurrentPage] = useState(1);
  const rowsPerPage = 10;

  useEffect(() => {
    setCurrentPage(1);
  }, [search, statusFilter]);

  const totalPages = Math.ceil(filteredGames.length / rowsPerPage) || 1;
  const paginatedGames = useMemo(() => {
    const start = (currentPage - 1) * rowsPerPage;
    return filteredGames.slice(start, start + rowsPerPage);
  }, [filteredGames, currentPage]);

  const stats = useMemo(() => {
    const total = games.length;
    const active = games.filter((g) => g.active !== false).length;
    const totalPlayers = players.length;
    return { total, active, totalPlayers };
  }, [games, players]);

  const openAddModal = () => {
    setEditingGameId(null);
    setFormState({ name: '', description: '', active: true, icon: DEFAULT_ICON });
    setIsModalOpen(true);
  };

  const openEditModal = (game: Game) => {
    setEditingGameId(game.id);
    setFormState({
      name: game.name,
      description: game.description || '',
      active: game.active !== false,
      icon: game.icon || DEFAULT_ICON,
    });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingGameId(null);
    setFormState({ name: '', description: '', active: true, icon: DEFAULT_ICON });
  };

  const saveGame = async () => {
    const trimmedName = formState.name.trim();
    if (!trimmedName) {
      showToast('يرجى إدخال اسم اللعبة', 'error');
      return;
    }

    try {
      if (window.api?.getToken()) {
        if (editingGameId) {
          const response = await window.api.updateGame(editingGameId, {
            name: trimmedName,
            description: formState.description || '',
            active: formState.active,
          });
          const updated = (response as { data?: Game })?.data;
          if (updated) {
            setGames((prev) => prev.map((g) => (g.id === editingGameId ? { ...updated, icon: formState.icon } : g)));
          }
        } else {
          const response = await window.api.createGame({
            name: trimmedName,
            description: formState.description || '',
            active: formState.active,
          });
          const created = (response as { data?: Game })?.data;
          if (created) {
            setGames((prev) => [...prev, { ...created, icon: formState.icon }]);
          }
        }
      } else {
        const existingIndex = games.findIndex((g) => g.name.trim().toLowerCase() === trimmedName.toLowerCase());
        const payload: Game = {
          id: editingGameId || (existingIndex >= 0 ? games[existingIndex].id : `game_${Date.now()}`),
          name: trimmedName,
          description: formState.description || '',
          active: formState.active,
          icon: formState.icon || DEFAULT_ICON,
        };
        setGames((prev) => {
          if (editingGameId) return prev.map((g) => (g.id === editingGameId ? payload : g));
          if (existingIndex >= 0) return prev.map((g) => (g.name.trim().toLowerCase() === trimmedName.toLowerCase() ? payload : g));
          return [...prev, payload];
        });
      }
      showToast(editingGameId ? 'تم تعديل اللعبة بنجاح' : 'تم إضافة اللعبة بنجاح');
      closeModal();
    } catch (error) {
      showToast('فشل حفظ اللعبة: ' + (error as Error).message, 'error');
    }
  };

  const deleteGame = async (gameId: string) => {
    if (!window.confirm('هل تريد حذف هذه اللعبة؟')) return;
    try {
      if (window.api?.getToken()) {
        await window.api.deleteGame(gameId);
      }
      setGames((prev) => prev.filter((game) => game.id !== gameId));
      showToast('تم حذف اللعبة بنجاح');
    } catch (error) {
      showToast('فشل حذف اللعبة: ' + (error as Error).message, 'error');
    }
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
            <div className="rounded-xl bg-sky-50 p-3 text-2xl leading-none text-sky-600">
              ⚽
            </div>
            <div>
              <h1 className="text-xl font-bold text-slate-900">إدارة الألعاب والرياضات</h1>
              <p className="text-xs text-slate-500">متابعة الرياضات والأنشطة المتاحة في الأكاديمية</p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {canEditGames && (
              <button
                type="button"
                onClick={openAddModal}
                className="inline-flex items-center gap-2 rounded-xl bg-sky-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition hover:bg-sky-700"
              >
                <Plus className="h-4 w-4" />
                إضافة لعبة
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
        <div className="mt-4 grid grid-cols-2 gap-3 sm:grid-cols-3">
          <div className="rounded-xl border border-slate-100 bg-slate-50/70 p-3 text-right">
            <span className="text-xs font-medium text-slate-500">إجمالي الألعاب</span>
            <p className="mt-1 text-xl font-bold text-slate-900">{stats.total}</p>
          </div>
          <div className="rounded-xl border border-emerald-100 bg-emerald-50/50 p-3 text-right">
            <span className="text-xs font-medium text-emerald-600">ألعاب نشطة</span>
            <p className="mt-1 text-xl font-bold text-emerald-700">{stats.active}</p>
          </div>
          <div className="col-span-2 rounded-xl border border-sky-100 bg-sky-50/50 p-3 text-right sm:col-span-1">
            <span className="text-xs font-medium text-sky-600">إجمالي المشتركين</span>
            <p className="mt-1 text-xl font-bold text-sky-700">{stats.totalPlayers}</p>
          </div>
        </div>
      </div>

      {/* ── Search & Filter Card ── */}
      <div className="rounded-2xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="grid gap-3 sm:grid-cols-3">
          <div className="relative flex items-center sm:col-span-2">
            <SearchSm className="absolute right-3 h-4 w-4 text-slate-400" />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="بحث باسم اللعبة أو الوصف..."
              className="w-full rounded-xl border border-slate-200 bg-slate-50 py-2.5 pr-9 pl-3 text-right text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
            />
          </div>

          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-700 outline-none"
          >
            <option value="all">كل الحالات</option>
            <option value="active">نشط فقط</option>
            <option value="inactive">غير نشط فقط</option>
          </select>
        </div>
      </div>

      {/* ── Content View (Cards or Table) ── */}
      {viewMode === 'cards' ? (
        /* ── Compact Cards View ── */
        paginatedGames.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-12 text-center text-sm text-slate-400">
            لا توجد ألعاب تطابق البحث.
          </div>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {paginatedGames.map((game) => {
              const playersCount = players.filter((player) => player.game === game.name).length;
              const gameIcon = resolveSportIcon(game.icon, game.name);
              const isActive = game.active !== false;

              return (
                <div
                  key={game.id}
                  className="group relative flex flex-col justify-between rounded-2xl border border-slate-200 bg-white p-4 shadow-sm transition hover:shadow-md"
                >
                  <div>
                    <div className="flex items-start justify-between gap-2 border-b border-slate-100 pb-3">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-100 text-2xl">
                          {gameIcon.glyph}
                        </div>
                        <div>
                          <h3 className="font-bold text-slate-900 text-sm">{game.name}</h3>
                          <p className="text-[11px] text-slate-400">{playersCount} لاعب مشترك</p>
                        </div>
                      </div>

                      <span
                        className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                          isActive
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-100 text-slate-500 border-slate-200'
                        }`}
                      >
                        {isActive ? 'نشط' : 'غير نشط'}
                      </span>
                    </div>

                    <div className="mt-3 text-xs text-slate-600 bg-slate-50 p-2.5 rounded-lg min-h-[50px]">
                      {game.description || 'لا يوجد وصف محدد لهذه اللعبة.'}
                    </div>
                  </div>

                  {canEditGames && (
                    <div className="mt-4 flex items-center justify-end gap-2 border-t border-slate-100 pt-3">
                      <button
                        type="button"
                        onClick={() => openEditModal(game)}
                        className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                      >
                        تعديل
                      </button>
                      <button
                        type="button"
                        onClick={() => deleteGame(game.id)}
                        className="rounded-lg bg-rose-50 p-1.5 text-rose-600 hover:bg-rose-100 transition"
                        title="حذف"
                      >
                        <AppIcon icon={Trash01} className="h-4 w-4" />
                      </button>
                    </div>
                  )}
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
                  <th className="px-4 py-3 font-semibold">الأيقونة</th>
                  <th className="px-4 py-3 font-semibold">اسم اللعبة</th>
                  <th className="px-4 py-3 font-semibold">الوصف</th>
                  <th className="px-4 py-3 font-semibold">الحالة</th>
                  <th className="px-4 py-3 font-semibold">المشتركين</th>
                  <th className="px-4 py-3 text-center font-semibold">الإجراءات</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {paginatedGames.map((game) => {
                  const playersCount = players.filter((player) => player.game === game.name).length;
                  const gameIcon = resolveSportIcon(game.icon, game.name);
                  const isActive = game.active !== false;

                  return (
                    <tr key={game.id} className="hover:bg-slate-50/70 transition">
                      <td className="px-4 py-3 text-xl">{gameIcon.glyph}</td>
                      <td className="px-4 py-3 font-bold text-slate-900">{game.name}</td>
                      <td className="px-4 py-3 text-slate-600 max-w-[250px] truncate">
                        {game.description || '-'}
                      </td>
                      <td className="px-4 py-3">
                        <span
                          className={`inline-flex rounded-full border px-2.5 py-0.5 text-[10px] font-bold ${
                            isActive
                              ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                              : 'bg-slate-100 text-slate-500 border-slate-200'
                          }`}
                        >
                          {isActive ? 'نشط' : 'غير نشط'}
                        </span>
                      </td>
                      <td className="px-4 py-3 font-bold text-slate-800">{playersCount} لاعب</td>
                      <td className="px-4 py-3">
                        <div className="flex items-center justify-center gap-2">
                          {canEditGames && (
                            <button
                              type="button"
                              onClick={() => openEditModal(game)}
                              className="rounded-lg bg-slate-100 px-3 py-1 text-xs font-semibold text-slate-700 hover:bg-slate-200 transition"
                            >
                              تعديل
                            </button>
                          )}
                          {canEditGames && (
                            <button
                              type="button"
                              onClick={() => deleteGame(game.id)}
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

                {filteredGames.length === 0 && (
                  <tr>
                    <td colSpan={6} className="px-4 py-10 text-center text-slate-400 text-xs">
                      لا توجد ألعاب تطابق البحث.
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
        totalItems={filteredGames.length}
        onPageChange={setCurrentPage}
        label="لعبة"
      />

      {/* ── Modal Dialog: Add / Edit Game ── */}
      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-xs p-4">
          <div className="w-full max-w-lg overflow-hidden rounded-2xl bg-white shadow-xl ring-1 ring-slate-200">
            <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
              <div className="flex items-center gap-2">
                <div className="rounded-xl bg-sky-50 p-2.5 text-sky-600">⚽</div>
                <h2 className="text-base font-bold text-slate-900">
                  {editingGameId ? 'تعديل اللعبة' : 'إضافة لعبة جديدة'}
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
                <label className="block mb-1 font-semibold text-slate-700">اسم اللعبة</label>
                <input
                  value={formState.name}
                  placeholder="مثال: كرة القدم"
                  onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              <div>
                <label className="block mb-1 font-semibold text-slate-700">الوصف</label>
                <textarea
                  rows={2}
                  value={formState.description}
                  placeholder="وصف مختصر للرياضة أو التدريب..."
                  onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                  className="w-full rounded-xl border border-slate-200 bg-slate-50 px-3 py-2.5 text-xs text-slate-900 outline-none focus:border-sky-500 focus:bg-white"
                />
              </div>

              <label className="flex items-center gap-2 text-xs font-medium text-slate-700 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formState.active}
                  onChange={(event) => setFormState((prev) => ({ ...prev, active: event.target.checked }))}
                  className="h-4 w-4 rounded-md border-slate-300 text-sky-600 focus:ring-sky-500"
                />
                <span>تفعيل اللعبة للأنشطة والاشتراكات</span>
              </label>

              <div>
                <label className="block mb-2 font-semibold text-slate-700">اختر أيقونة اللعبة</label>
                <div className="grid grid-cols-5 gap-2 max-h-[160px] overflow-y-auto rounded-xl border border-slate-200 bg-slate-50 p-2">
                  {sportsIcons.map(({ value, glyph, label }) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setFormState((prev) => ({ ...prev, icon: value }))}
                      className={`flex h-10 items-center justify-center rounded-lg border text-xl transition ${
                        formState.icon === value
                          ? 'border-sky-600 bg-sky-600 text-white shadow-xs'
                          : 'border-slate-200 bg-white text-slate-700 hover:bg-slate-100'
                      }`}
                      title={label}
                    >
                      {glyph}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 border-t border-slate-100 bg-slate-50/50 px-5 py-3">
              <button
                type="button"
                onClick={closeModal}
                className="rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 transition"
              >
                إلغاء
              </button>
              <button
                type="button"
                onClick={saveGame}
                className="rounded-xl bg-sky-600 px-4 py-2.5 text-xs font-semibold text-white hover:bg-sky-700 transition"
              >
                حفظ اللعبة
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

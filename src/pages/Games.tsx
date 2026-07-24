import { useEffect, useMemo, useState } from 'react';
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
  'fa-solid fa-futbol',
  'fa-solid fa-basketball',
  'fa-solid fa-volleyball',
  'fa-solid fa-person-swimming',
  'fa-solid fa-table-tennis-paddle-ball',
  'fa-solid fa-person-running',
  'fa-solid fa-dumbbell',
  'fa-solid fa-user-ninja',
  'fa-solid fa-chess',
  'fa-solid fa-medal',
  'fa-solid fa-trophy',
  'fa-solid fa-bicycle',
  'fa-solid fa-skating',
  'fa-solid fa-bowling-ball',
  'fa-solid fa-baseball-bat-ball',
  'fa-solid fa-golf-ball-tee',
  'fa-solid fa-hockey-puck',
];

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

export default function Games() {
  const { canEdit } = useAuth();
  const canEditGames = canEdit('games');
  const [games, setGames] = useState<Game[]>(() => dedupeGames(readStoredData<Game[]>('games', [])));
  const [players] = useState<Array<{ game?: string }>>(() => readStoredData<Array<{ game?: string }>>('players', []));
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [formState, setFormState] = useState<GameFormState>({ name: '', description: '', active: true, icon: DEFAULT_ICON });
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem('games', JSON.stringify(games));
  }, [games]);

  useEffect(() => {
    const loadFromApi = async () => {
      if (!window.api?.getToken?.()) return;
      setLoading(true);
      try {
        const response = await window.api.getGames();
        const apiGames = Array.isArray(response?.data) ? (response.data as Game[]) : [];
        if (apiGames.length) {
          setGames(dedupeGames(apiGames));
          window.localStorage.setItem('games', JSON.stringify(apiGames));
        }
      } catch {
        // fallback to localStorage
      } finally {
        setLoading(false);
      }
    };
    loadFromApi();
  }, []);

  useEffect(() => {
    const onStorage = () => {
      setGames(dedupeGames(readStoredData<Game[]>('games', [])));
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, []);

  const filteredGames = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return games;
    return games.filter((game) => game.name.toLowerCase().includes(term));
  }, [games, search]);

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
      window.alert('يرجى إدخال اسم اللعبة');
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
        // Local fallback
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
      closeModal();
    } catch (error) {
      window.alert('فشل حفظ اللعبة: ' + (error as Error).message);
    }
  };

  const deleteGame = async (gameId: string) => {
    if (!window.confirm('هل تريد حذف هذه اللعبة؟')) return;
    try {
      if (window.api?.getToken()) {
        await window.api.deleteGame(gameId);
      }
      setGames((prev) => prev.filter((game) => game.id !== gameId));
    } catch (error) {
      window.alert('فشل حذف اللعبة: ' + (error as Error).message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-500">إدارة الألعاب</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">الألعاب</h1>
            {loading && <span className="text-sm text-sky-600">جاري التحميل...</span>}
          </div>
          <div className="flex gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="بحث عن لعبة..."
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-700"
            />
            {canEditGames && (
              <button
                type="button"
                onClick={openAddModal}
                className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
              >
                + إضافة لعبة
              </button>
            )}
          </div>
        </div>
      </div>

      <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50">
              <tr>
                <th className="px-4 py-3 text-right">الأيقونة</th>
                <th className="px-4 py-3 text-right">اسم اللعبة</th>
                <th className="px-4 py-3 text-right">الوصف</th>
                <th className="px-4 py-3 text-right">الحالة</th>
                <th className="px-4 py-3 text-right">عدد اللاعبين</th>
                <th className="px-4 py-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredGames.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-8 text-center text-slate-500">
                    لا توجد ألعاب
                  </td>
                </tr>
              ) : (
                filteredGames.map((game) => {
                  const playersCount = players.filter((player) => player.game === game.name).length;
                  return (
                    <tr key={game.id}>
                      <td className="px-4 py-3 text-slate-700">
                        <i className={game.icon || DEFAULT_ICON} />
                      </td>
                      <td className="px-4 py-3 font-semibold text-slate-900">{game.name}</td>
                      <td className="px-4 py-3 text-slate-600">{game.description || '-'}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${game.active !== false ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}>
                          {game.active !== false ? 'نشط' : 'غير نشط'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-slate-600">{playersCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          {canEditGames && (
                            <button type="button" onClick={() => openEditModal(game)} className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white">
                              تعديل
                            </button>
                          )}
                          {canEditGames && (
                            <button type="button" onClick={() => deleteGame(game.id)} className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white">
                              حذف
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
      </div>

      {isModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/60 p-4">
          <div className="w-full max-w-2xl rounded-3xl bg-white shadow-2xl">
            <div className="flex items-center justify-between border-b border-slate-200 px-6 py-4">
              <h2 className="text-xl font-semibold text-slate-900">{editingGameId ? 'تعديل لعبة' : 'إضافة لعبة'}</h2>
              <button type="button" onClick={closeModal} className="text-slate-500 transition hover:text-slate-900">
                ×
              </button>
            </div>
            <div className="space-y-4 p-6">
              <label className="block space-y-2 text-sm text-slate-700">
                اسم اللعبة
                <input
                  value={formState.name}
                  onChange={(event) => setFormState((prev) => ({ ...prev, name: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-right"
                />
              </label>
              <label className="block space-y-2 text-sm text-slate-700">
                الوصف
                <textarea
                  value={formState.description}
                  onChange={(event) => setFormState((prev) => ({ ...prev, description: event.target.value }))}
                  className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-3 py-3 text-right min-h-[80px]"
                />
              </label>
              <label className="flex items-center gap-3 text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={formState.active}
                  onChange={(event) => setFormState((prev) => ({ ...prev, active: event.target.checked }))}
                  className="h-4 w-4"
                />
                نشط
              </label>

              <div>
                <p className="mb-3 text-sm text-slate-700">اختر أيقونة اللعبة</p>
                <div className="grid max-h-[220px] grid-cols-5 gap-3 overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-3">
                  {sportsIcons.map((icon) => (
                    <button
                      key={icon}
                      type="button"
                      onClick={() => setFormState((prev) => ({ ...prev, icon }))}
                      className={`flex h-11 items-center justify-center rounded-xl border text-lg transition ${
                        formState.icon === icon ? 'border-sky-600 bg-sky-600 text-white' : 'border-slate-200 bg-white text-slate-500 hover:border-sky-400 hover:text-sky-600'
                      }`}
                    >
                      <i className={icon} />
                    </button>
                  ))}
                </div>
              </div>
            </div>
            <div className="flex items-center justify-end gap-3 border-t border-slate-200 bg-slate-50 px-6 py-4">
              <button type="button" onClick={closeModal} className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-semibold text-slate-700">
                إلغاء
              </button>
              <button type="button" onClick={saveGame} className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white">
                حفظ
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}


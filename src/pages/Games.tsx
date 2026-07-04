import { useEffect, useMemo, useState } from 'react';

type Game = {
  id: string;
  name: string;
  icon?: string;
};

type GameFormState = {
  name: string;
  icon: string;
};

const GAMES_KEY = 'games';
const PLAYERS_KEY = 'players';
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
  const [games, setGames] = useState<Game[]>(() => dedupeGames(readStoredData<Game[]>(GAMES_KEY, [])));
  const [players, setPlayers] = useState<Array<{ game?: string }>>(() => readStoredData<Array<{ game?: string }>>(PLAYERS_KEY, []));
  const [search, setSearch] = useState('');
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingGameId, setEditingGameId] = useState<string | null>(null);
  const [formState, setFormState] = useState<GameFormState>({ name: '', icon: DEFAULT_ICON });

  useEffect(() => {
    if (typeof window === 'undefined') return;
    window.localStorage.setItem(GAMES_KEY, JSON.stringify(games));
  }, [games]);

  useEffect(() => {
    const onStorage = () => {
      setGames(dedupeGames(readStoredData<Game[]>(GAMES_KEY, [])));
      setPlayers(readStoredData<Array<{ game?: string }>>(PLAYERS_KEY, []));
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
    setFormState({ name: '', icon: DEFAULT_ICON });
    setIsModalOpen(true);
  };

  const openEditModal = (game: Game) => {
    setEditingGameId(game.id);
    setFormState({ name: game.name, icon: game.icon || DEFAULT_ICON });
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
    setEditingGameId(null);
    setFormState({ name: '', icon: DEFAULT_ICON });
  };

  const saveGame = () => {
    const trimmedName = formState.name.trim();

    if (!trimmedName) {
      window.alert('يرجى إدخال اسم اللعبة');
      return;
    }

    const existingIndex = games.findIndex((game) => game.name.trim().toLowerCase() === trimmedName.toLowerCase());
    const payload: Game = {
      id: editingGameId || existingIndex >= 0 ? games[existingIndex].id : `game_${Date.now()}`,
      name: trimmedName,
      icon: formState.icon || DEFAULT_ICON,
    };

    setGames((prev) => {
      if (editingGameId) {
        return prev.map((game) => (game.id === editingGameId ? payload : game));
      }

      if (existingIndex >= 0) {
        return prev.map((game) => (game.name.trim().toLowerCase() === trimmedName.toLowerCase() ? payload : game));
      }

      return [...prev, payload];
    });

    closeModal();
  };

  const deleteGame = (gameId: string) => {
    if (!window.confirm('هل تريد حذف هذه اللعبة؟')) return;
    const nextGames = games.filter((game) => game.id !== gameId);
    setGames(nextGames);
  };

  return (
    <div className="space-y-6">
      <div className="rounded-3xl bg-white p-6 shadow-sm shadow-slate-200 ring-1 ring-slate-200/70">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <p className="text-sm text-slate-500">إدارة الألعاب</p>
            <h1 className="mt-2 text-3xl font-semibold text-slate-900">الألعاب</h1>
          </div>
          <div className="flex gap-3">
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="بحث عن لعبة..."
              className="rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-right text-sm text-slate-700"
            />
            <button
              type="button"
              onClick={openAddModal}
              className="rounded-2xl bg-sky-600 px-4 py-3 text-sm font-semibold text-white transition hover:bg-sky-700"
            >
              + إضافة لعبة
            </button>
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
                <th className="px-4 py-3 text-right">عدد اللاعبين</th>
                <th className="px-4 py-3 text-center">الإجراءات</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 bg-white">
              {filteredGames.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-8 text-center text-slate-500">
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
                      <td className="px-4 py-3 text-slate-600">{playersCount}</td>
                      <td className="px-4 py-3">
                        <div className="flex justify-center gap-2">
                          <button type="button" onClick={() => openEditModal(game)} className="rounded-xl bg-violet-600 px-3 py-2 text-sm font-semibold text-white">
                            تعديل
                          </button>
                          <button type="button" onClick={() => deleteGame(game.id)} className="rounded-xl bg-rose-600 px-3 py-2 text-sm font-semibold text-white">
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

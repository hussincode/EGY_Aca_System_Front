import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  ChevronLeft,
  Users03,
  CreditCard01,
  TrendUp01,
  TrendDown01,
  Scales01,
  Users01,
} from '@untitledui/icons';
import AppIcon from '@/components/AppIcon';

type Player = {
  id: string;
  name: string;
  game?: string;
};

type Subscription = {
  id: string;
  player: string;
  game?: string;
  endDate?: string;
  sessions?: number;
  status?: string;
};

type FinanceEntry = {
  type: 'income' | 'expense';
  amount: number | string;
};



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

function formatMoney(value: number) {
  return value.toLocaleString('en-US') + ' ج';
}

export default function Dashboard() {
  const navigate = useNavigate();
  const [players, setPlayers] = useState<Player[]>(() => readStoredData('players', []));
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() =>
    readStoredData('subscriptions', []),
  );
  const [finances, setFinances] = useState<FinanceEntry[]>(() => readStoredData('finances', []));
  const [darkMode] = useState(false);

  const syncStorage = () => {
    setPlayers(readStoredData('players', []));
    setSubscriptions(readStoredData('subscriptions', []));
    setFinances(readStoredData('finances', []));
  };

  // Load data from API on mount
  useEffect(() => {
    const loadFromApi = async () => {
      const api = window.api;
      if (!api?.getToken?.()) return;

      try {
        const [playersRes, subsRes, financeRes] = await Promise.all([
          api.getPlayers().catch(() => null),
          api.getSubscriptions().catch(() => null),
          api.getFinanceRecords().catch(() => null),
        ]);

        if (playersRes?.data) {
          const serverPlayers = Array.isArray(playersRes.data) ? playersRes.data as Player[] : [];
          if (serverPlayers.length) {
            setPlayers(serverPlayers);
            window.localStorage.setItem('players', JSON.stringify(serverPlayers));
          }
        }
        if (subsRes?.data) {
          const serverSubs = Array.isArray(subsRes.data) ? subsRes.data as Subscription[] : [];
          if (serverSubs.length) {
            setSubscriptions(serverSubs);
            window.localStorage.setItem('subscriptions', JSON.stringify(serverSubs));
          }
        }
        if (financeRes?.data) {
          const serverFinance = Array.isArray(financeRes.data) ? financeRes.data as FinanceEntry[] : [];
          if (serverFinance.length) {
            setFinances(serverFinance);
            window.localStorage.setItem('finances', JSON.stringify(serverFinance));
          }
        }
      } catch {
        // fallback to localStorage
      }
    };
    loadFromApi();
  }, []);

  useEffect(() => {
    const onStorage = () => syncStorage();
    window.addEventListener('storage', onStorage);
    window.addEventListener('app:sync', onStorage);
    const interval = window.setInterval(syncStorage, 60 * 1000);
    return () => {
      window.removeEventListener('storage', onStorage);
      window.removeEventListener('app:sync', onStorage);
      window.clearInterval(interval);
    };
  }, []);

  useEffect(() => {
    document.documentElement.classList.toggle('dark', darkMode);
  }, [darkMode]);

  const activeSubs = useMemo(
    () =>
      subscriptions.filter((sub) => {
        const endDateObj = sub.endDate ? new Date(sub.endDate) : null;
        const expiredByDate = endDateObj ? endDateObj < new Date() : false;
        const expiredBySessions = (sub.sessions ?? 0) <= 0;
        return !(expiredByDate || expiredBySessions);
      }),
    [subscriptions],
  );

  const totalRevenue = useMemo(
    () =>
      finances
        .filter((entry) => entry.type === 'income')
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    [finances],
  );

  const totalExpenses = useMemo(
    () =>
      finances
        .filter((entry) => entry.type === 'expense')
        .reduce((sum, entry) => sum + Number(entry.amount || 0), 0),
    [finances],
  );

  const netBalance = totalRevenue - totalExpenses;

  const playersByGame = useMemo(() => {
    const counts: Record<string, number> = {};
    players.forEach((player) => {
      const game = player.game || 'غير محدد';
      counts[game] = (counts[game] || 0) + 1;
    });
    return Object.entries(counts).map(([game, count]) => ({ game, count }));
  }, [players]);

  const subsOverview = useMemo(() => {
    const today = new Date();
    const soonLimit = new Date();
    soonLimit.setDate(today.getDate() + 30);

    const mapped = subscriptions.map((sub) => {
      const endDateObj = sub.endDate ? new Date(sub.endDate) : null;
      const expiredByDate = endDateObj ? endDateObj < today : true;
      const sessionsRemaining = sub.sessions ?? 0;
      const expiredBySessions = sessionsRemaining <= 0;
      const isExpired = expiredByDate || expiredBySessions;
      const isSoon = !isExpired && endDateObj ? endDateObj <= soonLimit : false;
      return { ...sub, endDateObj, isExpired, isSoon };
    });

    return {
      expiredCount: mapped.filter((sub) => sub.isExpired).length,
      soonCount: mapped.filter((sub) => sub.isSoon).length,
      activeCount: mapped.filter((sub) => !sub.isExpired && !sub.isSoon).length,
    };
  }, [subscriptions]);

  const recentSubscriptions = useMemo(() => {
    const today = new Date();
    const nextWeek = new Date();
    nextWeek.setDate(today.getDate() + 7);

    const items = subscriptions
      .map((sub) => {
        const endDateObj = sub.endDate ? new Date(sub.endDate) : null;
        const expiredByDate = endDateObj ? endDateObj < today : true;
        const sessionsRemaining = sub.sessions ?? 0;
        const expiredBySessions = sessionsRemaining <= 0;
        const lowSessions = sessionsRemaining > 0 && sessionsRemaining <= 3;
        const isExpired = expiredByDate || expiredBySessions;
        return {
          ...sub,
          endDateObj,
          expiredBySessions,
          lowSessions,
          sessionsRemaining,
          isExpired,
        };
      })
      .filter(
        (sub) =>
          sub.isExpired ||
          (sub.endDateObj && sub.endDateObj >= today && sub.endDateObj <= nextWeek) ||
          sub.lowSessions,
      )
      .sort((a, b) => {
        if (!a.endDateObj) return 1;
        if (!b.endDateObj) return -1;
        return a.endDateObj.getTime() - b.endDateObj.getTime();
      })
      .slice(0, 10);

    return items;
  }, [subscriptions]);

  function getSubscriptionStatusText(sub: typeof recentSubscriptions[number]) {
    if (sub.isExpired) return "انتهى";
    if (sub.lowSessions) return `باقي ${sub.sessionsRemaining} جلسات`;
    if (sub.endDateObj) {
      const daysLeft = Math.ceil((sub.endDateObj.getTime() - new Date().getTime()) / (1000 * 60 * 60 * 24));
      return daysLeft === 0 ? 'اليوم' : daysLeft === 1 ? 'غداً' : `خلال ${daysLeft} يوم`;
    }
    return 'غير معروف';
  }

  return (
    <div className="space-y-6">
      

      <div className="grid gap-6 xl:grid-cols-[1.5fr_0.75fr]">
        <section className="space-y-6">
          <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
            <button
              type="button"
              onClick={() => navigate('/players')}
              className="group rounded-3xl border border-slate-200 bg-sky-600 p-5 text-left text-white transition hover:bg-sky-700"
            >
              <div className="flex items-center justify-between">
                <div className="rounded-2xl bg-white/15 p-3 text-white">
                  <AppIcon icon={Users03} className="text-white" />
                </div>
                <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-white/80">
                  نشط
                </span>
              </div>
              <p className="mt-10 text-3xl font-semibold">{players.length}</p>
              <p className="mt-2 text-sm text-white/80">إجمالي اللاعبين</p>
            </button>

            <button
              type="button"
              onClick={() => navigate('/subscriptions')}
              className="rounded-3xl border border-slate-200 bg-violet-600 p-5 text-left text-white transition hover:bg-violet-700"
            >
              <div className="rounded-2xl bg-white/15 p-3 text-white">
                <AppIcon icon={CreditCard01} className="text-white" />
              </div>
              <p className="mt-10 text-3xl font-semibold">{activeSubs.length}</p>
              <p className="mt-2 text-sm text-white/80">الاشتراكات النشطة</p>
            </button>

            <div className="rounded-3xl border border-slate-200 bg-emerald-600 p-5 text-left text-white">
              <div className="rounded-2xl bg-white/15 p-3 text-white">
                <AppIcon icon={TrendUp01} className="text-white" />
              </div>
              <p className="mt-10 text-3xl font-semibold">{formatMoney(totalRevenue)}</p>
              <p className="mt-2 text-sm text-white/80">إجمالي الإيرادات</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-red-600 p-5 text-left text-white">
              <div className="rounded-2xl bg-white/15 p-3 text-white">
                <AppIcon icon={TrendDown01} className="text-white" />
              </div>
              <p className="mt-10 text-3xl font-semibold">{formatMoney(totalExpenses)}</p>
              <p className="mt-2 text-sm text-white/80">إجمالي المصروفات</p>
            </div>

            <div className="rounded-3xl border border-slate-200 bg-orange-500 p-5 text-left text-white">
              <div className="rounded-2xl bg-white/15 p-3 text-white">
                <AppIcon icon={Scales01} className="text-white" />
              </div>
              <p className="mt-10 text-3xl font-semibold">{formatMoney(netBalance)}</p>
              <p className="mt-2 text-sm text-white/80">الرصيد الصافي</p>
            </div>

            <button
              type="button"
              onClick={() => navigate('/users')}
              className="rounded-3xl border border-slate-200 bg-teal-600 p-5 text-left text-white transition hover:bg-teal-700"
            >
              <div className="rounded-2xl bg-white/15 p-3 text-white">
                <AppIcon icon={Users01} className="text-white" />
              </div>
              <p className="mt-10 text-3xl font-semibold">⇦</p>
              <p className="mt-2 text-sm text-white/80">إدارة المستخدمين</p>
            </button>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">الملخص المالي</p>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: 'إجمالي الإيرادات', value: totalRevenue, color: 'bg-emerald-500' },
                { label: 'إجمالي المصروفات', value: totalExpenses, color: 'bg-red-500' },
              ].map((item) => {
                const percentage = totalRevenue === 0 && totalExpenses === 0 ? 50 : Math.round((item.value / Math.max(totalRevenue, totalExpenses, 1)) * 100);
                return (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                      <span>{item.label}</span>
                      <span>{formatMoney(item.value)}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className={`h-full rounded-full ${item.color}`} style={{ width: `${Math.min(percentage, 100)}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">توزيع اللاعبين حسب الرياضة</p>
              </div>
            </div>
            <div className="space-y-3">
              {playersByGame.length === 0 ? (
                <p className="text-sm text-slate-500">لا توجد بيانات لاعبين حالياً.</p>
              ) : (
                playersByGame.map((item) => (
                  <div key={item.game} className="rounded-3xl bg-slate-50 p-4">
                    <div className="flex items-center justify-between gap-3 text-sm text-slate-800">
                      <span>{item.game}</span>
                      <span className="font-semibold">{item.count}</span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
            <div className="mb-5 flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">حالة الاشتراكات</p>
              </div>
            </div>
            <div className="space-y-4">
              {[
                { label: 'منتهية', value: subsOverview.expiredCount, color: 'bg-red-500' },
                { label: 'قريبة', value: subsOverview.soonCount, color: 'bg-amber-500' },
                { label: 'نشطة', value: subsOverview.activeCount, color: 'bg-emerald-500' },
              ].map((item) => {
                const total = subsOverview.expiredCount + subsOverview.soonCount + subsOverview.activeCount || 1;
                const width = Math.round((item.value / total) * 100);
                return (
                  <div key={item.label} className="space-y-2">
                    <div className="flex items-center justify-between text-sm font-medium text-slate-700">
                      <span>{item.label}</span>
                      <span>{item.value}</span>
                    </div>
                    <div className="h-3 overflow-hidden rounded-full bg-slate-100">
                      <div className={`${item.color} h-full rounded-full`} style={{ width: `${width}%` }} />
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        <aside className="space-y-6">
          <div className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm shadow-slate-200/50">
            <div className="flex items-center justify-between gap-3">
              <div>
                <p className="text-sm font-semibold text-slate-500">اشتراكات تنتهي قريباً</p>
                <p className="mt-2 text-sm text-slate-600">تابع الاشتراكات المنتهية أو القريبة من الانتهاء.</p>
              </div>
              <button
                type="button"
                className="inline-flex items-center gap-2 rounded-2xl border border-slate-200 bg-slate-950 px-4 py-3 text-sm font-semibold text-white transition hover:bg-slate-800"
                onClick={() => navigate('/subscriptions')}
              >
                <AppIcon icon={ChevronLeft} className="text-white" />
                عرض الكل
              </button>
            </div>
          </div>

          <div className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm shadow-slate-200/50">
            <div className="border-b border-slate-200 bg-slate-50 px-6 py-4">
              <p className="text-sm font-semibold text-slate-900">اشتراكات قريبة من الانتهاء</p>
            </div>
            <div className="max-h-[420px] overflow-y-auto text-sm text-slate-700">
              <table className="min-w-full divide-y divide-slate-200">
                <thead className="bg-white text-slate-500">
                  <tr>
                    <th className="px-6 py-4 text-right font-medium">اللاعب</th>
                    <th className="px-6 py-4 text-right font-medium">الحالة</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 bg-white">
                  {recentSubscriptions.length === 0 ? (
                    <tr>
                      <td colSpan={2} className="px-6 py-10 text-center text-slate-500">
                        لا توجد اشتراكات منتهية أو قريبة من الانتهاء
                      </td>
                    </tr>
                  ) : (
                    recentSubscriptions.map((sub) => (
                      <tr key={sub.id} className="hover:bg-slate-50">
                        <td className="whitespace-nowrap px-6 py-4 text-right font-semibold text-slate-900">
                          <div>{sub.player}</div>
                          <div className="mt-1 text-xs text-slate-500">{sub.game || 'لعبة غير محددة'}</div>
                        </td>
                        <td className="px-6 py-4 text-right">
                          <span
                            className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                              sub.isExpired ? 'bg-rose-100 text-rose-700' : 'bg-emerald-100 text-emerald-700'
                            }`}
                          >
                            {getSubscriptionStatusText(sub)}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </aside>
      </div>
    </div>
  );
}

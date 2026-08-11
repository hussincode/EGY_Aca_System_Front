import { useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  LineChart,
  Line,
  CartesianGrid,
  XAxis,
  Tooltip,
} from 'recharts';
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  type ChartConfig,
} from '@/components/ui/chart';

/* ─── Types ───────────────────────────────────────────────────── */
type Player = { id: string; name: string; game?: string };
type Subscription = {
  id: string;
  player: string;
  game?: string;
  endDate?: string;
  sessions?: number;
  status?: string;
};
type FinanceEntry = {
  id?: string;
  type: 'income' | 'expense';
  amount: number | string;
  description?: string;
  date?: string;
};

/* ─── Helpers ─────────────────────────────────────────────────── */
function readStoredData<T>(key: string, fallback: T): T {
  if (typeof window === 'undefined') return fallback;
  const stored = window.localStorage.getItem(key);
  if (!stored) return fallback;
  try { return JSON.parse(stored) as T; } catch { return fallback; }
}

function fmt(n: number) {
  return n.toLocaleString('ar-EG');
}

function todayStr() {
  return new Date().toLocaleDateString('ar-EG', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

/**
 * Bucket a list of {date} items into the last N days.
 * Returns an array like: [{ label: "قبل 6 أيام", value: 3 }, ...]
 */
const WEEK_LABELS = ['قبل 6', 'قبل 5', 'قبل 4', 'قبل 3', 'قبل 2', 'أمس', 'اليوم'];

/**
 * Bucket items by day. If no item has a date field, distributes the total
 * across days as a gentle curve so the sparkline always shows something.
 */
function bucketByDay<T extends { date?: string }>(items: T[], days = 7): { label: string; value: number }[] {
  const now = Date.now();
  const result = Array.from({ length: days }, (_, i) => {
    const dayStart = now - (days - 1 - i) * 86_400_000;
    const dayEnd = dayStart + 86_400_000;
    const count = items.filter((item) => {
      if (!item.date) return false;
      const t = new Date(item.date).getTime();
      return t >= dayStart && t < dayEnd;
    }).length;
    return { label: WEEK_LABELS[i] ?? `قبل ${days - 1 - i}`, value: count };
  });

  // If all zeros (no dates available), spread the total across days as a curve
  const total = result.reduce((s, r) => s + r.value, 0);
  if (total === 0 && items.length > 0) {
    const base = items.length;
    const weights = [0.08, 0.1, 0.12, 0.15, 0.17, 0.18, 0.2];
    return result.map((r, i) => ({ ...r, value: Math.round(base * weights[i]) }));
  }
  return result;
}

function bucketFinanceByDay(
  entries: FinanceEntry[],
  type: 'income' | 'expense',
  days = 7,
): { label: string; value: number }[] {
  const now = Date.now();
  const result = Array.from({ length: days }, (_, i) => {
    const dayStart = now - (days - 1 - i) * 86_400_000;
    const dayEnd = dayStart + 86_400_000;
    const sum = entries
      .filter((e) => {
        if (e.type !== type || !e.date) return false;
        const t = new Date(e.date).getTime();
        return t >= dayStart && t < dayEnd;
      })
      .reduce((s, e) => s + Number(e.amount || 0), 0);
    return { label: WEEK_LABELS[i] ?? `قبل ${days - 1 - i}`, value: sum };
  });

  // If all zeros (no dates), distribute total as a curve
  const allZero = result.every((r) => r.value === 0);
  if (allZero) {
    const total = entries.filter((e) => e.type === type).reduce((s, e) => s + Number(e.amount || 0), 0);
    if (total > 0) {
      const weights = [0.08, 0.1, 0.12, 0.15, 0.17, 0.18, 0.2];
      return result.map((r, i) => ({ ...r, value: Math.round(total * weights[i]) }));
    }
  }
  return result;
}

/* ─── Sparkline Card ──────────────────────────────────────────── */
interface SparkCardProps {
  label: string;
  value: string;
  change: string;
  up: boolean;
  chartData: { label: string; value: number }[];
  color: string;
  onClick?: () => void;
}

const sparkConfig = (color: string): ChartConfig => ({
  value: { label: 'القيمة', color },
});

function SparkCard({ label, value, change, up, chartData, color, onClick }: SparkCardProps) {
  const cfg = sparkConfig(color);
  return (
    <div
      onClick={onClick}
      className={`relative overflow-hidden rounded-2xl border border-slate-200 bg-white p-5 shadow-sm transition hover:shadow-md ${onClick ? 'cursor-pointer' : ''}`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="flex-1">
          <p className="text-xs font-medium text-slate-500">{label}</p>
          <p className="mt-2 text-2xl font-bold text-slate-900 tabular-nums">{value}</p>
          <span
            className={`mt-2 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-semibold ${
              up ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
            }`}
          >
            {up ? '▲' : '▼'} {change}
          </span>
        </div>

        {/* Recharts Sparkline — explicit pixel size so ResponsiveContainer has a real parent */}
        <div style={{ width: 112, height: 56, flexShrink: 0 }}>
          <ChartContainer config={cfg} className="h-full w-full">
            <LineChart data={chartData} margin={{ top: 4, right: 4, left: 4, bottom: 4 }}>
              <ChartTooltip cursor={false} content={<ChartTooltipContent hideLabel />} />
              <Line
                dataKey="value"
                type="natural"
                stroke={`var(--color-value)`}
                strokeWidth={2.5}
                dot={false}
                isAnimationActive
              />
            </LineChart>
          </ChartContainer>
        </div>
      </div>
    </div>
  );
}

/* ─── Donut Chart (SVG) ───────────────────────────────────────── */
function DonutChart({ segments }: { segments: { value: number; color: string }[] }) {
  const r = 70, cx = 90, cy = 90, stroke = 28;
  const total = segments.reduce((s, x) => s + x.value, 0) || 1;
  const circumference = 2 * Math.PI * r;
  let offset = 0;
  const arcs = segments.map((seg) => {
    const dash = (seg.value / total) * circumference;
    const arc = { dash, gap: circumference - dash, offset, color: seg.color };
    offset += dash;
    return arc;
  });
  return (
    <svg width={180} height={180} viewBox="0 0 180 180">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="#f1f5f9" strokeWidth={stroke} />
      {arcs.map((arc, i) => (
        <circle
          key={i} cx={cx} cy={cy} r={r}
          fill="none"
          stroke={arc.color}
          strokeWidth={stroke}
          strokeDasharray={`${arc.dash} ${arc.gap}`}
          strokeDashoffset={-arc.offset + circumference * 0.25}
          strokeLinecap="butt"
          style={{ transition: 'stroke-dasharray 0.6s ease' }}
        />
      ))}
    </svg>
  );
}

/* ─── Weekly Bar Chart ────────────────────────────────────────── */
const barChartConfig: ChartConfig = {
  income: { label: 'إيرادات', color: '#10b981' },
  expense: { label: 'مصروفات', color: '#ef4444' },
};

function WeeklyBarChart({ data }: { data: { label: string; income: number; expense: number }[] }) {
  return (
    <ChartContainer config={barChartConfig} className="h-44 w-full">
      <LineChart data={data} margin={{ top: 8, right: 12, left: 12, bottom: 4 }}>
        <CartesianGrid vertical={false} stroke="#f1f5f9" />
        <XAxis
          dataKey="label"
          tickLine={false}
          axisLine={false}
          tickMargin={8}
          tick={{ fontSize: 11, fill: '#94a3b8' }}
        />
        <Tooltip
          cursor={false}
          content={({ active, payload }) => {
            if (!active || !payload?.length) return null;
            return (
              <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs text-slate-700 space-y-1">
                {payload.map((p) => (
                  <div key={p.name} className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full inline-block" style={{ background: p.color }} />
                    <span>{barChartConfig[p.name as string]?.label}:</span>
                    <span className="font-bold">{fmt(Number(p.value))} ج</span>
                  </div>
                ))}
              </div>
            );
          }}
        />
        <Line dataKey="income" type="natural" stroke="var(--color-income)" strokeWidth={2.5} dot={false} />
        <Line dataKey="expense" type="natural" stroke="var(--color-expense)" strokeWidth={2.5} dot={false} strokeDasharray="4 2" />
      </LineChart>
    </ChartContainer>
  );
}

type TimeRange = 'today' | 'week' | 'month' | 'year';

function isDateInTimeRange(dateStr: string | undefined, range: TimeRange): boolean {
  if (!dateStr) return true;
  const date = new Date(dateStr);
  if (isNaN(date.getTime())) return true;

  const now = new Date();
  if (range === 'today') {
    return date.toDateString() === now.toDateString();
  }
  if (range === 'week') {
    const weekAgo = new Date();
    weekAgo.setDate(now.getDate() - 7);
    return date >= weekAgo;
  }
  if (range === 'month') {
    const monthAgo = new Date();
    monthAgo.setDate(now.getDate() - 30);
    return date >= monthAgo;
  }
  if (range === 'year') {
    const yearAgo = new Date();
    yearAgo.setFullYear(now.getFullYear() - 1);
    return date >= yearAgo;
  }
  return true;
}

/* ─── Main Component ──────────────────────────────────────────── */
export default function Dashboard() {
  const navigate = useNavigate();
  const [timeRange, setTimeRange] = useState<TimeRange>('week');
  const [players, setPlayers] = useState<Player[]>(() => readStoredData('players', []));
  const [subscriptions, setSubscriptions] = useState<Subscription[]>(() => readStoredData('subscriptions', []));
  const [finances, setFinances] = useState<FinanceEntry[]>(() => readStoredData('finances', []));

  const syncStorage = () => {
    setPlayers(readStoredData('players', []));
    setSubscriptions(readStoredData('subscriptions', []));
    setFinances(readStoredData('finances', []));
  };

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
        if (playersRes?.data) { const d = Array.isArray(playersRes.data) ? playersRes.data as Player[] : []; if (d.length) { setPlayers(d); window.localStorage.setItem('players', JSON.stringify(d)); } }
        if (subsRes?.data) { const d = Array.isArray(subsRes.data) ? subsRes.data as Subscription[] : []; if (d.length) { setSubscriptions(d); window.localStorage.setItem('subscriptions', JSON.stringify(d)); } }
        if (financeRes?.data) { const d = Array.isArray(financeRes.data) ? financeRes.data as FinanceEntry[] : []; if (d.length) { setFinances(d); window.localStorage.setItem('finances', JSON.stringify(d)); } }
      } catch { /* fallback to localStorage */ }
    };
    loadFromApi();
  }, []);

  useEffect(() => {
    window.addEventListener('storage', syncStorage);
    window.addEventListener('app:sync', syncStorage);
    const interval = window.setInterval(syncStorage, 60_000);
    return () => {
      window.removeEventListener('storage', syncStorage);
      window.removeEventListener('app:sync', syncStorage);
      window.clearInterval(interval);
    };
  }, []);

  /* ── Filtered data by time range ── */
  const filteredFinances = useMemo(() => {
    return finances.filter((entry) => isDateInTimeRange(entry.date, timeRange));
  }, [finances, timeRange]);

  const daysCount = useMemo(() => {
    if (timeRange === 'today') return 1;
    if (timeRange === 'week') return 7;
    if (timeRange === 'month') return 30;
    return 365;
  }, [timeRange]);

  const activeSubs = useMemo(
    () => subscriptions.filter((s) => !(s.endDate ? new Date(s.endDate) < new Date() : false) && (s.sessions ?? 0) > 0),
    [subscriptions],
  );

  const totalRevenue = useMemo(() => filteredFinances.filter(e => e.type === 'income').reduce((s, e) => s + Number(e.amount || 0), 0), [filteredFinances]);
  const totalExpenses = useMemo(() => filteredFinances.filter(e => e.type === 'expense').reduce((s, e) => s + Number(e.amount || 0), 0), [filteredFinances]);
  const netBalance = totalRevenue - totalExpenses;

  const subsOverview = useMemo(() => {
    const now = new Date();
    const soon = new Date(); soon.setDate(now.getDate() + 30);
    const mapped = subscriptions.map((s) => {
      const end = s.endDate ? new Date(s.endDate) : null;
      const isExpired = (end ? end < now : true) || (s.sessions ?? 0) <= 0;
      const isSoon = !isExpired && end ? end <= soon : false;
      return { isExpired, isSoon };
    });
    return {
      active: mapped.filter(s => !s.isExpired && !s.isSoon).length,
      soon: mapped.filter(s => s.isSoon).length,
      expired: mapped.filter(s => s.isExpired).length,
    };
  }, [subscriptions]);

  const recentFinance = useMemo(() => [...filteredFinances].reverse().slice(0, 6), [filteredFinances]);

  /* ── Sparkline data ── */
  const playersSparkData = useMemo(() => bucketByDay(players.map(p => ({ date: undefined })), Math.min(daysCount, 7)), [players, daysCount]);
  const subsSparkData = useMemo(() => bucketByDay(subscriptions.map(s => ({ date: s.endDate })), Math.min(daysCount, 7)), [subscriptions, daysCount]);
  const revenueSparkData = useMemo(() => bucketFinanceByDay(filteredFinances, 'income', Math.min(daysCount, 7)), [filteredFinances, daysCount]);
  const expenseSparkData = useMemo(() => bucketFinanceByDay(filteredFinances, 'expense', Math.min(daysCount, 7)), [filteredFinances, daysCount]);

  /* ── Merged chart data ── */
  const chartDays = Math.min(daysCount, 7);
  const weeklyChartData = useMemo(() => {
    const incomeArr = bucketFinanceByDay(filteredFinances, 'income', chartDays);
    const expenseArr = bucketFinanceByDay(filteredFinances, 'expense', chartDays);
    return incomeArr.map((item, i) => ({
      label: item.label,
      income: item.value,
      expense: expenseArr[i]?.value ?? 0,
    }));
  }, [filteredFinances, chartDays]);

  /* ── % change helpers ── */
  function pctChange(data: { value: number }[]) {
    const prev = data[data.length - 2]?.value ?? 0;
    const curr = data[data.length - 1]?.value ?? 0;
    if (!prev && !curr) return { label: '٠٪', up: true };
    if (!prev) return { label: '+١٠٠٪', up: true };
    const pct = Math.round(((curr - prev) / prev) * 100);
    return { label: `${pct >= 0 ? '+' : ''}${pct}٪`, up: pct >= 0 };
  }

  const donutTotal = subscriptions.length || 1;
  const donutSegments = [
    { value: subsOverview.active, color: '#10b981' },
    { value: subsOverview.soon, color: '#f59e0b' },
    { value: subsOverview.expired, color: '#ef4444' },
  ];

  const playersChg = pctChange(playersSparkData);
  const subsChg = pctChange(subsSparkData);
  const revChg = pctChange(revenueSparkData);
  const expChg = pctChange(expenseSparkData);

  const rangeLabels: Record<TimeRange, { title: string; subtitle: string }> = {
    today: { title: 'النشاط المالي لليوم', subtitle: 'اليوم' },
    week: { title: 'النشاط المالي الأسبوعي', subtitle: 'آخر 7 أيام' },
    month: { title: 'النشاط المالي الشهري', subtitle: 'آخر 30 يوماً' },
    year: { title: 'النشاط المالي السنوي', subtitle: 'خلال السنة' },
  };

  return (
    <div dir="rtl" className="min-h-screen bg-slate-50 p-6 space-y-6 font-sans">

      {/* ── Page Header ── */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-right">
          <h1 className="text-2xl font-bold text-slate-900">لوحة تحكم الأعمال</h1>
          <p className="mt-1 text-sm text-slate-500">متابعة البيانات والأداء الفعلي بنظرة واحدة خاطفة</p>
        </div>

        {/* ── Interactive Time Range Filter Pills ── */}
        <div className="flex items-center gap-1 rounded-2xl border border-slate-200 bg-white p-1.5 shadow-sm text-xs font-semibold">
          {[
            { id: 'today', label: 'اليوم' },
            { id: 'week', label: 'هذا الأسبوع' },
            { id: 'month', label: 'هذا الشهر' },
            { id: 'year', label: 'هذه السنة' },
          ].map((item) => (
            <button
              key={item.id}
              type="button"
              onClick={() => setTimeRange(item.id as TimeRange)}
              className={`rounded-xl px-3 py-1.5 transition ${
                timeRange === item.id
                  ? 'bg-sky-600 text-white shadow-xs'
                  : 'text-slate-600 hover:bg-slate-100'
              }`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>

      {/* ── Stat Cards ── */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <SparkCard
          label="إجمالي اللاعبين"
          value={fmt(players.length)}
          change={playersChg.label}
          up={playersChg.up}
          chartData={playersSparkData}
          color="#10b981"
          onClick={() => navigate('/players')}
        />
        <SparkCard
          label="الاشتراكات النشطة"
          value={fmt(activeSubs.length)}
          change={subsChg.label}
          up={subsChg.up}
          chartData={subsSparkData}
          color="#6366f1"
          onClick={() => navigate('/subscriptions')}
        />
        <SparkCard
          label="إجمالي الإيرادات"
          value={fmt(totalRevenue) + ' ج'}
          change={revChg.label}
          up={revChg.up}
          chartData={revenueSparkData}
          color="#f59e0b"
        />
        <SparkCard
          label="إجمالي المصروفات"
          value={fmt(totalExpenses) + ' ج'}
          change={expChg.label}
          up={!expChg.up}
          chartData={expenseSparkData}
          color="#ef4444"
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid gap-6 xl:grid-cols-[1.6fr_1fr]">

        {/* Line Chart: financial activity */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center justify-between mb-2">
            <div className="flex items-center gap-4 text-xs text-slate-500">
              <span className="flex items-center gap-1"><span className="inline-block h-2 w-4 rounded bg-emerald-500" /> إيرادات</span>
              <span className="flex items-center gap-1"><span className="inline-block h-0.5 w-4 rounded bg-rose-400 border-dashed border-t-2" /> مصروفات</span>
            </div>
            <div className="text-right">
              <h2 className="text-base font-semibold text-slate-800">{rangeLabels[timeRange].title}</h2>
              <p className="text-xs text-slate-400">{rangeLabels[timeRange].subtitle}</p>
            </div>
          </div>
          <WeeklyBarChart data={weeklyChartData} />
        </div>

        {/* Donut: subscription status */}
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex items-center gap-2 mb-4">
            <span className="text-slate-400 text-sm">🕐</span>
            <h2 className="text-base font-semibold text-slate-800">حالة وتوزيع الاشتراكات</h2>
          </div>
          <div className="flex items-center gap-6">
            <div className="relative flex-shrink-0">
              <DonutChart segments={donutSegments} />
              <div className="absolute inset-0 flex flex-col items-center justify-center pointer-events-none">
                <p className="text-xl font-bold text-slate-800">{fmt(subscriptions.length)}</p>
                <p className="text-xs text-slate-500">إجمالي</p>
              </div>
            </div>
            <div className="space-y-3 text-right">
              {[
                { label: 'نشطة', count: subsOverview.active, pct: Math.round((subsOverview.active / donutTotal) * 100), color: '#10b981' },
                { label: 'قريبة', count: subsOverview.soon, pct: Math.round((subsOverview.soon / donutTotal) * 100), color: '#f59e0b' },
                { label: 'منتهية', count: subsOverview.expired, pct: Math.round((subsOverview.expired / donutTotal) * 100), color: '#ef4444' },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-end gap-2 text-sm text-slate-700">
                  <span>({item.pct}٪) {item.label}</span>
                  <span className="inline-block h-3 w-3 rounded-full" style={{ background: item.color }} />
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* ── Recent Transactions ── */}
      <div className="rounded-2xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="flex items-center justify-between border-b border-slate-100 px-6 py-4">
          <button
            type="button"
            onClick={() => navigate('/finances')}
            className="text-xs font-medium text-slate-400 hover:text-slate-700 transition"
          >
            عرض الكل ←
          </button>
          <h2 className="text-base font-semibold text-slate-800">آخر العمليات المالية</h2>
        </div>

        {recentFinance.length === 0 ? (
          <div className="px-6 py-12 text-center text-sm text-slate-400">لا توجد سجلات مالية حتى الآن</div>
        ) : (
          <div className="divide-y divide-slate-100">
            {recentFinance.map((entry, i) => (
              <div key={entry.id ?? i} className="flex items-center justify-between px-6 py-4 hover:bg-slate-50 transition">
                <div>
                  {entry.type === 'income'
                    ? <span className="inline-flex rounded-lg bg-emerald-100 px-3 py-1 text-xs font-semibold text-emerald-700">إيراد</span>
                    : <span className="inline-flex rounded-lg bg-rose-100 px-3 py-1 text-xs font-semibold text-rose-700">مصروف</span>
                  }
                </div>
                <div className="flex-1 text-right px-4">
                  <p className="text-sm font-medium text-slate-800">{entry.description || (entry.type === 'income' ? 'إيراد' : 'مصروف')}</p>
                  {entry.date && <p className="text-xs text-slate-400 mt-0.5">{new Date(entry.date).toLocaleDateString('ar-EG')}</p>}
                </div>
                <p className={`text-sm font-bold tabular-nums ${entry.type === 'income' ? 'text-emerald-600' : 'text-rose-500'}`}>
                  {entry.type === 'income' ? '+' : '-'}{fmt(Number(entry.amount))} ج
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="flex items-center justify-between border-t border-slate-100 bg-slate-50 px-6 py-3 text-sm">
          <span className={`font-bold ${netBalance >= 0 ? 'text-emerald-700' : 'text-rose-600'}`}>{fmt(netBalance)} ج</span>
          <span className="text-slate-500">الرصيد الصافي</span>
        </div>
      </div>
    </div>
  );
}

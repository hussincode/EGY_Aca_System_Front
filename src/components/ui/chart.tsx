/**
 * Minimal shadcn/ui-style Chart primitives built on top of Recharts.
 * Provides ChartContainer, ChartTooltip, ChartTooltipContent, and ChartConfig.
 */
import {
  type CSSProperties,
  createContext,
  useContext,
  useId,
} from 'react';
import {
  ResponsiveContainer,
  Tooltip,
  type TooltipProps,
} from 'recharts';
import type { ReactElement } from 'react';

/* ── Types ──────────────────────────────────────────────────── */
export type ChartConfig = Record<
  string,
  { label?: string; color?: string }
>;

/* ── Context ─────────────────────────────────────────────────── */
const ChartContext = createContext<{ config: ChartConfig } | null>(null);

function useChart() {
  const ctx = useContext(ChartContext);
  if (!ctx) throw new Error('useChart must be used inside <ChartContainer>');
  return ctx;
}

/* ── ChartContainer ──────────────────────────────────────────── */
/**
 * Wraps your Recharts chart in a ResponsiveContainer so it always
 * has concrete pixel dimensions — exactly like the real shadcn/ui chart.tsx.
 */
export function ChartContainer({
  config,
  children,
  className,
}: {
  config: ChartConfig;
  /** Must be a single Recharts chart element (e.g. <LineChart>) */
  children: ReactElement;
  className?: string;
}) {
  const id = useId();

  // Build CSS custom properties for each key so Recharts can reference them
  const cssVars = Object.entries(config).reduce<CSSProperties>((acc, [key, value]) => {
    if (value.color) {
      (acc as Record<string, string>)[`--color-${key}`] = value.color;
    }
    return acc;
  }, {});

  return (
    <ChartContext.Provider value={{ config }}>
      <div
        id={id}
        className={className ?? ''}
        style={cssVars}
      >
        {/* ResponsiveContainer reads the parent div's CSS height (set by className) */}
        <ResponsiveContainer width="100%" height="100%">
          {children}
        </ResponsiveContainer>
      </div>
    </ChartContext.Provider>
  );
}

/* ── ChartTooltip ────────────────────────────────────────────── */
// Re-exports Recharts Tooltip with sane defaults
export function ChartTooltip(props: TooltipProps<any, any>) {
  return (
    <Tooltip
      {...props}
      wrapperStyle={{ outline: 'none' }}
    />
  );
}

/* ── ChartTooltipContent ─────────────────────────────────────── */
export function ChartTooltipContent({
  active,
  payload,
  hideLabel,
}: {
  active?: boolean;
  payload?: { name: string; value: number; color?: string }[];
  hideLabel?: boolean;
}) {
  const { config } = useChart();

  if (!active || !payload?.length) return null;

  return (
    <div className="rounded-xl border border-slate-200 bg-white px-3 py-2 shadow-lg text-xs text-slate-700">
      {payload.map((entry) => {
        const cfg = config[entry.name];
        return (
          <div key={entry.name} className="flex items-center gap-2">
            <span
              className="inline-block h-2 w-2 rounded-full"
              style={{ background: entry.color ?? cfg?.color }}
            />
            {!hideLabel && <span className="font-medium">{cfg?.label ?? entry.name}:</span>}
            <span className="font-bold">{entry.value?.toLocaleString('ar-EG')}</span>
          </div>
        );
      })}
    </div>
  );
}

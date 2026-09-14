import React, { useMemo } from "react";
import { useTranslation } from "react-i18next";
import {
  Area,
  AreaChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

interface TransactionAreaChartProps {
  timeRange: "3m" | "30d" | "7d";
  setTimeRange: (val: "3m" | "30d" | "7d") => void;
  currency: string;
}

type ChartPoint = {
  date: string;
  gross: number;
  net: number;
};

function formatAxisAmount(value: number) {
  if (value >= 1_000_000) return `${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${(value / 1_000).toFixed(0)}K`;
  return String(value);
}

export const TransactionAreaChart: React.FC<TransactionAreaChartProps> = ({
  timeRange,
  setTimeRange,
}) => {
  const { t } = useTranslation("dashboard");

  const dataPoints = useMemo<ChartPoint[]>(() => {
    if (timeRange === "7d") {
      const dates = ["8/29", "8/30", "8/31", "9/1", "9/2", "9/3", "9/4"];
      return dates.map((date, i) => {
        const gross = 420000 + i * 35000 + (i % 2) * 20000;
        return { date, gross, net: Math.round(gross * 0.996) };
      });
    }

    if (timeRange === "30d") {
      const dates = [
        "8/5", "8/8", "8/11", "8/14", "8/17", "8/20", "8/23", "8/26", "8/29", "9/1", "9/4",
      ];
      return dates.map((date, i) => {
        const gross = 1250000 + i * 85000 + Math.sin(i * 0.9) * 40000;
        return { date, gross: Math.round(gross), net: Math.round(gross * 0.995) };
      });
    }

    const dates = [
      "4/3", "4/9", "4/15", "4/21", "4/27",
      "5/3", "5/9", "5/15", "5/22", "5/29",
      "6/4", "6/10", "6/16", "6/22", "6/30",
    ];
    const rhythms = [35, 58, 42, 65, 40, 72, 38, 82, 52, 88, 44, 75, 50, 92, 60];
    return dates.map((date, i) => {
      const gross = 1850000 + rhythms[i] * 12000;
      return { date, gross, net: Math.round(gross * 0.994) };
    });
  }, [timeRange]);

  const rangeLabel =
    timeRange === "3m"
      ? t("chart.range3m")
      : timeRange === "30d"
        ? t("chart.range30d")
        : t("chart.range7d");

  const timeRangeOptions = [
    { id: "3m" as const, label: t("chart.last3m") },
    { id: "30d" as const, label: t("chart.last30d") },
    { id: "7d" as const, label: t("chart.last7d") },
  ] as const;

  return (
    <div
      id="chart-card-container"
      className="bg-surface border border-line/90 rounded-xl p-3 shadow-2xs hover:shadow-card transition-shadow duration-200 flex flex-col"
    >
      <div className="flex flex-row flex-wrap sm:flex-nowrap items-center justify-between gap-2 mb-3 shrink-0">
        <div className="min-w-0">
          <h2 className="text-base font-semibold text-fg tracking-tight whitespace-nowrap">
            {t("chart.title")}
          </h2>
          <p className="text-xs text-fg-secondary mt-0.5">{rangeLabel}</p>
        </div>

        <div className="inline-flex p-0.5 bg-hover rounded-lg border border-line text-xs font-medium self-start sm:self-auto shrink-0 whitespace-nowrap">
          {timeRangeOptions.map((opt) => (
            <button
              key={opt.id}
              id={`timerange-${opt.id}`}
              type="button"
              onClick={() => setTimeRange(opt.id)}
              className={`px-3 py-1 rounded-md transition-all cursor-pointer ${
                timeRange === opt.id
                  ? "bg-surface text-fg shadow-card font-semibold"
                  : "text-fg-secondary hover:text-fg"
              }`}
            >
              {opt.label}
            </button>
          ))}
        </div>
      </div>

      <div className="relative w-full flex-1 min-h-[300px] select-none">
        <ResponsiveContainer width="100%" height={300}>
          <AreaChart
            data={dataPoints}
            margin={{ top: 8, right: 12, left: 0, bottom: 0 }}
          >
            <defs>
              <linearGradient id="fillGross" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#27272a" stopOpacity={0.35} />
                <stop offset="100%" stopColor="#27272a" stopOpacity={0.02} />
              </linearGradient>
              <linearGradient id="fillNet" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#71717a" stopOpacity={0.4} />
                <stop offset="100%" stopColor="#71717a" stopOpacity={0.04} />
              </linearGradient>
            </defs>
            <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f4f4f5" />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              width={48}
              tickFormatter={formatAxisAmount}
              tick={{ fill: "#a1a1aa", fontSize: 11 }}
            />
            <Tooltip
              cursor={{ stroke: "#18181b", strokeDasharray: "3 3" }}
              content={({ active, payload, label }) => {
                if (!active || !payload?.length) return null;
                const gross = Number(payload.find((p) => p.dataKey === "gross")?.value ?? 0);
                const net = Number(payload.find((p) => p.dataKey === "net")?.value ?? 0);
                return (
                  <div className="rounded-lg border border-line bg-primary px-3 py-2 text-xs text-primary-foreground shadow-xl">
                    <div className="font-semibold border-b border-line pb-1 mb-1">{label}</div>
                    <div className="flex justify-between gap-4 text-zinc-300">
                      <span>{t("chart.gross")}</span>
                      <span className="font-mono text-white">¥{gross.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-zinc-300">
                      <span>{t("chart.net")}</span>
                      <span className="font-mono text-white">¥{net.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between gap-4 text-emerald-400 pt-1 mt-1 border-t border-line font-mono text-[11px]">
                      <span>{t("chart.matchRate")}</span>
                      <span>{gross ? ((net / gross) * 100).toFixed(2) : "0.00"}%</span>
                    </div>
                  </div>
                );
              }}
            />
            <Area
              type="monotone"
              dataKey="gross"
              name={t("chart.gross")}
              stroke="#18181b"
              strokeWidth={2}
              fill="url(#fillGross)"
              activeDot={{ r: 4.5, stroke: "#fff", strokeWidth: 2 }}
            />
            <Area
              type="monotone"
              dataKey="net"
              name={t("chart.net")}
              stroke="#52525b"
              strokeWidth={1.75}
              fill="url(#fillNet)"
              activeDot={{ r: 3.5, stroke: "#fff", strokeWidth: 1.5 }}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

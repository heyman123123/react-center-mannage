import React, { useState, useMemo } from "react";

interface TransactionAreaChartProps {
  timeRange: "3m" | "30d" | "7d";
  setTimeRange: (val: "3m" | "30d" | "7d") => void;
  currency: string;
}

export const TransactionAreaChart: React.FC<TransactionAreaChartProps> = ({
  timeRange,
  setTimeRange,
  currency,
}) => {
  const [hoveredIndex, setHoveredIndex] = useState<number | null>(null);

  // Generate date points and curve heights matching the aesthetic of the screenshot
  const dataPoints = useMemo(() => {
    if (timeRange === "7d") {
      const dates = ["Aug 29", "Aug 30", "Aug 31", "Sep 1", "Sep 2", "Sep 3", "Sep 4"];
      return dates.map((date, i) => {
        const val1 = 45 + Math.sin(i * 1.5) * 25 + Math.cos(i * 2.8) * 15;
        const val2 = 25 + Math.sin(i * 1.4 + 1) * 15;
        return {
          date,
          value1: Math.max(20, Math.min(90, val1)),
          value2: Math.max(10, Math.min(val1 - 8, val2)),
          gross: 420000 + i * 35000 + (i % 2) * 20000,
          net: 418000 + i * 34800 + (i % 2) * 19900,
        };
      });
    }

    if (timeRange === "30d") {
      const dates = [
        "Aug 5", "Aug 8", "Aug 11", "Aug 14", "Aug 17", "Aug 20", "Aug 23", "Aug 26", "Aug 29", "Sep 1", "Sep 4"
      ];
      return dates.map((date, i) => {
        const val1 = 50 + Math.sin(i * 0.9) * 30 + Math.cos(i * 2.1) * 12;
        const val2 = 28 + Math.sin(i * 0.9 + 0.8) * 18;
        return {
          date,
          value1: Math.max(25, Math.min(92, val1)),
          value2: Math.max(12, Math.min(val1 - 10, val2)),
          gross: 1250000 + i * 85000,
          net: 1245000 + i * 84600,
        };
      });
    }

    // Default: 3 months (matches the exact dates in the screenshot: Apr 3 -> Jun 30)
    const dates = [
      "Apr 3", "Apr 9", "Apr 15", "Apr 21", "Apr 27",
      "May 3", "May 9", "May 15", "May 22", "May 29",
      "Jun 4", "Jun 10", "Jun 16", "Jun 22", "Jun 30"
    ];

    // Values crafted to mirror the exact undulating rhythm in screenshot
    const rawRhythms = [
      { v1: 35, v2: 18 },
      { v1: 58, v2: 32 },
      { v1: 42, v2: 24 },
      { v1: 65, v2: 38 },
      { v1: 40, v2: 20 },
      { v1: 72, v2: 42 },
      { v1: 38, v2: 22 },
      { v1: 82, v2: 45 },
      { v1: 52, v2: 30 },
      { v1: 88, v2: 48 },
      { v1: 44, v2: 25 },
      { v1: 75, v2: 40 },
      { v1: 50, v2: 28 },
      { v1: 92, v2: 50 },
      { v1: 60, v2: 35 },
    ];

    return dates.map((date, i) => ({
      date,
      value1: rawRhythms[i]?.v1 || 50,
      value2: rawRhythms[i]?.v2 || 25,
      gross: 1850000 + (rawRhythms[i]?.v1 || 50) * 12000,
      net: 1842000 + (rawRhythms[i]?.v2 || 25) * 11950,
    }));
  }, [timeRange]);

  // Compute SVG smooth bezier curve paths
  const svgWidth = 1000;
  const svgHeight = 260;
  const paddingX = 40;
  const paddingY = 20;

  const points1 = useMemo(() => {
    return dataPoints.map((d, i) => {
      const x = paddingX + (i / (dataPoints.length - 1)) * (svgWidth - paddingX * 2);
      const y = svgHeight - paddingY - (d.value1 / 100) * (svgHeight - paddingY * 2);
      return { x, y };
    });
  }, [dataPoints]);

  const points2 = useMemo(() => {
    return dataPoints.map((d, i) => {
      const x = paddingX + (i / (dataPoints.length - 1)) * (svgWidth - paddingX * 2);
      const y = svgHeight - paddingY - (d.value2 / 100) * (svgHeight - paddingY * 2);
      return { x, y };
    });
  }, [dataPoints]);

  const generateSmoothPath = (pts: { x: number; y: number }[]) => {
    if (pts.length === 0) return "";
    let path = `M ${pts[0].x} ${pts[0].y}`;
    for (let i = 0; i < pts.length - 1; i++) {
      const curr = pts[i];
      const next = pts[i + 1];
      const mx = (curr.x + next.x) / 2;
      path += ` C ${mx} ${curr.y}, ${mx} ${next.y}, ${next.x} ${next.y}`;
    }
    return path;
  };

  const path1 = useMemo(() => generateSmoothPath(points1), [points1]);
  const path2 = useMemo(() => generateSmoothPath(points2), [points2]);

  const area1 = useMemo(() => {
    if (points1.length === 0) return "";
    const bottomY = svgHeight - paddingY;
    return `${path1} L ${points1[points1.length - 1].x} ${bottomY} L ${points1[0].x} ${bottomY} Z`;
  }, [path1, points1]);

  const area2 = useMemo(() => {
    if (points2.length === 0) return "";
    const bottomY = svgHeight - paddingY;
    return `${path2} L ${points2[points2.length - 1].x} ${bottomY} L ${points2[0].x} ${bottomY} Z`;
  }, [path2, points2]);

  const activePoint = hoveredIndex !== null ? dataPoints[hoveredIndex] : null;
  const activeCoord1 = hoveredIndex !== null ? points1[hoveredIndex] : null;

  return (
    <div
      id="chart-card-container"
      className="bg-surface border border-line/90 rounded-xl p-5 shadow-2xs hover:shadow-card transition-shadow duration-200"
    >
      {/* Chart Card Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-base font-semibold text-fg tracking-tight">
            Total Transaction Volume (聚合交易流水与清算峰值)
          </h2>
          <p className="text-xs text-fg-secondary mt-0.5">
            {timeRange === "3m"
              ? "Total for the last 3 months (双轨比对: 业务订单流 vs 渠道平账实收)"
              : timeRange === "30d"
              ? "Total for the last 30 days"
              : "Total for the last 7 days"}
          </p>
        </div>

        {/* Time range switcher (mirrors screenshot's right segmented control) */}
        <div className="inline-flex p-0.5 bg-hover rounded-lg border border-line text-xs font-medium self-start sm:self-auto">
          <button
            id="timerange-3m"
            onClick={() => setTimeRange("3m")}
            className={`px-3 py-1 rounded-md transition-all ${
              timeRange === "3m"
                ? "bg-surface text-fg shadow-card font-semibold"
                : "text-fg-secondary hover:text-fg"
            }`}
          >
            Last 3 months
          </button>
          <button
            id="timerange-30d"
            onClick={() => setTimeRange("30d")}
            className={`px-3 py-1 rounded-md transition-all ${
              timeRange === "30d"
                ? "bg-surface text-fg shadow-card font-semibold"
                : "text-fg-secondary hover:text-fg"
            }`}
          >
            Last 30 days
          </button>
          <button
            id="timerange-7d"
            onClick={() => setTimeRange("7d")}
            className={`px-3 py-1 rounded-md transition-all ${
              timeRange === "7d"
                ? "bg-surface text-fg shadow-card font-semibold"
                : "text-fg-secondary hover:text-fg"
            }`}
          >
            Last 7 days
          </button>
        </div>
      </div>

      {/* SVG Canvas with screenshot's exact monochrome dual-layered aesthetic */}
      <div className="relative w-full overflow-hidden select-none">
        <svg
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          className="w-full h-56 md:h-64"
          preserveAspectRatio="none"
          onMouseLeave={() => setHoveredIndex(null)}
        >
          <defs>
            {/* Upper curve gradient */}
            <linearGradient id="curveGradient1" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#27272a" stopOpacity="0.45" />
              <stop offset="60%" stopColor="#52525b" stopOpacity="0.15" />
              <stop offset="100%" stopColor="#71717a" stopOpacity="0.02" />
            </linearGradient>

            {/* Lower curve gradient */}
            <linearGradient id="curveGradient2" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#3f3f46" stopOpacity="0.55" />
              <stop offset="80%" stopColor="#a1a1aa" stopOpacity="0.18" />
              <stop offset="100%" stopColor="#e4e4e7" stopOpacity="0.05" />
            </linearGradient>
          </defs>

          {/* Subtle horizontal grid guide lines */}
          <line
            x1={paddingX}
            y1={svgHeight - paddingY}
            x2={svgWidth - paddingX}
            y2={svgHeight - paddingY}
            stroke="#e4e4e7"
            strokeWidth="1"
          />
          <line
            x1={paddingX}
            y1={svgHeight * 0.65}
            x2={svgWidth - paddingX}
            y2={svgHeight * 0.65}
            stroke="#f4f4f5"
            strokeDasharray="4 4"
            strokeWidth="1"
          />
          <line
            x1={paddingX}
            y1={svgHeight * 0.35}
            x2={svgWidth - paddingX}
            y2={svgHeight * 0.35}
            stroke="#f4f4f5"
            strokeDasharray="4 4"
            strokeWidth="1"
          />

          {/* Shaded Areas */}
          <path d={area1} fill="url(#curveGradient1)" />
          <path d={area2} fill="url(#curveGradient2)" />

          {/* Main Stroke Curves */}
          <path
            d={path1}
            fill="none"
            stroke="#18181b"
            strokeWidth="2"
            strokeLinecap="round"
          />
          <path
            d={path2}
            fill="none"
            stroke="#3f3f46"
            strokeWidth="1.75"
            strokeLinecap="round"
          />

          {/* Invisible hover trigger columns for silky-smooth cursor interaction */}
          {points1.map((p, idx) => (
            <g key={idx}>
              <rect
                x={p.x - 20}
                y={0}
                width={40}
                height={svgHeight}
                fill="transparent"
                className="cursor-crosshair"
                onMouseEnter={() => setHoveredIndex(idx)}
              />
              {hoveredIndex === idx && (
                <>
                  <line
                    x1={p.x}
                    y1={paddingY}
                    x2={p.x}
                    y2={svgHeight - paddingY}
                    stroke="#18181b"
                    strokeWidth="1.5"
                    strokeDasharray="3 3"
                  />
                  <circle
                    cx={p.x}
                    cy={p.y}
                    r="4.5"
                    fill="#18181b"
                    stroke="#ffffff"
                    strokeWidth="2"
                  />
                  <circle
                    cx={points2[idx].x}
                    cy={points2[idx].y}
                    r="3.5"
                    fill="#71717a"
                    stroke="#ffffff"
                    strokeWidth="1.5"
                  />
                </>
              )}
            </g>
          ))}
        </svg>

        {/* Hover Tooltip Overlay */}
        {activePoint && activeCoord1 && (
          <div
            className="absolute top-2 pointer-events-none bg-primary text-primary-foreground rounded-lg px-3 py-2 text-xs shadow-xl z-20 border border-line transition-all duration-75"
            style={{
              left: `${Math.min(
                Math.max(activeCoord1.x - 75, 10),
                svgWidth - 160
              )}px`,
            }}
          >
            <div className="font-semibold text-zinc-200 border-b border-line pb-1 mb-1">
              {activePoint.date} (实时对账详情)
            </div>
            <div className="flex items-center justify-between gap-3 text-zinc-300">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-surface inline-block" />
                业务应收:
              </span>
              <span className="font-mono font-medium text-white">
                ¥{activePoint.gross.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-zinc-300">
              <span className="flex items-center gap-1">
                <span className="w-2 h-2 rounded-full bg-hover inline-block" />
                渠道实收:
              </span>
              <span className="font-mono font-medium text-white">
                ¥{activePoint.net.toLocaleString()}
              </span>
            </div>
            <div className="flex items-center justify-between gap-3 text-emerald-400 text-[11px] pt-1 mt-1 border-t border-line font-mono">
              <span>自动平账率:</span>
              <span>
                {((activePoint.net / activePoint.gross) * 100).toFixed(2)}%
              </span>
            </div>
          </div>
        )}
      </div>

      {/* X Axis Date labels (exact match to screenshot's dates: Apr 3 ... Jun 30) */}
      <div className="flex items-center justify-between px-4 mt-2 text-[11px] text-fg-tertiary font-mono overflow-x-auto">
        {dataPoints.map((d, i) => (
          <span
            key={i}
            className={`${
              hoveredIndex === i ? "text-fg font-semibold" : ""
            } transition-colors`}
          >
            {d.date}
          </span>
        ))}
      </div>
    </div>
  );
};

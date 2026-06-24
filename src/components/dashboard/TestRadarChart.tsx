"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo } from 'react';
import { Target } from 'lucide-react';
import { KniCard } from '@/components/KniPrimitives';

interface RadarStat {
  key: string;
  label: string;
  correct: number;
  total: number;
  percentage: number;
}

interface TestRadarChartProps {
  radarStats: RadarStat[];
  isActiveModule: boolean;
}

export function TestRadarChart({ radarStats, isActiveModule }: TestRadarChartProps) {
  const cx = 150;
  const cy = 120;
  const maxRadius = 70;

  const N = radarStats.length;
  const vertices = useMemo(() => {
    if (N === 0) return [];
    return radarStats.map((stat, i) => {
      const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
      const gridX = cx + maxRadius * Math.cos(angle);
      const gridY = cy + maxRadius * Math.sin(angle);
      const scoreRadius = (stat.percentage / 100) * maxRadius;
      const scoreX = cx + scoreRadius * Math.cos(angle);
      const scoreY = cy + scoreRadius * Math.sin(angle);
      return {
        ...stat,
        angle,
        gridX,
        gridY,
        scoreX,
        scoreY,
      };
    });
  }, [radarStats, N]);

  const pointsStr = useMemo(() => {
    return vertices.map(v => `${v.scoreX.toFixed(1)},${v.scoreY.toFixed(1)}`).join(' ');
  }, [vertices]);

  const GRID_LEVELS = [25, 50, 75, 100];

  const gridPolygons = useMemo(() => {
    if (N === 0) return [];
    return GRID_LEVELS.map(level => {
      const radius = (level / 100) * maxRadius;
      return vertices.map((_, i) => {
        const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
        const x = cx + radius * Math.cos(angle);
        const y = cy + radius * Math.sin(angle);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      }).join(' ');
    });
  }, [vertices, N]);

  const totalCorrect = radarStats.reduce((sum, item) => sum + item.correct, 0);
  const totalQuestions = radarStats.reduce((sum, item) => sum + item.total, 0);
  const overallMastery = totalQuestions > 0
    ? Math.round((totalCorrect / totalQuestions) * 100)
    : 0;

  if (!isActiveModule) {
    return (
      <KniCard className="p-5 sm:p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600">
              Mastery Breakdown
            </p>
            <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
              Section Performance
            </h2>
          </div>
          <div className="grid size-11 place-items-center rounded-full bg-orange-50 text-orange-600">
            <Target className="size-5" />
          </div>
        </div>

        <div className="mt-6 py-8 text-center">
          <p className="text-sm text-slate-500">
            Select a module to see mastery breakdown.
          </p>
        </div>
      </KniCard>
    );
  }

  return (
    <KniCard className="p-5 sm:p-6 flex flex-col">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600">
            Mastery Breakdown
          </p>
          <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
            Section Performance
          </h2>
        </div>
        <div className="grid size-11 place-items-center rounded-full bg-orange-50 text-orange-600">
          <Target className="size-5" />
        </div>
      </div>

      <div className="mt-5 relative w-full aspect-[4/3] flex items-center justify-center overflow-visible">
        <svg viewBox="0 0 300 240" className="w-full h-full overflow-visible select-none">
          <defs>
            <linearGradient id="radarFill" x1="0%" x2="100%">
              <stop offset="0%" stopColor="#ea580c" stopOpacity="0.3" />
              <stop offset="100%" stopColor="#f97316" stopOpacity="0.15" />
            </linearGradient>
          </defs>

          {/* Concentric grid polygons */}
          {gridPolygons.map((points, idx) => (
            <polygon
              key={idx}
              points={points}
              fill="none"
              stroke="#e2e8f0"
              strokeWidth="1"
            />
          ))}

          {/* Axis grid lines */}
          {vertices.map((v, i) => (
            <line
              key={i}
              x1={cx}
              y1={cy}
              x2={v.gridX}
              y2={v.gridY}
              stroke="#e2e8f0"
              strokeWidth="1"
              strokeDasharray="4 6"
            />
          ))}

          {/* Grid percentage labels */}
          {GRID_LEVELS.map((level) => {
            const radius = (level / 100) * maxRadius;
            return (
              <text
                key={level}
                x={cx + 4}
                y={cy - radius + 3}
                className="text-[9px] font-semibold fill-slate-350"
              >
                {level}%
              </text>
            );
          })}

          {/* User score polygon */}
          {pointsStr && (
            <polygon
              points={pointsStr}
              fill="url(#radarFill)"
              stroke="#ea580c"
              strokeWidth="3"
              strokeLinejoin="round"
              className="transition-all duration-300"
            />
          )}

          {/* Score vertex dots */}
          {vertices.map((v, i) => (
            <circle
              key={i}
              cx={v.scoreX}
              cy={v.scoreY}
              r="4"
              fill="#ea580c"
              stroke="white"
              strokeWidth="2"
            />
          ))}

          {/* Axis labels with wrapping */}
          {vertices.map((v, i) => {
            const isVertical = Math.abs(Math.sin(v.angle)) > 0.9;
            const labelRadius = maxRadius + (isVertical ? 25 : 12);
            const x = cx + labelRadius * Math.cos(v.angle);
            const y = cy + labelRadius * Math.sin(v.angle) + 4;
            const anchor = x > cx + 15 ? 'start' : x < cx - 15 ? 'end' : 'middle';

            const labelStr = v.label || '';
            const words = labelStr.split(' ');
            const lines: string[] = [];
            let currentLine = '';

            words.forEach(word => {
              if (currentLine.length + word.length > 18) {
                if (currentLine) lines.push(currentLine.trim());
                currentLine = word + ' ';
              } else {
                currentLine += word + ' ';
              }
            });
            if (currentLine) lines.push(currentLine.trim());

            if (lines.length <= 1) {
              return (
                <text
                  key={i}
                  x={x}
                  y={y}
                  textAnchor={anchor}
                  className="text-[8px] font-black fill-slate-500 uppercase tracking-wider"
                >
                  {labelStr}
                </text>
              );
            }

            const startY = y - ((lines.length - 1) * 8.5) / 2;

            return (
              <text
                key={i}
                x={x}
                y={startY}
                textAnchor={anchor}
                className="text-[8px] font-black fill-slate-500 uppercase tracking-wider"
              >
                {lines.map((line, idx) => (
                  <tspan key={idx} x={x} dy={idx === 0 ? 0 : 8.5}>
                    {line}
                  </tspan>
                ))}
              </text>
            );
          })}
        </svg>
      </div>

      {/* Stats legend grid */}
      <div className="mt-5 grid grid-cols-3 gap-x-3 gap-y-2 border-t border-slate-100 pt-4 shrink-0">
        {radarStats.map((stat) => (
          <div key={stat.key} className="flex flex-col">
            <span className="text-[10px] font-bold text-slate-400 truncate leading-tight uppercase tracking-wider" title={stat.label}>
              {stat.label}
            </span>
            <span className="text-sm font-black text-slate-950 mt-1">
              {stat.percentage}%
              <span className="text-[10px] font-medium text-slate-400 ml-1">
                ({stat.correct}/{stat.total})
              </span>
            </span>
          </div>
        ))}
      </div>

      {/* Overall mastery indicator */}
      <div className="mt-5 pt-4 border-t border-slate-100">
        <div className="flex items-center justify-between mb-2">
          <span className="text-xs font-medium text-slate-500">Overall mastery</span>
          <span className="text-sm font-black text-slate-950">{overallMastery}%</span>
        </div>
        <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-orange-500 rounded-full transition-all duration-300"
            style={{ width: `${overallMastery}%` }}
          />
        </div>
      </div>
    </KniCard>
  );
}

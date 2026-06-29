"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useMemo, useState } from 'react';
import {
  ArrowUpRight,
  BarChart3,
  Check,
  ChevronRight,
  Clock3,
  Book,
  Target,
  Timer,
} from 'lucide-react';
import {
  KniButton,
  KniCard,
  KniProgress,
  type DashboardView as DashboardViewType,
} from '@/components/KniPrimitives';
import { MODULE_TEST_LABELS } from '@/lib/constants';
import type { ModuleTestType, Profile } from '@/lib/types';
import { cn } from '@/lib/utils';

interface DashboardViewProps {
  profile: Profile | null;
  activeModule: ModuleTestType | null;
  pastExams: any[];
  examLimit: number | null;
  onViewChange: (view: DashboardViewType) => void;
  onReviewAttempt: (attempt: any) => void;
  onResumeAttempt: (attempt: any) => void;
  radarStats: {
    key: string;
    label: string;
    correct: number;
    total: number;
    percentage: number;
  }[];
  activeFormatTab: 'Digital' | 'Paper';
  onFormatTabChange: (tab: 'Digital' | 'Paper') => void;
}

function firstName(name?: string | null) {
  if (!name) return 'Student';
  return name.trim().split(/\s+/)[0] || 'Student';
}

function smoothPath(points: Array<{ x: number; y: number }>) {
  if (points.length < 2) return '';

  return points.reduce((path, point, index) => {
    if (index === 0) return `M ${point.x} ${point.y}`;
    const previous = points[index - 1];
    const controlX = (previous.x + point.x) / 2;
    return `${path} C ${controlX} ${previous.y}, ${controlX} ${point.y}, ${point.x} ${point.y}`;
  }, '');
}

function formatAttemptDate(value?: string) {
  if (!value) return 'Date unavailable';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 'Date unavailable';
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short' });
}

const GRID_LEVELS = [25, 50, 75, 100];

export function DashboardView({
  profile,
  activeModule,
  pastExams,
  examLimit,
  onViewChange,
  radarStats,
  onReviewAttempt,
  onResumeAttempt,
  activeFormatTab,
  onFormatTabChange,
}: DashboardViewProps) {
  const [avatarImageError, setAvatarImageError] = useState(false);
  const [chartViewMode, setChartViewMode] = useState<'graph' | 'list'>('graph');

  const cx = 200;
  const cy = 150;
  const maxRadius = 82;

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

  const filteredPastExams = useMemo(() => {
    return [...pastExams]
      .filter((attempt) => (attempt.exams?.format || 'Digital') === activeFormatTab)
      .sort((a, b) => (
        new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime()
      ));
  }, [activeFormatTab, pastExams]);

  const weaknessOrder = useMemo(
    () => [...radarStats].sort((a, b) => a.percentage - b.percentage),
    [radarStats],
  );

  const selectedActivity =
    weaknessOrder[0] ?? {
      key: 'first-session',
      label: 'Start your first practice session',
      percentage: 0,
      correct: 0,
      total: 0,
    };

  const completedAttempts = filteredPastExams.filter(attempt => attempt.status === 'completed');
  const inProgressAttempts = filteredPastExams.filter(attempt => attempt.status !== 'completed');
  const latestAttempt = filteredPastExams[0];
  const totalCorrect = radarStats.reduce((sum, item) => sum + item.correct, 0);
  const totalQuestions = radarStats.reduce((sum, item) => sum + item.total, 0);
  const overallMastery = totalQuestions > 0
    ? Math.round((totalCorrect / totalQuestions) * 100)
    : 0;
  const moduleLabel =
    MODULE_TEST_LABELS[activeModule || profile?.module_test || ''] || 'Module not selected';

  const chartAttempts = completedAttempts.slice(0, 7).reverse();
  const chartWidth = 520;
  const chartHeight = 210;
  const chartTop = 24;
  const chartBottom = 164;
  const chartSide = 24;
  const chartPoints = chartAttempts.map((attempt, index) => {
    const percentage = attempt.max_score > 0
      ? Math.round(((attempt.total_score ?? 0) / attempt.max_score) * 100)
      : 0;
    const x = chartAttempts.length === 1
      ? chartWidth / 2
      : chartSide + index * ((chartWidth - chartSide * 2) / (chartAttempts.length - 1));
    const y = chartBottom - (percentage / 100) * (chartBottom - chartTop);
    return { x, y, percentage, attempt };
  });
  const chartPath = smoothPath(chartPoints);

  const latestScore = latestAttempt?.max_score > 0
    ? Math.round(((latestAttempt.total_score ?? 0) / latestAttempt.max_score) * 100)
    : 0;
  const attemptsRemaining = examLimit === null
    ? null
    : Math.max(0, examLimit - pastExams.length);

  return (
    <div className="mx-auto w-full">
      <div className="grid gap-7 xl:grid-cols-[minmax(0,1.15fr)_minmax(340px,0.85fr)]">
        <section className="flex min-w-0 flex-col gap-6">
          <div className="grid overflow-hidden rounded-[26px] bg-kni-soft sm:min-h-[250px] sm:grid-cols-[minmax(0,1fr)_250px]">
            <div className="relative z-10 p-6 sm:p-8 lg:p-10">
              {/* <span className="inline-flex items-center gap-2 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-orange-700 shadow-sm">
                <Book className="size-3.5" />
                Your preparation space
              </span> */}
              <h2 className="text-3xl font-black tracking-[-0.045em] text-slate-950 sm:text-4xl">
                Hello {firstName(profile?.full_name)}!
              </h2>
              <p className="mt-3 max-w-lg text-sm leading-6 text-slate-500">
                Keep today simple: strengthen one weak area, then use a mock test to measure the difference.
              </p>

              <div className="mt-6 flex flex-wrap gap-2">
                <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-600">
                  {moduleLabel}
                </span>
                <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-600">
                  {profile?.format || 'Format not selected'}
                </span>
                <span className="rounded-full border border-slate-200 bg-white/80 px-3 py-1.5 text-xs font-bold text-slate-600">
                  {profile?.status || 'Pending'}
                </span>
              </div>
            </div>

            <div className="relative min-h-44 overflow-hidden sm:min-h-full">
              <div className="absolute -bottom-20 right-0 size-64 rounded-full bg-orange-100/90" />
              <div className="absolute bottom-7 right-14 grid size-32 rotate-3 place-items-center rounded-[34px] bg-kni-ink text-white shadow-2xl shadow-slate-400/30 overflow-hidden">
                {profile?.avatar_url && !avatarImageError ? (
                  <img
                    src={profile.avatar_url}
                    alt={profile.full_name || 'Profile'}
                    onError={() => setAvatarImageError(true)}
                    className="size-full object-cover -rotate-3 scale-110"
                  />
                ) : (
                  <span className="text-4xl font-black -rotate-3 uppercase select-none">
                    {firstName(profile?.full_name).charAt(0)}
                  </span>
                )}
              </div>
              <div className="absolute right-9 top-8 size-8 rounded-full border-[9px] border-orange-500" />
              <div className="absolute bottom-11 left-6 size-4 rounded-full bg-orange-400 sm:left-2" />
            </div>
          </div>

          {/* <KniCard className="flex flex-col gap-4 p-4 sm:flex-row sm:items-center">
            <div className="grid size-12 shrink-0 place-items-center rounded-full bg-orange-50 text-orange-600">
              <Target className="size-6" />
            </div>
            <div className="min-w-0 flex-1">
              <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                Recommended next
              </p>
              <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1">
                <h3 className="truncate text-base font-black text-slate-950">{selectedActivity.label}</h3>
                <span className="text-xs font-semibold text-slate-400">
                  {selectedActivity.total > 0
                    ? `${selectedActivity.correct}/${selectedActivity.total} correct`
                    : 'Ready for your first session'}
                </span>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="grid size-12 place-items-center rounded-full border-4 border-orange-100 text-xs font-black text-orange-700">
                {selectedActivity.percentage}%
              </div>
              <KniButton
                onClick={() => onViewChange('practice')}
                className="h-11 px-5 text-sm"
              >
                Continue
                <ChevronRight className="size-4" />
              </KniButton>
            </div>
          </KniCard> */}

          <KniCard className="p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600">
                  Performance
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                  Mock score trend
                </h2>
              </div>
              <div className="flex flex-wrap items-center gap-2 pb-4">
                {/* View toggle (Graph / List) */}
                {/* <div className="flex rounded-xl bg-slate-100 p-1">
                  <button
                    type="button"
                    onClick={() => setChartViewMode('graph')}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] transition',
                      chartViewMode === 'graph'
                        ? 'bg-white text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-slate-700',
                    )}
                  >
                    Graph
                  </button>
                  <button
                    type="button"
                    onClick={() => setChartViewMode('list')}
                    className={cn(
                      'rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] transition',
                      chartViewMode === 'list'
                        ? 'bg-white text-slate-950 shadow-sm'
                        : 'text-slate-400 hover:text-slate-700',
                    )}
                  >
                    List
                  </button>
                </div> */}

                {/* Digital / Paper format tabs */}
                <div className="flex rounded-xl bg-slate-100 p-1">
                  {(['Digital', 'Paper'] as const).map(format => (
                    <button
                      key={format}
                      type="button"
                      onClick={() => onFormatTabChange(format)}
                      className={cn(
                        'rounded-lg px-3 py-1.5 text-[10px] font-bold uppercase tracking-[0.1em] transition',
                        activeFormatTab === format
                          ? 'bg-white text-slate-950 shadow-sm'
                          : 'text-slate-400 hover:text-slate-700',
                      )}
                    >
                      {format}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {chartViewMode === 'graph' ? (
              chartPoints.length > 0 ? (
                <div className="mt-5 overflow-x-auto">
                  <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="min-w-[430px] w-full select-none"
                    aria-label={`${activeFormatTab} mock test score trend`}
                    role="img"
                  >
                    {[0, 25, 50, 75, 100].map(value => {
                      const y = chartBottom - (value / 100) * (chartBottom - chartTop);
                      return (
                        <g key={value}>
                          <line
                            x1={chartSide}
                            x2={chartWidth - chartSide}
                            y1={y}
                            y2={y}
                            stroke="#e2e8f0"
                            strokeDasharray="4 6"
                          />
                          <text x={0} y={y + 3} className="fill-slate-300 text-[9px] font-semibold">
                            {value}
                          </text>
                        </g>
                      );
                    })}

                    {chartPath && (
                      <path
                        d={chartPath}
                        fill="none"
                        stroke="#15171b"
                        strokeWidth="3"
                        strokeLinecap="round"
                      />
                    )}

                    {chartPoints.map((point, index) => (
                      <g key={point.attempt.id || index}>
                        <circle cx={point.x} cy={point.y} r="5" fill="#ea580c" stroke="white" strokeWidth="3" />
                        <text
                          x={point.x}
                          y={point.y - 12}
                          textAnchor="middle"
                          className="fill-slate-700 text-[10px] font-black"
                        >
                          {point.percentage}%
                        </text>
                        <text
                          x={point.x}
                          y={194}
                          textAnchor="middle"
                          className="fill-slate-400 text-[9px] font-semibold"
                        >
                          {formatAttemptDate(point.attempt.created_at)}
                        </text>
                      </g>
                    ))}
                  </svg>
                </div>
              ) : (
                <div className="mt-5 grid min-h-52 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
                  <div>
                    <BarChart3 className="mx-auto size-7 text-slate-300" />
                    <p className="mt-3 text-sm font-bold text-slate-700">No completed {activeFormatTab.toLowerCase()} mocks yet</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Your score trend will appear after the first completed test.
                    </p>
                  </div>
                </div>
              )
            ) : (
              completedAttempts.length > 0 ? (
                <div className="mt-5 max-h-[300px] overflow-y-auto pr-1.5 space-y-3 custom-scrollbar">
                  {completedAttempts.map((attempt) => {
                    const percentage = attempt.max_score > 0
                      ? Math.round(((attempt.total_score ?? 0) / attempt.max_score) * 100)
                      : 0;
                    return (
                      <div
                        key={attempt.id}
                        className="flex items-center justify-between gap-4 rounded-2xl border border-slate-100 bg-white p-4 shadow-sm hover:border-orange-200 transition"
                      >
                        <div className="min-w-0 flex-1">
                          <h4 className="font-bold text-slate-900 truncate">
                            {attempt.exams?.title || 'Mock Test'}
                          </h4>
                          <p className="mt-1 text-xs text-slate-400">
                            Taken on {formatAttemptDate(attempt.created_at)}
                          </p>
                        </div>
                        <div className="flex items-center gap-4">
                          <div className="text-right">
                            <span className="text-sm font-black text-slate-950">{percentage}%</span>
                            <p className="text-[10px] text-slate-400">
                              {attempt.total_score}/{attempt.max_score} correct
                            </p>
                          </div>
                          <KniButton
                            variant="secondary"
                            onClick={() => onReviewAttempt(attempt)}
                            className="h-9 px-4 text-xs font-bold"
                          >
                            Review
                          </KniButton>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="mt-5 grid min-h-52 place-items-center rounded-2xl border border-dashed border-slate-200 bg-slate-50/70 p-6 text-center">
                  <div>
                    <BarChart3 className="mx-auto size-7 text-slate-300" />
                    <p className="mt-3 text-sm font-bold text-slate-700">No completed {activeFormatTab.toLowerCase()} mocks yet</p>
                    <p className="mt-1 text-xs leading-5 text-slate-400">
                      Your mock history will appear after the first completed test.
                    </p>
                  </div>
                </div>
              )
            )}
          </KniCard>
        </section>

        <aside className="flex min-w-0 flex-col gap-6 h-full">
          {/* <div className="grid grid-cols-2 gap-3">
            <KniCard className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    Completed
                  </p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                    {completedAttempts.length}
                  </p>
                </div>
                <div className="grid size-10 place-items-center rounded-full bg-emerald-50 text-emerald-600">
                  <Check className="size-5" />
                </div>
              </div>
              <p className="mt-3 text-xs font-medium text-slate-400">
                {activeFormatTab} mock tests
              </p>
            </KniCard>

            <KniCard className="p-5">
              <div className="flex items-start justify-between gap-3">
                <div>
                  <p className="text-[10px] font-bold uppercase tracking-[0.16em] text-slate-400">
                    In progress
                  </p>
                  <p className="mt-2 text-3xl font-black tracking-tight text-slate-950">
                    {inProgressAttempts.length}
                  </p>
                </div>
                <div className="grid size-10 place-items-center rounded-full bg-orange-50 text-orange-600">
                  <Clock3 className="size-5" />
                </div>
              </div>
              <p className="mt-3 text-xs font-medium text-slate-400">
                {attemptsRemaining === null ? 'No attempt limit' : `${attemptsRemaining} attempts remaining`}
              </p>
            </KniCard>
          </div> */}

          <KniCard className="p-5 sm:p-6 flex flex-col h-full">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600">
                  Proficiency Radar
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                  Module mastery
                </h2>
              </div>
              <div className="grid size-11 place-items-center rounded-full bg-orange-50 text-orange-600">
                <Target className="size-5" />
              </div>
            </div>

            <div className="mt-5 relative w-full aspect-[4/3] flex items-center justify-center overflow-visible">
              <svg viewBox="0 0 400 300" className="w-full h-full overflow-visible select-none">
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
                    if (currentLine.length + word.length > 21) {
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
            <div className="mt-5 grid grid-cols-2 gap-x-4 gap-y-2 border-t border-slate-100 pt-4 shrink-0">
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
          </KniCard>



          {/* <KniCard className="p-5 sm:p-6">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Readiness snapshot
                </p>
                <h2 className="mt-1 text-xl font-black tracking-tight text-slate-950">
                  {overallMastery}% overall mastery
                </h2>
              </div>
              <div className="grid size-11 place-items-center rounded-full bg-orange-50 text-orange-600">
                <Target className="size-5" />
              </div>
            </div>

            <KniProgress value={overallMastery} className="mt-5 h-3" />

            <div className="mt-5 space-y-3">
              {weaknessOrder.slice(0, 3).map(item => (
                <div key={item.key} className="flex items-center justify-between gap-3">
                  <p className="truncate text-sm font-bold text-slate-700">{item.label}</p>
                  <span className="shrink-0 text-sm font-black text-slate-950">{item.percentage}%</span>
                </div>
              ))}
              {weaknessOrder.length === 0 && (
                <p className="text-sm leading-6 text-slate-400">
                  Complete a practice session to build your readiness profile.
                </p>
              )}
            </div>
          </KniCard>

          <KniCard className="p-5 sm:p-6">
            <div className="flex items-center gap-3">
              <div className="grid size-11 place-items-center rounded-2xl bg-slate-100 text-slate-700">
                <Timer className="size-5" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400">
                  Latest mock
                </p>
                <h3 className="mt-1 truncate text-base font-black text-slate-950">
                  {latestAttempt?.exams?.title || 'No mock test yet'}
                </h3>
              </div>
              {latestAttempt?.status === 'completed' && (
                <span className="text-lg font-black text-slate-950">{latestScore}%</span>
              )}
            </div>

            <p className="mt-4 text-sm leading-6 text-slate-500">
              {latestAttempt
                ? `${latestAttempt.status === 'completed' ? 'Completed' : 'Started'} ${formatAttemptDate(latestAttempt.created_at)}`
                : 'Run a timed mock test when you are ready to measure your progress.'}
            </p>

            <KniButton
              variant={latestAttempt ? 'secondary' : 'primary'}
              onClick={() => {
                if (!latestAttempt) {
                  onViewChange('mock');
                } else if (latestAttempt.status === 'completed') {
                  onReviewAttempt(latestAttempt);
                } else {
                  onResumeAttempt(latestAttempt);
                }
              }}
              className="mt-5 h-11 w-full px-4 text-sm"
            >
              {latestAttempt
                ? latestAttempt.status === 'completed' ? 'Review attempt' : 'Resume attempt'
                : 'Browse mock tests'}
              <ArrowUpRight className="size-4" />
            </KniButton>
          </KniCard> */}
        </aside>
      </div>
    </div>
  );
}

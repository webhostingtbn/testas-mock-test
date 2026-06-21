"use client";

import { useState } from 'react';
import {
  CircleUserRound, Target, CheckCircle2, ShieldCheck, BookOpen, Timer
} from 'lucide-react';
import { KniCard, KniButton, type DashboardView as DashboardViewType } from '@/components/KniPrimitives';
import { MODULE_TEST_LABELS } from '@/lib/constants';
import type { Profile, ModuleTestType } from '@/lib/types';

interface DashboardViewProps {
  profile: Profile | null;
  activeModule: ModuleTestType | null;
  pastExams: any[];
  examLimit: number | null;
  onViewChange: (view: DashboardViewType) => void;
  onReviewAttempt: (attempt: any) => void;
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

export function DashboardView({
  profile,
  activeModule,
  pastExams,
  examLimit,
  onViewChange,
  radarStats,
  onReviewAttempt,
  activeFormatTab,
  onFormatTabChange,
}: DashboardViewProps) {
  const filteredPastExams = pastExams.filter((attempt) => {
    const examFormat = attempt.exams?.format || 'Digital';
    return examFormat === activeFormatTab;
  });

  const cx = 200;
  const cy = 150;
  const maxRadius = 82;

  const N = radarStats.length;
  const vertices = radarStats.map((stat, i) => {
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

  const pointsStr = vertices.map(v => `${v.scoreX.toFixed(1)},${v.scoreY.toFixed(1)}`).join(' ');

  const gridLevels = [25, 50, 75, 100];
  const gridPolygons = gridLevels.map(level => {
    const radius = (level / 100) * maxRadius;
    return vertices.map((_, i) => {
      const angle = (i * 2 * Math.PI) / N - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  });

  return (
    <div className="mx-auto w-full max-w-7xl lg:h-[calc(100vh-105px)] lg:flex lg:flex-col lg:overflow-hidden lg:pb-1">
      <div className="mb-2 shrink-0">
        {/* <p className="text-[11px] font-bold uppercase tracking-wider text-orange-700">Student Home</p> */}
        <h2 className="mt-0.5 text-xl font-bold text-slate-900 md:text-2xl">
          Welcome back, {profile?.full_name || 'Student'}
        </h2>
      </div>

      <div className="grid gap-2.5 grid-cols-2 lg:grid-cols-4 shrink-0">
        <KniCard className="p-2.5 flex items-center gap-2.5">
          <div className="grid size-8.5 place-items-center rounded-xl bg-orange-100 text-orange-700 shrink-0">
            <CircleUserRound className="size-4.5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 leading-none">Account status</p>
            <p className="text-sm font-bold text-slate-900 leading-tight mt-1">{profile?.status || 'Pending'}</p>
          </div>
        </KniCard>

        <KniCard className="p-2.5 flex items-center gap-2.5">
          <div className="grid size-8.5 place-items-center rounded-xl bg-amber-100 text-amber-700 shrink-0">
            <Target className="size-4.5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 leading-none">Allocated module</p>
            <p className="text-xs font-bold text-slate-900 leading-tight mt-1 truncate max-w-[120px] lg:max-w-none">
              {MODULE_TEST_LABELS[activeModule || ''] || 'Not selected'}
            </p>
          </div>
        </KniCard>

        <KniCard className="p-2.5 flex items-center gap-2.5">
          <div className="grid size-8.5 place-items-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
            <CheckCircle2 className="size-4.5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 leading-none">Mock attempts</p>
            <p className="text-sm font-bold text-slate-900 leading-tight mt-1">
              {pastExams.length}{examLimit !== null ? ` / ${examLimit}` : ''}
            </p>
          </div>
        </KniCard>

        <KniCard className="p-2.5 flex items-center gap-2.5">
          <div className="grid size-8.5 place-items-center rounded-xl bg-sky-100 text-sky-700 shrink-0">
            <ShieldCheck className="size-4.5" />
          </div>
          <div>
            <p className="text-[10px] font-semibold text-slate-400 leading-none">Exam format</p>
            <p className="text-sm font-bold text-slate-900 leading-tight mt-1">{profile?.format || 'Not selected'}</p>
          </div>
        </KniCard>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-[1.25fr_0.75fr] lg:flex-grow lg:min-h-0 items-stretch">
        {/* Left Column: Recent Mock Tests list of individual cards */}
        <div className="flex flex-col lg:h-full lg:min-h-0 justify-start">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3.5 mb-2.5 shrink-0">
            <div>
              <h3 className="text-base font-bold text-slate-900">Recent Mock Tests</h3>
              <p className="text-[11px] text-slate-500 mt-0.5">Your exam attempts and performance history</p>
              
              {/* Format Switcher Tabs */}
              <div className="flex items-center gap-1 mt-2.5 bg-slate-100 p-0.5 rounded-lg w-fit border border-slate-200/50">
                <button
                  type="button"
                  onClick={() => onFormatTabChange('Digital')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    activeFormatTab === 'Digital'
                      ? 'bg-white text-orange-700 shadow-xs border border-orange-100/50'
                      : 'text-slate-505 hover:text-slate-800'
                  }`}
                >
                  Digital
                </button>
                <button
                  type="button"
                  onClick={() => onFormatTabChange('Paper')}
                  className={`px-3 py-1 text-[10px] font-bold rounded-md transition-all cursor-pointer ${
                    activeFormatTab === 'Paper'
                      ? 'bg-white text-orange-700 shadow-xs border border-orange-100/50'
                      : 'text-slate-505 hover:text-slate-800'
                  }`}
                >
                  Paper
                </button>
              </div>
            </div>
            <div className="flex gap-1.5 shrink-0 items-center">
              <KniButton variant="secondary" className="h-7.5 px-2.5 text-[11px]" onClick={() => onViewChange('practice')}>
                Practice Bins
              </KniButton>
              <KniButton className="h-7.5 px-2.5 text-[11px]" onClick={() => onViewChange('mock')}>
                All Mock Tests
              </KniButton>
            </div>
          </div>

          {filteredPastExams.length > 0 ? (
            <div className="space-y-2 lg:flex-grow lg:min-h-0 overflow-y-auto pr-1 custom-scrollbar">
              {filteredPastExams.map((attempt) => {
                const dateStr = new Date(attempt.created_at).toLocaleDateString('vi-VN', {
                  day: '2-digit',
                  month: '2-digit',
                  year: 'numeric'
                });
                const percentage = attempt.max_score > 0 ? Math.round((attempt.total_score / attempt.max_score) * 100) : 0;
                const isCompleted = attempt.status === 'completed';
                
                return (
                  <KniCard key={attempt.id} className="p-3 md:p-3.5">
                    <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                      <div className={`grid size-10 shrink-0 place-items-center rounded-2xl ${
                        isCompleted 
                          ? 'bg-emerald-50 text-emerald-600 border border-emerald-100/50' 
                          : 'bg-amber-50 text-amber-600 border border-amber-100/50'
                      }`}>
                        {isCompleted ? <CheckCircle2 className="size-5" /> : <Timer className="size-5" />}
                      </div>
                      
                      <div className="min-w-0 flex-1">
                        <div className="flex flex-wrap items-center justify-between gap-1.5">
                          <div className="flex items-center gap-2 flex-wrap">
                            <h4 className="text-sm font-bold text-slate-800 truncate">
                              {attempt.exams?.title || 'Mock Test'}
                            </h4>
                            <span className="text-[9px] uppercase font-extrabold tracking-wider rounded-md px-1.5 py-0.5 border bg-slate-50 text-slate-500 border-slate-200">
                              {attempt.exams?.major ? MODULE_TEST_LABELS[attempt.exams.major] || attempt.exams.major : 'Core Test'}
                            </span>
                          </div>
                          <span className="text-xs font-semibold text-slate-400">
                            {isCompleted ? `Score: ${attempt.total_score ?? 0}/${attempt.max_score}` : 'In Progress'}
                          </span>
                        </div>
                        
                        <p className="mt-0.5 text-[11px] text-slate-400">
                          {isCompleted 
                            ? `Completed on ${dateStr}` 
                            : `Started on ${dateStr}`}
                        </p>
                        
                        {/* progress bar */}
                        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
                          <div 
                            className={`h-full rounded-full transition-all duration-300 ${
                              isCompleted ? 'bg-gradient-to-r from-emerald-500 to-teal-400' : 'bg-gradient-to-r from-amber-500 to-orange-400 animate-pulse'
                            }`}
                            style={{ width: `${isCompleted ? percentage : 35}%` }}
                          />
                        </div>
                      </div>

                      <div className="flex shrink-0 gap-2 w-full sm:w-auto justify-end">
                        <KniButton
                          onClick={() => {
                            if (isCompleted) {
                              onReviewAttempt(attempt);
                            } else {
                              onViewChange('mock');
                            }
                          }}
                          variant="outline"
                          className="h-8 px-2.5 text-xs"
                        >
                          {isCompleted ? 'Details' : 'Resume'}
                        </KniButton>
                      </div>
                    </div>
                  </KniCard>
                );
              })}
            </div>
          ) : (
            <KniCard className="p-6 border border-dashed border-orange-100/50 flex flex-col items-center justify-center text-center bg-orange-50/10 rounded-2xl lg:h-full lg:min-h-0">
              <Timer className="size-8 text-orange-300 mb-2" />
              <h4 className="text-xs font-bold text-slate-700">No {activeFormatTab.toLowerCase()} mock tests taken</h4>
              <p className="text-[11px] text-slate-400 mt-1 max-w-xs leading-relaxed">
                Simulate a full timed exam in official {activeFormatTab} conditions to track your progress here.
              </p>
              <KniButton
                onClick={() => onViewChange('mock')}
                className="mt-3.5 h-8.5 px-3.5 text-xs font-semibold"
              >
                Start First Mock Test
              </KniButton>
            </KniCard>
          )}
        </div>

        {/* Right Column: Radar Chart Card */}
        <KniCard className="p-3 md:p-3.5 flex flex-col items-center bg-white/80 backdrop-blur-md lg:h-full lg:min-h-0 justify-between">
          <div className="mb-2 flex w-full items-center justify-between border-b border-slate-100 pb-2 shrink-0">
            <div>
              <p className="text-[9px] font-bold text-slate-400 uppercase tracking-wider leading-none">Proficiency Radar</p>
              <h3 className="text-sm font-bold text-slate-900 mt-1">Module mastery</h3>
            </div>
            <div className="grid size-8 place-items-center rounded-xl bg-orange-50 text-orange-600 border border-orange-100/50">
              <Target className="size-4" />
            </div>
          </div>
          
          <div className="relative w-full flex-grow max-w-[340px] lg:max-w-[360px] xl:max-w-[390px] aspect-[4/3] flex items-center justify-center py-0.5 shrink-0">
            <svg viewBox="0 0 400 300" className="w-full h-full overflow-visible select-none">
              <defs>
                <linearGradient id="radarFill" x1="0%" x2="100%">
                  <stop offset="0%" stopColor="#EA580C" stopOpacity="0.58" />
                  <stop offset="100%" stopColor="#F97316" stopOpacity="0.28" />
                </linearGradient>
              </defs>
              
              {/* Concentric grid polygons */}
              {gridPolygons.map((points, idx) => (
                <polygon
                  key={idx}
                  points={points}
                  fill="none"
                  stroke="rgba(15,23,42,.08)"
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
                  stroke="rgba(15,23,42,.06)"
                  strokeWidth="1"
                />
              ))}
              
              {/* Grid percentage labels along the top axis */}
              {gridLevels.map((level) => {
                const radius = (level / 100) * maxRadius;
                return (
                  <text
                    key={level}
                    x={cx + 4}
                    y={cy - radius + 3}
                    className="text-[9px] font-semibold fill-slate-400"
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
                  stroke="#F97316"
                  strokeWidth="2"
                  className="transition-all duration-300"
                />
              )}
              
              {/* Score vertex dots */}
              {vertices.map((v, i) => (
                <circle
                  key={i}
                  cx={v.scoreX}
                  cy={v.scoreY}
                  r="3.5"
                  fill="#F97316"
                  stroke="#FFFFFF"
                  strokeWidth="1"
                />
              ))}
              
              {/* Axis labels */}
              {vertices.map((v, i) => {
                const isVertical = Math.abs(Math.sin(v.angle)) > 0.9;
                const labelRadius = maxRadius + (isVertical ? 25 : 12);
                const x = cx + labelRadius * Math.cos(v.angle);
                const y = cy + labelRadius * Math.sin(v.angle) + 4;
                const anchor = x > cx + 15 ? 'start' : x < cx - 15 ? 'end' : 'middle';
                
                // Text wrapping logic for long labels
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
                      className="text-[8px] font-extrabold fill-slate-500 uppercase tracking-wider"
                    >
                      {labelStr}
                    </text>
                  );
                }

                // Adjust starting y position slightly upward for multi-line labels
                const startY = y - ((lines.length - 1) * 8.5) / 2;

                return (
                  <text
                    key={i}
                    x={x}
                    y={startY}
                    textAnchor={anchor}
                    className="text-[8px] font-extrabold fill-slate-500 uppercase tracking-wider"
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
          <div className="mt-2 w-full grid grid-cols-3 gap-x-2.5 gap-y-1.5 border-t border-slate-100 pt-2 shrink-0">
            {radarStats.map((stat) => (
              <div key={stat.key} className="flex flex-col">
                <span className="text-[9px] font-bold text-slate-500 truncate leading-tight" title={stat.label}>
                  {stat.label}
                </span>
                <span className="text-[11px] font-extrabold text-slate-900 mt-0.5">
                  {stat.percentage}% 
                  <span className="text-[9px] font-normal text-slate-400 ml-1">
                    ({stat.correct}/{stat.total})
                  </span>
                </span>
              </div>
            ))}
          </div>
        </KniCard>
      </div>
    </div>
  );
}

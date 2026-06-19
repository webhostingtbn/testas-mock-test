"use client";

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
  radarStats: {
    key: string;
    label: string;
    correct: number;
    total: number;
    percentage: number;
  }[];
}

export function DashboardView({ profile, activeModule, pastExams, examLimit, onViewChange, radarStats }: DashboardViewProps) {
  // Extract percentages for SVG coordinates (guaranteed mapping by key)
  const r0 = radarStats.find(s => s.key === 'figure_sequence')?.percentage || 0;
  const r1 = radarStats.find(s => s.key === 'math_equation')?.percentage || 0;
  const r2 = radarStats.find(s => s.key === 'latin_square')?.percentage || 0;
  const r3 = radarStats.find(s => s.key === 'module_mcq')?.percentage || 0;

  const pointsStr = `150,${150 - r0} ${150 + r1},150 150,${150 + r2} ${150 - r3},150`;

  return (
    <div className="mx-auto w-full max-w-7xl">
      <div className="mb-4">
        <p className="text-sm font-medium text-orange-700">Student Home</p>
        <h2 className="mt-0.5 text-2xl font-bold text-slate-900">
          Welcome back, {profile?.full_name || 'Student'}
        </h2>
      </div>

      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <KniCard className="p-3.5 flex items-center gap-3.5">
          <div className="grid size-10 place-items-center rounded-xl bg-orange-100 text-orange-700 shrink-0">
            <CircleUserRound className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Account status</p>
            <p className="text-base font-bold text-slate-900 leading-tight mt-0.5">{profile?.status || 'Pending'}</p>
          </div>
        </KniCard>

        <KniCard className="p-3.5 flex items-center gap-3.5">
          <div className="grid size-10 place-items-center rounded-xl bg-amber-100 text-amber-700 shrink-0">
            <Target className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Allocated module</p>
            <p className="text-base font-bold text-slate-900 leading-tight mt-0.5">
              {MODULE_TEST_LABELS[activeModule || ''] || 'Not selected'}
            </p>
          </div>
        </KniCard>

        <KniCard className="p-3.5 flex items-center gap-3.5">
          <div className="grid size-10 place-items-center rounded-xl bg-emerald-100 text-emerald-700 shrink-0">
            <CheckCircle2 className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Mock attempts</p>
            <p className="text-base font-bold text-slate-900 leading-tight mt-0.5">
              {pastExams.length}{examLimit !== null ? ` / ${examLimit}` : ''}
            </p>
          </div>
        </KniCard>

        <KniCard className="p-3.5 flex items-center gap-3.5">
          <div className="grid size-10 place-items-center rounded-xl bg-sky-100 text-sky-700 shrink-0">
            <ShieldCheck className="size-5" />
          </div>
          <div>
            <p className="text-xs font-semibold text-slate-400">Exam format</p>
            <p className="text-base font-bold text-slate-900 leading-tight mt-0.5">{profile?.format || 'Not selected'}</p>
          </div>
        </KniCard>
      </div>

      <div className="mt-5 grid gap-5 md:grid-cols-[1.3fr_0.7fr] items-stretch">
        {/* Preparation Workspace Card */}
        <KniCard className="p-5 flex flex-col justify-between bg-white/80 backdrop-blur-md">
          <div>
            <p className="text-sm font-medium text-orange-700">Preparation workspace</p>
            <h3 className="mt-1 text-xl font-bold text-slate-900">Choose how you want to prepare</h3>
            <p className="mt-3 text-xs leading-relaxed text-slate-500">
              Select Practice Mode to focus on specific question types and build confidence without test limits. Choose Mock Test Mode to simulate a full timed exam in official TestAS conditions.
            </p>
          </div>
          <div className="mt-6 flex flex-wrap gap-3">
            <KniButton variant="secondary" className="h-10 px-4 text-sm" onClick={() => onViewChange('practice')}>
              <BookOpen className="size-4" />
              Practice
            </KniButton>
            <KniButton className="h-10 px-4 text-sm" onClick={() => onViewChange('mock')}>
              <Timer className="size-4" />
              Mock Test
            </KniButton>
          </div>
        </KniCard>

        {/* Radar Chart Card */}
        <KniCard className="p-5 flex flex-col items-center bg-white/80 backdrop-blur-md">
          <h3 className="text-sm font-bold text-slate-900 self-start mb-0.5">Overall Aptitude Radar</h3>
          <p className="text-[10px] text-slate-500 self-start mb-3">Cumulative correct answers across all attempts.</p>
          
          <div className="relative w-full max-w-[170px] aspect-square flex items-center justify-center py-0.5">
            <svg viewBox="0 0 300 300" className="w-full h-full overflow-visible select-none">
              {/* Concentric grid diamonds */}
              {[25, 50, 75, 100].map((r) => (
                <polygon
                  key={r}
                  points={`150,${150 - r} ${150 + r},150 150,${150 + r} ${150 - r},150`}
                  fill="none"
                  stroke="#E2E8F0"
                  strokeWidth="1"
                />
              ))}
              
              {/* Axis cross lines */}
              <line x1="150" y1="50" x2="150" y2="250" stroke="#E2E8F0" strokeWidth="1" />
              <line x1="50" y1="150" x2="250" y2="150" stroke="#E2E8F0" strokeWidth="1" />
              
              {/* Grid percentage labels */}
              {[25, 50, 75, 100].map((r) => (
                <text
                  key={r}
                  x="154"
                  y={150 - r + 3}
                  className="text-[9px] font-semibold fill-slate-400"
                >
                  {r}%
                </text>
              ))}
              
              {/* User score polygon */}
              <polygon
                points={pointsStr}
                fill="rgba(249, 115, 22, 0.08)"
                stroke="#F97316"
                strokeWidth="2"
                className="transition-all duration-300"
              />
              
              {/* Score vertex dots */}
              <circle cx="150" cy={150 - r0} r="3.5" fill="#F97316" stroke="#FFFFFF" strokeWidth="1" />
              <circle cx={150 + r1} cy="150" r="3.5" fill="#F97316" stroke="#FFFFFF" strokeWidth="1" />
              <circle cx="150" cy={150 + r2} r="3.5" fill="#F97316" stroke="#FFFFFF" strokeWidth="1" />
              <circle cx={150 - r3} cy="150" r="3.5" fill="#F97316" stroke="#FFFFFF" strokeWidth="1" />
              
              {/* Axis labels */}
              <text x="150" y="32" textAnchor="middle" className="text-[10px] font-bold fill-slate-500 uppercase tracking-wide">
                {radarStats.find(s => s.key === 'figure_sequence')?.label || "Figure Sequences"}
              </text>
              <text x="262" y="153" textAnchor="start" className="text-[10px] font-bold fill-slate-500 uppercase tracking-wide">
                {radarStats.find(s => s.key === 'math_equation')?.label || "Math Equations"}
              </text>
              <text x="150" y="272" textAnchor="middle" className="text-[10px] font-bold fill-slate-500 uppercase tracking-wide">
                {radarStats.find(s => s.key === 'latin_square')?.label || "Latin Squares"}
              </text>
              <text x="38" y="153" textAnchor="end" className="text-[10px] font-bold fill-slate-500 uppercase tracking-wide">
                {radarStats.find(s => s.key === 'module_mcq')?.label || "Subject Module"}
              </text>
            </svg>
          </div>
          
          {/* Stats legend grid */}
          <div className="mt-3 w-full grid grid-cols-2 gap-2 border-t border-slate-100 pt-3">
            {radarStats.map((stat) => (
              <div key={stat.key} className="flex flex-col">
                <span className="text-[10px] font-semibold text-slate-500">{stat.label}</span>
                <span className="text-xs font-bold text-slate-900 mt-0.5">
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

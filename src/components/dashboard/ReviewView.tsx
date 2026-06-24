"use client";

import { useState } from 'react';
import {
  ChevronLeft, ChevronDown, ChevronUp, FileText, Calendar,
  BarChart2, AlertCircle
} from 'lucide-react';
import { KniCard, KniButton, KniProgress } from '@/components/KniPrimitives';
import { MODULE_TEST_LABELS } from '@/lib/constants';
import { cn } from '@/lib/utils';
import type { Profile, Exam } from '@/lib/types';

interface AnswerData {
  question_id: string;
  is_correct: boolean;
}

// ExamAttempt matches the PastExam type from useDashboardData
interface ExamAttempt {
  id?: string;
  created_at?: string;
  total_score: number | null;
  max_score: number | null;
  status?: string;
  exams?: Exam;
  detailed_results?: Record<string, any>;
}

interface ReviewViewProps {
  profile: Profile | null;
  attempt: any;
  pastExams: any[];
  onBack: () => void;
}

export function ReviewView({ profile, attempt, pastExams, onBack }: ReviewViewProps) {
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({});

  // Helpers to handle legacy DB formatting and nested object bugs
  const getScore = (sectionData: any, sectionTitle: string): number => {
    if (!sectionData) return 0;
    if (Array.isArray(sectionData)) {
      return sectionData.filter((ans: any) => ans && (ans.is_correct === true || ans.correct === true)).length;
    }
    if (typeof sectionData !== 'object') return 0;
    
    const s = sectionData.score;
    if (typeof s === 'number') return s;
    if (typeof s === 'string') {
      const p = parseInt(s, 10);
      return isNaN(p) ? 0 : p;
    }
    if (typeof s === 'object' && s !== null) {
      if (s[sectionTitle] && typeof s[sectionTitle].score === 'number') {
        return s[sectionTitle].score;
      }
      const titleLower = sectionTitle.toLowerCase();
      const matchedKey = Object.keys(s).find(k => k.toLowerCase() === titleLower || titleLower.includes(k.toLowerCase()) || k.toLowerCase().includes(titleLower));
      if (matchedKey && s[matchedKey] && typeof s[matchedKey].score === 'number') {
        return s[matchedKey].score;
      }
    }
    return 0;
  };

  const getMaxScore = (sectionData: any, sectionTitle: string): number => {
    if (!sectionData) return 0;
    if (Array.isArray(sectionData)) {
      return sectionData.length;
    }
    if (typeof sectionData !== 'object') return 0;
    
    const ms = sectionData.max_score;
    if (typeof ms === 'number') return ms;
    if (typeof ms === 'string') {
      const p = parseInt(ms, 10);
      return isNaN(p) ? 0 : p;
    }
    if (typeof sectionData.score === 'object' && sectionData.score !== null) {
      const s = sectionData.score;
      if (s[sectionTitle] && typeof s[sectionTitle].max_score === 'number') {
        return s[sectionTitle].max_score;
      }
      const titleLower = sectionTitle.toLowerCase();
      const matchedKey = Object.keys(s).find(k => k.toLowerCase() === titleLower || titleLower.includes(k.toLowerCase()) || k.toLowerCase().includes(titleLower));
      if (matchedKey && s[matchedKey] && typeof s[matchedKey].max_score === 'number') {
        return s[matchedKey].max_score;
      }
    }
    return 0;
  };

  const getAnswers = (sectionData: any, sectionTitle: string): any[] => {
    if (!sectionData) return [];
    if (Array.isArray(sectionData)) return sectionData;
    if (typeof sectionData !== 'object') return [];

    if (Array.isArray(sectionData.answers)) return sectionData.answers;

    const s = sectionData.score;
    if (typeof s === 'object' && s !== null) {
      if (s[sectionTitle] && Array.isArray(s[sectionTitle].answers)) {
        return s[sectionTitle].answers;
      }
      const titleLower = sectionTitle.toLowerCase();
      const matchedKey = Object.keys(s).find(k => k.toLowerCase() === titleLower || titleLower.includes(k.toLowerCase()) || k.toLowerCase().includes(titleLower));
      if (matchedKey && s[matchedKey] && Array.isArray(s[matchedKey].answers)) {
        return s[matchedKey].answers;
      }
    }
    return [];
  };

  const getType = (sectionData: any, sectionTitle: string): string => {
    if (sectionData && typeof sectionData === 'object' && !Array.isArray(sectionData) && sectionData.type) {
      return sectionData.type;
    }
    const t = sectionTitle.toLowerCase();
    if (t.includes('figure') || t.includes('pattern')) return 'figure_sequence';
    if (t.includes('math') || t.includes('equation') || t.includes('solving')) return 'math_equation';
    if (t.includes('latin') || t.includes('square') || t.includes('inferring')) return 'latin_square';
    return 'module_mcq';
  };

  const detailed = attempt?.detailed_results || {};
  const sectionsList = Object.entries(detailed).map(([title, data]: [string, any]) => {
    return {
      title,
      type: getType(data, title),
      score: getScore(data, title),
      max_score: getMaxScore(data, title),
      answers: getAnswers(data, title)
    };
  });

  const toggleSection = (sectionTitle: string) => {
    setExpandedSections(prev => ({
      ...prev,
      [sectionTitle]: !prev[sectionTitle]
    }));
  };

  // Calculate progression over time (chronological sorted list of completed attempts)
  const completedAttempts = [...pastExams]
    .filter(e => e.status === 'completed' && e.exams?.id === attempt?.exams?.id && e.created_at)
    .sort((a, b) => new Date(a.created_at!).getTime() - new Date(b.created_at!).getTime());

  const dateCompletedStr = attempt.created_at
    ? new Date(attempt.created_at).toLocaleDateString('vi-VN', {
        day: '2-digit',
        month: '2-digit',
        year: 'numeric',
        hour: '2-digit',
        minute: '2-digit'
      })
    : 'Date unavailable';

  const overallPercentage = attempt.max_score && attempt.total_score && attempt.max_score > 0
    ? Math.round(((attempt.total_score as number) / attempt.max_score) * 100)
    : 0;

  return (
    <div className="mx-auto w-full pb-10">


      <div className="mb-6">
        <div className="flex items-center gap-2 mb-3">
          <div className="grid size-8 place-items-center rounded-full bg-orange-100 text-orange-600">
            <FileText className="size-4" />
          </div>
          <span className="text-xs font-bold uppercase tracking-[0.18em] text-orange-600">
            Exam Review
          </span>
        </div>
        <h2 className="text-2xl font-black tracking-tight text-slate-950 md:text-3xl">
          {attempt.exams?.title || 'Mock Test'} Review
        </h2>
        <p className="text-sm text-slate-500 mt-2">
          Format: <span className="font-medium text-slate-700">{profile?.format || 'Digital'}</span> • Completed on {dateCompletedStr}
        </p>
      </div>

      {/* Score Summary Card */}
      <KniCard className="p-6 mb-6">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-slate-400 mb-2">
              Score Summary
            </p>
            <div className="flex items-baseline gap-3">
              <span className="text-5xl font-black tracking-tight text-slate-950">
                {attempt.total_score ?? 0}
              </span>
              <span className="text-lg text-slate-400 font-medium">/ {attempt.max_score ?? 0}</span>
              <span
                className={cn(
                  'inline-flex items-center rounded-full border px-3 py-1 text-xs font-bold',
                  overallPercentage >= 80
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : overallPercentage >= 50
                      ? 'border-amber-200 bg-amber-50 text-amber-700'
                      : 'border-rose-200 bg-rose-50 text-rose-700'
                )}
              >
                {overallPercentage}%
              </span>
            </div>
            <p className="text-sm text-slate-500 mt-3">
              You correctly answered <span className="font-bold text-slate-900">{attempt.total_score}</span> questions out of <span className="font-bold text-slate-900">{attempt.max_score}</span> total questions.
            </p>
          </div>
          <div className="flex items-center gap-3 min-w-[180px]">
            <div className="flex-1">
              <KniProgress
                value={overallPercentage}
                className="mb-2"
              />
              <span className="text-[10px] font-medium text-slate-400 uppercase tracking-wide">
                Performance
              </span>
            </div>
            <div className="w-px h-10 bg-slate-100 md:block hidden" />
            <div className="flex flex-col gap-1 min-w-[120px]">
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <Calendar className="size-3.5" />
                <span className="font-medium">Completed</span>
              </div>
              <span className="text-xs text-slate-400">
                Official mock conditions
              </span>
            </div>
          </div>
        </div>
      </KniCard>

        {/* Progression Chart Card */}
      <KniCard className="p-6 mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-[0.18em] text-orange-600 mb-1">
              Score Progression
            </p>
            <h3 className="text-lg font-black tracking-tight text-slate-950">
              Over time
            </h3>
          </div>
          <div className="grid size-9 place-items-center rounded-full bg-orange-50 text-orange-600">
            <BarChart2 className="size-4.5" />
          </div>
        </div>
        {completedAttempts.length > 0 ? (
          <div className="h-40 flex items-end justify-start gap-3 md:gap-4 w-full overflow-x-auto pb-2 custom-scrollbar -mx-2 px-2">
            {completedAttempts.map((past, idx) => {
              const pastPct = past.max_score && past.total_score && past.max_score > 0
                ? Math.round(((past.total_score as number) / past.max_score) * 100)
                : 0;
              const isCurrent = past.id === attempt.id;

              return (
                <div key={past.id} className="flex flex-col items-center flex-1 min-w-[60px] group relative">
                  {/* Tooltip on Hover */}
                  <div className="absolute bottom-full mb-2 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[10px] font-bold rounded-lg px-2 py-1 whitespace-nowrap pointer-events-none z-10 shadow-lg">
                    {past.total_score}/{past.max_score} ({pastPct}%)
                  </div>

                  {/* The Bar */}
                  <div className="w-full relative rounded-t-xl overflow-hidden bg-slate-100 flex items-end h-[80px] transition-all duration-300 group-hover:shadow-md">
                    <div
                      style={{ height: `${pastPct}%` }}
                      className={`w-full rounded-t-xl transition-all duration-300 ${
                        isCurrent
                          ? 'bg-gradient-to-t from-orange-600 to-amber-400 shadow-orange-500/20'
                          : 'bg-slate-300 group-hover:bg-slate-400'
                      }`}
                    />
                  </div>
                  <span className={`text-[10px] mt-2 font-bold ${isCurrent ? 'text-orange-700 font-extrabold' : 'text-slate-400'}`}>
                    {isCurrent ? 'Current' : `#${idx + 1}`}
                  </span>
                </div>
              );
            })}
          </div>
        ) : (
          <div className="h-40 flex items-center justify-center text-sm text-slate-400 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <div className="flex items-center gap-2">
              <BarChart2 className="size-4" />
              <span>No progress history available</span>
            </div>
          </div>
        )}
      </KniCard>

      {/* Sections Accordion */}
      <div className="mb-6">
        <div className="flex items-center gap-2 mb-4">
          <div className="grid size-8 place-items-center rounded-full bg-orange-100 text-orange-600">
            <FileText className="size-4" />
          </div>
          <h3 className="text-base font-black tracking-tight text-slate-950">
            Subtest Reviews
          </h3>
        </div>

        <div className="space-y-3">
          {sectionsList.map((section) => {
            const isExpanded = expandedSections[section.title] || false;

            const sectionAnswers = section.answers || [];
            const correct = section.score ?? 0;
            const total = section.max_score ?? 0;
            const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

            return (
              <KniCard key={section.title} className="p-0 overflow-hidden">
                {/* Accordion Trigger Header */}
                <button
                  onClick={() => toggleSection(section.title)}
                  className="w-full flex flex-col md:flex-row md:items-center justify-between p-4 text-left hover:bg-orange-50/50 cursor-pointer select-none transition"
                >
                  <div className="flex items-center gap-3">
                    <div className="grid size-9 place-items-center rounded-xl bg-orange-100 text-orange-600">
                      <FileText className="size-4.5" />
                    </div>
                    <div>
                      <h4 className="text-sm font-black tracking-tight text-slate-950">
                        {section.title}
                      </h4>
                      <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                        {MODULE_TEST_LABELS[section.type] || 'Core Subtest'}
                      </span>
                    </div>
                  </div>

                  <div className="flex items-center justify-between md:justify-end gap-5 mt-3 md:mt-0">
                    <div className="flex items-center gap-3 min-w-[140px]">
                      <div className="flex-1">
                        <KniProgress value={pct} />
                        <div className="flex items-center justify-between text-[10px] font-bold mt-1">
                          <span className="text-slate-500">Score</span>
                          <span className="text-slate-900">{correct} / {total}</span>
                        </div>
                      </div>
                      <div className="w-px h-8 bg-slate-100 hidden md:block" />
                      <div className="text-right min-w-[80px]">
                        <span className="text-sm font-black text-slate-900 block">
                          {pct}%
                        </span>
                        <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                          {pct >= 80 ? 'Excellent' : pct >= 50 ? 'Good' : 'Needs Work'}
                        </span>
                      </div>
                    </div>
                    {isExpanded ? (
                      <ChevronUp className="size-4.5 text-slate-400" />
                    ) : (
                      <ChevronDown className="size-4.5 text-slate-400" />
                    )}
                  </div>
                </button>

                {/* Accordion Content */}
                {isExpanded && (
                  <div className="border-t border-slate-100 bg-slate-50/50 p-4 md:p-6">
                    {sectionAnswers.length === 0 ? (
                      <div className="text-center py-6 text-sm text-slate-500 flex items-center justify-center gap-2 bg-slate-100/50 rounded-lg">
                        <AlertCircle className="size-4" />
                        <span>Detailed question indicators are not available for this subtest.</span>
                      </div>
                    ) : (
                      <div className="grid grid-cols-6 sm:grid-cols-8 md:grid-cols-10 gap-2">
                        {sectionAnswers.map((ans: AnswerData, idx: number) => {
                          const isCorrect = ans.is_correct === true;
                          return (
                            <div
                              key={ans.question_id || idx}
                              className={`flex flex-col items-center justify-center h-10 rounded-lg border text-[10px] font-bold transition-all duration-200 ${
                                isCorrect
                                  ? 'bg-emerald-50/80 border-emerald-200 text-emerald-700'
                                  : 'bg-rose-50/80 border-rose-200 text-rose-700'
                              }`}
                              title={`Question ${idx + 1}: ${isCorrect ? 'Correct' : 'Incorrect'}`}
                            >
                              <span className="text-[9px] text-slate-400 font-semibold block leading-none mb-0.5">Q{idx + 1}</span>
                              <span className="leading-none text-xs">{isCorrect ? '✓' : '✗'}</span>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}
              </KniCard>
            );
          })}
        </div>
      </div>
    </div>
  );
}

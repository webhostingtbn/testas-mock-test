"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import React, { useState } from 'react';
import {
  ChevronLeft, ChevronDown, ChevronUp, FileText, Calendar,
  BarChart2, AlertCircle
} from 'lucide-react';
import { KniCard } from '@/components/KniPrimitives';
import { MODULE_TEST_LABELS } from '@/lib/constants';

interface ReviewViewProps {
  profile: any;
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
    .filter(e => e.status === 'completed' && e.exams?.id === attempt?.exams?.id)
    .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime());

  const dateCompletedStr = new Date(attempt.created_at).toLocaleDateString('vi-VN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });

  const overallPercentage = attempt.max_score > 0 ? Math.round((attempt.total_score / attempt.max_score) * 100) : 0;

  return (
    <div className="mx-auto w-full max-w-7xl pb-10">
      <button 
        onClick={onBack} 
        className="flex items-center gap-1.5 text-slate-500 hover:text-slate-800 text-sm font-semibold mb-5 cursor-pointer transition shrink-0"
      >
        <ChevronLeft className="size-4" />
        Back to Dashboard
      </button>

      <div className="mb-4">
        <p className="text-[11px] font-bold uppercase tracking-wider text-orange-700">Exam Review</p>
        <h2 className="mt-0.5 text-2xl font-bold text-slate-900 md:text-3xl">
          {attempt.exams?.title || 'Mock Test'} Review
        </h2>
        <p className="text-slate-500 text-xs mt-1">Format: {profile?.format || 'Digital'} • Completed on {dateCompletedStr}</p>
      </div>

      {/* Overview Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3 mb-6 items-stretch">
        {/* Score Card */}
        <KniCard className="p-5 flex flex-col justify-between">
          <div>
            <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Score Summary</span>
            <div className="mt-3 flex items-baseline gap-2">
              <span className="text-4xl font-extrabold text-slate-900">
                {attempt.total_score ?? 0}
              </span>
              <span className="text-slate-400 text-lg">/ {attempt.max_score ?? 0}</span>
              <span className="text-xs font-semibold px-2 py-0.5 bg-orange-100 text-orange-750 rounded-md ml-2">
                {overallPercentage}%
              </span>
            </div>
            <p className="text-[11px] text-slate-500 mt-2">
              You correctly answered {attempt.total_score} questions out of {attempt.max_score} total questions.
            </p>
          </div>
          <div className="mt-4 pt-3 border-t border-slate-100 flex items-center gap-2 text-[11px] text-slate-400">
            <Calendar className="size-3.5" />
            <span>Finished in official mock conditions</span>
          </div>
        </KniCard>

        {/* Progression Chart Card */}
        <KniCard className="p-5 col-span-1 md:col-span-1 lg:col-span-2 flex flex-col justify-between">
          <div>
            <div className="flex justify-between items-center mb-1">
              <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider block">Score Progression over time</span>
              <BarChart2 className="size-4 text-orange-600" />
            </div>
            {completedAttempts.length > 0 ? (
              <div className="h-32 flex items-end justify-start gap-4 md:gap-6 mt-4 w-full overflow-x-auto pb-1 custom-scrollbar">
                {completedAttempts.map((past, idx) => {
                  const pastPct = past.max_score > 0 ? Math.round((past.total_score / past.max_score) * 100) : 0;
                  const isCurrent = past.id === attempt.id;
                  
                  return (
                    <div key={past.id} className="flex flex-col items-center flex-1 min-w-[50px] group relative">
                      {/* Tooltip on Hover */}
                      <div className="absolute bottom-full mb-1 opacity-0 group-hover:opacity-100 transition-opacity bg-slate-900 text-white text-[9px] font-bold rounded px-1.5 py-0.5 whitespace-nowrap pointer-events-none z-10">
                        {past.total_score}/{past.max_score} ({pastPct}%)
                      </div>

                      {/* The Bar */}
                      <div className="w-full relative rounded-t-md overflow-hidden bg-slate-100 flex items-end h-[100px]">
                        <div 
                          style={{ height: `${pastPct}%` }}
                          className={`w-full rounded-t-md transition-all duration-300 ${
                            isCurrent
                              ? 'bg-gradient-to-t from-orange-600 to-amber-400 shadow-md shadow-orange-500/20'
                              : 'bg-slate-300 group-hover:bg-slate-400'
                          }`}
                        />
                      </div>
                      <span className={`text-[10px] mt-1.5 font-bold ${isCurrent ? 'text-orange-700 font-extrabold' : 'text-slate-400'}`}>
                        {isCurrent ? 'Current' : `Attempt ${idx + 1}`}
                      </span>
                    </div>
                  );
                })}
              </div>
            ) : (
              <div className="h-32 flex items-center justify-center text-xs text-slate-400">
                No progress history available.
              </div>
            )}
          </div>
        </KniCard>
      </div>

      {/* Sections Accordion */}
      <h3 className="text-sm font-bold text-slate-400 uppercase tracking-wider mb-3 shrink-0">Subtest Reviews</h3>
      <div className="space-y-3">
        {sectionsList.map((section) => {
          const isExpanded = expandedSections[section.title] || false;
          
          const sectionAnswers = section.answers || [];
          const correct = section.score ?? 0;
          const total = section.max_score ?? 0;
          const pct = total > 0 ? Math.round((correct / total) * 100) : 0;

          return (
            <div key={section.title} className="bg-white rounded-2xl border border-orange-100/60 overflow-hidden">
              {/* Accordion Trigger Header */}
              <button
                onClick={() => toggleSection(section.title)}
                className="w-full flex flex-col md:flex-row md:items-center justify-between p-4 text-left hover:bg-orange-50/10 cursor-pointer select-none transition"
              >
                <div className="flex items-center gap-3">
                  <div className={`grid size-9 place-items-center rounded-xl bg-orange-100 text-orange-700`}>
                    <FileText className="size-4.5" />
                  </div>
                  <div>
                    <h4 className="text-sm font-bold text-slate-800">
                      {section.title}
                    </h4>
                    <span className="text-[10px] uppercase font-bold tracking-wider text-slate-400">
                      {MODULE_TEST_LABELS[section.type] || 'Core Subtest'}
                    </span>
                  </div>
                </div>

                <div className="flex items-center justify-between md:justify-end gap-5 mt-3 md:mt-0">
                  <div className="text-right">
                    <span className="text-sm font-extrabold text-slate-900">
                      {correct} / {total} correct
                    </span>
                    <div className="mt-1 w-24 h-1 rounded-full bg-slate-100 overflow-hidden">
                      <div 
                        className="h-full bg-orange-500 rounded-full" 
                        style={{ width: `${pct}%` }} 
                      />
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
                <div className="border-t border-slate-100 bg-slate-50/30 p-4 md:p-6">
                  {sectionAnswers.length === 0 ? (
                    <div className="text-center py-6 text-xs text-slate-400 flex items-center justify-center gap-1.5">
                      <AlertCircle className="size-4" />
                      Detailed question indicators are not available for this subtest.
                    </div>
                  ) : (
                    <div className="grid grid-cols-5 sm:grid-cols-8 md:grid-cols-10 gap-2.5">
                      {sectionAnswers.map((ans: any, idx: number) => {
                        const correct = ans.is_correct === true;
                        return (
                          <div 
                            key={ans.question_id || idx}
                            className={`flex flex-col items-center justify-center h-11 rounded-xl border text-xs font-bold transition-all duration-200 ${
                              correct
                                ? 'bg-emerald-50/70 border-emerald-250 text-emerald-700'
                                : 'bg-rose-50/70 border-rose-250 text-rose-700'
                            }`}
                            title={`Question ${idx + 1}: ${correct ? 'Correct' : 'Incorrect'}`}
                          >
                            <span className="text-[9px] text-slate-400 font-semibold block leading-none mb-0.5">Q{idx + 1}</span>
                            <span className="leading-none text-xs">{correct ? '✓' : '✗'}</span>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

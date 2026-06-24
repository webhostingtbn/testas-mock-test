"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import { useState, useMemo, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import {
  FilePenLine, Laptop, ChevronRight, Clock, CheckCircle2, PlayCircle, BookOpen,
  ArrowLeft, Calculator, Brain, Puzzle, Box, FileText, Award, TrendingUp, Sparkles, Info, BicepsFlexed
} from 'lucide-react';
import { KniCard, KniButton } from '@/components/KniPrimitives';
import type { Exam } from '@/lib/types';

interface TestSelectionViewProps {
  exams: Exam[];
  selectedExam: Exam | null;
  onSelectExam: (exam: Exam) => void;
  pastExams: any[];
  selectedTestHistory: any[];
  radarStats: any[];
  selectedExamDetails: {
    sectionsCount: number;
    questionsCount: number;
    totalDurationMinutes: number;
    isLoading: boolean;
  } | null;
  getExamAttemptInfo: (exam: any) => {
    attemptCount: number;
    limit: number | null;
    limitReached: boolean;
    bestScore: number | null;
    maxScore: number | null;
    bestPercentage: number;
  };
  onStartBriefing: () => void;
  onReviewAttempt: (attempt: any) => void;
  onResumeAttempt: (attempt: any) => void;
}

export function TestSelectionView({
  exams,
  selectedExam,
  onSelectExam,
  pastExams,
  selectedTestHistory,
  radarStats,
  selectedExamDetails,
  getExamAttemptInfo,
  onStartBriefing,
  onReviewAttempt,
  onResumeAttempt,
}: TestSelectionViewProps) {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'all' | 'completed' | 'in_progress'>('all');
  const [mobileView, setMobileView] = useState<'list' | 'dashboard'>('list');

  // Filter to active exams
  const activeExams = useMemo(() => exams.filter(exam => exam.is_active), [exams]);

  // Compute stats for each exam for the left panel display
  const getExamDisplayInfo = useCallback((exam: Exam) => {
    const attempts = pastExams.filter((pe) => pe.exam_id === exam.id);
    const hasCompleted = attempts.some((a) => a.status === 'completed');
    const hasStarted = attempts.length > 0;
    
    // Duration and questions estimation
    const sections = exam.sections || [];
    const totalDurationSeconds = sections.reduce((sum, s) => sum + (s.duration_seconds || 0), 0);
    const isPaper = exam.format === 'Paper';
    const duration = totalDurationSeconds > 0 
      ? Math.round(totalDurationSeconds / 60) + (isPaper ? 15 : 10) 
      : (isPaper ? 170 : 130);
    
    const questions = sections.reduce((sum, s) => sum + (s.question_count || 0), 0) || (isPaper ? 120 : 90);

    // Get best percentage if completed
    let bestPct = 0;
    attempts.forEach((pe) => {
      if (pe.status === 'completed' && pe.total_score !== null && pe.max_score) {
        const pct = Math.round((pe.total_score / pe.max_score) * 100);
        if (pct > bestPct) bestPct = pct;
      }
    });

    // In progress completion percentage (based on detailed results)
    let progressPct = 0;
    if (hasStarted && !hasCompleted) {
      const latestAttempt = attempts.sort((a, b) => new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime())[0];
      const detailed = latestAttempt?.detailed_results || {};
      const completedSections = Object.keys(detailed).length;
      const totalSections = sections.length || 4;
      progressPct = Math.round((completedSections / totalSections) * 100);
      if (progressPct === 0) progressPct = 10; // min placeholder
    }

    return {
      duration,
      questions,
      hasCompleted,
      hasStarted,
      isInProgress: hasStarted && !hasCompleted,
      bestPct,
      progressPct,
    };
  }, [pastExams]);

  // Filter exams based on selected active tab
  const filteredExams = useMemo(() => {
    return activeExams.filter((exam) => {
      const info = getExamDisplayInfo(exam);
      if (activeTab === 'completed') return info.hasCompleted;
      if (activeTab === 'in_progress') return info.isInProgress;
      return true;
    });
  }, [activeExams, activeTab, getExamDisplayInfo]);

  const handleSelectExam = (exam: Exam) => {
    onSelectExam(exam);
    setMobileView('dashboard');
  };

  // Helper for visual card icons
  const getExamCardVisuals = (title: string) => {
    const t = title.toLowerCase();
    if (t.includes('math') || t.includes('quant')) {
      return {
        icon: <Calculator className="size-5" />,
        bgColor: 'bg-amber-50 text-amber-600 border-amber-100/50',
      };
    }
    if (t.includes('read') || t.includes('verbal') || t.includes('analys')) {
      return {
        icon: <BookOpen className="size-5" />,
        bgColor: 'bg-orange-50 text-orange-600 border-orange-100/50',
      };
    }
    if (t.includes('pattern') || t.includes('figure')) {
      return {
        icon: <Puzzle className="size-5" />,
        bgColor: 'bg-purple-50 text-purple-600 border-purple-100/50',
      };
    }
    if (t.includes('spatial') || t.includes('solid')) {
      return {
        icon: <Box className="size-5" />,
        bgColor: 'bg-blue-50 text-blue-600 border-blue-100/50',
      };
    }
    if (t.includes('logic') || t.includes('reason')) {
      return {
        icon: <Brain className="size-5" />,
        bgColor: 'bg-emerald-50 text-emerald-600 border-emerald-100/50',
      };
    }
    return {
      icon: <FileText className="size-5" />,
      bgColor: 'bg-orange-50 text-orange-600 border-orange-100/50',
    };
  };

  const formatDate = (value?: string) => {
    if (!value) return '--';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '--';
    return date.toLocaleDateString('en-US', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const formatTime = (value?: string) => {
    if (!value) return '';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleTimeString('en-US', { hour: '2-digit', minute: '2-digit', hour12: true });
  };

  const getDuration = (attempt: any) => {
    const start = attempt.started_at || attempt.created_at;
    const end = attempt.completed_at;
    if (!start) return '--';
    const startTime = new Date(start).getTime();
    const endTime = end ? new Date(end).getTime() : Date.now();
    const totalMins = Math.round((endTime - startTime) / 60000);

    console.log("Duration", attempt );

    if (totalMins >= 60) {
      const hours = Math.floor(totalMins / 60);
      const remainingMins = totalMins % 60;
      if (remainingMins === 0) {
        return `${hours}h`;
      }
      return `${hours}h ${remainingMins}m`;
    }
    return `${totalMins} min`;
  };

  // Render empty state if no active exams
  if (activeExams.length === 0) {
    return (
      <div className="mx-auto w-full max-w-[1480px] p-4 sm:p-6 lg:p-8">
        <KniCard className="p-8 border border-dashed border-orange-100/50 flex flex-col items-center justify-center text-center bg-orange-50/10 rounded-[22px] py-16">
          <Clock className="size-10 text-orange-300 mb-3" />
          <h4 className="text-base font-black text-slate-900">No active mock exams available</h4>
          <p className="text-xs text-slate-500 mt-1.5 max-w-sm leading-relaxed">
            There is currently no active mock test configured in the system. Please check back later or contact an administrator.
          </p>
          <KniButton
            onClick={() => router.push('/dashboard')}
            className="mt-5 h-11 px-5 text-sm font-semibold rounded-xl bg-orange-600 text-white animate-fade-in"
          >
            Go Back to Dashboard
            <ChevronRight className="size-4 ml-1" />
          </KniButton>
        </KniCard>
      </div>
    );
  }

  // Dashboard calculations for selected test
  const selectedInfo = selectedExam ? getExamDisplayInfo(selectedExam) : null;
  const attempts = [...selectedTestHistory].sort((a, b) => new Date(a.created_at || 0).getTime() - new Date(b.created_at || 0).getTime());
  const attemptsDesc = [...attempts].reverse();
  const completedAttempts = attempts.filter(a => a.status === 'completed');
  
  // Metric 1: Latest Score
  const latestCompleted = completedAttempts[completedAttempts.length - 1];
  const latestScore = latestCompleted && latestCompleted.max_score
    ? Math.round((latestCompleted.total_score || 0) / latestCompleted.max_score * 100)
    : null;
  const latestAttemptIndex = latestCompleted ? attempts.indexOf(latestCompleted) + 1 : null;
  const latestDateStr = latestCompleted ? formatDate(latestCompleted.completed_at || latestCompleted.created_at) : '';

  // Metric 2: Total Attempts
  const totalAttempts = attempts.length;

  // Metric 3: Best Score
  let bestScore: number | null = null;
  let bestDateStr = '';
  completedAttempts.forEach(a => {
    if (a.max_score) {
      const pct = Math.round((a.total_score || 0) / a.max_score * 100);
      if (bestScore === null || pct > bestScore) {
        bestScore = pct;
        bestDateStr = formatDate(a.completed_at || a.created_at);
      }
    }
  });

  // Metric 4: Average Time
  const completedTimes = completedAttempts.map(a => {
    if (!a.started_at || !a.completed_at) return null;
    return (new Date(a.completed_at).getTime() - new Date(a.started_at).getTime()) / 60000;
  }).filter(t => t !== null) as number[];
  const avgTime = completedTimes.length > 0 ? Math.round(completedTimes.reduce((a, b) => a + b, 0) / completedTimes.length) : null;

  // Metric 5: Status
  const latestAttempt = attemptsDesc[0];
  const examStatus = latestAttempt ? latestAttempt.status : 'not_started';
  const progressPercentage = latestAttempt && selectedInfo ? (latestAttempt.status === 'completed' ? 100 : selectedInfo.progressPct) : 0;

  // Improvement Calculation
  let improvement = 0;
  if (completedAttempts.length >= 2) {
    const firstCompleted = completedAttempts[0];
    const firstPct = firstCompleted.max_score ? Math.round((firstCompleted.total_score || 0) / firstCompleted.max_score * 100) : 0;
    if (latestScore !== null) {
      improvement = latestScore - firstPct;
    }
  }

  // Strengths & Needs Improvement
  const strengths = radarStats.filter(s => s.percentage >= 70);
  const needsImprovement = radarStats.filter(s => s.percentage < 70 && s.total > 0);

  // Radar chart SVG config - expanded for better text visibility
  // Using 200x200 viewBox for better scaling
  const cx = 100;
  const cy = 100;
  const maxRadius = 80;
  const N = radarStats.length;

  const vertices = radarStats.map((stat, i) => {
    const angle = (i * 2 * Math.PI) / (N || 3) - Math.PI / 2;
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

  const gridPolygons = [25, 50, 75, 100].map(level => {
    const radius = (level / 100) * maxRadius;
    return vertices.map((_, i) => {
      const angle = (i * 2 * Math.PI) / (N || 3) - Math.PI / 2;
      const x = cx + radius * Math.cos(angle);
      const y = cy + radius * Math.sin(angle);
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    }).join(' ');
  });

  // Average line dotted polygon (55% baseline average)
  const avgPointsStr = vertices.map((_, i) => {
    const angle = (i * 2 * Math.PI) / (N || 3) - Math.PI / 2;
    const radius = 0.55 * maxRadius;
    const x = cx + radius * Math.cos(angle);
    const y = cy + radius * Math.sin(angle);
    return `${x.toFixed(1)},${y.toFixed(1)}`;
  }).join(' ');

  // Responsive scaling factor for labels based on chart size
  const labelPadding = 12;
  const labelRadiusOffset = 16;

  return (
    <div className="mx-auto w-full">
      <div className="grid gap-6 lg:grid-cols-[300px_1fr] xl:grid-cols-[360px_1fr]">

        {/* Left Side: Available Tests Panel */}
        <div className={`flex flex-col rounded-[22px] overflow-hidden border transition duration-200 border-slate-100 bg-white shadow-sm gap-4 p-4 sm:p-6 lg:sticky lg:top-0 lg:max-h-[calc(100vh-120px)] ${mobileView === 'dashboard' ? 'hidden lg:flex' : 'flex'}`}>
          <div>
            <h2 className="text-2xl font-black tracking-tight text-slate-950">
              Available Tests
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Choose an active test to view details or start.
            </p>
          </div>

          {/* Filter Tabs */}
          <div className="flex rounded-xl bg-slate-100/85 p-1 border border-slate-250/20">
            {(['all', 'completed', 'in_progress'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 text-center py-2 text-xs font-bold capitalize rounded-lg transition-all cursor-pointer ${
                  activeTab === tab
                    ? 'bg-white text-orange-600 shadow-xs border border-slate-200/10 font-extrabold'
                    : 'text-slate-500 hover:text-slate-900'
                }`}
              >
                {tab === 'in_progress' ? 'In Progress' : tab}
              </button>
            ))}
          </div>

          {/* Test Cards List */}
          <div className="flex flex-col gap-3 overflow-y-auto max-h-[400px] lg:max-h-[calc(100vh-280px)] pr-1">
            {filteredExams.length === 0 ? (
              <div className="text-center py-10 border border-dashed border-slate-200 rounded-2xl bg-slate-50/50">
                <p className="text-xs font-semibold text-slate-500">No tests match this filter</p>
              </div>
            ) : (
              filteredExams.map((exam) => {
                const info = getExamDisplayInfo(exam);
                const isSelected = selectedExam?.id === exam.id;
                const visuals = getExamCardVisuals(exam.title);

                return (
                  <div
                    key={exam.id}
                    onClick={() => handleSelectExam(exam)}
                    className={`flex items-center gap-3.5 p-4 rounded-2xl border transition-all cursor-pointer hover:shadow-xs group ${
                      isSelected
                        ? 'border-orange-500 bg-orange-500/5 shadow-xs border-l-4 border-l-orange-500'
                        : 'border-slate-150 bg-white hover:border-slate-350 border-l-4 border-l-transparent'
                    }`}
                  >
                    {/* Visual Icon */}
                    <div className={`grid size-11 shrink-0 place-items-center rounded-xl transition ${visuals.bgColor}`}>
                      {visuals.icon}
                    </div>

                    {/* Details */}
                    <div className="min-w-0 flex-1">
                      <h4 className="text-sm font-black text-slate-950 truncate group-hover:text-orange-600 transition">
                        {exam.title}
                      </h4>
                      <p className="text-[11px] text-slate-500 font-semibold mt-0.5">
                        {info.duration} min • {info.questions} questions
                      </p>
                    </div>

                    {/* Status / Percentage */}
                    <div className="text-right shrink-0 flex items-center gap-1.5">
                      <div className="flex flex-col items-end">
                        {info.hasCompleted ? (
                          <>
                            <span className="text-xs font-black text-emerald-600">{info.bestPct}%</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Completed</span>
                          </>
                        ) : info.isInProgress ? (
                          <>
                            <span className="text-xs font-black text-amber-600">{info.progressPct}%</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">In Progress</span>
                          </>
                        ) : (
                          <>
                            <span className="text-xs font-black text-slate-400">0%</span>
                            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">Not Started</span>
                          </>
                        )}
                      </div>
                      <ChevronRight className="size-4 text-slate-450 group-hover:translate-x-0.5 transition-transform" />
                    </div>
                  </div>
                );
              })
            )}
          </div>
        </div>

        {/* Right Side: Selected Test Dashboard */}
        {selectedExam && (
          <div className={`${mobileView === 'list' ? 'hidden lg:flex' : 'flex'} flex-col gap-6 bg-white rounded-xl p-6 border transition duration-200 border-slate-100 shadow-sm`}>
            {/* Mobile Back Navigation */}
            <button
              onClick={() => setMobileView('list')}
              className="flex lg:hidden items-center gap-1.5 text-slate-550 hover:text-slate-800 text-sm font-black mb-2 cursor-pointer transition"
            >
              <ArrowLeft className="size-4" />
              Back to Tests
            </button>

            {/* Dashboard Header */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
              <div>
                <h1 className="text-3xl font-black tracking-tight text-slate-950">
                  {selectedExam.title}
                </h1>
                <p className="text-sm font-semibold text-slate-500 mt-0.5">
                  History & Performance
                </p>
              </div>

              {/* Action Buttons */}
              <div className="flex items-center gap-3">
                <KniButton
                  onClick={onStartBriefing}
                  className="flex items-center gap-1.5 h-11 px-5 text-sm font-semibold rounded-xl bg-orange-600 text-white shadow-md shadow-orange-500/20 hover:bg-orange-500 transition cursor-pointer"
                >
                  <PlayCircle className="size-4.5" />
                  Start Test
                </KniButton>

                <KniButton
                  variant="secondary"
                  disabled={!latestCompleted}
                  onClick={() => latestCompleted && onReviewAttempt(latestCompleted)}
                  className="flex items-center gap-1.5 h-11 px-5 text-sm font-semibold rounded-xl bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                >
                  <BookOpen className="size-4.5 text-slate-500" />
                  Review Mistakes
                </KniButton>
              </div>
            </div>

            {/* Content Area: Statistics + Dashboard Body */}
            <div className="flex flex-col gap-6">

              {/* Statistics Cards Row */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-2 xl:grid-cols-5 gap-4">
                {/* Latest Score */}
                <div className="bg-white border border-slate-150 p-4 rounded-2xl flex flex-col justify-between shadow-xs">
                <div className="flex items-start justify-between gap-2">
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Latest Score</span>
                  <TrendingUp className="size-4 text-orange-500 animate-pulse" />
                </div>
                <div className="mt-3">
                  <p className="text-2xl font-black text-slate-950">
                    {latestScore !== null ? `${latestScore}%` : '--'}
                  </p>
                  <p className="text-[10px] text-slate-550 font-medium truncate mt-0.5" title={latestCompleted ? `Attempt ${latestAttemptIndex} • ${latestDateStr}` : 'No completed attempts'}>
                    {latestCompleted ? `Attempt ${latestAttemptIndex} • ${latestDateStr}` : 'No completed attempts'}
                  </p>
                </div>
              </div>

                {/* Total Attempts */}
                <div className="bg-white border border-slate-150 p-4 rounded-2xl flex flex-col justify-between shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Attempts</span>
                    <Award className="size-4 text-orange-500" />
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-black text-slate-950">
                      {totalAttempts}
                    </p>
                    <p className="text-[10px] text-slate-550 font-medium mt-0.5">
                      {totalAttempts === 1 ? '1 attempt' : `${totalAttempts} attempts`}
                    </p>
                  </div>
                </div>

                {/* Best Score */}
                <div className="bg-white border border-slate-150 p-4 rounded-2xl flex flex-col justify-between shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Best Score</span>
                    <Award className="size-4 text-orange-500" />
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-black text-slate-950">
                      {bestScore !== null ? `${bestScore}%` : '--'}
                    </p>
                    <p className="text-[10px] text-slate-550 font-medium truncate mt-0.5">
                      {bestDateStr ? bestDateStr : 'No completed attempts'}
                    </p>
                  </div>
                </div>

                {/* Average Time */}
                <div className="bg-white border border-slate-150 p-4 rounded-2xl flex flex-col justify-between shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider leading-none">Average Time</span>
                    <Clock className="size-4 text-orange-500" />
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-black text-slate-950">
                      {avgTime !== null ? `${avgTime} min` : '--'}
                    </p>
                    <p className="text-[10px] text-slate-550 font-medium mt-0.5">
                      {selectedInfo ? `of ${selectedInfo.duration} min` : '--'}
                    </p>
                  </div>
                </div>

                {/* Status */}
                <div className="bg-white border border-slate-150 p-4 rounded-2xl flex flex-col justify-between shadow-xs">
                  <div className="flex items-start justify-between gap-2">
                    <span className="text-[10px] font-bold text-slate-400 tracking-wider uppercase leading-none">Status</span>
                    <CheckCircle2 className="size-4 text-orange-500" />
                  </div>
                  <div className="mt-3">
                    <p className="text-2xl font-black text-slate-950 truncate">
                      {examStatus === 'completed' ? 'Completed' : examStatus === 'started' || examStatus === 'in_progress' ? 'In Progress' : 'Not Started'}
                    </p>
                    <p className="text-[10px] text-slate-550 font-medium mt-0.5">
                      {progressPercentage}% Complete
                    </p>
                  </div>
                </div>
              </div>

              {/* Dashboard Body */}
              <div className="flex flex-col xl:flex-row gap-6">

                {/* Column 1: Attempt History */}
                <div className="flex flex-col flex-1 gap-4">
                  <KniCard className="py-4 px-6 flex flex-col">
                    <div className="shrink-0">
                      <h3 className="text-lg font-black text-slate-900">
                        Attempt History
                      </h3>
                    </div>

                    <div className="overflow-x-auto overflow-y-auto max-h-[400px] custom-scrollbar mt-2">
                    <table className="w-full text-left text-xs border-collapse">
                      <thead>
                        <tr className="border-b border-slate-100 text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                          <th className="py-2.5 pb-3">Attempt</th>
                          <th className="py-2.5 pb-3">Date</th>
                          <th className="py-2.5 pb-3 text-center">Score</th>
                          {/* <th className="py-2.5 pb-3 text-center">Time</th> */}
                          <th className="py-2.5 pb-3 text-right">Status</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-50 text-slate-700 font-semibold">
                        {attemptsDesc.length === 0 ? (
                          <tr>
                            <td colSpan={5} className="py-10 text-center text-slate-400 font-bold">
                              No attempts yet for this test.
                            </td>
                          </tr>
                        ) : (
                          attemptsDesc.map((attempt) => {
                            const index = attempts.indexOf(attempt) + 1;
                            const pct = attempt.max_score ? Math.round((attempt.total_score || 0) / attempt.max_score * 100) : null;
                            const isCompleted = attempt.status === 'completed';

                            return (
                              <tr
                                key={attempt.id}
                                onClick={() => isCompleted ? onReviewAttempt(attempt) : onResumeAttempt(attempt)}
                                className="group hover:bg-slate-50/75 cursor-pointer transition-colors"
                              >
                                <td className="py-3.5 font-black text-slate-900">{index}</td>
                                <td className="py-3.5">
                                  <span>{formatDate(attempt.created_at)}</span>
                                  <span className="block text-[10px] text-slate-400 font-bold mt-0.5">{formatTime(attempt.created_at)}</span>
                                </td>
                                <td className="py-3.5 text-center font-black text-sm">
                                  {isCompleted && pct !== null ? (
                                    <span className={pct >= 70 ? 'text-emerald-600' : pct >= 50 ? 'text-orange-500' : 'text-rose-500'}>
                                      {pct}%
                                    </span>
                                  ) : (
                                    <span className="text-slate-400 font-medium">--</span>
                                  )}
                                </td>
                                {/* <td className="py-3.5 text-center text-slate-500">{getDuration(attempt)}</td> */}
                                <td className="py-3.5 text-right">
                                  <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider ${
                                    isCompleted
                                      ? 'bg-emerald-50 text-emerald-700 border border-emerald-100'
                                      : 'bg-amber-50 text-amber-700 border border-amber-100'
                                  }`}>
                                    {isCompleted ? 'Completed' : 'In Progress'}
                                  </span>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </KniCard>

                {/* Progress Improvement Tip Card - positioned at bottom of column */}
                {attempts.length > 0 && (
                  <div className="shrink-0 bg-orange-500/5 border border-orange-200/50 p-4.5 rounded-2xl flex items-start gap-3">
                    <div className="grid size-9 shrink-0 place-items-center rounded-xl bg-orange-100 text-orange-600">
                      <TrendingUp className="size-5" />
                    </div>
                    <p className="text-sm font-semibold leading-relaxed text-orange-850 self-center">
                      {attempts.length >= 2 ? (
                        improvement > 0 ? (
                          <>
                            You&apos;ve improved your score by <span className="font-black text-orange-600">{improvement}%</span> since your first attempt. Keep practicing to reach your best!
                          </>
                        ) : (
                          "Keep practicing and reviewing your mistakes to reach your best score!"
                        )
                      ) : (
                        "Review your mistakes and keep practicing to master this test!"
                      )}
                    </p>
                  </div>
                )}
                </div>

                {/* Column 2: Performance Overview */}
                <KniCard className="py-4 px-6 flex flex-col flex-1 gap-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-lg font-black text-slate-900 flex items-center gap-1.5">
                      Performance Overview
                      <span className="cursor-help" title="Section accuracy based on past attempts">
                        <Info className="size-4 text-slate-350" />
                      </span>
                    </h3>
                  </div>

                {radarStats.length === 0 || completedAttempts.length === 0 ? (
                  <div className="flex flex-col items-center justify-center text-center py-16 flex-1">
                    <Award className="size-10 text-slate-300 mb-2.5 animate-pulse" />
                    <p className="text-sm font-bold text-slate-800">No performance data yet</p>
                    <p className="text-xs text-slate-500 mt-1 max-w-[200px] leading-relaxed">
                      Complete a test attempt to view your section breakdown.
                    </p>
                  </div>
                ) : (
                  <div className="grid md:grid-cols-[1.1fr_0.9fr] xl:grid-cols-1 2xl:grid-cols-[1.15fr_0.85fr] gap-5 items-center">
                    
                    {/* Radar SVG Chart - responsive and scalable */}
                    <div className="flex items-center justify-center relative w-full max-w-60 mx-auto select-none overflow-visible">
                      <svg viewBox="0 0 200 200" className="w-full h-auto overflow-visible my-9" preserveAspectRatio="xMidYMid meet">
                        <defs>
                          <linearGradient id="radarFill" x1="0%" x2="100%">
                            <stop offset="0%" stopColor="#ea580c" stopOpacity="0.3" />
                            <stop offset="100%" stopColor="#f97316" stopOpacity="0.15" />
                          </linearGradient>
                        </defs>

                        {/* concentric grids */}
                        {gridPolygons.map((points, idx) => (
                          <polygon
                            key={idx}
                            points={points}
                            fill="none"
                            stroke="#f1f5f9"
                            strokeWidth="1.2"
                          />
                        ))}

                        {/* axes */}
                        {vertices.map((v, i) => (
                          <line
                            key={i}
                            x1={cx}
                            y1={cy}
                            x2={v.gridX}
                            y2={v.gridY}
                            stroke="#f1f5f9"
                            strokeWidth="1.2"
                            strokeDasharray="3 3"
                          />
                        ))}

                        {/* Grid labels - smaller font */}
                        {[50, 100].map((level) => {
                          const radius = (level / 100) * maxRadius;
                          return (
                            <text
                              key={level}
                              x={cx + 4}
                              y={cy - radius + 4}
                              className="text-[7px] font-bold fill-slate-300"
                            >
                              {level}%
                            </text>
                          );
                        })}

                        {/* Average Dotted Line Polygon */}
                        <polygon
                          points={avgPointsStr}
                          fill="none"
                          stroke="#cbd5e1"
                          strokeWidth="1.2"
                          strokeDasharray="2 3"
                        />

                        {/* User score polygon */}
                        {pointsStr && (
                          <polygon
                            points={pointsStr}
                            fill="url(#radarFill)"
                            stroke="#ea580c"
                            strokeWidth="2"
                            strokeLinejoin="round"
                            className="transition-all duration-300 animate-fade-in"
                          />
                        )}

                        {/* Dots - scaled for responsiveness */}
                        {vertices.map((v, i) => (
                          <circle
                            key={i}
                            cx={v.scoreX}
                            cy={v.scoreY}
                            r="3.5"
                            fill="#ea580c"
                            stroke="white"
                            strokeWidth="2"
                          />
                        ))}

                        {/* Vertex Labels - responsive positioning */}
                        {vertices.map((v, i) => {
                          const isVertical = Math.abs(Math.sin(v.angle)) > 0.9;
                          // Use percentage-based padding for responsiveness
                          const labelRadius = maxRadius + (isVertical ? labelRadiusOffset : labelRadiusOffset - 4);
                          const x = cx + labelRadius * Math.cos(v.angle);
                          const y = cy + labelRadius * Math.sin(v.angle);
                          // Adjust y for vertical labels - move top one up more
                          const yAdjust = isVertical && v.angle < 0 ? -18 : 0;
                          const anchor = x > cx + 10 ? 'start' : x < cx - 10 ? 'end' : 'middle';

                          // Split long labels into multiple lines using <tspan>
                          const labelStr = v.label || '';
                          let lines: string[] = [];

                          if (labelStr.length > 16) {
                            const words = labelStr.split(' ');
                            let currentLine = words[0];

                            for (let j = 1; j < words.length; j++) {
                              const testLine = currentLine + ' ' + words[j];
                              if (testLine.length <= 10) {
                                currentLine = testLine;
                              } else {
                                lines.push(currentLine);
                                currentLine = words[j];
                              }
                            }
                            lines.push(currentLine);
                          } else {
                            lines = [labelStr];
                          }

                          return (
                            <g key={i}>
                              {/* Label text with multi-line support - smaller font to reduce overlap */}
                              {lines.map((line, lineIndex) => (
                                <text
                                  key={lineIndex}
                                  x={x}
                                  y={y + lineIndex * 8 + yAdjust}
                                  textAnchor={anchor}
                                  className="text-[7px] font-bold fill-slate-550 uppercase tracking-wider"
                                >
                                  {line}
                                </text>
                              ))}
                              {/* Percentage value below label */}
                              <text
                                x={x}
                                y={y + lines.length * 8 + 3 + yAdjust}
                                textAnchor={anchor}
                                className="text-[6px] font-black fill-slate-900"
                              >
                                {v.percentage}%
                              </text>
                            </g>
                          );
                        })}
                      </svg>
                    </div>

                    {/* Strengths & Improvement Labels */}
                    <div className="flex flex-col gap-4 self-center w-full">
                      {/* Strengths */}
                      <div className="flex flex-row gap-1.5">
                        <span className="text-[10px] font-bold text-emerald-700 flex items-center gap-1 uppercase tracking-wider">
                          <BicepsFlexed className="size-3.5 text-emerald-600" />
                          Strengths
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {strengths.length === 0 ? (
                            <span className="text-[10px] text-slate-400 font-bold">Keep practicing to find your strengths!</span>
                          ) : (
                            strengths.map(s => (
                              <span key={s.key} className="inline-flex items-center rounded-lg bg-emerald-50 text-emerald-700 border border-emerald-100 px-2 py-0.5 text-[10px] font-extrabold">
                                {s.label.split(' ')[0]}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Needs Improvement */}
                      <div className="flex flex-row gap-1.5">
                        <span className="text-[10px] font-bold text-orange-700 flex items-center gap-1 uppercase tracking-wider">
                          <TrendingUp className="size-3.5 rotate-180 text-orange-600" />
                          Needs Improvement
                        </span>
                        <div className="flex flex-wrap gap-1.5">
                          {needsImprovement.length === 0 ? (
                            <span className="text-[10px] text-slate-400 font-bold">No critical areas needing improvement. Great job!</span>
                          ) : (
                            needsImprovement.map(s => (
                              <span key={s.key} className="inline-flex items-center rounded-lg bg-orange-50 text-orange-700 border border-orange-100 px-2 py-0.5 text-[10px] font-extrabold">
                                {s.label.split(' ')[0]}
                              </span>
                            ))
                          )}
                        </div>
                      </div>

                      {/* Legend */}
                      <div className="border-t border-slate-100 pt-3 flex flex-col gap-2">
                        <div className="flex items-center gap-2 text-[10px] text-slate-550 font-bold">
                          <span className="h-0.5 w-6 bg-orange-500 rounded-full" />
                          <span>Your Performance</span>
                        </div>
                        <div className="flex items-center gap-2 text-[10px] text-slate-550 font-bold">
                          <span className="h-0.5 w-6 border-t-2 border-dashed border-slate-350" />
                          <span>Average (All Users)</span>
                        </div>
                      </div>
                    </div>

                  </div>
                )}
              </KniCard>

              </div>
            </div>

          </div>
        )}

      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 8px;
          height: 8px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: #f1f5f9;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: #f97316;
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: #ea580c;
        }
      `}</style>
    </div>
  );
}

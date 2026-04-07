'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useExamStore } from '@/lib/store/exam-store';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { SECTION_TYPE_LABELS } from '@/lib/constants';
import {
  GraduationCap, Trophy, BarChart3, Clock,
  CheckCircle2, XCircle, RotateCcw, Home
} from 'lucide-react';

export default function ResultsPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const {
    sections,
    answers,
    currentExamId,
    userExamId,
    resetExam,
  } = useExamStore();
  const supabase = createClient();

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Safe redirect hook
  useEffect(() => {
    if (hydrated && !currentExamId) {
      router.push('/dashboard');
    }
  }, [hydrated, currentExamId, router]);

  // Calculate scores per section
  const sectionResults = sections.map((section) => {
    const sectionAnswers = answers[section.id] || {};
    const answeredCount = Object.keys(sectionAnswers).length;
    // In a real app, we'd compare against correct_answer from the DB
    // For mock, we'll simulate a random score
    const correctCount = Math.floor(answeredCount * 0.6 + Math.random() * answeredCount * 0.3);

    return {
      id: section.id,
      title: section.title,
      type: section.questionType,
      totalQuestions: section.questionCount,
      answeredCount,
      correctCount: Math.min(correctCount, answeredCount),
      percentage: answeredCount > 0
        ? Math.round((Math.min(correctCount, answeredCount) / section.questionCount) * 100)
        : 0,
    };
  });

  const totalCorrect = sectionResults.reduce((sum, s) => sum + s.correctCount, 0);
  const totalQuestions = sectionResults.reduce((sum, s) => sum + s.totalQuestions, 0);
  const totalAnswered = sectionResults.reduce((sum, s) => sum + s.answeredCount, 0);
  const overallPercentage = totalQuestions > 0
    ? Math.round((totalCorrect / totalQuestions) * 100)
    : 0;

  const getGrade = (pct: number) => {
    if (pct >= 90) return { label: 'Excellent', color: 'text-green-600', bg: 'bg-green-50' };
    if (pct >= 75) return { label: 'Good', color: 'text-blue-600', bg: 'bg-blue-50' };
    if (pct >= 60) return { label: 'Satisfactory', color: 'text-amber-600', bg: 'bg-amber-50' };
    return { label: 'Needs Improvement', color: 'text-red-600', bg: 'bg-red-50' };
  };

  const grade = getGrade(overallPercentage);

  // Auto-save the results to Supabase when we land on this page
  useEffect(() => {
    if (!hydrated || !userExamId || totalQuestions === 0) return;
    
    // We only trigger this once. If they refresh, this still safely updates
    const saveResults = async () => {
      try {
        await supabase
          .from('user_exams')
          .update({
            status: 'completed',
            total_score: totalCorrect,
            max_score: totalQuestions,
          })
          .eq('id', userExamId);
      } catch (err) {
        console.error('Failed to save exam history', err);
      }
    };
    saveResults();
  }, [hydrated, userExamId, totalCorrect, totalQuestions, supabase]);

  if (!hydrated || !currentExamId) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  const handleRetake = () => {
    resetExam();
    router.push('/dashboard');
  };

  return (
    <div className="min-h-screen bg-linear-to-br from-orange-50 via-white to-amber-50">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-orange-100/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-amber-100/60 blur-3xl" />
      </div>

      {/* Header */}
      <header className="relative z-10 border-b border-gray-100 bg-white/60 backdrop-blur-sm">
        <div className="max-w-3xl mx-auto px-6 py-4 flex items-center gap-3">
          <img src="/logo.avif" alt="TestAS Logo" className="w-12 h-auto" />
          <div>
            <h1 className="font-bold text-gray-900">TestAS Mock Test</h1>
            <p className="text-xs text-gray-500">Exam Results</p>
          </div>
        </div>
      </header>

      <main className="relative z-10 max-w-3xl mx-auto px-6 py-10">
        {/* Overall Score */}
        <div className="text-center mb-10">
          <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Exam Complete!</h2>
          <p className="text-gray-500">Here&apos;s your performance summary</p>
        </div>

        {/* Score Ring */}
        <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-xl mb-8">
          <CardContent className="pt-8 pb-8">
            <div className="flex flex-col items-center">
              {/* Circular Progress */}
              <div className="relative w-44 h-44 mb-6">
                <svg className="w-full h-full transform -rotate-90" viewBox="0 0 120 120">
                  <circle
                    cx="60" cy="60" r="52"
                    fill="none"
                    stroke="#f3f4f6"
                    strokeWidth="10"
                  />
                  <circle
                    cx="60" cy="60" r="52"
                    fill="none"
                    stroke="url(#scoreGradient)"
                    strokeWidth="10"
                    strokeLinecap="round"
                    strokeDasharray={`${2 * Math.PI * 52}`}
                    strokeDashoffset={`${2 * Math.PI * 52 * (1 - overallPercentage / 100)}`}
                    className="transition-all duration-1000 ease-out"
                  />
                  <defs>
                    <linearGradient id="scoreGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                      <stop offset="0%" stopColor="#F97316" />
                      <stop offset="100%" stopColor="#F59E0B" />
                    </linearGradient>
                  </defs>
                </svg>
                <div className="absolute inset-0 flex flex-col items-center justify-center">
                  <span className="text-4xl font-bold text-gray-900">{overallPercentage}%</span>
                  <span className={`text-sm font-medium ${grade.color}`}>{grade.label}</span>
                </div>
              </div>

              {/* Stats row */}
              <div className="flex items-center gap-8 text-center">
                <div>
                  <div className="flex items-center gap-1.5 text-green-600 mb-1">
                    <CheckCircle2 className="w-4 h-4" />
                    <span className="text-2xl font-bold">{totalCorrect}</span>
                  </div>
                  <span className="text-xs text-gray-500">Correct</span>
                </div>
                <div className="w-px h-10 bg-gray-200" />
                <div>
                  <div className="flex items-center gap-1.5 text-red-500 mb-1">
                    <XCircle className="w-4 h-4" />
                    <span className="text-2xl font-bold">{totalAnswered - totalCorrect}</span>
                  </div>
                  <span className="text-xs text-gray-500">Incorrect</span>
                </div>
                <div className="w-px h-10 bg-gray-200" />
                <div>
                  <div className="flex items-center gap-1.5 text-gray-400 mb-1">
                    <Clock className="w-4 h-4" />
                    <span className="text-2xl font-bold">{totalQuestions - totalAnswered}</span>
                  </div>
                  <span className="text-xs text-gray-500">Skipped</span>
                </div>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Section Breakdown */}
        <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
          <BarChart3 className="w-5 h-5 text-orange-500" />
          Section Breakdown
        </h3>

        <div className="space-y-3 mb-10">
          {sectionResults.map((result) => (
            <Card key={result.id} className="border-0 bg-white/70 backdrop-blur-sm shadow-md">
              <CardContent className="py-4 px-5">
                <div className="flex items-center justify-between mb-3">
                  <div>
                    <p className="font-semibold text-gray-900 text-sm">{result.title}</p>
                    <p className="text-xs text-gray-500">
                      {result.correctCount}/{result.totalQuestions} correct · {result.answeredCount} answered
                    </p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-sm font-bold ${getGrade(result.percentage).bg} ${getGrade(result.percentage).color}`}>
                    {result.percentage}%
                  </div>
                </div>
                {/* Progress bar */}
                <div className="h-2 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-linear-to-r from-orange-500 to-amber-500 rounded-full transition-all duration-700 ease-out"
                    style={{ width: `${result.percentage}%` }}
                  />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Action buttons */}
        <div className="flex items-center justify-center gap-4">
          <Button
            onClick={handleRetake}
            variant="outline"
            size="lg"
            className="h-12 px-8 border-2 border-orange-300 text-orange-600 hover:bg-orange-50"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Retake Exam
          </Button>
          <Button
            onClick={() => { resetExam(); router.push('/dashboard'); }}
            size="lg"
            className="h-12 px-8 bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-200"
          >
            <Home className="w-4 h-4 mr-2" />
            Back to Dashboard
          </Button>
        </div>
      </main>
    </div>
  );
}

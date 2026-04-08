"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useExamStore } from "@/lib/store/exam-store";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { SECTION_TYPE_LABELS } from "@/lib/constants";
import {
  GraduationCap,
  Trophy,
  BarChart3,
  Clock,
  CheckCircle2,
  XCircle,
  RotateCcw,
  Home,
  Mail,
  Info,
} from "lucide-react";

export default function ResultsPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [isCalculated, setIsCalculated] = useState(false);
  
  // State for calculated stats
  const [sectionResults, setSectionResults] = useState<any[]>([]);
  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [totalAnswered, setTotalAnswered] = useState(0);
  const [overallPercentage, setOverallPercentage] = useState(0);

  const { sections, answers, currentExamId, userExamId, resetExam } =
    useExamStore();
  const supabase = createClient();

  useEffect(() => {
    setHydrated(true);
  }, []);

  // Safe redirect hook
  useEffect(() => {
    if (hydrated && !currentExamId) {
      router.push("/dashboard");
    }
  }, [hydrated, currentExamId, router]);

  // Auto-calculate and save results to Supabase when we land on this page
  useEffect(() => {
    if (!hydrated || !userExamId || !currentExamId) return;

    // Helper for deep equality
    const isDeepEqual = (a: any, b: any): boolean => {
      if (typeof a === 'object' && a !== null && typeof b === 'object' && b !== null) {
        const keys1 = Object.keys(a);
        const keys2 = Object.keys(b);
        if (keys1.length !== keys2.length) return false;
        for (const key of keys1) {
            if (a[key] !== b[key]) return false;
        }
        return true;
      }
      return a === b;
    };

    const processResults = async () => {
      try {
        // Collect all possible question IDs to fetch correct answers
        const questionIds: string[] = [];
        sections.forEach((sec) => {
          if (sec.questionIds) {
            questionIds.push(...sec.questionIds);
          }
        });

        // 1. Fetch correct answers from DB
        const { data: questionsData, error } = await supabase
          .from("questions")
          .select("id, correct_answer")
          .in("id", questionIds);

        if (error) throw error;
        
        // 2. Build map of correct answers
        const correctAnswersMap = (questionsData || []).reduce((acc: Record<string, any>, q) => {
          acc[q.id] = q.correct_answer;
          return acc;
        }, {});

        // 3. Process section by section
        const calculatedResults = sections.map((section) => {
          const sectionAnswers = answers[section.id] || {};
          let correctCount = 0;
          let answeredCount = 0;

          // Check each question in the section
          Object.entries(sectionAnswers).forEach(([qId, ans]) => {
             answeredCount++;
             const correctAns = correctAnswersMap[qId];
             
             if (ans !== null && ans !== undefined && correctAns !== undefined) {
               // Complex equality for objects like {A: 7, B: 4} OR strict equality for "C"
               if (isDeepEqual(ans, correctAns)) {
                 correctCount++;
               }
             }
          });

          const percentage = section.questionCount > 0 
            ? Math.round((correctCount / section.questionCount) * 100) 
            : 0;

          return {
            id: section.id,
            title: section.title,
            type: section.questionType,
            totalQuestions: section.questionCount,
            answeredCount,
            correctCount,
            percentage,
          };
        });

        // 4. Calculate globals
        const totalC = calculatedResults.reduce((sum, s) => sum + s.correctCount, 0);
        const totalQ = calculatedResults.reduce((sum, s) => sum + s.totalQuestions, 0);
        const totalA = calculatedResults.reduce((sum, s) => sum + s.answeredCount, 0);
        const overallPct = totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0;

        setSectionResults(calculatedResults);
        setTotalCorrect(totalC);
        setTotalQuestions(totalQ);
        setTotalAnswered(totalA);
        setOverallPercentage(overallPct);
        setIsCalculated(true);

        // 5. Format detailed answers for jsonb
        const detailedAnswersByTitle = calculatedResults.reduce((acc, result) => {
          const section = sections.find((s) => s.id === result.id);
          if (!section) return acc;

          const sectionAnswers = answers[section.id] || {};
          
          const formatAns = (a: any) => {
            if (a && typeof a === 'object') {
              if ('image1' in a && 'image2' in a) return [a.image1, a.image2];
              if ('A' in a && 'B' in a) return [a.A, a.B];
            }
            return a !== undefined ? a : null;
          };

          const formattedAnswers = section.questionIds.map((qId) => {
            const ans = sectionAnswers[qId];
            const correctAns = correctAnswersMap[qId];
            const isCorrect = ans !== null && ans !== undefined && correctAns !== undefined && isDeepEqual(ans, correctAns);

            return {
              user_answer: formatAns(ans),
              correct_answer: formatAns(correctAns),
              is_correct: isCorrect
            };
          });
          
          acc[result.title] = {
            score: result.correctCount,
            max_score: result.totalQuestions,
            answers: formattedAnswers
          };
          return acc;
        }, {} as Record<string, unknown>);

        // 6. Save results
        await supabase
          .from("user_exams")
          .update({
            status: "completed",
            total_score: totalC,
            max_score: totalQ,
            detailed_results: detailedAnswersByTitle,
          })
          .eq("id", userExamId);

      } catch (err) {
        console.error("Failed to process and save exam history", err);
      }
    };
    
    processResults();
  }, [hydrated, userExamId, currentExamId, supabase]);

  const getGrade = (pct: number) => {
    if (pct >= 90) return { label: "Excellent", color: "text-green-600", bg: "bg-green-50" };
    if (pct >= 75) return { label: "Good", color: "text-blue-600", bg: "bg-blue-50" };
    if (pct >= 60) return { label: "Satisfactory", color: "text-amber-600", bg: "bg-amber-50" };
    return { label: "Needs Improvement", color: "text-red-600", bg: "bg-red-50" };
  };

  const grade = getGrade(overallPercentage);

  if (!hydrated || !currentExamId || !isCalculated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  const handleRetake = () => {
    resetExam();
    router.push("/dashboard");
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

      <main className="relative z-10 max-w-6xl mx-auto px-6 py-10">
        {/* Overall Score */}
        {/* <div className="text-center mb-10">
          <Trophy className="w-12 h-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-3xl font-bold text-gray-900 mb-2">Exam Complete!</h2>
          <p className="text-gray-500">Here&apos;s your performance summary</p>
        </div> */}

        <div className="relative">
          {/* Blurred Overlay for Results */}
          <div className="absolute inset-0 z-20 flex flex-col items-center justify-start pt-16 p-6 text-center bg-white/30 rounded-2xl">
            <div className="bg-white p-8 rounded-2xl shadow-2xl max-w-2xl w-full border border-orange-100">
              <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-4">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-2">
                Thanks for taking the test!
              </h3>
              <p className="text-gray-600 mb-6 leading-relaxed">
                Your answers have been securely recorded. We will review your
                test and email your detailed results and score analysis within{" "}
                <strong>1 day</strong>.
              </p>

              <div className="bg-orange-50 rounded-xl p-4 text-left shadow-sm border border-orange-100/50">
                <p className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
                  <Info className="w-4 h-4" /> Contact Information
                </p>
                <a
                  href="mailto:nhat@kni.vn"
                  className="flex items-center gap-2 text-sm text-orange-700 hover:text-orange-900 transition-colors"
                >
                  <Mail className="w-4 h-4 shrink-0" /> nhat@kni.vn
                </a>
                <div className="mt-3 space-y-2">
                  <a
                    href="tel:+84918391099"
                    className="flex items-center gap-2 text-sm text-orange-700 hover:text-orange-900 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.86 19.86 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.86 19.86 0 0 1 2.09 4.18 2 2 0 0 1 4 2h3a2 2 0 0 1 2 1.72c.12.9.38 1.76.75 2.58a2 2 0 0 1-.45 2.11L8.91 9.91a16 16 0 0 0 6 6l1.5-1.5a2 2 0 0 1 2.11-.45c.82.37 1.68.63 2.58.75A2 2 0 0 1 22 16.92z" />
                    </svg>
                    0918391099
                  </a>

                  <a
                    href="https://kni.vn"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-2 text-sm text-orange-700 hover:text-orange-900 transition-colors"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-4 h-4 shrink-0"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden
                    >
                      <path d="M10 14L21 3" />
                      <path d="M21 10v-7h-7" />
                      <path d="M21 21H3V3h7" />
                    </svg>
                    kni.vn
                  </a>
                </div>
              </div>

              <div className="flex pt-4 items-center justify-center gap-4">
                {/* <Button
            onClick={handleRetake}
            variant="outline"
            size="lg"
            className="h-12 px-8 border-2 border-orange-300 text-orange-600 hover:bg-orange-50"
          >
            <RotateCcw className="w-4 h-4 mr-2" />
            Retake Exam
          </Button> */}
                <Button
                  onClick={() => {
                    resetExam();
                    router.push("/dashboard");
                  }}
                  size="lg"
                  className="h-12 px-8 bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-200"
                >
                  <Home className="w-4 h-4 mr-2" />
                  Back to Dashboard
                </Button>
              </div>
            </div>
          </div>

          {/* <div className="select-none opacity-30 blur-[6px] pointer-events-none transition-all duration-500 pb-4">
            <Card className="border-0 bg-white/80 backdrop-blur-sm shadow-xl mb-8">
              <CardContent className="pt-8 pb-8">
                <div className="flex flex-col items-center">
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
          </div> */}
        </div>

        {/* Action buttons */}
      </main>
    </div>
  );
}

"use client";
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useExamStore } from "@/lib/store/exam-store";
import { createClient } from "@/lib/supabase/client";
import {
  GraduationCap,
  CheckCircle2,
  Home,
  Mail,
  Info,
} from "lucide-react";
import { KniCard, KniButton, KniBackground } from "@/components/KniPrimitives";

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

  const { sections, answers, ratings, currentExamId, userExamId, resetExam } =
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

    const formatAns = (a: any) => {
      if (a && typeof a === 'object') {
        if ('image1' in a && 'image2' in a) return [a.image1, a.image2];
        if ('A' in a && 'B' in a) return [a.A, a.B];
      }
      return a !== undefined ? a : null;
    };

    // Only process if sections are loaded
    if (sections.length === 0) return;

    const processResults = async () => {
      try {
        // Collect all possible section IDs to fetch correct questions
        const sectionIds = sections.map((s) => s.id);

        // 1. Fetch true questions from DB
        const { data: questionsData, error } = await supabase
          .from("questions")
          .select("id, section_id, correct_answer, question_type")
          .in("section_id", sectionIds);

        if (error) throw error;

        // 2. Build map of correct answers and types
        const questionsMap = (questionsData || []).reduce(
          (acc: Record<string, { correct: any; type: string }>, q) => {
            acc[q.id] = { correct: q.correct_answer, type: q.question_type };
            return acc;
          },
          {}
        );

        // 3. Process section by section
        const calculatedResults = sections.map((section) => {
          const sectionAnswers = answers[section.id] || {};
          let correctCount = 0;
          let answeredCount = 0;

          // Evaluate child question keys
          const actualQuestionIds = (questionsData || [])
            .filter((q) => q.section_id === section.id)
            .map((q) => q.id);

          const actualTotalQuestions = actualQuestionIds.length;

          // Check each real question in the section
          actualQuestionIds.forEach((qId) => {
            const ans = sectionAnswers[qId];
            const qInfo = questionsMap[qId];
            const correctAns = qInfo?.correct;
            const qType = qInfo?.type;

            if (ans !== null && ans !== undefined) {
              answeredCount++;
            }

            if (
              ans !== null &&
              ans !== undefined &&
              correctAns !== undefined
            ) {
              let isCorrect = false;
              if (qType === 'numerical_series') {
                const getDistinctCharsSorted = (str: string) => {
                  return Array.from(new Set(String(str).replace(/\s+/g, '').split(''))).sort().join('');
                };
                isCorrect = getDistinctCharsSorted(String(ans)) === getDistinctCharsSorted(String(correctAns));
              } else {
                isCorrect = isDeepEqual(formatAns(ans), formatAns(correctAns));
              }

              if (isCorrect) {
                correctCount++;
              }
            }
          });

          const percentage =
            actualTotalQuestions > 0
              ? Math.round((correctCount / actualTotalQuestions) * 100)
              : 0;

          return {
            id: section.id,
            title: section.title,
            type: section.questionType,
            totalQuestions: actualTotalQuestions,
            actualQuestionIds: actualQuestionIds,
            answeredCount,
            correctCount,
            percentage,
          };
        });

        // 4. Calculate globals
        const totalC = calculatedResults.reduce(
          (sum, s) => sum + s.correctCount,
          0
        );
        const totalQ = calculatedResults.reduce(
          (sum, s) => sum + s.totalQuestions,
          0
        );
        const totalA = calculatedResults.reduce(
          (sum, s) => sum + s.answeredCount,
          0
        );
        const overallPct =
          totalQ > 0 ? Math.round((totalC / totalQ) * 100) : 0;

        setSectionResults(calculatedResults);
        setTotalCorrect(totalC);
        setTotalQuestions(totalQ);
        setTotalAnswered(totalA);
        setOverallPercentage(overallPct);
        setIsCalculated(true);

        // Get user_id from user_exams first to associate practice difficulties
        const { data: userExamData, error: userExamError } = await supabase
          .from("user_exams")
          .select("user_id")
          .eq("id", userExamId)
          .single();

        if (userExamError) throw userExamError;
        const userId = userExamData?.user_id;

        const incorrectOrUnansweredQuestionIds: string[] = [];

        // 5. Format detailed answers for jsonb
        const detailedAnswersByTitle = calculatedResults.reduce((acc, result) => {
          const sectionAnswers = answers[result.id] || {};

          const formattedAnswers = result.actualQuestionIds.map(
            (qId: string) => {
              const ans = sectionAnswers[qId];
              const qInfo = questionsMap[qId];
              const correctAns = qInfo?.correct;
              const qType = qInfo?.type;
              const formattedUserAns = formatAns(ans);
              const formattedCorrectAns = formatAns(correctAns);
              
              let isCorrect = false;
              if (qType === 'numerical_series') {
                const getDistinctCharsSorted = (str: string) => {
                  return Array.from(new Set(String(str).replace(/\s+/g, '').split(''))).sort().join('');
                };
                isCorrect = getDistinctCharsSorted(String(ans)) === getDistinctCharsSorted(String(correctAns));
              } else {
                isCorrect =
                  ans !== null &&
                  ans !== undefined &&
                  correctAns !== undefined &&
                  isDeepEqual(formattedUserAns, formattedCorrectAns);
              }

              if (!isCorrect) {
                incorrectOrUnansweredQuestionIds.push(qId);
              }

              return {
                question_id: qId,
                user_answer: formattedUserAns,
                correct_answer: formattedCorrectAns,
                is_correct: isCorrect,
              };
            }
          );

          acc[result.title] = {
            score: result.correctCount,
            max_score: result.totalQuestions,
            type: result.type,
            answers: formattedAnswers,
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

        // 7. Upsert manual ratings and default incorrect/unanswered to 'hard' in user_question_practices
        if (userId) {
          const manualRatings: { question_id: string; difficulty: 'easy' | 'medium' | 'hard' }[] = [];
          
          sections.forEach((section) => {
            const sectionRatings = ratings[section.id] || {};
            Object.entries(sectionRatings).forEach(([qId, difficulty]) => {
              if (difficulty) {
                manualRatings.push({
                  question_id: qId,
                  difficulty,
                });
              }
            });
          });

          const manuallyRatedQuestionIds = new Set(manualRatings.map(mr => mr.question_id));
          const autoHardQuestionIds = incorrectOrUnansweredQuestionIds.filter(qId => !manuallyRatedQuestionIds.has(qId));

          const upsertData = [
            ...manualRatings.map(({ question_id, difficulty }) => ({
              user_id: userId,
              question_id,
              difficulty,
              updated_at: new Date().toISOString()
            })),
            ...autoHardQuestionIds.map((qId) => ({
              user_id: userId,
              question_id: qId,
              difficulty: 'hard' as const,
              updated_at: new Date().toISOString()
            }))
          ];

          if (upsertData.length > 0) {
            const { error: upsertError } = await supabase
              .from("user_question_practices")
              .upsert(upsertData, { onConflict: "user_id,question_id" });

            if (upsertError) {
              console.error("Failed to upsert practice difficulties:", upsertError);
            }
          }
        }

      } catch (err) {
        console.error("Failed to process and save exam history", err);
      }
    };
    
    processResults();
  }, [hydrated, userExamId, currentExamId, supabase, sections, answers]);

  if (!hydrated || !currentExamId || !isCalculated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-orange-50">
        <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-orange-50 relative overflow-hidden flex flex-col">
      <KniBackground />

      {/* Header */}
      <header className="relative z-10 flex items-center justify-between border-b border-orange-100/70 bg-white/70 px-4 py-4 backdrop-blur-xl md:px-8">
        <div className="flex min-w-0 items-center gap-3">
          <div className="hidden text-left sm:block">
            <p className="text-sm text-slate-500">mocktest.kni.vn</p>
            <h1 className="truncate text-lg font-semibold text-slate-900">TestAS Prep Platform</h1>
          </div>
        </div>
        <div>
          <span className="rounded-full border border-emerald-250 bg-emerald-50 px-3.5 py-1.5 text-xs font-bold text-emerald-700">
            Exam Complete
          </span>
        </div>
      </header>

      <main className="relative z-10 max-w-2xl mx-auto px-6 py-16 flex-1 flex items-center justify-center">
        <KniCard className="p-8 w-full text-center relative z-20">
          <div className="w-16 h-16 bg-emerald-50 rounded-full border border-emerald-200 flex items-center justify-center mx-auto mb-4 shadow-xs">
            <CheckCircle2 className="w-8 h-8 text-emerald-600" />
          </div>
          <h3 className="text-2xl font-bold text-slate-900 mb-2">
            Thanks for taking the test!
          </h3>
          <p className="text-slate-600 mb-6 leading-relaxed">
            Your answers have been securely recorded. We will review your
            test and email your detailed results and score analysis within{" "}
            <strong>1 day</strong>.
          </p>

          <div className="bg-orange-50 rounded-2xl p-5 text-left border border-orange-100/50 mb-6 shadow-xs">
            <p className="text-xs font-bold text-orange-800 uppercase tracking-wider mb-3 flex items-center gap-1.5">
              <Info className="w-4 h-4" /> Contact Information
            </p>
            <div className="space-y-2">
              <a
                href="mailto:nhat@kni.vn"
                className="flex items-center gap-2 text-sm text-orange-700 hover:text-orange-950 transition-colors"
              >
                <Mail className="w-4 h-4 shrink-0" /> nhat@kni.vn
              </a>
              <a
                href="tel:+84918391099"
                className="flex items-center gap-2 text-sm text-orange-700 hover:text-orange-950 transition-colors"
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
                className="flex items-center gap-2 text-sm text-orange-700 hover:text-orange-950 transition-colors"
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

          <div className="flex items-center justify-center">
            <KniButton
              onClick={() => {
                resetExam();
                router.push("/dashboard");
              }}
              className="h-12 px-8"
            >
              <Home className="w-4 h-4" />
              Back to Dashboard
            </KniButton>
          </div>
        </KniCard>
      </main>
    </div>
  );
}

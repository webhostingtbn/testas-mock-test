"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useExamStore } from "@/lib/store/exam-store";
import { createClient } from "@/lib/supabase/client";
import { Button } from "@/components/ui/button";
import { CheckCircle2, Home, Mail, Phone, ExternalLink } from "lucide-react";
import { useSession } from "next-auth/react";

export default function ResultsPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [isCalculated, setIsCalculated] = useState(false);

  const { sections, answers, currentExamId, userExamId, resetExam } =
    useExamStore();
  const supabase = createClient();
  const { data: session } = useSession();

  // Phone number state
  const [phoneNumber, setPhoneNumber] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submitError, setSubmitError] = useState("");

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !currentExamId) {
      router.push("/dashboard");
    }
  }, [hydrated, currentExamId, router]);

  // Auto-calculate and save results to Supabase
  useEffect(() => {
    if (!hydrated || !userExamId || !currentExamId) return;

    const isDeepEqual = (a: any, b: any): boolean => {
      if (typeof a === "object" && a !== null && typeof b === "object" && b !== null) {
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
      if (a && typeof a === "object") {
        if ("image1" in a && "image2" in a) return [a.image1, a.image2];
        if ("A" in a && "B" in a) return [a.A, a.B];
      }
      return a !== undefined ? a : null;
    };

    if (sections.length === 0) return;

    const processResults = async () => {
      try {
        const sectionIds = sections.map((s) => s.id);

        const { data: questionsData, error } = await supabase
          .from("questions")
          .select("id, section_id, correct_answer")
          .in("section_id", sectionIds);

        if (error) throw error;

        const correctAnswersMap = (questionsData || []).reduce(
          (acc: Record<string, any>, q) => {
            acc[q.id] = q.correct_answer;
            return acc;
          },
          {}
        );

        const calculatedResults = sections.map((section) => {
          const sectionAnswers = answers[section.id] || {};
          let correctCount = 0;
          let answeredCount = 0;

          const actualQuestionIds = (questionsData || [])
            .filter((q) => q.section_id === section.id)
            .map((q) => q.id);

          actualQuestionIds.forEach((qId) => {
            const ans = sectionAnswers[qId];
            const correctAns = correctAnswersMap[qId];
            if (ans !== null && ans !== undefined) answeredCount++;
            if (ans !== null && ans !== undefined && correctAns !== undefined) {
              if (isDeepEqual(formatAns(ans), formatAns(correctAns))) correctCount++;
            }
          });

          const percentage =
            actualQuestionIds.length > 0
              ? Math.round((correctCount / actualQuestionIds.length) * 100)
              : 0;

          return {
            id: section.id,
            title: section.title,
            totalQuestions: actualQuestionIds.length,
            actualQuestionIds,
            answeredCount,
            correctCount,
            percentage,
          };
        });

        const totalC = calculatedResults.reduce((sum, s) => sum + s.correctCount, 0);
        const totalQ = calculatedResults.reduce((sum, s) => sum + s.totalQuestions, 0);

        setIsCalculated(true);

        const detailedAnswersByTitle = calculatedResults.reduce((acc, result) => {
          const sectionAnswers = answers[result.id] || {};
          const formattedAnswers = result.actualQuestionIds.map((qId: string) => {
            const ans = sectionAnswers[qId];
            const correctAns = correctAnswersMap[qId];
            const formattedUserAns = formatAns(ans);
            const formattedCorrectAns = formatAns(correctAns);
            const isCorrect =
              ans !== null &&
              ans !== undefined &&
              correctAns !== undefined &&
              isDeepEqual(formattedUserAns, formattedCorrectAns);
            return { user_answer: formattedUserAns, correct_answer: formattedCorrectAns, is_correct: isCorrect };
          });
          acc[result.title] = { score: result.correctCount, max_score: result.totalQuestions, answers: formattedAnswers };
          return acc;
        }, {} as Record<string, unknown>);

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

  const handleSubmitPhone = async () => {
    if (!phoneNumber.trim()) return;
    if (!session?.user?.id) {
      setSubmitError("Not signed in — please refresh and try again.");
      return;
    }

    setIsSubmitting(true);
    setSubmitError("");
    try {
      const { error } = await supabase
        .from("profiles")
        .update({ phonenumber: phoneNumber.trim() })
        .eq("id", session.user.id);

      if (error) throw error;
      setSubmitted(true);
    } catch (err) {
      console.error("Failed to save phone number:", err);
      setSubmitError("Failed to save. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  };

  if (!hydrated || !currentExamId || !isCalculated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#faf9f7]">
        <div className="w-8 h-8 border-[3px] border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#f5f4f0] flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-gray-100">
        <div className="max-w-lg mx-auto px-5 py-3.5 flex items-center gap-3">
          <img src="/logo.avif" alt="TestAS Logo" className="w-10 h-auto" />
          <div>
            <h1 className="font-bold text-gray-900 text-sm leading-tight">TestAS Mock Test</h1>
            <p className="text-xs text-gray-400">Exam Results</p>
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-lg mx-auto w-full px-4 py-6 flex flex-col gap-3">

        {/* Main card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">

          {/* Top section: check + title + description */}
          <div className="px-7 pt-8 pb-6 text-center">
            <div className="w-14 h-14 bg-green-50 rounded-full flex items-center justify-center mx-auto mb-5">
              <CheckCircle2 className="w-7 h-7 text-green-500" strokeWidth={2} />
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-3 leading-tight">
              Thanks for taking the test!
            </h2>
            <p className="text-gray-500 text-[15px] leading-relaxed">
              Your answers have been securely recorded. We&apos;ll review your test and send
              your detailed results within <strong className="text-gray-700">1 day</strong>.
            </p>
          </div>

          {/* Divider */}
          <div className="h-px bg-gray-100 mx-0" />

          {/* Phone input section */}
          <div className="px-7 py-6">
            {!submitted ? (
              <>
                <p className="font-semibold text-gray-900 text-[15px] mb-1">
                  Want to get your test results?
                </p>
                <p className="text-gray-400 text-sm mb-4">
                  Submit your Zalo phone number and we&apos;ll send results directly to you.
                </p>
                <div className="flex gap-2">
                  <input
                    type="tel"
                    placeholder="e.g. 0912 345 678"
                    value={phoneNumber}
                    onChange={(e) => setPhoneNumber(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && phoneNumber.trim()) handleSubmitPhone();
                    }}
                    className="flex-1 h-12 px-4 rounded-xl border border-gray-200 bg-gray-50 text-gray-900 text-[15px] placeholder:text-gray-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
                  />
                  <button
                    onClick={handleSubmitPhone}
                    disabled={isSubmitting || !phoneNumber.trim()}
                    className="h-12 px-6 rounded-xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold text-[15px] transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
                  >
                    {isSubmitting ? (
                      <span className="flex items-center gap-2">
                        <span className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                        Saving
                      </span>
                    ) : (
                      "Submit"
                    )}
                  </button>
                </div>
                {submitError && (
                  <p className="text-red-500 text-xs mt-2">{submitError}</p>
                )}
              </>
            ) : (
              <div className="flex items-center gap-3 py-1">
                <div className="w-10 h-10 bg-green-50 rounded-full flex items-center justify-center shrink-0">
                  <CheckCircle2 className="w-5 h-5 text-green-500" />
                </div>
                <div>
                  <p className="font-semibold text-gray-900 text-[15px]">Phone number saved!</p>
                  <p className="text-gray-400 text-sm">
                    We&apos;ll contact you at <span className="font-medium text-gray-600">{phoneNumber}</span> on Zalo.
                  </p>
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Contact card */}
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 px-7 py-5">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
            Contact
          </p>
          <div className="space-y-3">
            <a
              href="mailto:nhat@kni.vn"
              className="flex items-center gap-3 group"
            >
              <span className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 group-hover:bg-orange-100 transition-colors">
                <Mail className="w-4 h-4 text-orange-500" />
              </span>
              <span className="text-gray-700 text-[15px] group-hover:text-orange-600 transition-colors">
                nhat@kni.vn
              </span>
            </a>
            <a
              href="tel:+84918391099"
              className="flex items-center gap-3 group"
            >
              <span className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 group-hover:bg-orange-100 transition-colors">
                <Phone className="w-4 h-4 text-orange-500" />
              </span>
              <span className="text-gray-700 text-[15px] group-hover:text-orange-600 transition-colors">
                0918391099
              </span>
            </a>
            <a
              href="https://kni.vn"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-3 group"
            >
              <span className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0 group-hover:bg-orange-100 transition-colors">
                <ExternalLink className="w-4 h-4 text-orange-500" />
              </span>
              <span className="text-gray-700 text-[15px] group-hover:text-orange-600 transition-colors">
                kni.vn
              </span>
            </a>
          </div>
        </div>

        {/* Back to Dashboard — full width outside cards */}
        <button
          onClick={() => {
            resetExam();
            router.push("/dashboard");
          }}
          className="w-full h-14 rounded-2xl bg-orange-500 hover:bg-orange-600 active:bg-orange-700 text-white font-semibold text-[16px] flex items-center justify-center gap-2.5 transition-colors shadow-md shadow-orange-200"
        >
          <Home className="w-5 h-5" />
          Back to Dashboard
        </button>
      </main>
    </div>
  );
}

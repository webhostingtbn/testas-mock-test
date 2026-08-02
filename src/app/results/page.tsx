"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { flattenExamAnswers, useExamStore } from "@/lib/store/exam-store";
import {
  GraduationCap,
  CheckCircle2,
  Home,
  Info,
} from "lucide-react";
import { KniCard, KniButton, KniBackground } from "@/components/KniPrimitives";

export default function ResultsPage() {
  const router = useRouter();
  const [hydrated, setHydrated] = useState(false);
  const [isCalculated, setIsCalculated] = useState(false);

  const [totalCorrect, setTotalCorrect] = useState(0);
  const [totalQuestions, setTotalQuestions] = useState(0);
  const [overallPercentage, setOverallPercentage] = useState(0);

  const { currentExamId, userExamId, answers, resetExam } = useExamStore();

  useEffect(() => {
    setHydrated(true);
  }, []);

  useEffect(() => {
    if (hydrated && !currentExamId) {
      router.push("/dashboard");
    }
  }, [hydrated, currentExamId, router]);

  useEffect(() => {
    if (!hydrated || !userExamId || !currentExamId) return;

    const processResults = async () => {
      try {
        const res = await fetch(`/api/attempts/${userExamId}/submit`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ userAnswers: flattenExamAnswers(answers) }),
        });

        if (!res.ok) {
          throw new Error("Failed to submit exam attempt for scoring");
        }

        const data = await res.json();
        const resObj = data.result || {};
        const score = resObj.score || 0;
        const total = resObj.total || 1;
        const pct = Math.round((score / total) * 100);

        setTotalCorrect(score);
        setTotalQuestions(total);
        setOverallPercentage(pct);
        setIsCalculated(true);
      } catch (err) {
        console.error("Failed to process exam results", err);
      }
    };

    processResults();
  }, [hydrated, userExamId, currentExamId, answers]);

  if (!hydrated || !currentExamId || !isCalculated) {
    return (
      <KniBackground className="min-h-screen flex items-center justify-center p-6 text-foreground">
        <div className="flex flex-col items-center space-y-4">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
          <p className="text-muted-foreground animate-pulse font-medium">
            Scoring exam on server...
          </p>
        </div>
      </KniBackground>
    );
  }

  return (
    <KniBackground className="min-h-screen py-12 px-4 sm:px-6 lg:px-8 text-foreground">
      <div className="max-w-4xl mx-auto space-y-8">
        <KniCard className="p-8 sm:p-10 border-primary/20 bg-card/60 backdrop-blur-md shadow-2xl relative overflow-hidden">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6 pb-8 border-b border-border/40">
            <div className="flex items-center space-x-4">
              <div className="p-3.5 rounded-2xl bg-primary/10 text-primary">
                <GraduationCap className="w-10 h-10" />
              </div>
              <div>
                <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight">
                  Exam Completed
                </h1>
                <p className="text-muted-foreground text-sm mt-1">
                  Server-verified result recorded
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <KniButton
                variant="outline"
                onClick={() => {
                  resetExam();
                  router.push("/dashboard");
                }}
                className="gap-2"
              >
                <Home className="w-4 h-4" />
                Dashboard
              </KniButton>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 my-8">
            <div className="p-6 rounded-xl bg-primary/5 border border-primary/10 flex flex-col items-center text-center">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Score
              </span>
              <span className="text-4xl font-extrabold text-primary mt-2">
                {totalCorrect} / {totalQuestions}
              </span>
            </div>

            <div className="p-6 rounded-xl bg-primary/5 border border-primary/10 flex flex-col items-center text-center">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Percentage
              </span>
              <span className="text-4xl font-extrabold text-primary mt-2">
                {overallPercentage}%
              </span>
            </div>

            <div className="p-6 rounded-xl bg-primary/5 border border-primary/10 flex flex-col items-center text-center">
              <span className="text-xs uppercase tracking-wider text-muted-foreground font-semibold">
                Status
              </span>
              <span className="text-xl font-bold text-emerald-500 mt-3 flex items-center gap-1.5">
                <CheckCircle2 className="w-5 h-5" /> Completed
              </span>
            </div>
          </div>

          <div className="mt-6 pt-6 border-t border-border/40 text-center text-sm text-muted-foreground flex items-center justify-center gap-2">
            <Info className="w-4 h-4" />
            <span>Answer keys and scoring are secured server-side.</span>
          </div>
        </KniCard>
      </div>
    </KniBackground>
  );
}

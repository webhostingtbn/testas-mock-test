'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChevronLeft, ChevronRight, Flag, Smile, Meh, Frown } from 'lucide-react';

interface ExamBottomBarProps {
  onBack: () => void;
  onNext: () => void;
  onEndSubtest: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  sectionTitle: string;
  isCurrentQuestionRated?: boolean;
  currentRating: 'easy' | 'medium' | 'hard' | null;
  onRatingChange: (rating: 'easy' | 'medium' | 'hard') => void;
}

export default function ExamBottomBar({
  onBack,
  onNext,
  onEndSubtest,
  isFirstQuestion,
  isLastQuestion,
  sectionTitle,
  isCurrentQuestionRated = false,
  currentRating,
  onRatingChange,
}: ExamBottomBarProps) {
  const [showEndDialog, setShowEndDialog] = useState(false);

  const ratingOptions = [
    { id: 'easy' as const, icon: Smile, title: 'Easy', activeClass: 'bg-emerald-600 hover:bg-emerald-500 text-white border-emerald-650' },
    { id: 'medium' as const, icon: Meh, title: 'Medium', activeClass: 'bg-amber-500 hover:bg-amber-400 text-white border-amber-550' },
    { id: 'hard' as const, icon: Frown, title: 'Hard', activeClass: 'bg-rose-500 hover:bg-rose-400 text-white border-rose-550' },
  ];

  return (
    <>
      <div className="bg-white border-t border-slate-200 shadow-xs shrink-0 z-30">
        <div className="mx-auto px-6 py-3 flex items-center justify-between gap-4">
          {/* Left: Back button */}
          <div className="flex-1 flex justify-start">
            <Button
              onClick={onBack}
              disabled={isFirstQuestion}
              variant="outline"
              className="h-11 px-6 text-sm font-medium border-slate-200 bg-white text-slate-700 hover:bg-slate-50 hover:text-slate-900 disabled:opacity-25 transition-all duration-150"
            >
              <ChevronLeft className="w-4 h-4 mr-1" />
              Back
            </Button>
          </div>

          {/* Middle: Rating Smiley Buttons */}
          <div className="flex px-2 items-center gap-1.5 bg-slate-50 p-1 rounded-xl border border-slate-100">
            <div className="text-sm mr-1">
              <div>Rate to</div>
              <div>change question</div>
            </div>
            {ratingOptions.map((opt) => {
              const isActive = currentRating === opt.id;
              const Icon = opt.icon;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => onRatingChange(opt.id)}
                  title={opt.title}
                  className={`p-2 flex gap-1 rounded-lg border transition-all duration-150 cursor-pointer ${
                    isActive 
                      ? `${opt.activeClass} shadow-xs scale-105` 
                      : 'bg-white border-slate-200 text-slate-500 hover:text-slate-800 hover:bg-slate-50'
                  }`}
                >
                  {opt.title}
                  <Icon className="w-5 h-5 shrink-0" />
                </button>
              );
            })}
          </div>

          {/* Right: End Subtest and Next side by side */}
          <div className="flex-1 flex justify-end items-center gap-3">
            <Button
              onClick={() => setShowEndDialog(true)}
              disabled={!isCurrentQuestionRated}
              variant="outline"
              className="h-11 px-4 text-sm font-medium border border-orange-200 text-orange-650 bg-orange-50 hover:bg-orange-100 transition-all duration-150 disabled:opacity-25"
              title={!isCurrentQuestionRated ? "Rate the current question first to end subtest" : undefined}
            >
              <Flag className="w-4 h-4 mr-1.5" />
              End Subtest
            </Button>

            <Button
              onClick={onNext}
              disabled={isLastQuestion || !isCurrentQuestionRated}
              className="h-11 px-8 text-sm font-medium bg-orange-600 hover:bg-orange-500 text-white shadow-md shadow-orange-500/15 disabled:opacity-25 transition-all duration-150 border-0"
              title={!isCurrentQuestionRated ? "Rate the current question first to proceed" : undefined}
            >
              Next
              <ChevronRight className="w-4 h-4 ml-1" />
            </Button>
          </div>
        </div>
      </div>

      {/* End Subtest Confirmation Dialog */}
      <Dialog open={showEndDialog} onOpenChange={setShowEndDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="text-lg">End Subtest?</DialogTitle>
            <DialogDescription className="text-sm">
              Are you sure you want to end <strong>&quot;{sectionTitle}&quot;</strong>?
              You will not be able to return to this section.
              Any unanswered questions will be marked as blank.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="flex space-x-2 sm:gap-0">
            <Button
              variant="outline"
              onClick={() => setShowEndDialog(false)}
              className="flex-1 sm:flex-none"
            >
              Continue Test
            </Button>
            <Button
              onClick={() => {
                setShowEndDialog(false);
                onEndSubtest();
              }}
              className="flex-1 sm:flex-none bg-orange-500 hover:bg-orange-600 text-white"
            >
              End Subtest
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

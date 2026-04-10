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
import { ChevronLeft, ChevronRight, Flag } from 'lucide-react';

interface ExamBottomBarProps {
  onBack: () => void;
  onNext: () => void;
  onEndSubtest: () => void;
  isFirstQuestion: boolean;
  isLastQuestion: boolean;
  sectionTitle: string;
}

export default function ExamBottomBar({
  onBack,
  onNext,
  onEndSubtest,
  isFirstQuestion,
  isLastQuestion,
  sectionTitle,
}: ExamBottomBarProps) {
  const [showEndDialog, setShowEndDialog] = useState(false);

  return (
    <>
      <div className="bg-white border-t border-gray-200 shadow-[0_-4px_16px_rgba(0,0,0,0.05)] shrink-0">
        <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
          {/* Back button */}
          <Button
            onClick={onBack}
            disabled={isFirstQuestion}
            variant="outline"
            className="h-11 pr-12 text-sm font-medium border-gray-300 text-gray-600 hover:bg-gray-50 disabled:opacity-40 transition-all duration-150"
          >
            <ChevronLeft className="w-4 h-4 mr-1" />
            Back
          </Button>

          {/* End subtest button */}
          <Button
            onClick={() => setShowEndDialog(true)}
            variant="outline"
            className="h-11 px-6 text-sm font-medium border-2 border-orange-400 text-orange-600 bg-white hover:bg-orange-50 transition-all duration-150"
          >
            <Flag className="w-4 h-4 mr-2" />
            End Subtest
          </Button>

          {/* Next button */}
          <Button
            onClick={onNext}
            disabled={isLastQuestion}
            className="h-11 pl-12 text-sm font-medium bg-blue-600 hover:bg-blue-700 text-white shadow-md shadow-blue-200 disabled:opacity-40 transition-all duration-150"
          >
            Next
            <ChevronRight className="w-4 h-4 ml-1" />
          </Button>
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

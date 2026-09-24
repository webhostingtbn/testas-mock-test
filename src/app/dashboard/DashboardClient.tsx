"use client";

import { useState, useEffect } from 'react';
import type { Session } from 'next-auth';
import { useDashboardData } from '@/hooks/useDashboardData';
import { KniShell, type DashboardView } from '@/components/KniPrimitives';
import { AdminUsersPanel, AdminCmsPanel } from '@/components/AdminPanels';
import {
  LoadingScreen,
  ModuleSelectionScreen,
  PendingSetupScreen,
  PendingApprovalScreen,
  RejectedScreen,
} from '@/components/dashboard/GateScreens';
import { DashboardView as DashboardOverview } from '@/components/dashboard/DashboardView';
import { PracticeView } from '@/components/dashboard/PracticeView';
import { MockTestView } from '@/components/dashboard/MockTestView';
import { ReviewView, type ExamAttemptReview } from '@/components/dashboard/ReviewView';
import { SubtestDrillsView } from '@/components/dashboard/SubtestDrillsView';

import { useCallback } from 'react';
import { pickDefaultExam } from '@/lib/exam/exam-select';

export default function DashboardClient({ session }: { session: Session }) {
  const data = useDashboardData(session);
  const [activeView, setActiveView] = useState<DashboardView>('dashboard');
  const [selectedAttemptForReview, setSelectedAttemptForReview] = useState<ExamAttemptReview | null>(null);
  const [backNavigation, setBackNavigation] = useState<{ label: string; onBack: () => void } | undefined>(undefined);
  const [reviewSourceView, setReviewSourceView] = useState<DashboardView>('dashboard');

  // Handle back navigation for the review view centrally
  useEffect(() => {
    if (activeView === 'review' && selectedAttemptForReview) {
      setBackNavigation({
        label:
          reviewSourceView === 'mock'
            ? 'Back to Mock Test'
            : reviewSourceView === 'subtest-drills'
            ? 'Back to Subtest Drills'
            : 'Back to Dashboard',
        onBack: () => {
          setSelectedAttemptForReview(null);
          setActiveView(reviewSourceView);
        }
      });
    }
  }, [activeView, selectedAttemptForReview, reviewSourceView]);

  // Memoize the callback to prevent unnecessary re-renders
  const handleBackNavigation = useCallback((nav: { label: string; onBack: () => void } | undefined) => {
    setBackNavigation(nav);
  }, []);
  
  // Lifted tab state for dashboard format switching
  const [activeFormatTab, setActiveFormatTab] = useState<'Digital' | 'Paper'>(data.profile?.format as 'Digital' | 'Paper' || 'Digital');

  // Synchronize activeFormatTab with user's allocated format once profile loads
  useEffect(() => {
    if (data.profile?.format) {
      setActiveFormatTab(data.profile.format as 'Digital' | 'Paper');
    }
  }, [data.profile?.format]);

  // Reset briefing checklist and select the default exam when leaving mock view.
  // The default is format-aware (Digital preferred when no format is chosen),
  // never raw API order — otherwise a Paper exam wins by accident.
  useEffect(() => {
    if (activeView !== 'mock') {
      data.setBriefingChecklist([]);
      data.setSelectedExam(pickDefaultExam(data.exams, data.profile?.format));
    }
  }, [activeView, data.exams, data.profile?.format]);

  // --------------- Gate screens ---------------

  if (data.isLoading) {
    return <LoadingScreen />;
  }

  const profile = data.profile;

  const isPendingAndNeedsSetup = profile &&
    (profile.status === 'Pending' || !profile.status) &&
    profile.role !== 'admin' &&
    !profile.module_test;

  const isPendingAndApproved = profile &&
    (profile.status === 'Pending' || !profile.status) &&
    profile.role !== 'admin' &&
    profile.module_test;

  const isRejected = profile && profile.status === 'Rejected' && profile.role !== 'admin';

  const isApprovedNeedsModule = profile &&
    profile.status === 'Approved' &&
    profile.role !== 'admin' &&
    !data.activeModule;

  if (isApprovedNeedsModule) {
    return (
      <ModuleSelectionScreen
        selectedApprovedModule={data.selectedApprovedModule}
        onSelectModule={data.setSelectedApprovedModule}
        onSaveModule={data.handleSaveModuleOnly}
        onLogout={data.handleLogout}
        isLoading={data.isLoading}
      />
    );
  }

  if (isPendingAndNeedsSetup) {
    return (
      <PendingSetupScreen
        selectedModule={data.selectedModule}
        selectedFormat={data.selectedFormat}
        onSelectModule={data.setSelectedModule}
        onSelectFormat={data.setSelectedFormat}
        onSaveConfig={data.handleSaveConfig}
        onLogout={data.handleLogout}
        isSubmitting={data.isSubmittingConfig}
        configError={data.configError}
      />
    );
  }

  if (isPendingAndApproved) {
    return <PendingApprovalScreen onLogout={data.handleLogout} />;
  }

  if (isRejected) {
    return <RejectedScreen onLogout={data.handleLogout} />;
  }

  // --------------- Main dashboard shell ---------------

  const handleToggleChecklistItem = (id: string) => {
    data.setBriefingChecklist(prev =>
      prev.includes(id)
        ? prev.filter(i => i !== id)
        : [...prev, id]
    );
  };

  return (
    <KniShell
      email={profile?.email}
      avatarUrl={profile?.avatar_url}
      onLogout={data.handleLogout}
      isAdmin={data.isAdmin}
      activeView={activeView}
      onViewChange={setActiveView}
      backNavigation={backNavigation}
    >
      {activeView === 'dashboard' && (
        <DashboardOverview
          profile={profile}
          activeModule={data.activeModule}
          pastExams={data.pastExams}
          examLimit={data.examLimit}
          onViewChange={setActiveView}
          radarStats={data.computeRadarStats(activeFormatTab)}
          activeFormatTab={activeFormatTab}
          onFormatTabChange={setActiveFormatTab}
          onReviewAttempt={(attempt) => {
            setReviewSourceView('dashboard');
            setSelectedAttemptForReview(attempt);
            setActiveView('review');
          }}
          onResumeAttempt={(attempt) => {
            data.handleResumeExam(attempt.id);
          }}
        />
      )}

      {activeView === 'practice' && (
        <PracticeView
          profile={profile}
          activeModule={data.activeModule}
          onBackNavigation={handleBackNavigation}
        />
      )}

      {activeView === 'mock' && (
        <MockTestView
          profile={profile}
          pastExams={data.pastExams}
          briefingChecklist={data.briefingChecklist}
          onToggleChecklistItem={handleToggleChecklistItem}
          isStarting={data.isStarting}
          hasActiveExam={data.hasActiveExam}
          isEligible={data.isEligible}
          onStartExam={data.handleStartExam}
          exams={data.exams}
          selectedExam={data.selectedExam}
          selectedExamDetails={data.selectedExamDetails}
          onSelectExam={data.setSelectedExam}
          getExamAttemptInfo={data.getExamAttemptInfo}
          selectedTestHistory={data.selectedTestHistory}
          onBackNavigation={handleBackNavigation}
          onResumeAttempt={(attempt) => {
            // Callers (TestSelectionView, DashboardView) pass the whole
            // attempt object — unwrap the id (passing the object straight
            // into handleResumeExam fetched `/api/attempts/[object Object]`).
            if (attempt && typeof attempt.id === 'string') {
              data.handleResumeExam(attempt.id);
            }
          }}
        />
      )}

      {activeView === 'subtest-drills' && (
        <SubtestDrillsView
          profile={profile}
          activeModule={data.activeModule}
          pastExams={data.pastExams}
          onStartDrill={data.handleStartDrill}
          onResumeAttempt={(attempt) => {
            if (attempt && typeof attempt.id === 'string') {
              data.handleResumeExam(attempt.id);
            }
          }}
          onReviewAttempt={(attempt) => {
            setReviewSourceView('subtest-drills');
            setSelectedAttemptForReview(attempt);
            setActiveView('review');
          }}
          isStarting={data.isStarting}
        />
      )}

      {activeView === 'review' && selectedAttemptForReview && (
        <ReviewView
          profile={profile}
          attempt={selectedAttemptForReview}
          pastExams={data.pastExams}
          onBack={() => {
            setSelectedAttemptForReview(null);
            setActiveView(reviewSourceView);
          }}
        />
      )}

      {activeView === 'users' && data.isAdmin && <AdminUsersPanel />}
      {activeView === 'cms' && data.isAdmin && <AdminCmsPanel />}
    </KniShell>
  );
}

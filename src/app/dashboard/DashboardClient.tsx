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
import { ReviewView } from '@/components/dashboard/ReviewView';

export default function DashboardClient({ session }: { session: Session }) {
  const data = useDashboardData(session);
  const [activeView, setActiveView] = useState<DashboardView>('dashboard');
  const [selectedAttemptForReview, setSelectedAttemptForReview] = useState<any | null>(null);
  
  // Lifted tab state for dashboard format switching
  const [activeFormatTab, setActiveFormatTab] = useState<'Digital' | 'Paper'>('Digital');

  // Synchronize activeFormatTab with user's allocated format once profile loads
  useEffect(() => {
    if (data.profile?.format) {
      setActiveFormatTab(data.profile.format as 'Digital' | 'Paper');
    }
  }, [data.profile?.format]);

  // Reset briefing checklist and select the active exam when leaving mock view
  useEffect(() => {
    if (activeView !== 'mock') {
      data.setBriefingChecklist([]);
      if (data.exams.length > 0) {
        data.setSelectedExam(data.exams[0]);
      } else {
        data.setSelectedExam(null);
      }
    }
  }, [activeView, data.exams]);

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
      onLogout={data.handleLogout}
      isAdmin={data.isAdmin}
      activeView={activeView}
      onViewChange={setActiveView}
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
            setSelectedAttemptForReview(attempt);
            setActiveView('review');
          }}
        />
      )}

      {activeView === 'practice' && (
        <PracticeView
          profile={profile}
          activeModule={data.activeModule}
        />
      )}

      {activeView === 'mock' && (
        <MockTestView
          profile={profile}
          activeModule={data.activeModule}
          pastExams={data.pastExams}
          examLimit={data.examLimit}
          isAdmin={data.isAdmin}
          briefingChecklist={data.briefingChecklist}
          onToggleChecklistItem={handleToggleChecklistItem}
          isStarting={data.isStarting}
          hasActiveExam={data.hasActiveExam}
          isEligible={data.isEligible}
          onStartExam={data.handleStartExam}
          exams={data.exams}
          selectedExam={data.selectedExam}
          onSelectExam={data.setSelectedExam}
          getExamAttemptInfo={data.getExamAttemptInfo}
          radarStats={data.computeRadarStats()}
          onViewChange={setActiveView}
        />
      )}

      {activeView === 'review' && selectedAttemptForReview && (
        <ReviewView
          profile={profile}
          attempt={selectedAttemptForReview}
          pastExams={data.pastExams}
          onBack={() => {
            setSelectedAttemptForReview(null);
            setActiveView('dashboard');
          }}
        />
      )}

      {activeView === 'users' && data.isAdmin && <AdminUsersPanel />}
      {activeView === 'cms' && data.isAdmin && <AdminCmsPanel />}
    </KniShell>
  );
}

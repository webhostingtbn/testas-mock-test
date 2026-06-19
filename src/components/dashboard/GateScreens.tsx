"use client";
/* eslint-disable @typescript-eslint/no-explicit-any */

import {
  GraduationCap, Sparkles, Clock, FileText, CheckCircle2, ChevronRight,
  Laptop, TrendingUp, Settings, Monitor, File, X
} from 'lucide-react';
import { KniCard, KniButton } from '@/components/KniPrimitives';
import { MODULE_TEST_OPTIONS } from '@/lib/constants';
import type { Profile, ModuleTestType } from '@/lib/types';

// --------------- Loading Screen ---------------

export function LoadingScreen() {
  return (
    <div className="min-h-screen flex items-center justify-center bg-orange-50">
      <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
    </div>
  );
}

// --------------- Module Selection Screen ---------------

interface ModuleSelectionScreenProps {
  selectedApprovedModule: ModuleTestType | null;
  onSelectModule: (module: ModuleTestType) => void;
  onSaveModule: (module: ModuleTestType) => void;
  onLogout: () => void;
  isLoading: boolean;
}

export function ModuleSelectionScreen({
  selectedApprovedModule,
  onSelectModule,
  onSaveModule,
  onLogout,
  isLoading,
}: ModuleSelectionScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center p-4 bg-orange-50 relative overflow-hidden">
      <div className="pointer-events-none fixed inset-0 z-0 bg-[radial-gradient(circle_at_12%_12%,rgba(234,88,12,.14),transparent_30%),radial-gradient(circle_at_88%_8%,rgba(245,158,11,.16),transparent_28%),linear-gradient(135deg,#fff7ed,#ffffff_46%,#fffbeb)]" />

      <div className="relative z-10 w-full max-w-lg">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <div className="mx-auto mb-4 grid size-16 place-items-center rounded-2xl bg-gradient-to-br from-orange-600 to-amber-500 shadow-lg shadow-orange-500/25">
            <GraduationCap className="size-9 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
            Choose Your
            <span className="text-orange-600"> Module Test</span>
          </h1>
          <p className="text-slate-550 mt-2 max-w-sm mx-auto text-sm">
            Select the subject module you want to practice. This determines your 4th exam section.
          </p>
        </div>

        <KniCard className="p-6">
          <div className="text-center pb-4">
            <h2 className="text-lg font-bold text-slate-900 flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              Module Test Selection
            </h2>
            <p className="text-xs text-slate-500 mt-1">
              Pick one module — this cannot be changed during the exam
            </p>
          </div>
          <div className="flex flex-col gap-3">
            {MODULE_TEST_OPTIONS.map((moduleOption) => {
              const isSelected = selectedApprovedModule === moduleOption.value;
              return (
                <button
                  key={moduleOption.value}
                  type="button"
                  onClick={() => onSelectModule(moduleOption.value as any)}
                  className={`w-full flex items-start gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left group ${
                    isSelected
                      ? 'border-orange-500 bg-orange-50 shadow-md shadow-orange-100'
                      : 'border-orange-100/50 bg-white/80 hover:border-orange-200 hover:shadow-sm'
                  }`}
                >
                  <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-all duration-200 ${
                    isSelected
                      ? 'bg-orange-100 scale-105'
                      : 'bg-orange-50/50 group-hover:bg-orange-100/30'
                  }`}>
                    {moduleOption.icon}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-semibold transition-colors duration-200 ${
                      isSelected ? 'text-orange-700' : 'text-slate-900'
                    }`}>
                      {moduleOption.label}
                    </p>
                    <p className="text-xs text-slate-500 mt-0.5 leading-relaxed">{moduleOption.description}</p>
                    <div className="flex items-center gap-3 mt-2">
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-semibold">
                        <Clock className="w-3 h-3 text-orange-400" />
                        150 min
                      </span>
                      <span className="inline-flex items-center gap-1 text-xs text-slate-400 font-semibold">
                        <FileText className="w-3 h-3 text-orange-400" />
                        22 questions
                      </span>
                    </div>
                  </div>
                  {isSelected ? (
                    <CheckCircle2 className="w-6 h-6 text-orange-650 shrink-0" />
                  ) : (
                    <div className="w-6 h-6 rounded-full border-2 border-orange-100 shrink-0 group-hover:border-orange-200 transition-colors" />
                  )}
                </button>
              );
            })}

            <div className="flex gap-3 mt-4">
              <KniButton
                onClick={() => onSaveModule(selectedApprovedModule as any)}
                disabled={!selectedApprovedModule || isLoading}
                className="flex-1 h-12 justify-center"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <div className="flex items-center gap-2">
                    Continue to Exam
                    <ChevronRight className="w-4 h-4" />
                  </div>
                )}
              </KniButton>

              <KniButton
                onClick={onLogout}
                variant="outline"
                className="flex-1 h-12 justify-center"
              >
                Return to Sign In
              </KniButton>
            </div>
          </div>
        </KniCard>

        <p className="text-center text-xs text-slate-400 mt-4">
          The core tests (Figure Sequences, Math Equations, Latin Squares) are the same for all modules.
        </p>
      </div>
    </div>
  );
}

// --------------- Pending Setup Screen ---------------

interface PendingSetupScreenProps {
  selectedModule: ModuleTestType | null;
  selectedFormat: 'Digital' | 'Paper' | null;
  onSelectModule: (module: ModuleTestType) => void;
  onSelectFormat: (format: 'Digital' | 'Paper') => void;
  onSaveConfig: () => void;
  onLogout: () => void;
  isSubmitting: boolean;
  configError: string | null;
}

export function PendingSetupScreen({
  selectedModule,
  selectedFormat,
  onSelectModule,
  onSelectFormat,
  onSaveConfig,
  onLogout,
  isSubmitting,
  configError,
}: PendingSetupScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-orange-50 via-white to-amber-50 p-4 py-12">
      <div className="w-full max-w-4xl text-center">
        {/* Logo / Branding */}
        <div className="mb-8 flex flex-col items-center">
          <img
            src="/logo.webp"
            alt="TestAS Logo"
            className="w-20 h-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            TestAS
            <span className="text-orange-600"> Mock Test</span>
          </h1>
          <p className="text-gray-500 mt-2">
            Practice the real exam experience
          </p>
        </div>

        <KniCard className="p-8 text-left flex flex-col">
          <h2 className="text-2xl font-bold text-slate-900 text-center mb-2">
            Configure Your Exam
          </h2>
          <p className="text-slate-550 text-sm text-center mb-6 leading-relaxed">
            Please choose your target module and preferred format before submitting your registration for administrator approval.
          </p>

          {configError && (
            <div className="bg-red-50 text-red-650 p-3.5 rounded-xl text-xs mb-5 font-semibold border border-red-100">
              ⚠️ {configError}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            {/* Left Column: Module Selection */}
            <div className="space-y-4">
              <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                Select Your Test Module
              </label>
              <div className="flex flex-col gap-3">
                {[
                  { id: 'natural_computer_science', label: 'Computer Science', desc: 'For IT, Math, and Natural Sciences', icon: Laptop },
                  { id: 'economics', label: 'Economics', desc: 'For Business Administration and Econ', icon: TrendingUp },
                  { id: 'engineering', label: 'Engineering', desc: 'For Mechanical, Civil, and Tech studies', icon: Settings },
                ].map((mod) => {
                  const IconComp = mod.icon;
                  const isSelected = selectedModule === mod.id;
                  return (
                    <button
                      key={mod.id}
                      type="button"
                      onClick={() => onSelectModule(mod.id as any)}
                      className={`flex items-start gap-4 p-4 rounded-xl border text-left transition-all duration-200 w-full ${
                        isSelected
                          ? 'border-orange-500 bg-orange-50/40 text-orange-950 shadow-xs'
                          : 'border-orange-100 bg-white hover:border-orange-200 hover:bg-orange-50/10 text-slate-700'
                      }`}
                    >
                      <div className={`p-2.5 rounded-lg shrink-0 transition-colors duration-200 ${
                        isSelected ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600'
                      }`}>
                        <IconComp className="w-5 h-5" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm leading-tight">{mod.label}</p>
                        <p className="text-xs text-slate-400 mt-1 leading-normal">{mod.desc}</p>
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Right Column: Format Selection & Actions */}
            <div className="flex flex-col justify-between space-y-6 md:space-y-0">
              {/* Format Selection */}
              <div className="space-y-4">
                <label className="text-xs font-bold text-slate-400 uppercase tracking-wider block">
                  Select Exam Format
                </label>
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { id: 'Digital', label: 'Digital Exam', desc: 'Take in browser', icon: Monitor },
                    { id: 'Paper', label: 'Paper Exam', desc: 'Download booklets', icon: File },
                  ].map((fmt) => {
                    const IconComp = fmt.icon;
                    const isSelected = selectedFormat === fmt.id;
                    return (
                      <button
                        key={fmt.id}
                        type="button"
                        onClick={() => onSelectFormat(fmt.id as any)}
                        className={`flex flex-col items-center p-4 rounded-xl border text-center transition-all duration-200 ${
                          isSelected
                            ? 'border-orange-500 bg-orange-50/40 text-orange-950 shadow-xs'
                            : 'border-orange-100 bg-white hover:border-orange-200 hover:bg-orange-50/10 text-slate-700'
                        }`}
                      >
                        <div className={`p-2.5 rounded-lg mb-2 transition-colors duration-200 ${
                          isSelected ? 'bg-orange-500 text-white' : 'bg-orange-50 text-orange-600'
                        }`}>
                          <IconComp className="w-5 h-5" />
                        </div>
                        <p className="font-semibold text-sm leading-none">{fmt.label}</p>
                        <p className="text-[10px] text-slate-400 mt-1.5">{fmt.desc}</p>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Actions */}
              <div className="space-y-3">
                <KniButton
                  variant="primary"
                  onClick={onSaveConfig}
                  disabled={isSubmitting || !selectedModule || !selectedFormat}
                  className="w-full h-12 text-sm justify-center"
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                      Submitting...
                    </div>
                  ) : (
                    'Submit Registration'
                  )}
                </KniButton>

                <KniButton
                  variant="outline"
                  onClick={onLogout}
                  className="w-full h-12 text-sm justify-center"
                >
                  Return to Sign In
                </KniButton>
              </div>
            </div>
          </div>
        </KniCard>
      </div>
    </div>
  );
}

// --------------- Pending Approval Screen ---------------

interface StatusScreenProps {
  onLogout: () => void;
}

export function PendingApprovalScreen({ onLogout }: StatusScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-orange-50 via-white to-amber-50 p-4">
      <div className="w-full max-w-md text-center">
        {/* Logo / Branding */}
        <div className="mb-8 flex flex-col items-center">
          <img
            src="/logo.webp"
            alt="TestAS Logo"
            className="w-20 h-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            TestAS
            <span className="text-orange-600"> Mock Test</span>
          </h1>
          <p className="text-gray-500 mt-2">
            Practice the real exam experience
          </p>
        </div>

        <KniCard className="p-8 text-center flex flex-col items-center">
          {/* clock icon */}
          <div className="mb-5 grid size-16 place-items-center rounded-2xl border border-amber-300/30 bg-amber-500/15 text-orange-600">
            <Clock className="size-8" />
          </div>

          {/* status badge */}
          <span className="rounded-full border border-amber-300/30 bg-amber-500/10 px-3 py-1 text-sm text-amber-700 font-semibold">
            Pending Approval
          </span>

          <h2 className="mt-5 text-2xl font-bold text-slate-900">
            Account Pending Approval
          </h2>

          <p className="mt-4 text-slate-500 text-sm leading-relaxed">
            An administrator is reviewing your registration. Once approved, you will gain access to your allocated modules.
          </p>

          <KniButton
            variant="outline"
            onClick={onLogout}
            className="mt-7 w-full h-12 text-sm"
          >
            Return to Sign In
          </KniButton>
        </KniCard>
      </div>
    </div>
  );
}

// --------------- Rejected Screen ---------------

export function RejectedScreen({ onLogout }: StatusScreenProps) {
  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-orange-50 via-white to-amber-50 p-4">
      <div className="w-full max-w-md text-center">
        {/* Logo / Branding */}
        <div className="mb-8 flex flex-col items-center">
          <img
            src="/logo.webp"
            alt="TestAS Logo"
            className="w-20 h-auto mb-4"
          />
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            TestAS
            <span className="text-orange-600"> Mock Test</span>
          </h1>
          <p className="text-gray-500 mt-2">
            Practice the real exam experience
          </p>
        </div>

        <KniCard className="p-8 text-center flex flex-col items-center">
          {/* alert/error icon */}
          <div className="mb-5 grid size-16 place-items-center rounded-2xl border border-red-300/30 bg-red-500/15 text-red-650">
            <X className="size-8" />
          </div>

          {/* status badge */}
          <span className="rounded-full border border-red-300/30 bg-red-500/10 px-3 py-1 text-sm text-red-700 font-semibold">
            Registration Rejected
          </span>

          <h2 className="mt-5 text-2xl font-bold text-slate-900">
            Registration Rejected
          </h2>

          <p className="mt-4 text-slate-500 text-sm leading-relaxed">
            Your registration has been rejected by an administrator. Please contact support if you believe this is a mistake.
          </p>

          <KniButton
            variant="outline"
            onClick={onLogout}
            className="mt-7 w-full h-12 text-sm"
          >
            Return to Sign In
          </KniButton>
        </KniCard>
      </div>
    </div>
  );
}

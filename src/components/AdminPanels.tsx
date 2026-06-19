'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { useEffect, useState, useMemo } from 'react';
import { createClient } from '@/lib/supabase/client';
import {
  ChevronDown, ChevronUp, ShieldAlert,
  Settings2, Check, X, PenLine, Plus, Upload, Lock, Save, ImagePlus, Flag,
  Search, Download, Users, CheckCircle2, Clock, Info
} from 'lucide-react';
import { KniCard, KniButton, KniBadge } from '@/components/KniPrimitives';

// ─── Types ────────────────────────────────────────────────────────────────────

interface UserExam {
  id: string;
  created_at: string;
  status: string;
  total_score: number | null;
  max_score: number | null;
  detailed_results: Record<string, any> | null;
}

interface ProfileWithExams {
  id: string;
  email: string;
  full_name: string | null;
  role: string | null;
  created_at: string;
  user_exams: UserExam[];
  phonenumber?: string;
  allow_test_limit?: number;
  status: string | null;
  format: string | null;
  module_test: string | null;
}

interface ExamConfig {
  id: string;
  title: string;
  is_active: boolean;
  retry_number: number | null;
  created_at: string;
}

interface CmsQuestion {
  id: string;
  subtest: string;
  question: string;
  answer: string;
  explanation: string;
  modules: string[];
  options: {
    A: string;
    B: string;
    C: string;
    D: string;
  };
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getInitial(user: ProfileWithExams) {
  return (user.full_name || user.email || '?')[0].toUpperCase();
}

function formatAnsValue(ans: any): string {
  if (ans === null || ans === undefined) return '-';
  if (Array.isArray(ans)) return `[${ans.join(', ')}]`;
  if (typeof ans === 'object') return Object.entries(ans).map(([k, v]) => `${k}:${v}`).join(', ');
  return String(ans);
}

function exportUserReport(user: ProfileWithExams) {
  const lines: string[] = [];
  lines.push('TESTAS MOCK – USER REPORT');
  lines.push('='.repeat(60));
  lines.push(`Name       : ${user.full_name || 'N/A'}`);
  lines.push(`Email      : ${user.email}`);
  lines.push(`Phone      : ${user.phonenumber || 'N/A'}`);
  lines.push(`Joined     : ${new Date(user.created_at).toLocaleString()}`);
  lines.push(`Status     : ${user.status || 'Pending'}`);
  const friendlyModule = user.module_test === 'natural_computer_science' ? 'CS' : user.module_test === 'economics' ? 'Economics' : user.module_test === 'engineering' ? 'Engineering' : (user.module_test || 'CS');
  lines.push(`Module     : ${friendlyModule}`);
  lines.push(`Total Exams: ${user.user_exams.length}`);
  lines.push('');

  if (user.user_exams.length === 0) {
    lines.push('No exam history.');
  } else {
    user.user_exams.forEach((exam, idx) => {
      lines.push(`─── Attempt #${idx + 1} ${'─'.repeat(47)}`);
      lines.push(`  Date   : ${new Date(exam.created_at).toLocaleString()}`);
      lines.push(`  Status : ${exam.status.toUpperCase()}`);
      lines.push(`  Score  : ${exam.total_score ?? '-'} / ${exam.max_score ?? '-'}`);
      lines.push(`  Exam ID: ${exam.id}`);

      if (exam.detailed_results && Object.keys(exam.detailed_results).length > 0) {
        lines.push('');
        lines.push('  Section breakdown:');
        Object.entries(exam.detailed_results).forEach(([sectionTitle, sectionData]) => {
          const isLegacy = Array.isArray(sectionData);
          const answers: any[] = isLegacy ? sectionData : (sectionData as any).answers || [];
          const scoreStr = isLegacy ? 'N/A' : `${(sectionData as any).score} / ${(sectionData as any).max_score}`;

          lines.push(`    [${sectionTitle}]  Score: ${scoreStr}`);
          answers.forEach((ans, qi) => {
            const qLabel = `Q${qi + 1}`;
            if (ans && typeof ans === 'object' && 'user_answer' in ans) {
              const correct = ans.is_correct ? '✓' : '✗';
              lines.push(
                `      ${qLabel}. ${correct}  User: ${formatAnsValue(ans.user_answer)}  | Correct: ${formatAnsValue(ans.correct_answer)}`
              );
            } else {
              lines.push(`      ${qLabel}. ${formatAnsValue(ans)}`);
            }
          });
        });
      }
      lines.push('');
    });
  }

  const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  const safeName = (user.full_name || user.email || user.id).replace(/[^a-z0-9]/gi, '_');
  a.download = `report_${safeName}_${Date.now()}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

function exportAllUsersCSV(users: ProfileWithExams[]) {
  const moduleNamesSet = new Set<string>();
  users.forEach(user => {
    const latestExam = user.user_exams[0];
    if (latestExam?.detailed_results) {
      Object.keys(latestExam.detailed_results).forEach(key => moduleNamesSet.add(key));
    }
  });
  const modules = Array.from(moduleNamesSet);
  const headers = ['Name', 'Phone', 'Email', 'Date Joined', 'Status', 'Format', 'Module Allocation', 'Latest Score', ...modules];

  const rows = users.map(user => {
    const name = `"${(user.full_name || '').replace(/"/g, '""')}"`;
    const phone = `"${(user.phonenumber || '').replace(/"/g, '""')}"`;
    const email = `"${(user.email || '').replace(/"/g, '""')}"`;
    const dateJoined = `"${new Date(user.created_at).toLocaleDateString()}"`;
    const statusVal = `"${user.status || 'Pending'}"`;
    const formatVal = `"${user.format || 'Digital'}"`;
    const friendlyModule = user.module_test === 'natural_computer_science' ? 'CS' : user.module_test === 'economics' ? 'Economics' : user.module_test === 'engineering' ? 'Engineering' : (user.module_test || 'CS');
    const moduleVal = `"${friendlyModule}"`;
    const latestExam = user.user_exams[0];
    const latestScoreStr = latestExam && latestExam.total_score !== null 
      ? `${latestExam.total_score}/${latestExam.max_score}` 
      : 'N/A';
    const score = `"${latestScoreStr}"`;

    const moduleScores = modules.map(mod => {
      let modScoreStr = 'N/A';
      if (latestExam?.detailed_results?.[mod]) {
        const sectionData = latestExam.detailed_results[mod];
        const isLegacy = Array.isArray(sectionData);
        modScoreStr = isLegacy ? 'N/A' : `${(sectionData as any).score}/${(sectionData as any).max_score}`;
      }
      return `"${modScoreStr}"`;
    });

    return [name, phone, email, dateJoined, statusVal, formatVal, moduleVal, score, ...moduleScores].join(',');
  });

  const csvContent = [headers.join(','), ...rows].join('\n');
  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `all_users_export_${Date.now()}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ─── INITIAL CMS SEED ────────────────────────────────────────────────────────
const INITIAL_CMS_QUESTIONS: CmsQuestion[] = [
  {
    id: '1',
    subtest: 'Figure Sequences',
    question: 'Which figure continues the pattern after a 90 degree clockwise rotation?',
    answer: 'B',
    explanation: 'The figure rotates by 90 degrees while alternating the shaded segment.',
    modules: ['CS', 'Engineering'],
    options: {
      A: 'The pattern continues with a triangle on top.',
      B: 'The pattern rotates clockwise 90 degrees.',
      C: 'The pattern flips vertically.',
      D: 'The pattern shifts leftward.'
    }
  },
  {
    id: '2',
    subtest: 'Mathematical Equations',
    question: 'If A + B = 10 and A - B = 4, what is the value of A?',
    answer: 'A',
    explanation: 'Adding the two equations: 2A = 14 => A = 7. Thus option A (7) is correct.',
    modules: ['CS', 'Economics', 'Engineering'],
    options: {
      A: '7',
      B: '3',
      C: '5',
      D: '14'
    }
  },
  {
    id: '3',
    subtest: 'Latin Squares',
    question: 'Fill in the missing letter in the 5x5 grid so that no row or column contains duplicates.',
    answer: 'C',
    explanation: 'Row 3 contains A, B, D, E. The missing letter must be C.',
    modules: ['CS'],
    options: {
      A: 'A',
      B: 'B',
      C: 'C',
      D: 'D'
    }
  },
  {
    id: '4',
    subtest: 'Module Test',
    question: 'Which of the following sorting algorithms has a worst-case time complexity of O(n log n)?',
    answer: 'D',
    explanation: 'Merge sort and Heap sort have O(n log n) worst-case time complexity, while Quick sort is O(n^2).',
    modules: ['CS'],
    options: {
      A: 'Selection Sort',
      B: 'Bubble Sort',
      C: 'Quick Sort',
      D: 'Merge Sort'
    }
  }
];

// ─── ExpandedHistory Component ──────────────────────────────────────────────────

function ExpandedHistory({ user }: { user: ProfileWithExams }) {
  return (
    <div className="border-t border-orange-100 bg-orange-50/20 p-5">
      <div className="flex justify-between items-center mb-4">
        <h4 className="font-semibold text-slate-800 text-sm uppercase tracking-wider">Exam History</h4>
        <KniButton
          variant="outline"
          className="h-8 px-2.5 text-xs gap-1"
          onClick={() => exportUserReport(user)}
        >
          <Download className="w-3.5 h-3.5" />
          <span>Export Attempt Report</span>
        </KniButton>
      </div>
      
      {user.user_exams.length === 0 ? (
        <p className="text-sm text-slate-500 italic py-4">No exams taken yet.</p>
      ) : (
        <div className="space-y-4">
          {user.user_exams.map((exam, idx) => (
            <div key={exam.id} className="bg-white border border-orange-100 rounded-xl p-4 shadow-sm">
              <div className="flex flex-wrap sm:flex-nowrap justify-between gap-4 mb-4 pb-4 border-b border-orange-50">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                      exam.status === 'completed' ? 'bg-emerald-50 text-emerald-700 border border-emerald-100' : 'bg-amber-50 text-amber-805 border border-amber-100'
                    }`}>
                      {exam.status.toUpperCase()}
                    </span>
                    <span className="text-xs text-slate-500 font-medium">
                      Attempt #{idx + 1} — {new Date(exam.created_at).toLocaleString()}
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-400 font-mono">ID: {exam.id}</p>
                </div>
                <div className="text-right">
                  <p className="text-[10px] text-slate-500 uppercase font-semibold">Total Score</p>
                  <p className="text-lg font-bold text-slate-900">
                    {exam.total_score ?? '-'}<span className="text-slate-400 text-sm font-normal"> / {exam.max_score ?? '-'}</span>
                  </p>
                </div>
              </div>

              {/* Detailed Results Summary */}
              <div>
                <p className="text-xs font-bold text-slate-500 uppercase mb-2">Detailed Results Map:</p>
                {exam.detailed_results && Object.keys(exam.detailed_results).length > 0 ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                    {Object.entries(exam.detailed_results).map(([sectionTitle, sectionData]) => {
                      const isLegacy = Array.isArray(sectionData);
                      const answers: any[] = isLegacy ? sectionData : (sectionData as any).answers || [];
                      const scoreStr = isLegacy ? null : `${(sectionData as any).score} / ${(sectionData as any).max_score}`;
                      
                      return (
                        <div key={sectionTitle} className="bg-orange-50/30 border border-orange-100/50 rounded-lg p-3">
                          <div className="flex justify-between items-center border-b border-orange-100/70 pb-1.5 mb-2">
                            <p className="text-xs font-bold text-slate-700">
                              {sectionTitle}
                            </p>
                            {scoreStr && (
                              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-orange-100 text-orange-800">
                                Score: {scoreStr}
                              </span>
                            )}
                          </div>
                          {Array.isArray(answers) ? (
                            <div className="flex flex-wrap gap-2">
                              {answers.length > 0 ? answers.map((ans, qi) => {
                                let displayAns = '-';
                                let bgClass = 'bg-white border-orange-100 text-slate-700';
                                let titleStr: string | undefined;

                                if (ans && typeof ans === 'object' && 'user_answer' in ans) {
                                  displayAns = formatAnsValue(ans.user_answer);
                                  if (ans.correct_answer !== undefined) {
                                    titleStr = `Correct answer: ${formatAnsValue(ans.correct_answer)}`;
                                  }
                                  bgClass = ans.is_correct 
                                    ? 'bg-green-50 border-green-200 text-green-700' 
                                    : 'bg-red-50 border-red-200 text-red-700';
                                } else {
                                  displayAns = formatAnsValue(ans);
                                }

                                return (
                                  <span 
                                    key={qi} 
                                    title={titleStr}
                                    className={`inline-flex items-center justify-center px-2 py-1 min-h-6 border text-xs font-mono rounded whitespace-nowrap shadow-xs ${bgClass}`}
                                  >
                                    <span className="opacity-50 mr-1.5 font-normal">Q{qi + 1}.</span> 
                                    <span className="font-bold">{displayAns}</span>
                                  </span>
                                );
                              }) : (
                                <span className="text-xs text-slate-450 italic">Skipped</span>
                              )}
                            </div>
                          ) : (
                            <pre className="text-[10px] text-slate-650 overflow-x-auto">
                              {JSON.stringify(answers, null, 2)}
                            </pre>
                          )}
                        </div>
                      )})}
                  </div>
                ) : (
                  <p className="text-xs text-slate-400 italic">No detailed records found for this attempt.</p>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN USERS PANEL
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminUsersPanel() {
  const supabase = createClient();
  const [users, setUsers] = useState<ProfileWithExams[]>([]);
  const [exams, setExams] = useState<ExamConfig[]>([]);
  const [isUpdatingExamId, setIsUpdatingExamId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState<'All' | 'Pending' | 'Approved' | 'Rejected'>('All');
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);

  // Sub-tab for users vs exams
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'approved' | 'exams'>('pending');

  useEffect(() => {
    async function fetchAdminData() {
      try {
        const { data: allUsers, error: fetchError } = await supabase
          .from('profiles')
          .select(`
            id, email, full_name, role, created_at, phonenumber, allow_test_limit, status, module_test,
            user_exams (
              id, created_at, status, total_score, max_score, detailed_results
            )
          `)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        const formattedUsers = (allUsers || []).map(u => ({
          ...u,
          format: 'Digital',
          user_exams: (u.user_exams || []).sort(
            (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        }));
        setUsers(formattedUsers as ProfileWithExams[]);

        const { data: examsData, error: examsError } = await supabase
          .from('exams')
          .select('id, title, is_active, retry_number, created_at')
          .order('created_at', { ascending: false });

        if (examsError) throw examsError;
        setExams((examsData || []) as ExamConfig[]);
      } catch (err: any) {
        console.error('Admin fetch error:', err);
        setError(err.message || 'An error occurred fetching data.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAdminData();
  }, [supabase]);

  const toggleExpand = (userId: string) => {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  };

  const handleUpdateStatus = async (userId: string, newStatus: string) => {
    try {
      const { error: patchError } = await supabase
        .from('profiles')
        .update({ status: newStatus })
        .eq('id', userId);
      if (patchError) throw patchError;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, status: newStatus } : u));
    } catch (err: any) {
      setError(err.message || 'Failed to update status.');
    }
  };

  const handleUpdateFormat = async (userId: string, newFormat: string) => {
    try {
      const { error: patchError } = await supabase
        .from('profiles')
        .update({ format: newFormat })
        .eq('id', userId);
      if (patchError) throw patchError;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, format: newFormat } : u));
    } catch (err: any) {
      setError(err.message || 'Failed to update format.');
    }
  };

  const handleUpdateModule = async (userId: string, newModule: string) => {
    try {
      const { error: patchError } = await supabase
        .from('profiles')
        .update({ 
          module_test: newModule
        })
        .eq('id', userId);
      if (patchError) throw patchError;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, module_test: newModule } : u));
    } catch (err: any) {
      setError(err.message || 'Failed to update module.');
    }
  };

  const toggleExamActive = async (examId: string, shouldActivate: boolean) => {
    setIsUpdatingExamId(examId);
    try {
      if (shouldActivate) {
        await supabase.from('exams').update({ is_active: false }).eq('is_active', true);
        await supabase.from('exams').update({ is_active: true }).eq('id', examId);
        setExams(prev => prev.map(e => ({ ...e, is_active: e.id === examId })));
      } else {
        await supabase.from('exams').update({ is_active: false }).eq('id', examId);
        setExams(prev => prev.map(e => e.id === examId ? { ...e, is_active: false } : e));
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to update exam activation.');
    } finally {
      setIsUpdatingExamId(null);
    }
  };

  const updateUserLimit = async (userId: string, currentLimit: number) => {
    const newVal = window.prompt('Enter new test limit for this user:', (currentLimit ?? 1).toString());
    if (newVal === null) return;
    const limit = parseInt(newVal, 10);
    if (isNaN(limit) || limit < 1) {
      alert('Invalid limit. Must be a number >= 1.');
      return;
    }
    setIsUpdatingLimit(true);
    try {
      const { error: patchError } = await supabase.from('profiles').update({ allow_test_limit: limit }).eq('id', userId);
      if (patchError) throw patchError;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, allow_test_limit: limit } : u));
    } catch (err: any) {
      setError(err.message || 'Failed to update limit');
    } finally {
      setIsUpdatingLimit(false);
    }
  };

  const updateAllUsersLimit = async () => {
    const newVal = window.prompt('Enter new test limit for ALL users:', '1');
    if (newVal === null) return;
    const limit = parseInt(newVal, 10);
    if (isNaN(limit) || limit < 1) {
      alert('Invalid limit. Must be a number >= 1.');
      return;
    }
    setIsUpdatingLimit(true);
    try {
      const { error: patchError } = await supabase.from('profiles').update({ allow_test_limit: limit }).neq('role', 'admin');
      if (patchError) throw patchError;
      setUsers(prev => prev.map(u => u.role === 'admin' ? u : { ...u, allow_test_limit: limit }));
      alert(`Successfully updated test limit to ${limit} for all normal users.`);
    } catch (err: any) {
      setError(err.message || 'Failed to update limits');
    } finally {
      setIsUpdatingLimit(false);
    }
  };

  const nonAdminUsers = useMemo(
    () => users.filter(u => u.role !== 'admin'),
    [users]
  );

  const filteredUsers = useMemo(() => {
    return nonAdminUsers.filter(u => {
      const q = searchQuery.trim().toLowerCase();
      const matchesSearch = !q || 
        (u.full_name || '').toLowerCase().includes(q) ||
        (u.email || '').toLowerCase().includes(q) ||
        (u.phonenumber || '').toLowerCase().includes(q);
      
      let matchesStatus = false;
      if (activeSubTab === 'pending') {
        if (statusFilter === 'All') {
          matchesStatus = u.status !== 'Approved';
        } else if (statusFilter === 'Pending') {
          matchesStatus = u.status === 'Pending' || !u.status;
        } else if (statusFilter === 'Rejected') {
          matchesStatus = u.status === 'Rejected';
        }
      } else if (activeSubTab === 'approved') {
        matchesStatus = u.status === 'Approved';
      }
      return matchesSearch && matchesStatus;
    });
  }, [nonAdminUsers, searchQuery, statusFilter, activeSubTab]);

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto">
      {/* Title */}
      <div className="mb-6">
        <p className="text-sm font-medium text-orange-700">Admin Panel</p>
        <h2 className="text-3xl font-bold text-slate-900 mt-1">Platform Management</h2>
        <p className="text-slate-550 mt-1 text-sm">
          Manage registrations, activate exams, and export performance reports.
        </p>
      </div>

      {/* Sub-Tab Selection */}
      <div className="flex border-b border-orange-200 mb-6 gap-2">
        {(['pending', 'approved', 'exams'] as const).map((tab) => (
          <button
            key={tab}
            onClick={() => {
              setActiveSubTab(tab);
              if (tab === 'pending') {
                setStatusFilter('All');
              }
            }}
            className={`px-4 py-2.5 font-semibold text-sm transition-all border-b-2 -mb-[2px] ${
              activeSubTab === tab
                ? 'border-orange-600 text-orange-600'
                : 'border-transparent text-slate-500 hover:text-slate-900'
            }`}
          >
            {tab === 'pending' ? 'Pending Approvals' : tab === 'approved' ? 'Approved Users' : 'Active Exams'}
          </button>
        ))}
      </div>

      {/* Error Banner */}
      {error && (
        <div className="bg-red-50 text-red-650 p-4 rounded-xl mb-6 border border-red-200 flex items-start gap-3">
          <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
          <div>
            <p className="font-bold">An error occurred</p>
            <p className="text-sm opacity-90">{error}</p>
          </div>
        </div>
      )}

      {(activeSubTab === 'pending' || activeSubTab === 'approved') && (
        <div className="space-y-6">
          {/* Filter Section */}
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">
                {activeSubTab === 'pending' ? 'Pending Approvals' : 'Approved Users'}
              </h3>
              <p className="text-slate-555 text-sm mt-0.5">
                Showing {filteredUsers.length} of {activeSubTab === 'pending' ? nonAdminUsers.filter(u => u.status !== 'Approved').length : nonAdminUsers.filter(u => u.status === 'Approved').length} students
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label className="flex min-w-[280px] items-center gap-2 rounded-2xl border border-orange-200 bg-white px-4 py-2.5">
                <Search className="size-4 text-slate-400" />
                <input
                  aria-label="Search users"
                  placeholder="Search users by name, email or phone..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full bg-transparent text-sm outline-none placeholder:text-slate-400 text-slate-800"
                />
              </label>
              {activeSubTab === 'pending' && (
                <div className="relative">
                  <select
                    value={statusFilter}
                    onChange={e => setStatusFilter(e.target.value as any)}
                    className="appearance-none inline-flex items-center gap-2 rounded-2xl border border-orange-200 bg-white pl-4 pr-10 py-2.5 text-sm text-slate-700 outline-none hover:bg-orange-50 cursor-pointer"
                  >
                    <option value="All">All Statuses</option>
                    <option value="Pending">Pending Only</option>
                    <option value="Rejected">Rejected Only</option>
                  </select>
                  <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
                </div>
              )}
              <KniButton
                variant="secondary"
                className="h-10 px-4 flex items-center justify-center gap-2 text-xs"
                onClick={updateAllUsersLimit}
                disabled={isUpdatingLimit}
              >
                <Users className="w-4 h-4" />
                <span>Set All Limits</span>
              </KniButton>
              <KniButton
                variant="primary"
                className="h-10 px-4 flex items-center justify-center gap-2 text-xs"
                onClick={() => exportAllUsersCSV(filteredUsers)}
              >
                <Download className="w-4 h-4" />
                <span>Export CSV</span>
              </KniButton>
            </div>
          </div>

          {/* Users grid table */}
          <KniCard className="overflow-hidden p-0">
            {activeSubTab === 'pending' ? (
              <div className="hidden lg:grid grid-cols-[1.5fr_1.5fr_1fr_1.2fr] gap-4 border-b border-orange-100 bg-orange-50/30 px-5 py-4 text-sm font-semibold text-slate-500">
                <span>User</span>
                <span>Email</span>
                <span>Status</span>
                <span className="text-right">Actions</span>
              </div>
            ) : (
              <div className="hidden lg:grid grid-cols-[1.5fr_1.5fr_1.2fr_1.3fr] gap-4 border-b border-orange-100 bg-orange-50/30 px-5 py-4 text-sm font-semibold text-slate-500">
                <span>User</span>
                <span>Email</span>
                <span>Module Allocation</span>
                <span className="text-right">Actions</span>
              </div>
            )}

            {filteredUsers.length === 0 ? (
              <div className="text-center py-12 text-slate-400 text-sm italic bg-white/50">
                No users match the search filters.
              </div>
            ) : (
              filteredUsers.map((user) => {
                const isExpanded = expandedUserId === user.id;
                return (
                  <div key={user.id} className="border-b border-orange-100 last:border-b-0">
                    <div 
                      onClick={() => toggleExpand(user.id)}
                      className={`grid gap-4 px-5 py-5 items-center cursor-pointer transition-colors hover:bg-orange-55/30 ${
                        isExpanded ? 'bg-orange-50/15' : 'bg-white/50'
                      } ${activeSubTab === 'pending' ? 'lg:grid-cols-[1.5fr_1.5fr_1fr_1.2fr]' : 'lg:grid-cols-[1.5fr_1.5fr_1.2fr_1.3fr]'}`}
                    >
                      <div className="flex items-center gap-3">
                        <div className="grid size-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-orange-400 to-amber-300 font-bold text-slate-950 text-sm">
                          {getInitial(user)}
                        </div>
                        <div className="min-w-0">
                          <p className="font-semibold text-slate-900 truncate">{user.full_name || 'No Name Provided'}</p>
                          <p className="text-xs text-slate-400">{new Date(user.created_at).toLocaleDateString()}</p>
                        </div>
                      </div>
                      <p className="text-sm text-slate-500 truncate lg:block hidden">{user.email}</p>
                      <p className="text-xs text-slate-400 lg:hidden block">
                        <span className="font-semibold text-slate-500">Email:</span> {user.email}
                      </p>
                      {activeSubTab === 'pending' && (
                        <div>
                          <KniBadge status={user.status || 'Pending'} className="px-2.5 py-0.5 text-[11px] rounded-md" />
                        </div>
                      )}
                      {activeSubTab === 'approved' && (
                        <div className="flex flex-wrap gap-2" onClick={e => e.stopPropagation()}>
                          {['natural_computer_science', 'economics', 'engineering'].map(module => {
                            const isCurrent = user.module_test === module;
                            const label = module === 'natural_computer_science' ? 'CS' : module === 'economics' ? 'Economics' : 'Engineering';
                            return (
                              <button
                                key={module}
                                type="button"
                                onClick={() => handleUpdateModule(user.id, module)}
                                className={`rounded-full border px-2.5 py-0.5 text-[10px] font-semibold transition ${
                                  isCurrent
                                    ? 'border-orange-300/60 bg-orange-600/10 text-orange-850'
                                    : 'border-orange-200 bg-orange-50/30 text-slate-400 hover:text-slate-700'
                                }`}
                              >
                                {label}
                              </button>
                            );
                          })}
                        </div>
                      )}

                      <div className="flex gap-2 justify-between lg:justify-end items-center" onClick={e => e.stopPropagation()}>
                        {activeSubTab === 'approved' && (
                          <>
                            <div className="flex items-center gap-1.5 mr-2">
                              <span className="text-[10px] text-slate-400 font-semibold uppercase">Limit:</span>
                              <button
                                onClick={() => updateUserLimit(user.id, user.allow_test_limit ?? 1)}
                                className="px-2 py-0.5 rounded border border-orange-200 bg-orange-50/70 hover:bg-orange-100 text-orange-800 text-xs font-bold font-mono transition-colors"
                                title="Override Limit"
                              >
                                {user.allow_test_limit ?? 1}
                              </button>
                            </div>
                            <button
                              type="button"
                              onClick={() => exportUserReport(user)}
                              className="grid size-8 place-items-center rounded-xl bg-orange-100/60 border border-orange-200 text-orange-600 hover:bg-orange-100 transition-colors"
                              title="Export Report"
                            >
                              <Download className="size-4" />
                            </button>
                          </>
                        )}
                        <div className="flex gap-1.5">
                          {activeSubTab === 'pending' && (
                            <>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(user.id, 'Approved')}
                                className="grid size-8 place-items-center rounded-xl bg-emerald-500/15 text-emerald-700 transition hover:bg-emerald-500/25"
                                title="Approve"
                              >
                                <Check className="size-4" />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleUpdateStatus(user.id, 'Rejected')}
                                className="grid size-8 place-items-center rounded-xl bg-rose-500/15 text-rose-700 transition hover:bg-rose-500/25"
                                title="Reject"
                              >
                                <X className="size-4" />
                              </button>
                            </>
                          )}
                          {activeSubTab === 'approved' && (
                            <button
                              type="button"
                              onClick={() => handleUpdateStatus(user.id, 'Pending')}
                              className="px-2.5 py-1 text-[11px] font-semibold rounded-lg bg-rose-500/10 text-rose-700 hover:bg-rose-500/20 transition-colors border border-rose-200"
                              title="Unapprove User"
                            >
                              Unapprove
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => toggleExpand(user.id)}
                            className="grid size-8 place-items-center rounded-xl bg-orange-50 border border-orange-100 text-orange-600 hover:bg-orange-100 transition-colors"
                            title="View History"
                          >
                            {isExpanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}
                          </button>
                        </div>
                      </div>
                    </div>
                    {isExpanded && (
                      <ExpandedHistory user={user} />
                    )}
                  </div>
                );
              })
            )}
          </KniCard>
        </div>
      )}

      {activeSubTab === 'exams' && (
        <div className="space-y-6">
          <div className="flex flex-col sm:flex-row justify-between sm:items-center gap-4">
            <div>
              <h3 className="text-xl font-bold text-slate-900">Active Exams Console</h3>
              <p className="text-slate-500 text-sm mt-0.5">Toggle student accessibility and configure attempts override.</p>
            </div>
          </div>
          <KniCard className="p-6 bg-white/70">
            <div className="flex items-center gap-2 mb-4 pb-3 border-b border-orange-100">
              <Clock className="w-5 h-5 text-orange-600" />
              <h4 className="font-bold text-slate-900">Exam Activation List</h4>
            </div>
            <div className="space-y-4">
              {exams.length === 0 ? (
                <p className="text-sm text-slate-500 italic py-4">No exam configurations found in the database.</p>
              ) : (
                exams.map((exam) => {
                  const disabled = isUpdatingExamId === exam.id;
                  return (
                    <div
                      key={exam.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 rounded-xl border border-orange-150 bg-white/50 p-4 transition-all hover:bg-white/80"
                    >
                      <div>
                        <p className="font-semibold text-slate-800">{exam.title}</p>
                        <p className="text-[10px] text-slate-400 font-mono mt-0.5">Exam ID: {exam.id}</p>
                        <p className="text-xs text-slate-500 mt-1 font-medium">
                          Retry number: {exam.retry_number ?? 'No limit'}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 shrink-0">
                        <span className={`text-xs font-semibold px-2.5 py-1 rounded-full border ${
                          exam.is_active
                            ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                            : 'bg-slate-50 text-slate-650 border-slate-200'
                        }`}>
                          {exam.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <KniButton
                          disabled={disabled}
                          variant={exam.is_active ? 'outline' : 'primary'}
                          onClick={() => toggleExamActive(exam.id, !exam.is_active)}
                          className="h-9 px-4 text-xs"
                        >
                          {disabled ? 'Updating…' : exam.is_active ? 'Deactivate' : 'Activate'}
                        </KniButton>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </KniCard>
        </div>
      )}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════════
// ADMIN CMS PANEL
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminCmsPanel() {
  const [cmsQuestions, setCmsQuestions] = useState<CmsQuestion[]>(INITIAL_CMS_QUESTIONS);
  const [selectedCmsQuestionId, setSelectedCmsQuestionId] = useState<string>('1');
  const [cmsForm, setCmsForm] = useState<Omit<CmsQuestion, 'id'>>({
    subtest: 'Figure Sequences',
    question: 'Which figure continues the pattern after a 90 degree clockwise rotation?',
    answer: 'B',
    explanation: 'The figure rotates by 90 degrees while alternating the shaded segment.',
    modules: ['CS', 'Engineering'],
    options: {
      A: 'The pattern continues with a triangle on top.',
      B: 'The pattern rotates clockwise 90 degrees.',
      C: 'The pattern flips vertically.',
      D: 'The pattern shifts leftward.'
    }
  });
  const [saveState, setSaveState] = useState<'idle' | 'saved'>('idle');

  const loadCmsQuestion = (questionId: string) => {
    const found = cmsQuestions.find(q => q.id === questionId);
    if (found) {
      setSelectedCmsQuestionId(questionId);
      setCmsForm({
        subtest: found.subtest,
        question: found.question,
        answer: found.answer,
        explanation: found.explanation,
        modules: found.modules,
        options: { ...found.options }
      });
    }
  };

  const handleToggleCmsModule = (module: string) => {
    setCmsForm(prev => {
      const exists = prev.modules.includes(module);
      return {
        ...prev,
        modules: exists ? prev.modules.filter(m => m !== module) : [...prev.modules, module]
      };
    });
  };

  const handleSaveCmsQuestion = () => {
    setSaveState('saved');
    setCmsQuestions(prev => prev.map(q => q.id === selectedCmsQuestionId ? { id: q.id, ...cmsForm } : q));
    setTimeout(() => setSaveState('idle'), 2200);
  };

  const handleCreateNewQuestion = () => {
    const newId = (Math.max(...cmsQuestions.map(q => parseInt(q.id, 10))) + 1).toString();
    const newQ: CmsQuestion = {
      id: newId,
      subtest: 'Figure Sequences',
      question: 'New question text here...',
      answer: 'A',
      explanation: 'Explanation text here...',
      modules: ['CS'],
      options: {
        A: 'Option A description',
        B: 'Option B description',
        C: 'Option C description',
        D: 'Option D description'
      }
    };
    setCmsQuestions(prev => [...prev, newQ]);
    setSelectedCmsQuestionId(newId);
    setCmsForm({
      subtest: newQ.subtest,
      question: newQ.question,
      answer: newQ.answer,
      explanation: newQ.explanation,
      modules: newQ.modules,
      options: { ...newQ.options }
    });
  };

  return (
    <div className="max-w-7xl mx-auto">
      <div className="mb-6">
        <p className="text-sm font-medium text-orange-700">Admin CMS</p>
        <h2 className="text-3xl font-bold text-slate-900 mt-1">Question CMS</h2>
        <p className="text-slate-550 mt-1 text-sm">
          Edit test banks and preview questions in real time.
        </p>
      </div>

      <div className="grid w-full gap-6 xl:grid-cols-[1.1fr_0.9fr]">
        {/* CMS Form Editor */}
        <KniCard className="p-5 md:p-6 bg-white/70">
          <div className="mb-6 flex items-center justify-between">
            <div>
              <p className="text-sm font-semibold text-orange-700">Question CMS</p>
              <h3 className="text-2xl font-bold text-slate-950 mt-0.5">Question Editor</h3>
            </div>
            <button
              type="button"
              onClick={handleCreateNewQuestion}
              className="grid size-10 place-items-center rounded-xl border border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 transition shadow-sm"
              title="Add new question"
            >
              <Plus className="size-5" />
            </button>
          </div>

          <div className="grid gap-4">
            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Select Question to Edit</span>
              <div className="relative">
                <select
                  value={selectedCmsQuestionId}
                  onChange={e => loadCmsQuestion(e.target.value)}
                  className="w-full appearance-none rounded-xl border border-orange-200 bg-white pl-4 pr-10 py-3 text-slate-800 font-medium outline-none focus:border-orange-400"
                >
                  {cmsQuestions.map(q => (
                    <option key={q.id} value={q.id}>
                      Q{q.id} ({q.subtest}) - {q.question.substring(0, 50)}...
                    </option>
                  ))}
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Subtest Section</span>
              <div className="relative">
                <select
                  value={cmsForm.subtest}
                  onChange={e => setCmsForm({ ...cmsForm, subtest: e.target.value })}
                  className="w-full appearance-none rounded-xl border border-orange-200 bg-white pl-4 pr-10 py-3 text-slate-800 outline-none focus:border-orange-400"
                >
                  <option value="Figure Sequences">Figure Sequences</option>
                  <option value="Mathematical Equations">Mathematical Equations</option>
                  <option value="Latin Squares">Latin Squares</option>
                  <option value="Module Test">Module Test</option>
                </select>
                <ChevronDown className="absolute right-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 pointer-events-none" />
              </div>
            </label>

            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Question content</span>
              <textarea
                value={cmsForm.question}
                onChange={e => setCmsForm({ ...cmsForm, question: e.target.value })}
                className="min-h-24 rounded-xl border border-orange-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-orange-400 text-sm leading-relaxed"
              />
            </label>

            <button
              type="button"
              className="flex items-center justify-center gap-3 rounded-xl border border-dashed border-orange-300 bg-orange-500/5 px-4 py-6 text-orange-800 hover:bg-orange-500/10 transition"
            >
              <Upload className="size-5" />
              <span className="text-xs font-semibold">Drag & drop diagram image (Optional)</span>
            </button>

            <div className="grid gap-3">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Answer options</span>
              {(['A', 'B', 'C', 'D'] as const).map(letter => (
                <div key={letter} className="flex gap-2 items-center">
                  <button
                    type="button"
                    onClick={() => setCmsForm({ ...cmsForm, answer: letter })}
                    className={`w-12 h-11 shrink-0 rounded-xl border font-bold flex items-center justify-center transition ${
                      cmsForm.answer === letter
                        ? 'border-emerald-300 bg-emerald-500/15 text-emerald-800 shadow-sm'
                        : 'border-orange-200 bg-white text-slate-500 hover:bg-orange-50'
                    }`}
                  >
                    {letter}
                  </button>
                  <input
                    type="text"
                    value={cmsForm.options[letter]}
                    onChange={e => setCmsForm({
                      ...cmsForm,
                      options: {
                        ...cmsForm.options,
                        [letter]: e.target.value
                      }
                    })}
                    placeholder={`Description for Option ${letter}`}
                    className="w-full h-11 rounded-xl border border-orange-200 bg-white px-3 text-sm text-slate-800 outline-none focus:border-orange-400"
                  />
                </div>
              ))}
            </div>

            <label className="grid gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Explanation</span>
              <textarea
                value={cmsForm.explanation}
                onChange={e => setCmsForm({ ...cmsForm, explanation: e.target.value })}
                className="min-h-20 rounded-xl border border-orange-200 bg-white px-4 py-3 text-slate-800 outline-none focus:border-orange-400 text-sm leading-relaxed"
              />
            </label>

            <div className="grid gap-1.5">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Modules Restricted</span>
              <div className="flex flex-wrap gap-2">
                {['CS', 'Economics', 'Engineering'].map(module => {
                  const active = cmsForm.modules.includes(module);
                  return (
                    <button
                      key={module}
                      type="button"
                      onClick={() => handleToggleCmsModule(module)}
                      className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition flex items-center gap-1 ${
                        active
                          ? 'border-orange-300 bg-orange-600/10 text-orange-850 shadow-xs'
                          : 'border-orange-200 bg-white text-slate-400 hover:text-slate-700'
                      }`}
                    >
                      {active && <Lock className="size-3" />}
                      {module}
                    </button>
                  );
                })}
              </div>
            </div>

            <div className="flex justify-end gap-3 mt-4 pt-4 border-t border-orange-100">
              <button
                type="button"
                onClick={() => {
                  const found = cmsQuestions.find(q => q.id === selectedCmsQuestionId);
                  if (found) {
                    setCmsForm({
                      subtest: found.subtest,
                      question: found.question,
                      answer: found.answer,
                      explanation: found.explanation,
                      modules: found.modules,
                      options: { ...found.options }
                    });
                  }
                }}
                className="h-11 px-5 rounded-xl border border-orange-300 font-semibold text-slate-600 hover:bg-orange-50 transition text-sm shadow-xs"
              >
                Reset Form
              </button>
              <button
                type="button"
                onClick={handleSaveCmsQuestion}
                className="h-11 px-6 inline-flex items-center justify-center gap-2 rounded-xl bg-orange-600 font-semibold text-white shadow-lg shadow-orange-500/25 hover:bg-orange-500 transition text-sm"
              >
                <Save className="size-4" />
                <span>{saveState === 'saved' ? 'Saved Successfully' : 'Save Question'}</span>
              </button>
            </div>
          </div>
        </KniCard>

        {/* CMS Live Preview Column */}
        <div className="space-y-6">
          <KniCard className="p-5 md:p-6 bg-white/70">
            <div className="mb-6 flex items-center justify-between pb-3 border-b border-orange-100">
              <div>
                <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">Question Live Preview</p>
                <h4 className="text-xl font-bold text-slate-900 mt-1">{cmsForm.subtest}</h4>
              </div>
              <ImagePlus className="size-6 text-orange-600" />
            </div>

            {/* Live Preview UI Panel wrapper */}
            <div className="rounded-3xl border border-orange-200 bg-orange-50/50 p-5 shadow-inner">
              <span className="text-[10px] uppercase font-bold text-slate-450 tracking-widest">Question Canvas</span>
              
              {/* Stem */}
              <h5 className="mt-2 text-lg font-bold leading-snug text-slate-800">
                {cmsForm.question || 'Enter question stem above...'}
              </h5>

              {/* Diagram area preview */}
              <div className="my-5 grid min-h-40 place-items-center rounded-2xl border border-dashed border-orange-200 bg-orange-50/70 text-xs font-medium text-slate-400">
                <span>No Diagram Uploaded</span>
              </div>

              {/* Options List */}
              <div className="grid gap-3">
                {(['A', 'B', 'C', 'D'] as const).map(letter => {
                  const isCorrect = cmsForm.answer === letter;
                  return (
                    <div
                      key={letter}
                      className={`rounded-2xl border px-4 py-3 flex justify-between items-center text-sm font-semibold transition ${
                        isCorrect
                          ? 'border-emerald-300 bg-emerald-500/10 text-emerald-800 shadow-sm'
                          : 'border-orange-100 bg-white text-slate-600'
                      }`}
                    >
                      <span>{letter}. {cmsForm.options[letter] || `Option ${letter} description`}</span>
                      {isCorrect && <Check className="size-4 text-emerald-700" />}
                    </div>
                  );
                })}
              </div>

              {/* Explanation Preview */}
              {cmsForm.explanation && (
                <div className="mt-5 rounded-2xl border border-orange-200/50 bg-orange-600/5 p-4 text-xs leading-relaxed text-orange-850">
                  <p className="font-bold mb-1 uppercase tracking-wider text-[10px]">Explanation:</p>
                  <p>{cmsForm.explanation}</p>
                </div>
              )}
            </div>
          </KniCard>
        </div>
      </div>
    </div>
  );
}

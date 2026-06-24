'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { useState, useEffect, useMemo } from 'react';

import { KniCard, KniButton, KniBadge } from '@/components/KniPrimitives';
import { PenLine, CheckCircle2, Info, ShieldAlert, Download, Search, Users, Check, X, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { createClient } from '@/lib/supabase/client';

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
  format: string | null;
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
            id, email, full_name, role, created_at, phonenumber, allow_test_limit, status, module_test, format,
            user_exams (
              id, created_at, status, total_score, max_score, detailed_results
            )
          `)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        const formattedUsers = (allUsers || []).map((u: any) => ({
          ...u,
          user_exams: (u.user_exams || []).sort(
            (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        }));
        setUsers(formattedUsers as ProfileWithExams[]);

        const { data: examsData, error: examsError } = await supabase
          .from('exams')
          .select('id, title, is_active, retry_number, created_at, format')
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
      const targetExam = exams.find(e => e.id === examId);
      const examFormat = targetExam?.format || 'Digital';

      await supabase
        .from('exams')
        .update({ is_active: shouldActivate })
        .eq('id', examId);

      setExams(prev =>
        prev.map(e => (e.id === examId ? { ...e, is_active: shouldActivate } : e))
      );
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
    <div className=" mx-auto">
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
              <div className="hidden lg:grid grid-cols-[1.2fr_1.2fr_1.1fr_1fr_1.5fr] gap-4 border-b border-orange-100 bg-orange-50/30 px-5 py-4 text-sm font-semibold text-slate-500">
                <span>User</span>
                <span>Email</span>
                <span>Module Allocation</span>
                <span>Format</span>
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
                      } ${activeSubTab === 'pending' ? 'lg:grid-cols-[1.5fr_1.5fr_1fr_1.2fr]' : 'lg:grid-cols-[1.2fr_1.2fr_1.1fr_1fr_1.5fr]'}`}
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
                        <>
                          <div className="flex flex-wrap gap-1.5" onClick={e => e.stopPropagation()}>
                            {['natural_computer_science', 'economics', 'engineering'].map(module => {
                              const isCurrent = user.module_test === module;
                              const label = module === 'natural_computer_science' ? 'CS' : module === 'economics' ? 'Economics' : 'Engineering';
                              return (
                                <button
                                  key={module}
                                  type="button"
                                  onClick={() => handleUpdateModule(user.id, module)}
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
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
                          <div className="flex flex-wrap gap-1.5" onClick={e => e.stopPropagation()}>
                            {['Digital', 'Paper'].map(fmt => {
                              const isCurrent = (user.format || 'Digital').toLowerCase() === fmt.toLowerCase();
                              return (
                                <button
                                  key={fmt}
                                  type="button"
                                  onClick={() => handleUpdateFormat(user.id, fmt)}
                                  className={`rounded-full border px-2 py-0.5 text-[10px] font-semibold transition ${
                                    isCurrent
                                      ? 'border-orange-300/60 bg-orange-600/10 text-orange-850'
                                      : 'border-orange-200 bg-orange-50/30 text-slate-400 hover:text-slate-700'
                                  }`}
                                >
                                  {fmt}
                                </button>
                              );
                            })}
                          </div>
                        </>
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
// ADMIN CMS PANEL - GUIDELINES FOR IMPORTING QUESTIONS
// ═══════════════════════════════════════════════════════════════════════════════

export function AdminCmsPanel() {
  return (
    <div className=" mx-auto">
      <div className="mb-8">
        <p className="text-sm font-medium text-orange-700">Admin CMS</p>
        <h2 className="text-3xl font-bold text-slate-900 mt-1">Import Questions into Database</h2>
        <p className="text-slate-550 mt-1 text-sm">
          Use SQL templates to add questions and exams to the TestAS database.
        </p>
      </div>

      {/* Overview Card */}
      <KniCard className="p-6 mb-6 bg-gradient-to-br from-orange-50 to-white">
        <div className="flex items-start gap-4">
          <div className="p-3 bg-orange-100 rounded-xl shrink-0">
            <PenLine className="w-6 h-6 text-orange-700" />
          </div>
          <div>
            <h3 className="text-lg font-bold text-slate-900">How to Import Questions</h3>
            <p className="text-slate-600 mt-2 text-sm leading-relaxed">
              The CMS system uses SQL templates to import questions and exams directly into the database.
              This approach ensures data consistency and allows for version-controlled question management.
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-800">
                Step 1: Select Template
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-800">
                Step 2: Fill Values
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-800">
                Step 3: Generate SQL
              </span>
              <span className="inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-medium bg-emerald-100 text-emerald-800">
                Step 4: Run in Supabase
              </span>
            </div>
          </div>
        </div>
      </KniCard>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Step-by-Step Guide */}
        <div className="space-y-6">
          <KniCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-sm">
                1
              </div>
              <h3 className="text-lg font-bold text-slate-900">Find the Right Template</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Navigate to <code className="px-2 py-1 rounded bg-slate-100 text-slate-700 font-mono text-xs">src/lib/cms/templates/</code>
              and choose a template based on your question type:
            </p>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-semibold text-orange-700 mb-2 uppercase">Core Digital Questions</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                  <li><code className="text-slate-800">figure_sequence.json</code> - Visual sequence completion</li>
                  <li><code className="text-slate-800">math_equation.json</code> - Solve systems of equations</li>
                  <li><code className="text-slate-800">latin_square.json</code> - 5x5 grid puzzle</li>
                </ul>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-semibold text-orange-700 mb-2 uppercase">Module Digital Questions</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                  <li><code className="text-slate-800">module_mcq.json</code> - Multiple choice with passage</li>
                  <li><code className="text-slate-800">interpreting_texts.json</code> - Text interpretation</li>
                </ul>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-semibold text-orange-700 mb-2 uppercase">Complete Exam Template</p>
                <ul className="text-xs text-slate-600 space-y-1 list-disc list-inside">
                  <li><code className="text-slate-800">exam_template.json</code> - Full exam with sections</li>
                </ul>
              </div>
            </div>
          </KniCard>

          <KniCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-sm">
                2
              </div>
              <h3 className="text-lg font-bold text-slate-900">Fill in Your Values</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Copy the template JSON and replace placeholder values:
            </p>
            <div className="bg-slate-900 rounded-xl p-4 overflow-x-auto">
              <pre className="text-xs text-slate-300 font-mono leading-relaxed">
{`{
  "id": "generate-uuid-v4",           // Replace with new UUID or use gen_random_uuid()
  "section_id": "your-section-id",   // Get from sections table
  "sort_order": 1,
  "question_type": "figure_sequence",
  "content": {
    "sequence_images": ["url1", "url2"],
    "answer_options": ["opt1", "opt2"]
  },
  "correct_answer": {
    "image1": 1
  }
}`}
              </pre>
            </div>
            <div className="mt-4 p-3 rounded-lg bg-amber-50 border border-amber-100">
              <p className="text-xs text-amber-800">
                <span className="font-semibold">Note:</span> Use <code className="font-mono bg-amber-100 px-1 rounded">gen_random_uuid()</code> for new IDs to avoid conflicts.
              </p>
            </div>
          </KniCard>

          <KniCard className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-8 h-8 rounded-full bg-orange-600 text-white flex items-center justify-center font-bold text-sm">
                3
              </div>
              <h3 className="text-lg font-bold text-slate-900">Generate SQL</h3>
            </div>
            <p className="text-sm text-slate-600 mb-4">
              Use the SQL Generator or write SQL manually:
            </p>
            <div className="space-y-3">
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-semibold text-slate-700 mb-2">Method: SQL Generator (TypeScript)</p>
                <pre className="text-xs text-slate-600 font-mono bg-white p-2 rounded border border-slate-200">
{`import { generateSQLFromJSON } from '@/lib/cms/sql-generator';
const sql = generateSQLFromJSON(yourQuestionJSON);
console.log(sql);`}
                </pre>
              </div>
              <div className="p-3 rounded-xl bg-slate-50 border border-slate-100">
                <p className="text-xs font-semibold text-slate-700 mb-2">Method: Direct SQL</p>
                <pre className="text-xs text-slate-600 font-mono bg-white p-2 rounded border border-slate-200">
{`INSERT INTO public.questions (id, section_id, sort_order, question_type, content, correct_answer)
VALUES (
  gen_random_uuid(),
  'SECTION_UUID',
  1,
  'figure_sequence',
  '{"sequence_images": [...], "answer_options": [...]}',
  '{"image1": 1}'
);`}
                </pre>
              </div>
            </div>
          </KniCard>
        </div>

        {/* Database Reference & Quick Tips */}
        <div className="space-y-6">
          <KniCard className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <CheckCircle2 className="w-5 h-5 text-emerald-600" />
              Database Schema
            </h3>
            <div className="space-y-4">
              <div className="p-3 rounded-xl bg-white border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">exams Table</p>
                <pre className="text-[10px] text-slate-600 font-mono leading-relaxed overflow-x-auto">
{`id UUID PRIMARY KEY
title TEXT NOT NULL
format TEXT NOT NULL DEFAULT 'Digital'
is_active BOOLEAN DEFAULT TRUE
retry_number SMALLINT`}
                </pre>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">sections Table</p>
                <pre className="text-[10px] text-slate-600 font-mono leading-relaxed overflow-x-auto">
{`id UUID PRIMARY KEY
exam_id UUID REFERENCES exams(id)
title TEXT NOT NULL
question_type TEXT NOT NULL
duration_seconds INTEGER
question_count INTEGER`}
                </pre>
              </div>
              <div className="p-3 rounded-xl bg-white border border-slate-100">
                <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">questions Table</p>
                <pre className="text-[10px] text-slate-600 font-mono leading-relaxed overflow-x-auto">
{`id UUID PRIMARY KEY
section_id UUID REFERENCES sections(id)
question_type TEXT NOT NULL
content JSONB NOT NULL
correct_answer JSONB NOT NULL`}
                </pre>
              </div>
            </div>
          </KniCard>

          <KniCard className="p-6">
            <h3 className="text-lg font-bold text-slate-900 mb-4 flex items-center gap-2">
              <Info className="w-5 h-5 text-blue-600" />
              Common Operations
            </h3>
            <div className="space-y-3">
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-xs font-semibold text-blue-800 mb-1">Get Section ID</p>
                <pre className="text-[10px] text-blue-700 font-mono bg-white p-2 rounded border border-blue-200">
{`SELECT id FROM public.sections WHERE title = 'Core - Figure Sequences';`}
                </pre>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-xs font-semibold text-blue-800 mb-1">Add Multiple Questions</p>
                <pre className="text-[10px] text-blue-700 font-mono bg-white p-2 rounded border border-blue-200">
{`INSERT INTO public.questions (...) VALUES (section_id, ...);
INSERT INTO public.questions (...) VALUES (section_id, ...);`}
                </pre>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-xs font-semibold text-blue-800 mb-1">Update Question</p>
                <pre className="text-[10px] text-blue-700 font-mono bg-white p-2 rounded border border-blue-200">
{`UPDATE public.questions SET content = {...}
WHERE id = 'question-uuid';`}
                </pre>
              </div>
              <div className="p-3 rounded-lg bg-blue-50 border border-blue-100">
                <p className="text-xs font-semibold text-blue-800 mb-1">Activate Exam</p>
                <pre className="text-[10px] text-blue-700 font-mono bg-white p-2 rounded border border-blue-200">
{`-- Deactivate others first
UPDATE public.exams SET is_active = FALSE WHERE format = 'Digital';
-- Activate target
UPDATE public.exams SET is_active = TRUE WHERE id = 'exam-uuid';`}
                </pre>
              </div>
            </div>
          </KniCard>

          <KniCard className="p-6 bg-rose-50/50">
            <h3 className="text-lg font-bold text-slate-900 mb-3 flex items-center gap-2">
              <ShieldAlert className="w-5 h-5 text-rose-600" />
              Troubleshooting
            </h3>
            <div className="space-y-3">
              <div>
                <p className="text-xs font-semibold text-rose-800 mb-1">Foreign Key Violation</p>
                <p className="text-xs text-rose-700">
                  Make sure the section_id exists before inserting questions.
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-rose-800 mb-1">Invalid JSONB Input</p>
                <p className="text-xs text-rose-700">
                  Escape single quotes: <code className="font-mono bg-rose-100 px-1 rounded">''</code>
                </p>
              </div>
              <div>
                <p className="text-xs font-semibold text-rose-800 mb-1">UUID Already Exists</p>
                <p className="text-xs text-rose-700">
                  Use <code className="font-mono bg-rose-100 px-1 rounded">gen_random_uuid()</code> instead of hard-coded IDs.
                </p>
              </div>
            </div>
          </KniCard>
        </div>
      </div>

      {/* Quick SQL Template Box */}
      <KniCard className="p-6 mt-6">
        <h3 className="text-lg font-bold text-slate-900 mb-4">Ready-to-Use SQL Snippets</h3>
        <div className="space-y-4">
          <div className="group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Figure Sequence Question</span>
              <button className="text-xs text-orange-600 font-medium hover:text-orange-700">
                Copy to Clipboard
              </button>
            </div>
            <pre className="text-xs font-mono bg-slate-900 text-slate-300 p-4 rounded-xl overflow-x-auto">
{`INSERT INTO public.questions (id, section_id, sort_order, question_type, content, correct_answer)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM public.sections WHERE title = 'Core - Figure Sequences' LIMIT 1),
  1,
  'figure_sequence',
  '{
    "sequence_images": ["image1_url", "image2_url", "image3_url"],
    "answer_options": ["Option A", "Option B", "Option C", "Option D"],
    "correct_option": 1
  }'::jsonb,
  '{
    "image1": 1,
    "image2": 2
  }'::jsonb
);`}
            </pre>
          </div>
          <div className="group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Math Equation Question</span>
              <button className="text-xs text-orange-600 font-medium hover:text-orange-700">
                Copy to Clipboard
              </button>
            </div>
            <pre className="text-xs font-mono bg-slate-900 text-slate-300 p-4 rounded-xl overflow-x-auto">
{`INSERT INTO public.questions (id, section_id, sort_order, question_type, content, correct_answer)
VALUES (
  gen_random_uuid(),
  (SELECT id FROM public.sections WHERE title = 'Core - Mathematical Equations' LIMIT 1),
  1,
  'math_equation',
  '{
    "equations": ["A + B = 10", "A - B = 4"],
    "variables": ["A", "B"]
  }'::jsonb,
  '{
    "A": 7,
    "B": 3
  }'::jsonb
);`}
            </pre>
          </div>
          <div className="group">
            <div className="flex items-center justify-between mb-2">
              <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Complete Exam with Sections</span>
              <button className="text-xs text-orange-600 font-medium hover:text-orange-700">
                Copy to Clipboard
              </button>
            </div>
            <pre className="text-xs font-mono bg-slate-900 text-slate-300 p-4 rounded-xl overflow-x-auto">
{`-- First, create the exam
INSERT INTO public.exams (id, title, format, is_active)
VALUES (gen_random_uuid(), 'TestAS Practice Exam 1', 'Digital', true);

-- Get the exam ID
SELECT id FROM public.exams WHERE title = 'TestAS Practice Exam 1';

-- Create sections (repeat for each section)
INSERT INTO public.sections (id, exam_id, title, question_type, duration_seconds, question_count, sort_order)
VALUES (
  gen_random_uuid(),
  'EXAM_ID_HERE',
  'Core - Figure Sequences',
  'figure_sequence',
  1200,
  15,
  1
);

-- Then add questions to each section
INSERT INTO public.questions (id, section_id, sort_order, question_type, content, correct_answer)
VALUES (gen_random_uuid(), 'SECTION_ID_HERE', 1, 'figure_sequence', ..., ...);`}
            </pre>
          </div>
        </div>
      </KniCard>
    </div>
  );
}

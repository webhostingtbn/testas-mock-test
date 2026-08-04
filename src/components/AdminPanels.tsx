'use client';
import { useEffect, useMemo, useState } from 'react';
import { Check, ChevronDown, ChevronUp, Clock, Download, Search, ShieldAlert, Users, X } from 'lucide-react';
import { KniCard, KniButton, KniBadge } from '@/components/KniPrimitives';

interface UserExam {
  id: string;
  created_at: string;
  status: string;
  total_score: number | null;
  max_score: number | null;
  detailed_results: Record<string, unknown> | null;
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

interface QuestionResult {
  id: string;
  userAnswer: unknown;
  isCorrect: boolean | null;
}

interface ResultSection {
  title: string;
  score: string | null;
  questions: QuestionResult[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function formatAnswerValue(value: unknown): string {
  if (value === null || value === undefined) return 'No answer';
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return String(value);
  }

  try {
    return JSON.stringify(value) ?? 'No answer';
  } catch {
    return 'Answer unavailable';
  }
}

function toQuestionResult(value: unknown, index: number): QuestionResult {
  if (isRecord(value) && 'user_answer' in value) {
    return {
      id: typeof value.question_id === 'string' ? value.question_id : String(index + 1),
      userAnswer: value.user_answer,
      isCorrect: typeof value.is_correct === 'boolean' ? value.is_correct : null,
    };
  }

  return { id: String(index + 1), userAnswer: value, isCorrect: null };
}

function getResultSections(detailedResults: Record<string, unknown> | null): ResultSection[] {
  if (!detailedResults) return [];

  const flatAnswers = detailedResults.answers;
  if (Array.isArray(flatAnswers)) {
    return [{
      title: 'Question results',
      score: null,
      questions: flatAnswers.map(toQuestionResult),
    }];
  }

  return Object.entries(detailedResults).flatMap(([title, sectionData]) => {
    const answers = Array.isArray(sectionData)
      ? sectionData
      : isRecord(sectionData) && Array.isArray(sectionData.answers)
        ? sectionData.answers
        : [];
    if (answers.length === 0) return [];

    const score = isRecord(sectionData)
      && typeof sectionData.score === 'number'
      && typeof sectionData.max_score === 'number'
      ? `${sectionData.score} / ${sectionData.max_score}`
      : null;

    return [{ title, score, questions: answers.map(toQuestionResult) }];
  });
}

function ExpandedHistory({ user }: { user: ProfileWithExams }) {
  return (
    <div className="border-t border-orange-100 bg-orange-50/20 p-5">
      <h4 className="mb-3 text-sm font-bold uppercase tracking-wider text-slate-700">Exam History</h4>
      {user.user_exams.length === 0 ? (
        <p className="text-sm italic text-slate-500">No exams taken yet.</p>
      ) : (
        <div className="space-y-4">
          {user.user_exams.map((attempt, attemptIndex) => {
            const sections = getResultSections(attempt.detailed_results);
            return (
              <div key={attempt.id} className="rounded-xl border border-orange-100 bg-white p-4 shadow-sm">
                <div className="mb-4 flex flex-wrap justify-between gap-4 border-b border-orange-50 pb-4">
                  <div>
                    <p className="text-sm font-semibold text-slate-800">
                      Attempt #{attemptIndex + 1} · {new Date(attempt.created_at).toLocaleString()}
                    </p>
                    <p className="mt-1 text-xs font-medium uppercase text-slate-500">{attempt.status}</p>
                  </div>
                  <div className="text-right">
                    <p className="text-[10px] font-semibold uppercase text-slate-500">Total score</p>
                    <p className="text-lg font-bold text-slate-900">
                      {attempt.total_score ?? '-'}<span className="text-sm font-normal text-slate-400"> / {attempt.max_score ?? '-'}</span>
                    </p>
                  </div>
                </div>
                {sections.length === 0 ? (
                  <p className="text-xs italic text-slate-400">No question-level results were saved for this attempt.</p>
                ) : (
                  <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                    {sections.map((section) => (
                      <div key={section.title} className="rounded-lg border border-orange-100/50 bg-orange-50/30 p-3">
                        <div className="mb-2 flex items-center justify-between border-b border-orange-100/70 pb-1.5">
                          <p className="text-xs font-bold text-slate-700">{section.title}</p>
                          {section.score && <span className="text-[10px] font-bold text-orange-800">Score: {section.score}</span>}
                        </div>
                        <div className="flex flex-wrap gap-2">
                          {section.questions.map((question, questionIndex) => {
                            const resultClass = question.isCorrect === true
                              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                              : question.isCorrect === false
                                ? 'border-rose-200 bg-rose-50 text-rose-700'
                                : 'border-orange-100 bg-white text-slate-700';
                            const resultLabel = question.isCorrect === true ? 'Correct' : question.isCorrect === false ? 'Incorrect' : 'Recorded';
                            return (
                              <span key={`${question.id}-${questionIndex}`} className={`inline-flex items-center gap-1 rounded border px-2 py-1 text-xs font-mono shadow-sm ${resultClass}`}>
                                <span className="opacity-60">Q{questionIndex + 1}.</span>
                                <span className="font-bold">{formatAnswerValue(question.userAnswer)}</span>
                                <span className="font-sans text-[10px] font-semibold">{resultLabel}</span>
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

export function AdminUsersPanel() {
  const [users, setUsers] = useState<ProfileWithExams[]>([]);
  const [exams, setExams] = useState<ExamConfig[]>([]);
  const [isUpdatingExamId, setIsUpdatingExamId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [activeSubTab, setActiveSubTab] = useState<'pending' | 'approved' | 'exams'>('pending');

  useEffect(() => {
    async function fetchAdminData() {
      try {
        const usersRes = await fetch('/api/admin/users');
        if (!usersRes.ok) throw new Error('Failed to load admin user data');
        const usersData: { users?: ProfileWithExams[] } = await usersRes.json();

        const formattedUsers = (usersData.users ?? []).map((u) => ({
          ...u,
          user_exams: (u.user_exams ?? []).sort(
            (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        }));
        setUsers(formattedUsers);

        const examsRes = await fetch('/api/exams');
        if (examsRes.ok) {
          const examsData: { exams?: ExamConfig[] } = await examsRes.json();
          setExams(examsData.exams ?? []);
        }
      } catch (err: unknown) {
        console.error('Admin fetch error:', err);
        setError(err instanceof Error ? err.message : 'An error occurred fetching data.');
      } finally {
        setIsLoading(false);
      }
    }

    fetchAdminData();
  }, []);

  const toggleExamActive = async (examId: string, shouldActivate: boolean) => {
    setIsUpdatingExamId(examId);
    try {
      const res = await fetch(`/api/admin/exams/${examId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: shouldActivate }),
      });
      if (!res.ok) throw new Error('Failed to update exam status');

      setExams(prev =>
        prev.map(e => (e.id === examId ? { ...e, is_active: shouldActivate } : e))
      );
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update exam activation.');
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
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allow_test_limit: limit }),
      });
      if (!res.ok) throw new Error('Failed to update limit');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, allow_test_limit: limit } : u));
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update limit');
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
      const res = await fetch('/api/admin/users/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allow_test_limit: limit }),
      });
      if (!res.ok) throw new Error('Failed to update limits');
      setUsers(prev => prev.map(u => u.role === 'admin' ? u : { ...u, allow_test_limit: limit }));
      alert(`Successfully updated test limit to ${limit} for all normal users.`);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to update limits');
    } finally {
      setIsUpdatingLimit(false);
    }
  };

  const updateUser = async (userId: string, updates: Record<string, string | number>) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update user');
      setUsers((previous) => previous.map((user) => user.id === userId ? { ...user, ...updates } : user));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Failed to update user.');
    }
  };

  const nonAdminUsers = useMemo(() => users.filter((user) => user.role !== 'admin'), [users]);
  const filteredUsers = useMemo(() => {
    const query = searchQuery.trim().toLowerCase();
    return nonAdminUsers.filter((user) => {
      const matchesSearch = !query || [user.full_name, user.email, user.phonenumber]
        .some((value) => value?.toLowerCase().includes(query));
      const matchesTab = activeSubTab === 'pending'
        ? user.status !== 'Approved'
        : activeSubTab === 'approved'
          ? user.status === 'Approved'
          : true;
      return matchesSearch && matchesTab;
    });
  }, [activeSubTab, nonAdminUsers, searchQuery]);

  const exportUsers = () => {
    const rows = filteredUsers.map((user) => [
      user.full_name ?? '', user.email, user.phonenumber ?? '', user.status ?? 'Pending',
      user.format ?? 'Digital', user.module_test ?? '', String(user.allow_test_limit ?? 1),
    ].map((value) => `"${value.replaceAll('"', '""')}"`).join(','));
    const blob = new Blob([[['Name', 'Email', 'Phone', 'Status', 'Format', 'Module', 'Limit'].join(','), ...rows].join('\n')], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `testas-users-${Date.now()}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading admin panel data...
      </div>
    );
  }

  return (
    <div className="mx-auto w-full">
      <div className="mb-6">
        <p className="text-sm font-medium text-orange-700">Admin Panel</p>
        <h2 className="mt-1 text-3xl font-bold text-slate-900">Platform Management</h2>
        <p className="mt-1 text-sm text-slate-550">Manage registrations, student allocations, exam access, and reports.</p>
      </div>
      <div className="mb-6 flex gap-2 border-b border-orange-200">
        {(['pending', 'approved', 'exams'] as const).map((tab) => (
          <button key={tab} type="button" onClick={() => setActiveSubTab(tab)} className={`-mb-px border-b-2 px-4 py-2.5 text-sm font-semibold transition ${activeSubTab === tab ? 'border-orange-600 text-orange-600' : 'border-transparent text-slate-500 hover:text-slate-900'}`}>
            {tab === 'pending' ? 'Pending Approvals' : tab === 'approved' ? 'Approved Users' : 'Active Exams'}
          </button>
        ))}
      </div>
      {error && (
        <div className="mb-6 flex gap-3 rounded-xl border border-red-200 bg-red-50 p-4 text-red-700">
          <ShieldAlert className="size-5 shrink-0" />
          <p>{error}</p>
        </div>
      )}
      {activeSubTab === 'exams' ? (
        <KniCard className="p-6">
          <div className="mb-4 flex items-center gap-2 border-b border-orange-100 pb-3"><Clock className="size-5 text-orange-600" /><h3 className="font-bold text-slate-900">Exam Activation List</h3></div>
          <div className="space-y-4">{exams.map((exam) => <div key={exam.id} className="flex flex-col justify-between gap-4 rounded-xl border border-orange-100 bg-white/50 p-4 sm:flex-row sm:items-center"><div><p className="font-semibold text-slate-800">{exam.title}</p><p className="mt-1 text-xs text-slate-500">{exam.format ?? 'Digital'} · Retry number: {exam.retry_number ?? 'No limit'}</p></div><div className="flex items-center gap-3"><KniBadge status={exam.is_active ? 'Approved' : 'Inactive'} /><KniButton disabled={isUpdatingExamId === exam.id} variant={exam.is_active ? 'outline' : 'primary'} className="h-9 px-4 text-xs" onClick={() => toggleExamActive(exam.id, !exam.is_active)}>{isUpdatingExamId === exam.id ? 'Updating…' : exam.is_active ? 'Deactivate' : 'Activate'}</KniButton></div></div>)}</div>
        </KniCard>
      ) : (
        <div className="space-y-6">
          <div className="flex flex-col justify-between gap-4 lg:flex-row lg:items-center"><div><h3 className="text-xl font-bold text-slate-900">{activeSubTab === 'pending' ? 'Pending Approvals' : 'Approved Users'}</h3><p className="mt-0.5 text-sm text-slate-500">Showing {filteredUsers.length} students</p></div><div className="flex flex-wrap gap-3"><label className="flex min-w-70 items-center gap-2 rounded-2xl border border-orange-200 bg-white px-4 py-2.5"><Search className="size-4 text-slate-400" /><input aria-label="Search users" value={searchQuery} onChange={(event) => setSearchQuery(event.target.value)} placeholder="Search name, email or phone..." className="w-full bg-transparent text-sm outline-none" /></label><KniButton variant="secondary" className="h-10 px-4 text-xs" disabled={isUpdatingLimit} onClick={updateAllUsersLimit}><Users className="size-4" />Set All Limits</KniButton><KniButton variant="primary" className="h-10 px-4 text-xs" onClick={exportUsers}><Download className="size-4" />Export CSV</KniButton></div></div>
          <KniCard className="overflow-hidden p-0">
            <div className="hidden grid-cols-[1.4fr_1.1fr_1fr_1.2fr] gap-4 border-b border-orange-100 bg-orange-50/30 px-5 py-4 text-sm font-semibold text-slate-500 lg:grid"><span>User</span><span>Allocation</span><span>Attempts</span><span className="text-right">Actions</span></div>
            {filteredUsers.map((user) => {
              const expanded = expandedUserId === user.id;
              return (
                <div key={user.id} className="border-b border-orange-100 last:border-b-0">
                  <div className="grid cursor-pointer gap-4 px-5 py-5 transition hover:bg-orange-50/30 lg:grid-cols-[1.4fr_1.1fr_1fr_1.2fr] lg:items-center" onClick={() => setExpandedUserId(expanded ? null : user.id)}>
                    <div><p className="font-semibold text-slate-900">{user.full_name || 'No Name Provided'}</p><p className="text-sm text-slate-500">{user.email}</p></div>
                    <div className="text-sm text-slate-600">{user.module_test || 'Not selected'} · {user.format || 'Digital'}</div>
                    <div className="font-semibold text-slate-700">{user.user_exams.length}</div>
                    <div className="flex justify-end gap-2" onClick={(event) => event.stopPropagation()}>
                      {activeSubTab === 'pending' ? <><button type="button" className="rounded-lg bg-emerald-500/10 px-3 py-1.5 text-xs font-bold text-emerald-700" onClick={() => updateUser(user.id, { status: 'Approved' })}><Check className="mr-1 inline size-3" />Approve</button><button type="button" className="rounded-lg bg-rose-500/10 px-3 py-1.5 text-xs font-bold text-rose-700" onClick={() => updateUser(user.id, { status: 'Rejected' })}><X className="mr-1 inline size-3" />Reject</button></> : <><button type="button" className="rounded-lg border border-orange-200 px-2 py-1 text-xs" onClick={() => updateUser(user.id, { module_test: user.module_test === 'economics' ? 'engineering' : 'economics' })}>Module</button><button type="button" className="rounded-lg border border-orange-200 px-2 py-1 text-xs" onClick={() => updateUser(user.id, { format: user.format === 'Paper' ? 'Digital' : 'Paper' })}>Format</button><button type="button" className="rounded-lg border border-orange-200 px-2 py-1 text-xs" onClick={() => updateUserLimit(user.id, user.allow_test_limit ?? 1)}>Limit {user.allow_test_limit ?? 1}</button></>}
                      <button type="button" className="grid size-8 place-items-center rounded-xl bg-orange-50 text-orange-600" onClick={() => setExpandedUserId(expanded ? null : user.id)}>{expanded ? <ChevronUp className="size-4" /> : <ChevronDown className="size-4" />}</button>
                    </div>
                  </div>
                  {expanded && <ExpandedHistory user={user} />}
                </div>
              );
            })}
          </KniCard>
        </div>
      )}
    </div>
  );
}

export function AdminCmsPanel() {
  return (
    <div className="p-6">
      <h3 className="text-lg font-bold mb-2">CMS Panel</h3>
      <p className="text-sm text-muted-foreground">CMS question management is secured server-side.</p>
    </div>
  );
}

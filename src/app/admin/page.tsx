'use client';

import { useEffect, useState, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
  LogOut, ChevronDown, ChevronUp, UserSquare, Home, ShieldAlert,
  Search, Download, Users, CheckCircle2, Clock,
} from 'lucide-react';

import { signOut, useSession } from 'next-auth/react';

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
  phonenumber: string;
}

interface ExamConfig {
  id: string;
  title: string;
  is_active: boolean;
  retry_number: number | null;
  created_at: string;
}

// ─── helpers ──────────────────────────────────────────────────────────────────

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

// ─── ExpandedRow ──────────────────────────────────────────────────────────────

function ExpandedRow({ user, colSpan }: { user: ProfileWithExams; colSpan: number }) {
  return (
    <tr>
      <td colSpan={colSpan} className="p-0 bg-slate-50 border-b border-gray-200">
        <div className="px-6 py-5">
          <h4 className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-4">
            Exam History — {user.full_name || user.email}
          </h4>

          {user.user_exams.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No exams taken yet.</p>
          ) : (
            <div className="space-y-4">
              {user.user_exams.map((exam, idx) => (
                <div key={exam.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                  <div className="flex flex-wrap sm:flex-nowrap justify-between gap-4 mb-4 pb-3 border-b border-gray-100">
                    <div>
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                          exam.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                          {exam.status.toUpperCase()}
                        </span>
                        <span className="text-xs text-gray-500 font-medium">
                          Attempt #{idx + 1} — {new Date(exam.created_at).toLocaleString()}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 font-mono">ID: {exam.id}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-[10px] text-gray-500 uppercase font-semibold">Total Score</p>
                      <p className="text-lg font-bold text-gray-900">
                        {exam.total_score ?? '-'}
                        <span className="text-gray-400 text-sm font-normal"> / {exam.max_score ?? '-'}</span>
                      </p>
                    </div>
                  </div>

                  {exam.detailed_results && Object.keys(exam.detailed_results).length > 0 ? (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                      {Object.entries(exam.detailed_results).map(([sectionTitle, sectionData]) => {
                        const isLegacy = Array.isArray(sectionData);
                        const answers: any[] = isLegacy ? sectionData : (sectionData as any).answers || [];
                        const scoreStr = isLegacy ? null : `${(sectionData as any).score} / ${(sectionData as any).max_score}`;

                        return (
                          <div key={sectionTitle} className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                            <div className="flex justify-between items-center border-b border-gray-200 pb-1 mb-2">
                              <p className="text-xs font-bold text-gray-700">{sectionTitle}</p>
                              {scoreStr && (
                                <span className="text-[10px] font-bold px-1.5 py-0.5 rounded-sm bg-orange-100 text-orange-800">
                                  Score: {scoreStr}
                                </span>
                              )}
                            </div>
                            {Array.isArray(answers) ? (
                              <div className="flex flex-wrap gap-1.5">
                                {answers.length > 0 ? answers.map((ans, qi) => {
                                  let displayAns = '-';
                                  let bgClass = 'bg-white border-gray-200 text-gray-700';
                                  let titleStr: string | undefined;

                                  if (ans && typeof ans === 'object' && 'user_answer' in ans) {
                                    displayAns = formatAnsValue(ans.user_answer);
                                    if (ans.correct_answer !== undefined) {
                                      titleStr = `Correct: ${formatAnsValue(ans.correct_answer)}`;
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
                                      className={`inline-flex items-center px-2 py-0.5 border text-xs font-mono rounded whitespace-nowrap ${bgClass}`}
                                    >
                                      <span className="opacity-40 mr-1 font-normal">Q{qi + 1}.</span>
                                      <span className="font-bold">{displayAns}</span>
                                    </span>
                                  );
                                }) : (
                                  <span className="text-xs text-gray-400 italic">Skipped</span>
                                )}
                              </div>
                            ) : (
                              <pre className="text-[10px] text-gray-600 overflow-x-auto">
                                {JSON.stringify(answers, null, 2)}
                              </pre>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  ) : (
                    <p className="text-xs text-gray-400 italic">No detailed records for this attempt.</p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const supabase = createClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<ProfileWithExams[]>([]);
  const [exams, setExams] = useState<ExamConfig[]>([]);
  const [isUpdatingExamId, setIsUpdatingExamId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    async function checkAdminAndFetchData() {
      if (status === 'loading') return;
      try {
        if (!session?.user) { router.push('/login'); return; }

        const { data: profile, error: profileError } = await supabase
          .from('profiles').select('role').eq('email', session.user.email).maybeSingle();

        if (profileError) throw new Error(`Profile check failed: ${profileError.message}`);
        if (!profile || profile.role !== 'admin') { setIsAdmin(false); setIsLoading(false); return; }

        setIsAdmin(true);

        const { data: allUsers, error: fetchError } = await supabase
          .from('profiles')
          .select(`id, email, full_name, role, created_at, phonenumber,
            user_exams ( id, created_at, status, total_score, max_score, detailed_results )`)
          .order('created_at', { ascending: false });

        if (fetchError) throw fetchError;

        const formattedUsers = (allUsers || []).map(u => ({
          ...u,
          user_exams: (u.user_exams || []).sort(
            (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ),
        }));

        setUsers(formattedUsers as ProfileWithExams[]);

        const { data: examsData, error: examsError } = await supabase
          .from('exams').select('id, title, is_active, retry_number, created_at')
          .order('created_at', { ascending: false });

        if (examsError) throw examsError;
        setExams((examsData || []) as ExamConfig[]);
      } catch (err: any) {
        setError(err.message || 'An error occurred fetching data.');
      } finally {
        setIsLoading(false);
      }
    }
    checkAdminAndFetchData();
  }, [router, supabase, session, status]);

  const toggleExpand = (userId: string) =>
    setExpandedUserId(prev => (prev === userId ? null : userId));

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

  const non_admin_users = useMemo(
    () => users.filter(u => u.role !== 'admin'),
    [users]
  );

  const filteredUsers = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return non_admin_users;
    return non_admin_users.filter(u =>
      (u.full_name || '').toLowerCase().includes(q) ||
      (u.email || '').toLowerCase().includes(q) ||
      (u.phonenumber || '').toLowerCase().includes(q)
    );
  }, [non_admin_users, searchQuery]);

  // ── stats ──
  const totalCompleted = useMemo(
    () => non_admin_users.reduce((s, u) => s + u.user_exams.filter(e => e.status === 'completed').length, 0),
    [non_admin_users]
  );

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-[3px] border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-gray-50 p-6 text-center">
        <ShieldAlert className="w-16 h-16 text-red-500 mb-4" />
        <h1 className="text-2xl font-bold text-gray-900 mb-2">Access Denied</h1>
        <p className="text-gray-500 mb-6">You need admin privileges to view this page.</p>
        <Button onClick={() => router.push('/dashboard')} className="bg-orange-500 hover:bg-orange-600 text-white">
          <Home className="w-4 h-4 mr-2" /> Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* ── Header ── */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserSquare className="w-8 h-8 text-orange-500" />
            <div>
              <h1 className="font-bold text-gray-900 text-lg">Admin Dashboard</h1>
              <p className="text-xs text-gray-500">Manage Users and Test Results</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')} className="text-gray-600 hover:text-gray-900">
              <Home className="w-4 h-4 mr-1.5" /> Site
            </Button>
            <Button variant="ghost" size="sm" onClick={async () => { await signOut({ callbackUrl: '/login' }); }}
              className="text-red-500 hover:bg-red-50 hover:text-red-600">
              <LogOut className="w-4 h-4 mr-1.5" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-6 py-4 space-y-6">

        {/* ── Stat Pills ── */}
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-4 mb-3">
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-orange-50 flex items-center justify-center shrink-0">
              <Users className="w-5 h-5 text-orange-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Total Users</p>
              <p className="text-xl font-bold text-gray-900">{non_admin_users.length}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm">
            <div className="w-9 h-9 rounded-lg bg-green-50 flex items-center justify-center shrink-0">
              <CheckCircle2 className="w-5 h-5 text-green-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Completed Exams</p>
              <p className="text-xl font-bold text-gray-900">{totalCompleted}</p>
            </div>
          </div>
          <div className="bg-white border border-gray-200 rounded-xl p-4 flex items-center gap-3 shadow-sm col-span-2 sm:col-span-1">
            <div className="w-9 h-9 rounded-lg bg-blue-50 flex items-center justify-center shrink-0">
              <Clock className="w-5 h-5 text-blue-500" />
            </div>
            <div>
              <p className="text-xs text-gray-400 font-medium">Active Exam</p>
              <p className="text-sm font-semibold text-gray-900 truncate max-w-[160px]">
                {exams.find(e => e.is_active)?.title ?? 'None'}
              </p>
            </div>
          </div>
        </div>

        {/* ── Exam Activation ── */}
        <Card className="border-gray-200 shadow-sm py-2">
          <CardHeader className="pb-1">
            <CardTitle>Exam Activation</CardTitle>
            <CardDescription>Only one exam should be active at a time for students.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {exams.length === 0 ? (
                <p className="text-sm text-gray-500">No exams found in the database.</p>
              ) : (
                exams.map((exam) => {
                  const disabled = isUpdatingExamId === exam.id;
                  return (
                    <div key={exam.id}
                      className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-lg border border-gray-200 bg-white p-4">
                      <div>
                        <p className="font-semibold text-gray-900">{exam.title}</p>
                        <p className="text-xs text-gray-400 font-mono">ID: {exam.id}</p>
                        <p className="text-xs text-gray-500 mt-0.5">Retry limit: {exam.retry_number ?? 'No limit'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <span className={`text-xs font-semibold px-2 py-1 rounded-full border ${
                          exam.is_active ? 'bg-green-50 text-green-700 border-green-200' : 'bg-gray-50 text-gray-600 border-gray-200'
                        }`}>
                          {exam.is_active ? 'Active' : 'Inactive'}
                        </span>
                        <Button size="sm" disabled={disabled}
                          variant={exam.is_active ? 'outline' : 'default'}
                          onClick={() => toggleExamActive(exam.id, !exam.is_active)}>
                          {disabled ? 'Updating…' : exam.is_active ? 'Deactivate' : 'Activate'}
                        </Button>
                      </div>
                    </div>
                  );
                })
              )}
            </div>
          </CardContent>
        </Card>

        {/* ── Error Banner ── */}
        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl border border-red-100 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Failed to load data</p>
              <p className="text-sm opacity-90">{error}</p>
            </div>
          </div>
        )}

        {/* ── User Table ── */}
        <div>
          {/* Table header row */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
            <div>
              <h2 className="text-xl font-bold text-gray-900">Platform Users</h2>
              <p className="text-sm text-gray-400 mt-0.5">
                Showing {filteredUsers.length} of {non_admin_users.length} users
              </p>
            </div>
            {/* Search */}
            <div className="relative w-full sm:w-72">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
              <input
                type="text"
                placeholder="Search name, email, phone…"
                value={searchQuery}
                onChange={e => setSearchQuery(e.target.value)}
                className="w-full pl-9 pr-4 h-9 text-sm rounded-lg border border-gray-200 bg-white text-gray-800 placeholder:text-gray-400 outline-none focus:border-orange-400 focus:ring-2 focus:ring-orange-100 transition-all"
              />
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-gray-100 bg-gray-50">
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">User</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap hidden md:table-cell">Phone</th>
                    <th className="text-left px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap hidden sm:table-cell">Joined</th>
                    <th className="text-center px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Exams</th>
                    <th className="text-right px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-wider whitespace-nowrap">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredUsers.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="text-center py-12 text-gray-400 text-sm italic">
                        {searchQuery ? 'No users match your search.' : 'No users found.'}
                      </td>
                    </tr>
                  ) : (
                    filteredUsers.map((user) => {
                      const isExpanded = expandedUserId === user.id;
                      const completedExams = user.user_exams.filter(e => e.status === 'completed');
                      const latestScore = user.user_exams[0];

                      return (
                        <Fragment key={user.id}>
                          <tr
                            key={user.id}
                            className={`border-b border-gray-100 hover:bg-orange-50/40 transition-colors cursor-pointer ${isExpanded ? 'bg-orange-50/30' : ''}`}
                            onClick={() => toggleExpand(user.id)}
                          >
                            {/* User */}
                            <td className="px-4 py-3">
                              <div className="flex items-center gap-3">
                                <div className="w-8 h-8 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 text-xs font-bold shrink-0">
                                  {getInitial(user)}
                                </div>
                                <div className="min-w-0">
                                  <p className="font-semibold text-gray-900 truncate max-w-[180px]">
                                    {user.full_name || 'No Name'}
                                  </p>
                                  <p className="text-xs text-gray-400 truncate max-w-[180px]">{user.email}</p>
                                </div>
                              </div>
                            </td>

                            {/* Phone */}
                            <td className="px-4 py-3 hidden md:table-cell">
                              <span className="text-xs text-gray-600 font-mono">
                                {user.phonenumber || <span className="text-gray-300">—</span>}
                              </span>
                            </td>

                            {/* Joined */}
                            <td className="px-4 py-3 hidden sm:table-cell">
                              <span className="text-xs text-gray-500">
                                {new Date(user.created_at).toLocaleDateString()}
                              </span>
                            </td>

                            {/* Exams */}
                            <td className="px-4 py-3 text-center">
                              <div className="flex items-center justify-center gap-1">
                                <span className="text-green-600 font-bold">{completedExams.length}</span>
                                <span className="text-gray-400 text-xs">/ {user.user_exams.length}</span>
                              </div>
                              {latestScore && latestScore.total_score !== null && (
                                <Badge variant="outline" className="text-[10px] mt-0.5 border-orange-200 text-orange-700 bg-orange-50">
                                  {latestScore.total_score}/{latestScore.max_score}
                                </Badge>
                              )}
                            </td>

                            {/* Actions */}
                            <td className="px-4 py-3">
                              <div className="flex items-center justify-end gap-2" onClick={e => e.stopPropagation()}>
                                <Button
                                  size="sm"
                                  variant="outline"
                                  className="h-7 px-2.5 text-xs text-gray-600 hover:text-orange-600 hover:border-orange-300 gap-1"
                                  onClick={() => exportUserReport(user)}
                                  title="Export report"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span className="hidden sm:inline">Export</span>
                                </Button>
                                <button
                                  className="w-7 h-7 flex items-center justify-center rounded-md bg-gray-100 hover:bg-gray-200 transition-colors"
                                  onClick={() => toggleExpand(user.id)}
                                  aria-label={isExpanded ? 'Collapse' : 'Expand'}
                                >
                                  {isExpanded
                                    ? <ChevronUp className="w-4 h-4 text-gray-500" />
                                    : <ChevronDown className="w-4 h-4 text-gray-500" />}
                                </button>
                              </div>
                            </td>
                          </tr>

                          {/* Expanded detail row */}
                          {isExpanded && (
                            <ExpandedRow key={`${user.id}-expanded`} user={user} colSpan={5} />
                          )}
                        </Fragment>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}

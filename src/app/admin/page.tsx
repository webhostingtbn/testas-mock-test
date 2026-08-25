'use client';

import { useEffect, useState, useMemo, Fragment } from 'react';
import { useRouter } from 'next/navigation';
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
  allow_test_limit: number;
  status?: string | null;
  format?: string | null;
  module_test?: string | null;
}

const MODULE_OPTIONS = [
  { value: 'economics', label: 'Economics' },
  { value: 'engineering', label: 'Engineering' },
  { value: 'natural_computer_science', label: 'Natural & CS' },
] as const;

const FORMAT_OPTIONS = [
  { value: 'Digital', label: 'Digital' },
  { value: 'Paper', label: 'Paper' },
] as const;

interface ExamConfig {
  id: string;
  title: string;
  is_active: boolean;
  retry_number: number | null;
  created_at: string;
  format: string | null;
}

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
                `      ${qLabel}. ${correct}  User: ${formatAnsValue(ans.user_answer)}`
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
  a.download = `user_report_${(user.full_name || user.email).replace(/[^a-z0-9]/gi, '_')}.txt`;
  a.click();
  URL.revokeObjectURL(url);
}

export default function AdminPage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<ProfileWithExams[]>([]);
  const [exams, setExams] = useState<ExamConfig[]>([]);
  const [isUpdatingExamId, setIsUpdatingExamId] = useState<string | null>(null);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);

  useEffect(() => {
    async function checkAdminAndFetchData() {
      if (status === 'loading') return;
      try {
        if (!session?.user) { router.push('/login'); return; }

        const usersRes = await fetch('/api/admin/users');
        if (usersRes.status === 403) {
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }
        if (!usersRes.ok) throw new Error('Failed to load admin user data');

        const usersData = await usersRes.json();
        setIsAdmin(true);

        const formattedUsers = (usersData.users || []).map((u: any) => ({
          ...u,
          user_exams: (u.user_exams || []).sort(
            (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          ),
        }));

        setUsers(formattedUsers as ProfileWithExams[]);

        const examsRes = await fetch('/api/exams');
        if (examsRes.ok) {
          const examsData = await examsRes.json();
          setExams((examsData.exams || []) as ExamConfig[]);
        }
      } catch (err: any) {
        setError(err.message || 'An error occurred fetching data.');
      } finally {
        setIsLoading(false);
      }
    }
    checkAdminAndFetchData();
  }, [router, session, status]);

  const toggleExpand = (userId: string) =>
    setExpandedUserId(prev => (prev === userId ? null : userId));

  const toggleExamActive = async (examId: string, shouldActivate: boolean) => {
    setIsUpdatingExamId(examId);
    try {
      const res = await fetch(`/api/admin/exams/${examId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_active: shouldActivate }),
      });
      if (!res.ok) throw new Error('Failed to update exam state');

      setExams(prev =>
        prev.map(e => (e.id === examId ? { ...e, is_active: shouldActivate } : e))
      );
    } catch (err: any) {
      setError(err?.message || 'Failed to update exam activation.');
    } finally {
      setIsUpdatingExamId(null);
    }
  };

  const updateUser = async (userId: string, updates: Partial<{ status: string; format: string; module_test: string; allow_test_limit: number }>) => {
    try {
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updates),
      });
      if (!res.ok) throw new Error('Failed to update user');
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, ...updates } : u));
    } catch (caught: unknown) {
      setError(caught instanceof Error ? caught.message : 'Failed to update user.');
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
      if (!res.ok) throw new Error('Failed to update user limit');
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
      const res = await fetch('/api/admin/users/bulk', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allow_test_limit: limit }),
      });
      if (!res.ok) throw new Error('Failed to update limits');
      setUsers(prev => prev.map(u => u.role === 'admin' ? u : { ...u, allow_test_limit: limit }));
      alert(`Successfully updated test limit to ${limit} for all normal users.`);
    } catch (err: any) {
      setError(err.message || 'Failed to update limits');
    } finally {
      setIsUpdatingLimit(false);
    }
  };

  const filteredUsers = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return users;
    return users.filter(u =>
      (u.full_name && u.full_name.toLowerCase().includes(q)) ||
      u.email.toLowerCase().includes(q) ||
      (u.phonenumber && u.phonenumber.includes(q))
    );
  }, [users, searchQuery]);

  const totalExamsTaken = useMemo(
    () => users.reduce((acc, u) => acc + u.user_exams.length, 0),
    [users]
  );
  const totalCompleted = useMemo(
    () => users.reduce((acc, u) => acc + u.user_exams.filter(e => e.status === 'completed').length, 0),
    [users]
  );

  if (isLoading || status === 'loading') {
    return (
      <div className="flex h-screen items-center justify-center bg-slate-900 text-slate-100">
        <div className="flex flex-col items-center gap-3">
          <Clock className="h-8 w-8 animate-spin text-indigo-400" />
          <p className="text-sm text-slate-400 font-medium">Verifying admin credentials...</p>
        </div>
      </div>
    );
  }

  if (isAdmin === false) {
    return (
      <div className="flex h-screen flex-col items-center justify-center bg-slate-900 px-4 text-center">
        <div className="rounded-full bg-red-500/10 p-4 text-red-400 mb-4">
          <ShieldAlert className="h-10 w-10" />
        </div>
        <h1 className="text-2xl font-bold text-slate-100">Access Denied</h1>
        <p className="mt-2 text-sm text-slate-400 max-w-sm">
          You do not have administrator permissions to view this control panel.
        </p>
        <Button onClick={() => router.push('/dashboard')} className="mt-6 gap-2 bg-indigo-600 hover:bg-indigo-500">
          <Home className="h-4 w-4" /> Return to Dashboard
        </Button>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans pb-16">
      <header className="sticky top-0 z-20 border-b border-slate-800/80 bg-slate-900/80 backdrop-blur-md px-6 py-4">
        <div className="mx-auto flex max-w-7xl items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-indigo-600 text-white font-bold">
              <UserSquare className="h-5 w-5" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-slate-100 leading-none">Admin Control Panel</h1>
              <p className="text-xs text-slate-400 mt-0.5">Manage Users & Exam Permissions</p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <Button variant="outline" size="sm" onClick={() => router.push('/dashboard')} className="gap-2 border-slate-700 text-slate-300 hover:bg-slate-800">
              <Home className="h-4 w-4" /> Dashboard
            </Button>
            <Button variant="ghost" size="sm" onClick={() => signOut({ callbackUrl: '/login' })} className="gap-2 text-slate-400 hover:bg-slate-800 hover:text-white">
              <LogOut className="h-4 w-4" /> Sign out
            </Button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl px-6 pt-8 space-y-8">
        {error && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-400 flex items-center justify-between">
            <span>{error}</span>
            <Button size="sm" variant="ghost" onClick={() => setError(null)} className="h-auto p-1 text-red-400 hover:bg-red-500/20">✕</Button>
          </div>
        )}

        <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Registered Users</CardTitle>
              <Users className="h-4 w-4 text-indigo-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{users.length}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Attempts Initiated</CardTitle>
              <Clock className="h-4 w-4 text-amber-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{totalExamsTaken}</div>
            </CardContent>
          </Card>
          <Card className="border-slate-800 bg-slate-900/60">
            <CardHeader className="flex flex-row items-center justify-between pb-2">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-slate-400">Total Exams Completed</CardTitle>
              <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            </CardHeader>
            <CardContent>
              <div className="text-2xl font-bold text-white">{totalCompleted}</div>
            </CardContent>
          </Card>
        </div>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-white">Global Exam Activation Settings</CardTitle>
            <CardDescription className="text-xs text-slate-400">Toggle which exams are enabled for student selection.</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="divide-y divide-slate-800">
              {exams.map(exam => (
                <div key={exam.id} className="flex items-center justify-between py-3">
                  <div>
                    <div className="font-medium text-sm text-slate-200">{exam.title}</div>
                    <div className="text-xs text-slate-500">Format: {exam.format || 'Digital'} • Retry Limit: {exam.retry_number ?? 'Default'}</div>
                  </div>
                  <Button
                    size="sm"
                    variant={exam.is_active ? "default" : "outline"}
                    disabled={isUpdatingExamId === exam.id}
                    onClick={() => toggleExamActive(exam.id, !exam.is_active)}
                    className={exam.is_active ? "bg-emerald-600 hover:bg-emerald-500" : "border-slate-700 text-slate-400"}
                  >
                    {exam.is_active ? 'Active' : 'Disabled'}
                  </Button>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <Card className="border-slate-800 bg-slate-900/60">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="text-base font-semibold text-white">Registered Users & Test Limits</CardTitle>
              <CardDescription className="text-xs text-slate-400">Review student activity and adjust exam limits.</CardDescription>
            </div>
            <div className="flex items-center gap-3">
              <div className="relative w-64">
                <Search className="absolute left-3 top-2.5 h-4 w-4 text-slate-500" />
                <input
                  type="text"
                  placeholder="Search user..."
                  value={searchQuery}
                  onChange={e => setSearchQuery(e.target.value)}
                  className="w-full rounded-lg bg-slate-800/80 border border-slate-700 pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder:text-slate-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                />
              </div>
              <Button size="sm" onClick={updateAllUsersLimit} disabled={isUpdatingLimit} className="bg-indigo-600 hover:bg-indigo-500 text-xs">
                Set Global Limit
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs text-slate-300">
                <thead className="border-b border-slate-800 bg-slate-900/80 uppercase tracking-wider text-slate-500">
                  <tr>
                    <th className="p-3">User</th>
                    <th className="p-3">Role</th>
                    <th className="p-3">Phone</th>
                    <th className="p-3">Module</th>
                    <th className="p-3">Format</th>
                    <th className="p-3">Attempts Used</th>
                    <th className="p-3">Allowed Limit</th>
                    <th className="p-3 text-right">Actions</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-800/60">
                  {filteredUsers.map(user => (
                    <Fragment key={user.id}>
                      <tr className="hover:bg-slate-800/40">
                        <td className="p-3">
                          <div className="flex items-center gap-2.5">
                            <div className="flex h-7 w-7 items-center justify-center rounded-full bg-slate-800 font-semibold text-indigo-400">
                              {getInitial(user)}
                            </div>
                            <div>
                              <div className="font-medium text-slate-200">{user.full_name || 'N/A'}</div>
                              <div className="text-slate-500 text-[11px]">{user.email}</div>
                            </div>
                          </div>
                        </td>
                        <td className="p-3">
                          <Badge variant={user.role === 'admin' ? 'default' : 'secondary'} className={user.role === 'admin' ? 'bg-indigo-600' : 'bg-slate-800 text-slate-400'}>
                            {user.role || 'user'}
                          </Badge>
                        </td>
                        <td className="p-3 text-slate-400">{user.phonenumber || '-'}</td>
                        <td className="p-3">
                          <select
                            aria-label="Select module"
                            value={user.module_test || ''}
                            onChange={(e) => updateUser(user.id, { module_test: e.target.value })}
                            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            <option value="" disabled>Select Module</option>
                            {MODULE_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3">
                          <select
                            aria-label="Select format"
                            value={user.format || 'Digital'}
                            onChange={(e) => updateUser(user.id, { format: e.target.value })}
                            className="rounded-md border border-slate-700 bg-slate-800 px-2 py-1 text-xs text-slate-200 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                          >
                            {FORMAT_OPTIONS.map((opt) => (
                              <option key={opt.value} value={opt.value}>{opt.label}</option>
                            ))}
                          </select>
                        </td>
                        <td className="p-3 font-semibold">{user.user_exams.length}</td>
                        <td className="p-3 font-semibold text-indigo-400">{user.allow_test_limit}</td>
                        <td className="p-3 text-right space-x-2">
                          <Button size="sm" variant="ghost" onClick={() => updateUserLimit(user.id, user.allow_test_limit)} disabled={isUpdatingLimit} className="text-slate-400 hover:text-white">
                            Edit Limit
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => exportUserReport(user)} className="border-slate-700 text-slate-300">
                            <Download className="h-3.5 w-3.5 mr-1" /> Export
                          </Button>
                          <Button size="sm" variant="ghost" onClick={() => toggleExpand(user.id)} className="text-slate-400">
                            {expandedUserId === user.id ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
                          </Button>
                        </td>
                      </tr>
                      {expandedUserId === user.id && (
                        <tr>
                          <td colSpan={8} className="bg-slate-900/90 p-4">
                            <h4 className="font-semibold text-xs text-slate-400 uppercase tracking-wider mb-2">Exam History ({user.user_exams.length})</h4>
                            {user.user_exams.length === 0 ? (
                              <p className="text-xs text-slate-500">No exam attempts recorded.</p>
                            ) : (
                              <div className="space-y-2">
                                {user.user_exams.map(exam => (
                                  <div key={exam.id} className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950 p-2.5 text-xs">
                                    <div>
                                      <span className="font-medium text-slate-300">Date: {new Date(exam.created_at).toLocaleString()}</span>
                                      <span className="ml-3 text-slate-500">Status: {exam.status}</span>
                                    </div>
                                    <div className="font-semibold text-indigo-400">
                                      Score: {exam.total_score ?? '-'} / {exam.max_score ?? '-'}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  ))}
                </tbody>
              </table>
            </div>
          </CardContent>
        </Card>
      </main>
    </div>
  );
}

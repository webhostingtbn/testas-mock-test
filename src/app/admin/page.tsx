'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { LogOut, ChevronDown, ChevronUp, UserSquare, Home, ShieldAlert } from 'lucide-react';

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
}

export default function AdminPage() {
  const router = useRouter();
  const     supabase = createClient();
  const [isAdmin, setIsAdmin] = useState<boolean | null>(null);
  const [users, setUsers] = useState<ProfileWithExams[]>([]);
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function checkAdminAndFetchData() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          router.push('/login');
          return;
        }

        // 1. Check if the user is admin
        const { data: profile } = await supabase
          .from('profiles')
          .select('role')
          .eq('id', user.id)
          .single();
        // console.log("me: ", profile);

        if (profile?.role !== 'admin') {
          setIsAdmin(false);
          setIsLoading(false);
          return;
        }

        setIsAdmin(true);

        // 2. Fetch all users and their user_exams
        const { data: allUsers, error: fetchError } = await supabase
          .from('profiles')
          .select(`
            id, email, full_name, role, created_at,
            user_exams (
              id, created_at, status, total_score, max_score, detailed_results
            )
          `)
          .order('created_at', { ascending: false });

        if (fetchError) {
          throw fetchError;
        }

        // Sort exams for each user by newest first
        const formattedUsers = (allUsers || []).map(u => ({
          ...u,
          user_exams: (u.user_exams || []).sort(
            (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        }));

        setUsers(formattedUsers as ProfileWithExams[]);
      } catch (err: any) {
        console.error('Admin fetch error:', err);
        setError(err.message || 'An error occurred fetching data.');
      } finally {
        setIsLoading(false);
      }
    }

    checkAdminAndFetchData();
  }, [router, supabase]);

  const toggleExpand = (userId: string) => {
    setExpandedUserId((prev) => (prev === userId ? null : userId));
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50">
        <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
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

  console.log("Users with exams:", users);

  return (
    <div className="min-h-screen bg-gray-50/50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white sticky top-0 z-10">
        <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <UserSquare className="w-8 h-8 text-orange-500" />
            <div>
              <h1 className="font-bold text-gray-900 text-lg">Admin Dashboard</h1>
              <p className="text-xs text-gray-500">Manage Users and Test Results</p>
            </div>
          </div>
          <div className="flex gap-3">
            <Button
              variant="outline"
              size="sm"
              onClick={() => router.push('/dashboard')}
              className="text-gray-600 hover:text-gray-900"
            >
              <Home className="w-4 h-4 mr-1.5" /> Site
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={async () => {
                await supabase.auth.signOut();
                router.push('/login');
              }}
              className="text-red-500 hover:bg-red-50 hover:text-red-600"
            >
              <LogOut className="w-4 h-4 mr-1.5" /> Logout
            </Button>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="mb-6 flex justify-between items-end">
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Platform Users</h2>
            <p className="text-gray-500 text-sm mt-1">Total registered users: {users.length}</p>
          </div>
        </div>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-xl mb-6 border border-red-100 flex items-start gap-3">
            <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
            <div>
              <p className="font-bold">Failed to load data</p>
              <p className="text-sm opacity-90">{error}</p>
              <p className="text-xs mt-2 opacity-70">
                Make sure you have an RLS policy on your tables allowing admins to SELECT.
              </p>
            </div>
          </div>
        )}

        <div className="space-y-4">
          {users.map((user) => {
            const isExpanded = expandedUserId === user.id;
            const completedExams = user.user_exams.filter(e => e.status === 'completed');

            return (
              <Card key={user.id} className="border-gray-200 shadow-sm overflow-hidden transition-all duration-200">
                <button
                  onClick={() => toggleExpand(user.id)}
                  className="w-full flex items-center justify-between p-5 bg-white hover:bg-gray-50 transition-colors text-left"
                >
                  <div className="flex items-center gap-4">
                    <div className="w-10 h-10 rounded-full bg-orange-100 flex items-center justify-center text-orange-600 font-bold shrink-0">
                      {(user.full_name || user.email || '?')[0].toUpperCase()}
                    </div>
                    <div>
                      <p className="font-bold text-gray-900">
                        {user.full_name || 'No Name Provided'}
                        {user.role === 'admin' && (
                          <span className="ml-2 text-[10px] bg-red-100 text-red-700 px-2 py-0.5 rounded-full font-bold uppercase">Admin</span>
                        )}
                      </p>
                      <p className="text-sm text-gray-500">{user.email}</p>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-6">
                    <div className="text-right hidden sm:block">
                      <p className="text-xs text-gray-400 font-medium">Joined</p>
                      <p className="text-sm text-gray-700 font-medium">
                        {new Date(user.created_at).toLocaleDateString()}
                      </p>
                    </div>
                    <div className="text-right">
                      <p className="text-xs text-gray-400 font-medium">Exams Taken</p>
                      <p className="text-sm text-gray-700 font-medium">
                        <span className="text-green-600 font-bold">{completedExams.length}</span> / {user.user_exams.length}
                      </p>
                    </div>
                    <div className="w-6 h-6 flex items-center justify-center rounded-full bg-gray-100">
                      {isExpanded ? (
                        <ChevronUp className="w-4 h-4 text-gray-500" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-gray-500" />
                      )}
                    </div>
                  </div>
                </button>

                {isExpanded && (
                  <div className="border-t border-gray-100 bg-gray-50/50 p-5">
                    <h4 className="font-semibold text-gray-800 mb-4 text-sm uppercase tracking-wider">Exam History</h4>
                    
                    {user.user_exams.length === 0 ? (
                      <p className="text-sm text-gray-500 italic py-4">No exams taken yet.</p>
                    ) : (
                      <div className="space-y-4">
                        {user.user_exams.map((exam) => (
                          <div key={exam.id} className="bg-white border border-gray-200 rounded-xl p-4 shadow-xs">
                            <div className="flex flex-wrap sm:flex-nowrap justify-between gap-4 mb-4 pb-4 border-b border-gray-100">
                              <div>
                                <div className="flex items-center gap-2 mb-1">
                                  <span className={`text-xs font-bold px-2 py-0.5 rounded-md ${
                                    exam.status === 'completed' ? 'bg-green-100 text-green-700' : 'bg-amber-100 text-amber-700'
                                  }`}>
                                    {exam.status.toUpperCase()}
                                  </span>
                                  <span className="text-sm text-gray-500 font-medium">
                                    {new Date(exam.created_at).toLocaleString()}
                                  </span>
                                </div>
                                <p className="text-xs text-gray-400 font-mono">ID: {exam.id}</p>
                              </div>
                              <div className="text-right">
                                <p className="text-xs text-gray-500 uppercase font-semibold">Total Score</p>
                                <p className="text-lg font-bold text-gray-900">
                                  {exam.total_score ?? '-'}<span className="text-gray-400 text-sm font-normal"> / {exam.max_score ?? '-'}</span>
                                </p>
                              </div>
                            </div>

                            {/* Detailed Results Summary */}
                            <div>
                              <p className="text-xs font-bold text-gray-500 uppercase mb-2">Detailed Results Map:</p>
                              {exam.detailed_results && Object.keys(exam.detailed_results).length > 0 ? (
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                  {Object.entries(exam.detailed_results).map(([sectionTitle, sectionData]) => {
                                    const isLegacy = Array.isArray(sectionData);
                                    const answers: any[] = isLegacy ? sectionData : (sectionData as any).answers || [];
                                    const scoreStr = isLegacy ? null : `${(sectionData as any).score} / ${(sectionData as any).max_score}`;
                                    
                                    return (
                                    <div key={sectionTitle} className="bg-gray-50 border border-gray-100 rounded-lg p-3">
                                      <div className="flex justify-between items-center border-b border-gray-200 pb-1 mb-2">
                                        <p className="text-xs font-bold text-gray-700">
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
                                          {answers.length > 0 ? answers.map((ans, idx) => {
                                            let displayAns = '-';
                                            let bgClass = 'bg-white border-gray-200 text-gray-700';
                                            let titleStr = undefined;

                                            // Check if it's the new verbose object format
                                            if (ans && typeof ans === 'object' && 'user_answer' in ans) {
                                              const uAns = ans.user_answer;
                                              const cAns = ans.correct_answer;
                                              
                                              if (uAns !== null && uAns !== undefined) {
                                                if (Array.isArray(uAns)) displayAns = `[${uAns.join(', ')}]`;
                                                else if (typeof uAns === 'object') displayAns = Object.entries(uAns).map(([k, v]) => `${k}:${v}`).join(', ');
                                                else displayAns = String(uAns);
                                              }
                                              
                                              if (cAns !== undefined) {
                                                let cAnsStr = String(cAns);
                                                if (Array.isArray(cAns)) cAnsStr = `[${cAns.join(', ')}]`;
                                                else if (cAns && typeof cAns === 'object') {
                                                  cAnsStr = Object.entries(cAns).map(([k, v]) => `${k}:${v}`).join(', ');
                                                }
                                                titleStr = `Correct answer: ${cAnsStr}`;
                                              }

                                              bgClass = ans.is_correct 
                                                ? 'bg-green-50 border-green-200 text-green-700' 
                                                : 'bg-red-50 border-red-200 text-red-700';
                                            } else {
                                              // Legacy fallback
                                              if (ans !== null && ans !== undefined) {
                                                if (Array.isArray(ans)) displayAns = `[${ans.join(', ')}]`;
                                                else if (typeof ans === 'object') displayAns = Object.entries(ans).map(([k, v]) => `${k}:${v}`).join(', ');
                                                else displayAns = String(ans);
                                              }
                                            }

                                            return (
                                              <span 
                                                key={idx} 
                                                title={titleStr}
                                                className={`inline-flex items-center justify-center px-2 py-1 min-h-6 border text-xs font-mono rounded whitespace-nowrap shadow-sm ${bgClass}`}
                                              >
                                                <span className="opacity-50 mr-1.5 font-normal">Q{idx + 1}.</span> 
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
                                  )})}
                                </div>
                              ) : (
                                <p className="text-xs text-gray-400 italic">No detailed records found for this attempt.</p>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </Card>
            );
          })}
        </div>
      </main>
    </div>
  );
}

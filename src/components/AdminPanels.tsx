'use client';
/* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unused-vars */

import { useState, useEffect } from 'react';
import { KniCard, KniButton, KniBadge } from '@/components/KniPrimitives';

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

export function AdminUsersPanel() {
  const [users, setUsers] = useState<ProfileWithExams[]>([]);
  const [exams, setExams] = useState<ExamConfig[]>([]);
  const [isUpdatingExamId, setIsUpdatingExamId] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isUpdatingLimit, setIsUpdatingLimit] = useState(false);

  useEffect(() => {
    async function fetchAdminData() {
      try {
        const usersRes = await fetch('/api/admin/users');
        if (!usersRes.ok) throw new Error('Failed to load admin user data');
        const usersData = await usersRes.json();

        const formattedUsers = (usersData.users || []).map((u: any) => ({
          ...u,
          user_exams: (u.user_exams || []).sort(
            (a: any, b: any) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
          )
        }));
        setUsers(formattedUsers as ProfileWithExams[]);

        const examsRes = await fetch('/api/exams');
        if (examsRes.ok) {
          const examsData = await examsRes.json();
          setExams((examsData.exams || []) as ExamConfig[]);
        }
      } catch (err: any) {
        console.error('Admin fetch error:', err);
        setError(err.message || 'An error occurred fetching data.');
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
      const res = await fetch(`/api/admin/users/${userId}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ allow_test_limit: limit }),
      });
      if (!res.ok) throw new Error('Failed to update limit');
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

  if (isLoading) {
    return (
      <div className="p-8 text-center text-muted-foreground">
        Loading admin panel data...
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-4 bg-destructive/10 text-destructive rounded-lg">
          {error}
        </div>
      )}

      <KniCard className="p-6">
        <h3 className="text-lg font-bold mb-4">Exam Configuration & Activation</h3>
        <div className="space-y-3">
          {exams.map(exam => (
            <div key={exam.id} className="flex items-center justify-between p-3 border rounded-lg">
              <div>
                <p className="font-semibold">{exam.title}</p>
                <p className="text-xs text-muted-foreground">Format: {exam.format || 'Digital'}</p>
              </div>
              <KniButton
                variant={exam.is_active ? 'primary' : 'outline'}
                onClick={() => toggleExamActive(exam.id, !exam.is_active)}
                disabled={isUpdatingExamId === exam.id}
              >
                {exam.is_active ? 'Active' : 'Disabled'}
              </KniButton>
            </div>
          ))}
        </div>
      </KniCard>

      <KniCard className="p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-bold">User Management & Limits</h3>
          <KniButton onClick={updateAllUsersLimit} disabled={isUpdatingLimit}>
            Set All Normal Users Limit
          </KniButton>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead>
              <tr className="border-b text-xs uppercase text-muted-foreground">
                <th className="p-2">Name / Email</th>
                <th className="p-2">Role</th>
                <th className="p-2">Attempts</th>
                <th className="p-2">Limit</th>
                <th className="p-2 text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {users.map(user => (
                <tr key={user.id} className="border-b">
                  <td className="p-2">
                    <p className="font-medium">{user.full_name || 'N/A'}</p>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </td>
                  <td className="p-2">
                    <KniBadge status={user.role || 'user'} />
                  </td>
                  <td className="p-2 font-semibold">{user.user_exams.length}</td>
                  <td className="p-2 font-semibold text-primary">{user.allow_test_limit ?? 1}</td>
                  <td className="p-2 text-right space-x-2">
                    <KniButton
                      variant="outline"
                      onClick={() => updateUserLimit(user.id, user.allow_test_limit ?? 1)}
                      disabled={isUpdatingLimit}
                    >
                      Edit Limit
                    </KniButton>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </KniCard>
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

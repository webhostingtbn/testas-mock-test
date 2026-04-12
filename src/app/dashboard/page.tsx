import React from 'react';
import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const session = await auth();

  console.log('[DashboardPage] Session check:', {
    hasSession: !!session,
    hasUser: !!session?.user,
    userEmail: session?.user?.email || 'N/A',
    userId: session?.user?.id || 'N/A',
  });

  if (!session?.user?.email) {
    console.warn('[DashboardPage] Redirecting to login - no valid session');
    redirect('/login');
  }

  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-orange-50 via-white to-amber-50">
          <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      }
    >
      {/* DashboardClient is a client component that uses client-only hooks like useSearchParams */}
      <DashboardClient session={session} />
    </Suspense>
  );
}

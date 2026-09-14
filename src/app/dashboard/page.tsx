import React from 'react';
import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';
import { DashboardLoadingShell } from '@/components/dashboard/DashboardSkeleton';

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
    <Suspense fallback={<DashboardLoadingShell />}>
      {/* DashboardClient is a client component that uses client-only hooks like useSearchParams */}
      <DashboardClient session={session} />
    </Suspense>
  );
}

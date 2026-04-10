import React from 'react';
import { Suspense } from 'react';
import DashboardClient from './DashboardClient';

export default function DashboardPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-orange-50 via-white to-amber-50">
          <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
        </div>
      }
    >
      {/* DashboardClient is a client component that uses client-only hooks like useSearchParams */}
      <DashboardClient />
    </Suspense>
  );
}

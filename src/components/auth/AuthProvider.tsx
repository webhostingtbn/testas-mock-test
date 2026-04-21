'use client';

import { SessionProvider } from 'next-auth/react';
import React from 'react';

export function AuthProvider({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider 
      refetchOnWindowFocus={false} // Prevents a request every time you switch tabs/windows
      refetchInterval={5 * 60}     // Only refresh session every 5 minutes (optional)
    >
      {children}
    </SessionProvider>
  );
}

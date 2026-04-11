'use client';

import { LoginButton } from '@/components/auth/LoginButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';
import { Suspense } from 'react';
import ErrorMessage from './ErrorMessage';
import Image from 'next/image';

export default function LoginPage() {

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-orange-50 via-white to-amber-50 p-4">
      {/* ...existing code... */}
      <div className="relative z-10 w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8 flex flex-col items-center">
          <Image 
            src="/logo.webp" 
            alt="TestAS Logo" 
            width={80} 
            height={80} 
            priority
            className="w-20 h-auto mb-4" 
          />
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            TestAS
            <span className="text-orange-600"> Mock Test</span>
          </h1>
          <p className="text-gray-500 mt-2">
            Practice the real exam experience
          </p>
        </div>

        <Card className="border-0 shadow-xl shadow-gray-200/50 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-xl">Welcome</CardTitle>
            <CardDescription>
              Sign in with your Google account to get started
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4">
            <Suspense fallback={null}>
              <ErrorMessage />
            </Suspense>
            
            <LoginButton />

            <div className="mt-6 flex items-center gap-3 text-xs text-gray-400">
              <BookOpen className="w-4 h-4 shrink-0" />
              <p>By signing in, you agree to take the mock test under exam conditions.</p>
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

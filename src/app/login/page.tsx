'use client';

import { LoginButton } from '@/components/auth/LoginButton';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen } from 'lucide-react';

export default function LoginPage() {

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-orange-50 via-white to-amber-50 p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-orange-100/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-amber-100/60 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-150 h-150 rounded-full bg-orange-50/40 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-md">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <img src="/logo.avif" alt="TestAS Logo" className="w-20 h-auto mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            TestAS
            <span className="text-orange-600"> Mock Test</span>
          </h1>
          <p className="text-gray-500 mt-2">
            Practice the real exam experience
          </p>
        </div>

        {step === 'login' ? (
          <Card className="border-0 shadow-xl shadow-gray-200/50 bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl">Welcome</CardTitle>
              <CardDescription>
                Sign in with your Google account to get started
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4">
              <LoginButton />

              <div className="mt-6 flex items-center gap-3 text-xs text-gray-400">
                <BookOpen className="w-4 h-4 shrink-0" />
                <p>By signing in, you agree to take the mock test under exam conditions.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div>Major selection would go here (optional)</div>
        )}
      </div>
    </div>
  );
}

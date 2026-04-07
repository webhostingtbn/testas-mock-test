'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { MAJOR_LABELS } from '@/lib/constants';
import type { MajorType } from '@/lib/types';
import { BookOpen, GraduationCap, ChevronRight } from 'lucide-react';

const majors: { value: MajorType; label: string; icon: string; description: string }[] = [
  {
    value: 'economics',
    label: MAJOR_LABELS.economics,
    icon: '📊',
    description: 'Business, Economics, and Social Sciences',
  },
  {
    value: 'engineering',
    label: MAJOR_LABELS.engineering,
    icon: '⚙️',
    description: 'Engineering, Informatics, and Mathematics',
  },
  {
    value: 'natural_computer_science',
    label: MAJOR_LABELS.natural_computer_science,
    icon: '🔬',
    description: 'Natural Sciences and Computer Science',
  },
];

export default function LoginPage() {
  const [selectedMajor, setSelectedMajor] = useState<MajorType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [step, setStep] = useState<'login' | 'major'>('login');
  const router = useRouter();
  const supabase = createClient();

  const handleGoogleLogin = async () => {
    setIsLoading(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: 'google',
        options: {
          redirectTo: `${window.location.origin}/auth/callback`,
        },
      });
      if (error) throw error;
    } catch (err) {
      console.error('Login error:', err);
      setIsLoading(false);
    }
  };

  const handleMajorSelect = async () => {
    if (!selectedMajor) return;
    setIsLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('profiles')
        .update({ major: selectedMajor })
        .eq('id', user.id);

      if (error) throw error;
      router.push('/select-module');
    } catch (err) {
      console.error('Error saving major:', err);
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-orange-50 via-white to-amber-50 p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-orange-100/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-amber-100/60 blur-3xl" />
        <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full bg-orange-50/40 blur-3xl" />
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
              <Button
                onClick={handleGoogleLogin}
                disabled={isLoading}
                className="w-full h-12 text-base font-medium bg-white hover:bg-gray-50 text-gray-700 border border-gray-300 shadow-sm transition-all duration-200 hover:shadow-md"
                variant="outline"
              >
                {isLoading ? (
                  <div className="flex items-center gap-3">
                    <div className="w-5 h-5 border-2 border-gray-300 border-t-orange-500 rounded-full animate-spin" />
                    Connecting...
                  </div>
                ) : (
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5" viewBox="0 0 24 24">
                      <path
                        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"
                        fill="#4285F4"
                      />
                      <path
                        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                        fill="#34A853"
                      />
                      <path
                        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
                        fill="#FBBC05"
                      />
                      <path
                        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
                        fill="#EA4335"
                      />
                    </svg>
                    Sign in with Google
                  </div>
                )}
              </Button>

              <div className="mt-6 flex items-center gap-3 text-xs text-gray-400">
                <BookOpen className="w-4 h-4 shrink-0" />
                <p>By signing in, you agree to take the mock test under exam conditions.</p>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Card className="border-0 shadow-xl shadow-gray-200/50 bg-white/80 backdrop-blur-sm">
            <CardHeader className="text-center pb-2">
              <CardTitle className="text-xl">Select Your Major</CardTitle>
              <CardDescription>
                Choose the subject module you want to take
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-4 space-y-3">
              {majors.map((major) => (
                <button
                  key={major.value}
                  onClick={() => setSelectedMajor(major.value)}
                  className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left ${
                    selectedMajor === major.value
                      ? 'border-orange-500 bg-orange-50 shadow-md shadow-orange-100'
                      : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                  }`}
                >
                  <span className="text-2xl">{major.icon}</span>
                  <div className="flex-1">
                    <Label className="text-sm font-semibold text-gray-900 cursor-pointer">
                      {major.label}
                    </Label>
                    <p className="text-xs text-gray-500 mt-0.5">{major.description}</p>
                  </div>
                  {selectedMajor === major.value && (
                    <div className="w-5 h-5 rounded-full bg-orange-500 flex items-center justify-center">
                      <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                      </svg>
                    </div>
                  )}
                </button>
              ))}

              <Button
                onClick={handleMajorSelect}
                disabled={!selectedMajor || isLoading}
                className="w-full h-12 mt-4 text-base font-medium bg-gradient-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-200 transition-all duration-200"
              >
                {isLoading ? (
                  <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                ) : (
                  <div className="flex items-center gap-2">
                    Continue
                    <ChevronRight className="w-4 h-4" />
                  </div>
                )}
              </Button>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  );
}

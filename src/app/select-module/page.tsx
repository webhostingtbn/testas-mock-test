'use client';

import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { createClient } from '@/lib/supabase/client';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { MODULE_TEST_OPTIONS } from '@/lib/constants';
import { GraduationCap, ChevronRight, Sparkles, Clock, FileText, CheckCircle2 } from 'lucide-react';
import type { ModuleTestType } from '@/lib/types';

export default function SelectModulePage() {
  const [selectedModule, setSelectedModule] = useState<ModuleTestType | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isCheckingAuth, setIsCheckingAuth] = useState(true);
  const router = useRouter();
  const supabase = createClient();

  useEffect(() => {
    async function checkAuth() {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          // Allow dev bypass
          const urlParams = new URLSearchParams(window.location.search);
          if (urlParams.get('dev') !== 'true') {
            router.push('/login');
            return;
          }
        } else {
          // If logged in, check if they already chose a module
          const { data: profile } = await supabase
            .from('profiles')
            .select('module_test')
            .eq('id', user.id)
            .maybeSingle();

          if (profile?.module_test) {
            router.push('/dashboard');
            return;
          }
        }
      } catch {
        // Allow through in dev
      }
      setIsCheckingAuth(false);
    }
    checkAuth();
  }, [router, supabase]);

  const handleContinue = async () => {
    if (!selectedModule) return;
    setIsLoading(true);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        // Save the chosen module to the database. We use upsert in case the profile row doesn't exist yet!
        await supabase
          .from('profiles')
          .upsert({ 
            id: user.id, 
            email: user.email || '', 
            module_test: selectedModule 
          }) 
          .eq('id', user.id);
      }
    } catch (e) {
      console.error(e);
    }

    // Navigate to dashboard with the selected module as a query param
    router.push(`/dashboard?module=${selectedModule}`);
  };

  if (isCheckingAuth) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-orange-50 via-white to-amber-50">
        <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-orange-50 via-white to-amber-50 p-4">
      {/* Background decoration */}
      <div className="fixed inset-0 overflow-hidden pointer-events-none">
        <div className="absolute -top-40 -right-40 w-80 h-80 rounded-full bg-orange-100/60 blur-3xl" />
        <div className="absolute -bottom-40 -left-40 w-80 h-80 rounded-full bg-amber-100/60 blur-3xl" />
        <div className="absolute top-1/3 left-1/4 w-[500px] h-[500px] rounded-full bg-orange-50/30 blur-3xl" />
      </div>

      <div className="relative z-10 w-full max-w-lg">
        {/* Logo / Branding */}
        <div className="text-center mb-8">
          <img src="/logo.avif" alt="TestAS Logo" className="w-20 h-auto mx-auto mb-4" />
          <h1 className="text-3xl font-bold text-gray-900 tracking-tight">
            Choose Your
            <span className="text-orange-600"> Module Test</span>
          </h1>
          <p className="text-gray-500 mt-2 max-w-sm mx-auto">
            Select the subject module you want to practice. This determines your 4th exam section.
          </p>
        </div>

        <Card className="border-0 shadow-xl shadow-gray-200/50 bg-white/80 backdrop-blur-sm">
          <CardHeader className="text-center pb-2">
            <CardTitle className="text-lg flex items-center justify-center gap-2">
              <Sparkles className="w-5 h-5 text-orange-500" />
              Module Test Selection
            </CardTitle>
            <CardDescription>
              Pick one module — this cannot be changed during the exam
            </CardDescription>
          </CardHeader>
          <CardContent className="pt-4 space-y-3">
            {MODULE_TEST_OPTIONS.map((module) => (
              <button
                key={module.value}
                onClick={() => setSelectedModule(module.value)}
                className={`w-full flex items-center gap-4 p-4 rounded-xl border-2 transition-all duration-200 text-left group ${
                  selectedModule === module.value
                    ? 'border-orange-500 bg-orange-50 shadow-md shadow-orange-100'
                    : 'border-gray-100 bg-white hover:border-gray-200 hover:shadow-sm'
                }`}
              >
                <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-2xl shrink-0 transition-all duration-200 ${
                  selectedModule === module.value
                    ? 'bg-orange-100 scale-110'
                    : 'bg-gray-50 group-hover:bg-gray-100'
                }`}>
                  {module.icon}
                </div>
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold transition-colors duration-200 ${
                    selectedModule === module.value ? 'text-orange-700' : 'text-gray-900'
                  }`}>
                    {module.label}
                  </p>
                  <p className="text-xs text-gray-500 mt-0.5">{module.description}</p>
                  <div className="flex items-center gap-3 mt-2">
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <Clock className="w-3 h-3" />
                      150 min
                    </span>
                    <span className="inline-flex items-center gap-1 text-xs text-gray-400">
                      <FileText className="w-3 h-3" />
                      22 questions
                    </span>
                  </div>
                </div>
                {selectedModule === module.value ? (
                  <CheckCircle2 className="w-6 h-6 text-orange-500 shrink-0" />
                ) : (
                  <div className="w-6 h-6 rounded-full border-2 border-gray-200 shrink-0 group-hover:border-gray-300 transition-colors" />
                )}
              </button>
            ))}

            <Button
              onClick={handleContinue}
              disabled={!selectedModule || isLoading}
              className="w-full h-12 mt-4 text-base font-medium bg-linear-to-r from-orange-500 to-amber-500 hover:from-orange-600 hover:to-amber-600 text-white shadow-lg shadow-orange-200 transition-all duration-200 disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isLoading ? (
                <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              ) : (
                <div className="flex items-center gap-2">
                  Continue to Exam
                  <ChevronRight className="w-4 h-4" />
                </div>
              )}
            </Button>
          </CardContent>
        </Card>

        <p className="text-center text-xs text-gray-400 mt-4">
          The core tests (Figure Sequences, Math Equations, Latin Squares) are the same for all modules.
        </p>
      </div>
    </div>
  );
}

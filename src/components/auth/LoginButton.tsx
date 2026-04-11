'use client';

import { signIn } from 'next-auth/react';
import { Button } from '@/components/ui/button';

export function LoginButton() {
  return (
    <Button
      onClick={() => signIn('google', { redirectTo: '/select-module' })}
      className="w-full py-6 bg-transparent border-2 border-gray-300 hover:bg-gray-100 transition-colors duration-200 rounded-lg text-lg font-medium flex items-center justify-center gap-3 text-gray-700 hover:text-gray-900"
    >
        <img src="https://www.gstatic.com/marketing-cms/assets/images/d5/dc/cfe9ce8b4425b410b49b7f2dd3f3/g.webp=s96-fcrop64=1,00000000ffffffff-rw" alt="Google icon" className="w-5 h-5" />
      Sign in with Google
    </Button>
  );
}

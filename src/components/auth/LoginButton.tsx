'use client';

import { signIn } from '@auth/nextjs/react';
import { Button } from '@/components/ui/button';

export function LoginButton() {
  return (
    <Button
      onClick={() => signIn('google', { redirectTo: '/select-module' })}
      className="w-full"
    >
      Sign in with Google
    </Button>
  );
}

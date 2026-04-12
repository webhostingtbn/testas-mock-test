# Real Issue Analysis: Production Dashboard/Login Loop

## Critical Discovery

The actual problem is **NOT** the middleware or session callbacks alone. It's a **combination of issues**:

### **Issue #1: Missing AUTH_SECRET (MOST CRITICAL)**

**What's happening:**
- Without `AUTH_SECRET` in production, NextAuth v5 cannot encrypt/decrypt JWT tokens
- This causes `req.auth` in middleware to be `null` even when the user is logged in
- The middleware then redirects `null` auth → `/login`
- After login, the cycle repeats because the token still can't be verified

**Proof:**
In `src/proxy.ts`:
```typescript
const isLoggedIn = !!req.auth;  // This is NULL without AUTH_SECRET!
if (!isLoggedIn) {
  return NextResponse.redirect(new URL('/login', req.nextUrl));  // ALWAYS REDIRECTS
}
```

**Why dev works but prod doesn't:**
- Dev: Next.js auto-generates a temporary AUTH_SECRET
- Prod: Must be explicitly set via environment variable, otherwise defaults to empty string

### **Issue #2: UseSession Race Condition**

In `src/app/select-module/page.tsx`:
```typescript
const { data: session, status } = useSession();

useEffect(() => {
  async function checkProfile() {
    if (status === 'loading') return;
    if (status === 'unauthenticated') {  // ← Race condition here
      router.push('/login');
      return;
    }
```

The `useSession()` hook loads from `SessionProvider` which hasn't hydrated yet. On first render, it might report `unauthenticated` before the session actually loads.

### **Issue #3: Middleware Timing with SessionProvider**

The client-side `SessionProvider` wraps all pages, but it takes time to hydrate. Meanwhile, the middleware runs first and makes auth decisions based on `req.auth`. If these don't sync, you get a redirect loop.

## Solution

### **Step 1: Set AUTH_SECRET (CRITICAL)**

This is **mandatory** for production. Generate it:

```bash
openssl rand -base64 32
```

Then add to your production environment:
```env
AUTH_SECRET=your-generated-secret-here
```

**Without this, nothing else will work.**

### **Step 2: Add Protection to Select-Module**

The select-module page needs proper server-side auth check:

```typescript
'use client';

import { useSession } from 'next-auth/react';
import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

export default function SelectModulePage() {
  const { data: session, status } = useSession();
  const router = useRouter();
  const [isMounted, setIsMounted] = useState(false);

  // Prevent hydration mismatch
  useEffect(() => {
    setIsMounted(true);
  }, []);

  useEffect(() => {
    if (!isMounted || status === 'loading') return;
    
    // If definitively unauthenticated after session loads
    if (status === 'unauthenticated') {
      router.push('/login');
    }
  }, [status, isMounted, router]);

  // Only render after hydration
  if (!isMounted || status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-linear-to-br from-orange-50 via-white to-amber-50">
        <div className="w-8 h-8 border-3 border-orange-200 border-t-orange-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (status === 'unauthenticated') {
    return null; // Will redirect above
  }

  // ... rest of component
```

### **Step 3: Make Dashboard Redirect More Robust**

In `src/app/dashboard/page.tsx`, ensure it waits for proper session before rendering:

```typescript
import React from 'react';
import { Suspense } from 'react';
import { auth } from '@/auth';
import { redirect } from 'next/navigation';
import DashboardClient from './DashboardClient';

export default async function DashboardPage() {
  const session = await auth();

  console.log('[DashboardPage] Server Session:', {
    hasSession: !!session,
    userId: session?.user?.id || 'N/A',
    userEmail: session?.user?.email || 'N/A',
  });

  // Use email as backup since it's more reliable than id
  if (!session?.user?.email) {
    console.warn('[DashboardPage] No session with email, redirecting to login');
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
      <DashboardClient session={session} />
    </Suspense>
  );
}
```

### **Step 4: Fix DashboardClient to Handle Hydration**

```typescript
useEffect(() => {
  async function loadProfile() {
    // Ensure component is mounted before checking session
    if (!session?.user?.email) {
      console.warn('[DashboardClient] No session user after mount, redirecting');
      router.push('/login');
      return;
    }

    // ... rest of loading logic
  }

  loadProfile();
}, [session?.user?.email, router]);
```

## Root Cause Summary

| Issue | Cause | Symptom |
|-------|-------|---------|
| **Missing AUTH_SECRET** | Environment variable not set | req.auth is always null, middleware always redirects |
| **UseSession timing** | SessionProvider not hydrated | Client thinks user is unauthenticated before session loads |
| **Hydration mismatch** | Server and client auth states differ | Redirect loop during client hydration |

## Checklist for Fix

- [ ] **Set AUTH_SECRET** in production environment (CRITICAL)
- [ ] Verify `NODE_ENV=production` is set
- [ ] Verify all other env vars are set (AUTH_GOOGLE_ID, AUTH_GOOGLE_SECRET, NEXT_PUBLIC_SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)
- [ ] Add hydration check to select-module page
- [ ] Test locally: `npm run build && npm start`
- [ ] Check middleware logs after login - should see `LoggedIn: true`
- [ ] Monitor production logs after deployment

## How to Test

```bash
# 1. Build production version
npm run build

# 2. Start production server
npm start

# 3. Visit http://localhost:3000/login
# 4. Log in with Google
# 5. Check logs - should see:
#    - [Middleware] ... LoggedIn: true
#    - [DashboardPage] Server Session: { hasSession: true, ... }
#    - No repeated redirects

# 6. You should be redirected to /select-module, then /dashboard
```

## If It Still Doesn't Work

Check these in order:

1. **Verify AUTH_SECRET exists**: Check your production environment variables
2. **Check middleware logs**: Look for `[Middleware]` logs with `LoggedIn: true`
3. **Check database**: Verify the user profile was created in Supabase
4. **Test locally first**: Use `npm run build && npm start` before pushing to production

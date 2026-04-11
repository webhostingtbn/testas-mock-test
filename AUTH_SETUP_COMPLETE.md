# Auth.js OAuth Implementation - Complete Setup

This implementation replaces Supabase Auth with **Auth.js v5** (NextAuth.js) for Google OAuth, while keeping Supabase as a database backend for user storage only.

## What Was Implemented

### ✅ Core Components Created

1. **`src/auth.ts`** - Auth.js configuration
   - Google OAuth provider setup
   - Supabase user sync callback
   - Session management

2. **`src/app/api/auth/[auth0]/route.ts`** - OAuth API handler
   - Handles Google OAuth callback
   - Manages session creation

3. **`src/middleware.ts`** - Route protection
   - Protects specified routes
   - Redirects unauthenticated users to login

4. **`src/components/auth/LoginButton.tsx`** - Sign-in button
   - Client component
   - Triggers Google OAuth flow
   - Redirects to `/select-module` after login

5. **`src/components/auth/LogoutButton.tsx`** - Sign-out button
   - Client component
   - Clears session
   - Redirects to login

6. **`src/components/auth/AuthProvider.tsx`** - Session provider
   - Wraps app for client-side session access
   - Enables `useSession()` hook

7. **Updated `src/app/login/page.tsx`** - New login page
   - Uses `LoginButton` component
   - Removed Supabase Auth dependency
   - Simplified UI

8. **Updated `src/app/dashboard/page.tsx`** - Protected dashboard
   - Uses `auth()` for server-side session check
   - Passes session to client component

### ✅ Configuration & Documentation

- **`migrations/001_create_users_table.sql`** - Database schema
  - Creates `public.users` table
  - Stores synced OAuth user data
  - Includes RLS policies

- **`.env.example`** - Environment variables template
  - Google OAuth credentials
  - Auth.js secret
  - Supabase connection details
  - Service role key

- **`package.json`** - Updated dependencies
  - `next-auth@5`
  - `@auth/core`
  - `@auth/google`

- **`AUTH_IMPLEMENTATION_GUIDE.md`** - Comprehensive guide
  - Setup instructions
  - Environment variable configuration
  - Usage examples
  - Troubleshooting

## Quick Start

### 1. Install Dependencies

```bash
npm install next-auth@5 @auth/core @auth/google @supabase/supabase-js
```

### 2. Configure Environment Variables

Copy `.env.example` to `.env.local`:
```bash
cp .env.example .env.local
```

Edit `.env.local` with:

**Google OAuth** (from Google Cloud Console):
```env
AUTH_GOOGLE_ID=your-client-id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your-client-secret
```

**Auth.js Secret** (generate with `openssl rand -base64 32`):
```env
AUTH_SECRET=your-generated-32-char-secret
```

**Supabase** (from Supabase dashboard):
```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 3. Create Database Table

Run this in your Supabase SQL Editor:

```sql
-- Create users table
CREATE TABLE IF NOT EXISTS public.users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email VARCHAR(255) UNIQUE NOT NULL,
  name VARCHAR(255),
  avatar_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  last_login TIMESTAMP WITH TIME ZONE
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS users_email_idx ON public.users(email);

-- Enable RLS
ALTER TABLE public.users ENABLE ROW LEVEL SECURITY;

-- RLS Policy: users can read their own data
CREATE POLICY "Users can read their own data"
  ON public.users
  FOR SELECT
  USING (auth.uid() = id);
```

### 4. Test Locally

```bash
npm run dev
```

Visit `http://localhost:3000/login` and test the Google OAuth flow.

## How It Works

### OAuth Flow
1. User clicks "Sign in with Google"
2. Redirected to Google consent screen
3. User authenticates
4. Redirected to `/api/auth/callback/google`
5. Auth.js exchanges code for session
6. **Supabase sync triggered** (server-side)
7. User record created/updated in `public.users`
8. Redirected to `/select-module`

### User Sync to Supabase
- **When**: On every sign-in (via `signIn` callback)
- **What**: Email, name, avatar_url, last_login
- **How**: Server-side with service role key (never exposed to client)
- **Where**: `public.users` table
- **Key Field**: Email (upsert on email conflict)

### Session Management
- **Storage**: HttpOnly, Secure cookies
- **Server Access**: `auth()` function
- **Client Access**: `useSession()` hook (wrapped in `AuthProvider`)
- **Duration**: Configurable (default 30 days)

## File Changes Summary

```
Created:
  src/auth.ts
  src/app/api/auth/[auth0]/route.ts
  src/middleware.ts
  src/components/auth/LoginButton.tsx
  src/components/auth/LogoutButton.tsx
  src/components/auth/AuthProvider.tsx
  migrations/001_create_users_table.sql
  .env.example
  AUTH_IMPLEMENTATION_GUIDE.md

Modified:
  src/app/login/page.tsx (simplified, uses LoginButton)
  src/app/dashboard/page.tsx (uses auth() instead of Supabase)
  src/app/layout.tsx (wrapped with AuthProvider)
  package.json (added next-auth dependencies)

To Remove (Supabase Auth):
  src/app/auth/callback/route.ts (no longer needed)
  src/lib/supabase/client.ts (can be removed if only using Supabase DB)
  src/lib/supabase/middleware.ts (replaced by src/middleware.ts)
  src/lib/supabase/server.ts (can keep if using Supabase DB for other queries)
```

## Usage Examples

### Sign In Button
```tsx
import { LoginButton } from '@/components/auth/LoginButton';

export function Header() {
  return <LoginButton />;
}
```

### Sign Out Button
```tsx
import { LogoutButton } from '@/components/auth/LogoutButton';

export function UserMenu() {
  return <LogoutButton />;
}
```

### Server-Side Session Check
```tsx
import { auth } from '@/auth';
import { redirect } from 'next/navigation';

export default async function ProtectedPage() {
  const session = await auth();
  
  if (!session?.user) {
    redirect('/login');
  }

  return <div>Welcome, {session.user.name}</div>;
}
```

### Client-Side Session Access
```tsx
'use client';

import { useSession } from 'next-auth/react';

export function UserGreeting() {
  const { data: session } = useSession();
  
  if (!session) return null;
  
  return <p>Hello, {session.user.name}</p>;
}
```

### Query User from Database
```tsx
// Server-side only - using Supabase with service role
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const { data: user } = await supabase
  .from('users')
  .select('*')
  .eq('email', session.user.email)
  .single();
```

## Security Checklist

- ✅ Service role key **never exposed** to client
- ✅ Auth.js secret stored in `.env.local` (not committed)
- ✅ Session tokens are HttpOnly, Secure cookies
- ✅ No passwords stored (OAuth only)
- ✅ RLS enabled on users table
- ✅ Proper environment variable isolation
- ✅ Redirect URIs match Google OAuth settings

## Environment Variables Reference

| Variable | Type | Where | Purpose |
|----------|------|-------|---------|
| `AUTH_GOOGLE_ID` | Secret | Server | Google OAuth client ID |
| `AUTH_GOOGLE_SECRET` | Secret | Server | Google OAuth client secret |
| `AUTH_SECRET` | Secret | Server | Session encryption key (32+ chars) |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Both | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Both | Supabase anonymous key |
| `SUPABASE_SERVICE_ROLE_KEY` | Secret | Server | Supabase admin key for user sync |
| `NEXT_PUBLIC_APP_URL` | Public | Both | Your app's domain |

## Next Steps

1. ✅ Fill in `.env.local` with real credentials
2. ✅ Run database migration
3. ✅ Test login/logout flow locally
4. ✅ Update Google OAuth redirect URIs for production
5. ✅ Deploy to Vercel/production
6. ✅ Implement exam/module routes with session checks
7. ✅ Remove old Supabase Auth code if desired

## Troubleshooting

**"Cannot find module 'next-auth'"**
- Run: `npm install next-auth@5 @auth/core @auth/google`
- Restart: `npm run dev`

**"OAuth configuration is incomplete"**
- Check all env vars in `.env.local`
- Verify Google redirect URI matches exactly: `https://yourdomain.com/api/auth/callback/google`

**"User not syncing to Supabase"**
- Verify `SUPABASE_SERVICE_ROLE_KEY` in `.env.local`
- Check Supabase logs for errors
- Ensure `public.users` table exists

**"Session not persisting"**
- Check `AUTH_SECRET` is set (32+ characters)
- Verify cookies in DevTools (Application > Cookies)
- Clear cookies and try again

## Support

See `AUTH_IMPLEMENTATION_GUIDE.md` for detailed setup and troubleshooting.

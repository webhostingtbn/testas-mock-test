# Auth.js OAuth Implementation Guide

This guide walks you through implementing Google OAuth with Auth.js v5, replacing Supabase Auth entirely.

## Prerequisites
- Node.js 18+ and npm/yarn/pnpm
- Google OAuth credentials (from Google Cloud Console)
- Supabase project (for storing user data only)

## Installation

### 1. Install Required Packages

```bash
npm install next-auth@5 @auth/core @auth/google @supabase/supabase-js
```

### 2. Set Up Environment Variables

Copy `.env.example` to `.env.local` and fill in your values:

```bash
cp .env.example .env.local
```

Then edit `.env.local` with:

#### Google OAuth Credentials
1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project or select existing one
3. Enable Google+ API
4. Create OAuth 2.0 credentials:
   - Application type: Web application
   - Authorized redirect URIs:
     - `http://localhost:3000/api/auth/callback/google` (dev)
     - `https://yourdomain.com/api/auth/callback/google` (production)
5. Copy Client ID and Client Secret to `.env.local`:

```env
AUTH_GOOGLE_ID=your-client-id.apps.googleusercontent.com
AUTH_GOOGLE_SECRET=your-client-secret
```

#### Auth.js Secret
Generate a secure secret (32+ characters, base64 encoded):

```bash
openssl rand -base64 32
```

Add to `.env.local`:
```env
AUTH_SECRET=your-generated-secret
```

#### Supabase Configuration
1. Go to your Supabase project settings
2. Copy URL and Anon Key:

```env
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key
```

3. Find Service Role Key (Settings > API):
```env
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key
```

4. Set your app URL:
```env
NEXT_PUBLIC_APP_URL=http://localhost:3000  # or your production domain
```

## Setup Instructions

### 1. Create Supabase Users Table

Run the migration SQL in your Supabase dashboard:

```bash
# Copy the content from: migrations/001_create_users_table.sql
# Paste it in Supabase SQL Editor and execute
```

Or via psql:
```bash
psql -h db.supabase.co -U postgres -d postgres < migrations/001_create_users_table.sql
```

### 2. Core Files Created

#### `src/auth.ts`
- Auth.js configuration with Google provider
- User sync logic to Supabase database
- Callbacks for sign-in and session management

#### `src/app/api/auth/[auth0]/route.ts`
- API route handler for OAuth flow
- Handles `/api/auth/*` requests

#### `src/middleware.ts`
- Protects routes using Auth.js session
- Configurable matcher for protected routes

#### `src/components/auth/LoginButton.tsx`
- Sign in button (client component)
- Redirects to `/select-module` after login

#### `src/components/auth/LogoutButton.tsx`
- Sign out button (client component)
- Redirects to `/login` after logout

#### `src/app/login/page.tsx` (Updated)
- Simplified login page using Auth.js
- Removed Supabase Auth dependency

#### `src/app/dashboard/page.tsx` (Updated)
- Server component that checks Auth.js session
- Passes session to client component
- Redirects to login if not authenticated

## Usage

### Sign In
Use the `LoginButton` component:

```tsx
import { LoginButton } from '@/components/auth/LoginButton';

export function MyComponent() {
  return <LoginButton />;
}
```

### Sign Out
Use the `LogoutButton` component:

```tsx
import { LogoutButton } from '@/components/auth/LogoutButton';

export function MyComponent() {
  return <LogoutButton />;
}
```

### Access Current Session (Server Component)
```tsx
import { auth } from '@/auth';

export default async function MyPage() {
  const session = await auth();
  
  if (!session?.user) {
    return <p>Not logged in</p>;
  }

  return <p>Welcome, {session.user.name}</p>;
}
```

### Access Current Session (Client Component)
```tsx
'use client';

import { useSession } from 'next-auth/react';

export default function MyComponent() {
  const { data: session } = useSession();
  
  return <p>Welcome, {session?.user?.name}</p>;
}
```

### Protect Routes
Routes are protected via `middleware.ts`. Add protected paths:

```ts
const protectedPaths = ['/dashboard', '/exam', '/results', '/select-module'];
```

## User Data Flow

1. **User clicks "Sign in with Google"**
   - Redirected to Google OAuth consent screen
   - User authenticates with Google
   - Redirected back to `/api/auth/callback/google`

2. **Auth.js handles callback**
   - Exchanges code for session
   - Triggers `signIn` callback
   - User sync function executes (server-side only)

3. **Supabase sync**
   - Uses **service role key** (server-side only)
   - Upserts user data: email, name, avatar_url, last_login
   - No password stored (OAuth only)
   - Table: `public.users`

4. **Session created**
   - User redirected to `/select-module`
   - Session cookie set (HttpOnly, Secure)
   - Available via `auth()` or `useSession()`

## Database Schema

Users are stored in `public.users`:

| Column | Type | Notes |
|--------|------|-------|
| id | UUID | Primary key |
| email | VARCHAR(255) | Unique, from Google |
| name | VARCHAR(255) | Full name from Google |
| avatar_url | TEXT | Profile picture URL |
| created_at | TIMESTAMP | Auto-set |
| updated_at | TIMESTAMP | Auto-updated |
| last_login | TIMESTAMP | Updated on each login |

## Security Notes

- ✅ **Service role key** used only on server for user sync
- ✅ **Anon key** used only on client (no auth operations)
- ✅ **AUTH_SECRET** stored in `.env.local` (never committed)
- ✅ Session tokens are HttpOnly, Secure cookies
- ✅ No passwords stored (OAuth only)
- ✅ Row-level security (RLS) on users table

## Troubleshooting

### "Cannot find module 'next-auth'"
- Run `npm install next-auth@5 @auth/core @auth/google`
- Restart dev server: `npm run dev`

### "OAuth configuration is incomplete"
- Check all env vars in `.env.local`
- Verify Google redirect URIs match your app URL
- Use correct format: `https://yourdomain.com/api/auth/callback/google`

### "User not syncing to Supabase"
- Check `SUPABASE_SERVICE_ROLE_KEY` is set correctly
- Verify `public.users` table exists
- Check browser console and server logs for errors

### "Session not persisting"
- Ensure `AUTH_SECRET` is set (minimum 32 characters)
- Check cookies in browser DevTools (Application > Cookies)
- Verify domain matches `NEXT_PUBLIC_APP_URL`

## Next Steps

1. ✅ Install packages
2. ✅ Configure environment variables
3. ✅ Create Supabase users table
4. ✅ Test Google OAuth login
5. ✅ Verify user sync to database
6. ✅ Implement major/module selection (server-side)
7. ✅ Add exam functionality with session checks
8. ✅ Deploy to production with correct redirect URIs

## Removing Supabase Auth Entirely

If you want to completely remove Supabase Auth code:

1. Delete `src/lib/supabase/` directory (except for Supabase JS client)
2. Update `src/app/auth/callback/route.ts` - no longer needed
3. Remove all imports of `createClient()` for auth
4. Update protected pages to use `auth()` from `src/auth.ts`

## References

- [Auth.js Documentation](https://authjs.dev)
- [Auth.js Google Provider](https://authjs.dev/docs/providers/google)
- [Next.js Middleware](https://nextjs.org/docs/app/building-your-application/routing/middleware)
- [Supabase JS Client](https://supabase.com/docs/reference/javascript/introduction)

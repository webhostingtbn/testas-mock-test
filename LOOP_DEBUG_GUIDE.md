# Dashboard/Login Loop - Deep Dive Debug Guide

## Additional Root Cause Found

The issue is **TWO-FOLD**:

### 1. **Session Callback Not Returning Complete Session** 
The original callback only populated `session.user.id` but didn't preserve other critical fields like `email`, `name`, etc. In production, this resulted in an incomplete session object.

### 2. **Client Component Redirect Check Too Strict**
The `DashboardClient` was checking `!session?.user` which would be true if the session was incomplete, causing a redirect to login even though the user was authenticated at the server level.

## Changes Made to Fix Loop

### 1. **src/auth.ts** - JWT + Session Callbacks
Changed from a session-only callback to a proper JWT + Session flow:

```typescript
async jwt({ token, user }) {
  if (user) {
    token.email = user.email;
    token.name = user.name;
    token.image = user.image;
    
    // Try to get user id from Supabase
    try {
      const { data } = await supabase
        .from('profiles')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();
      if (data?.id) {
        token.sub = data.id;
      }
    } catch (err) {
      // Don't fail if Supabase is slow
      console.warn('Failed to get user id:', err);
    }
  }
  return token;
},
async session({ session, token }) {
  // Populate all user fields from token
  if (session.user) {
    session.user.id = token.sub || '';
    session.user.email = (token.email as string) || '';
    session.user.name = (token.name as string) || '';
    session.user.image = (token.image as string | null) || null;
  }
  return session;
},
```

**Why this fixes it:**
- Even if Supabase is slow, the session still has `email`, `name`, and `image`
- The client component gets a complete session object

### 2. **src/app/dashboard/page.tsx** - Better Logging
Added comprehensive server-side logging to catch session issues early:

```typescript
console.log('[DashboardPage] Session check:', {
  hasSession: !!session,
  hasUser: !!session?.user,
  userEmail: session?.user?.email || 'N/A',
  userId: session?.user?.id || 'N/A',
});
```

### 3. **src/app/dashboard/DashboardClient.tsx** - Defensive Redirect
Changed from immediate redirect to one with a slight delay and better checks:

```typescript
if (!session?.user?.email) {
  // Only redirect after a small delay
  const timer = setTimeout(() => {
    router.push('/login');
  }, 500);
  return () => clearTimeout(timer);
}
```

**Why the delay matters:** Sometimes the session isn't fully hydrated on first render. A small delay prevents a spurious redirect.

## Debug Checklist

When deploying, check these in production:

1. **Server Logs** should show:
   ```
   [DashboardPage] Session check: {
     hasSession: true,
     hasUser: true,
     userEmail: "user@example.com",
     userId: "uuid-here"
   }
   ```

2. **Browser Console** should NOT show repeated:
   ```
   [DashboardClient] Redirecting to login due to missing session
   ```

3. **Middleware Logs** should show session found:
   ```
   [Middleware] Path: /dashboard, LoggedIn: true, CookiePresent: true, Auth: true
   ```

4. **Network Tab** should show only ONE redirect from `/login` to `/dashboard` after login

## Environment Variables Required

Ensure these are set in production:

```env
# NextAuth
AUTH_SECRET=<generated-secret>
AUTH_GOOGLE_ID=<google-client-id>
AUTH_GOOGLE_SECRET=<google-client-secret>

# Supabase
NEXT_PUBLIC_SUPABASE_URL=<your-supabase-url>
SUPABASE_SERVICE_ROLE_KEY=<service-role-key>

# Next.js
NODE_ENV=production
```

## How to Generate AUTH_SECRET

If not set, generate one with:
```bash
openssl rand -base64 32
```

Set it in your production environment variables.

## If Loop Still Occurs

Check these things:

1. **Is AUTH_SECRET set?** Without it, session encoding/decoding fails
2. **Is Supabase reachable?** Add error logging in both callbacks
3. **Are cookies being sent?** Check Network tab → Application → Cookies
4. **Is HTTPS properly configured?** Non-HTTPS breaks secure cookies

Run the production build locally to test:
```bash
npm run build
npm start
```

Then test login flow and check console logs.

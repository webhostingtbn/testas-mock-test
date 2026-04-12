# Production Dashboard/Login Loop - Root Cause & Fix

## The Problem
Users experience an infinite redirect loop between `/dashboard` and `/login` **only in production**, not in development.

## Root Causes Identified

### 1. **Secure Cookie Configuration Missing**
**Issue:** In production (HTTPS), NextAuth v5 needs explicit secure cookie configuration. Without it, cookies aren't properly sent/received in middleware.

**What was wrong:**
```typescript
// BEFORE - No cookie configuration
export const { handlers, auth, signIn, signOut } = NextAuth({
  trustHost: true,
  providers: [...],
  pages: {...},
  callbacks: {...}
});
```

**The fix:**
```typescript
// AFTER - Explicit secure cookie config
cookies: {
  sessionToken: {
    name: process.env.NODE_ENV === 'production' 
      ? '__Secure-authjs.session-token'  // Production HTTPS naming
      : 'authjs.session-token',            // Dev HTTP
    options: {
      httpOnly: true,
      sameSite: 'lax',
      path: '/',
      secure: process.env.NODE_ENV === 'production', // HTTPS only in prod
    },
  },
},
```

### 2. **Cookie Name Mismatch in Middleware**
**Issue:** The middleware was only checking for `authjs.session-token`, but NextAuth v5 uses different cookie names in production.

**What was wrong:**
```typescript
// BEFORE - Only checks dev cookie name
console.log(`CookiePresent: ${!!req.cookies.get('authjs.session-token')}`);
```

**The fix:**
```typescript
// AFTER - Checks both dev and production cookie names
const sessionTokenDev = req.cookies.get('authjs.session-token');
const sessionTokenProd = req.cookies.get('__Secure-authjs.session-token');
const cookiePresent = !!(sessionTokenDev || sessionTokenProd);
```

### 3. **Auth API Routes Not Excluded**
**Issue:** The middleware was processing `/api/auth/*` routes, which could interfere with NextAuth operations.

**The fix:**
```typescript
// Always allow auth API routes
if (isOnAuthPage) {
  return NextResponse.next();
}
```

## Why This Only Happens in Production

1. **Development (HTTP):** Cookies work without the `Secure` flag, so the session persists across requests
2. **Production (HTTPS):** Cookies without `secure: true` aren't sent with HTTPS requests, so:
   - User logs in ✓
   - Redirect to `/dashboard` ✓
   - Middleware checks for session cookie → NOT FOUND (because it's not marked as secure)
   - Middleware redirects to `/login` ✓
   - Loop continues...

## Changes Made

### 1. `src/auth.ts`
- Added `cookies` configuration with production-safe cookie handling
- Session token name changes based on environment
- Secure flag only enabled in production

### 2. `src/proxy.ts`
- Updated middleware to check both cookie names
- Added auth API route exclusion
- Improved logging for debugging

### 3. `next.config.ts`
- Added cache headers to ensure fresh auth state

## Testing the Fix

1. **Before deploying**, verify locally:
```bash
# Test production build locally
npm run build
npm start
# Visit http://localhost:3000/login
# Log in and verify redirect to dashboard
# No redirect loop should occur
```

2. **Environment variables** required:
```env
AUTH_GOOGLE_ID=...
AUTH_GOOGLE_SECRET=...
AUTH_SECRET=... # Must be set in production!
NEXT_PUBLIC_SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
```

3. **Check server logs** for the middleware debug output:
```
[Middleware] Path: /dashboard, LoggedIn: true, CookiePresent: true, Auth: true
```

## Additional Recommendations

1. **Set AUTH_SECRET** in production env - this is crucial for session signing
2. **Verify HTTPS** is properly configured on your hosting
3. **Check cookie domain** if using subdomains (might need explicit domain in cookie config)
4. **Monitor middleware logs** during deployment to confirm cookies are being found


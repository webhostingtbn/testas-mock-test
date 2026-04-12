import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth?.user?.email;
  const isOnLoginPage = req.nextUrl.pathname.startsWith('/login');
  const isOnAuthPage = req.nextUrl.pathname.startsWith('/api/auth');
  
  // Check for both possible cookie names (dev and production)
  const sessionTokenDev = req.cookies.get('authjs.session-token');
  const sessionTokenProd = req.cookies.get('__Secure-authjs.session-token');
  const cookiePresent = !!(sessionTokenDev || sessionTokenProd);

  const addDebugHeaders = (response: NextResponse, decision: string) => {
    response.headers.set('x-auth-debug-path', req.nextUrl.pathname);
    response.headers.set('x-auth-debug-decision', decision);
    response.headers.set('x-auth-debug-logged-in', String(isLoggedIn));
    response.headers.set('x-auth-debug-has-auth', String(!!req.auth));
    response.headers.set('x-auth-debug-has-user', String(!!req.auth?.user));
    response.headers.set('x-auth-debug-has-email', String(!!req.auth?.user?.email));
    response.headers.set('x-auth-debug-cookie', String(cookiePresent));
    return response;
  };
  
  console.log(`[Middleware] Path: ${req.nextUrl.pathname}, LoggedIn: ${isLoggedIn}, CookiePresent: ${cookiePresent}, Auth: ${!!req.auth?.user}`);

  // Always allow auth API routes
  if (isOnAuthPage) {
    return addDebugHeaders(NextResponse.next(), 'allow-auth-api');
  }

  if (isOnLoginPage) {
    if (isLoggedIn) {
      return addDebugHeaders(
        NextResponse.redirect(new URL('/dashboard', req.nextUrl)),
        'redirect-login-to-dashboard'
      );
    }
    return addDebugHeaders(NextResponse.next(), 'allow-login');
  }

  if (!isLoggedIn) {
    return addDebugHeaders(
      NextResponse.redirect(new URL('/login', req.nextUrl)),
      'redirect-protected-to-login'
    );
  }

  return addDebugHeaders(NextResponse.next(), 'allow-protected');
});

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

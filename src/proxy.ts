import { auth } from '@/auth';
import { NextResponse } from 'next/server';

export const proxy = auth((req) => {
  const isLoggedIn = !!req.auth;
  const isOnLoginPage = req.nextUrl.pathname.startsWith('/login');
  const isOnAuthPage = req.nextUrl.pathname.startsWith('/api/auth');
  
  // Check for both possible cookie names (dev and production)
  const sessionTokenDev = req.cookies.get('authjs.session-token');
  const sessionTokenProd = req.cookies.get('__Secure-authjs.session-token');
  const cookiePresent = !!(sessionTokenDev || sessionTokenProd);
  
  console.log(`[Middleware] Path: ${req.nextUrl.pathname}, LoggedIn: ${isLoggedIn}, CookiePresent: ${cookiePresent}, Auth: ${!!req.auth?.user}`);

  // Always allow auth API routes
  if (isOnAuthPage) {
    return NextResponse.next();
  }

  if (isOnLoginPage) {
    if (isLoggedIn) {
      return NextResponse.redirect(new URL('/dashboard', req.nextUrl));
    }
    return NextResponse.next();
  }

  if (!isLoggedIn) {
    return NextResponse.redirect(new URL('/login', req.nextUrl));
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    '/((?!api|_next/static|_next/image|favicon.ico|public|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
};

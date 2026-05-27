import { betterFetch } from '@better-fetch/fetch';
import { type Session, type User } from 'better-auth/types';
import { type NextRequest, NextResponse } from 'next/server';

// Extend User type to include properties from plugins (like admin)
interface UserWithRole extends User {
  role?: string;
}

const authRoutes = ['/sign-in', '/sign-up'];
const passwordRoutes = ['/reset-password', '/forgot-password'];
const privateRoutes = ['/dashboard'];
// Admin routes that should be publicly accessible (no auth required)
const publicAdminRoutes = ['/admin-login'];

export default async function proxy(request: NextRequest) {
  const pathName = request.nextUrl.pathname;
  const isAuthRoute = authRoutes.includes(pathName);
  const isPasswordRoute = passwordRoutes.includes(pathName);
  const isPublicAdminRoute = publicAdminRoutes.some((route) =>
    pathName.startsWith(route),
  );
  const isAdminRoute = pathName.startsWith('/admin') && !isPublicAdminRoute;
  const isPrivateRoute = privateRoutes.some((route) =>
    pathName.startsWith(route),
  );

  let sessionData: { session: Session; user: UserWithRole } | null = null;

  try {
    const { data } = await betterFetch<{
      session: Session;
      user: UserWithRole;
    }>('/api/auth/get-session', {
      baseURL: process.env.BETTER_AUTH_URL || 'http://localhost:3000',
      headers: {
        // get the cookie from the request
        cookie: request.headers.get('cookie') || '',
      },
    });
    sessionData = data;
  } catch (error) {
    // Fail silently/gracefully - treat as no session
    console.error('Middleware auth check failed:', error);
  }

  const response = NextResponse.next();

  if (!sessionData) {
    if (isPrivateRoute || isAdminRoute) {
      return NextResponse.redirect(new URL('/sign-in', request.url));
    }
  } else {
    if (isAuthRoute || isPasswordRoute) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }

    if (
      isAdminRoute &&
      sessionData.user.role !== 'admin' &&
      sessionData.user.role !== 'superadmin'
    ) {
      return NextResponse.redirect(new URL('/dashboard', request.url));
    }
  }

  // Force no-cache for homepage to ensure full refresh on deployment
  if (pathName === '/') {
    response.headers.set(
      'Cache-Control',
      'no-store, no-cache, must-revalidate, proxy-revalidate',
    );
    response.headers.set('Pragma', 'no-cache');
    response.headers.set('Expires', '0');
    response.headers.set('Surrogate-Control', 'no-store');
  }

  return response;
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - api (API routes)
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     */
    '/((?!api|_next/static|_next/image|favicon.ico).*)',
  ],
};

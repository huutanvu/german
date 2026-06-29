import { NextRequest, NextResponse } from 'next/server';

function isTokenValid(token: string): boolean {
  try {
    const parts = token.split('.');
    if (parts.length !== 3) return false;
    const payload = parts[1].replace(/-/g, '+').replace(/_/g, '/');
    const json = atob(payload);
    const data = JSON.parse(json);
    const exp = typeof data.exp === 'number' ? data.exp : 0;
    return exp > Date.now() / 1000 + 30;
  } catch { return false; }
}

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Allow auth API routes and the login page through unconditionally
  if (pathname === '/login' || pathname.startsWith('/api/auth/')) {
    return NextResponse.next();
  }

  const token = request.cookies.get('sb-access-token')?.value;

  if (!token || !isTokenValid(token)) {
    const loginUrl = request.nextUrl.clone();
    loginUrl.pathname = '/login';
    return NextResponse.redirect(loginUrl);
  }

  return NextResponse.next();
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
};

import { NextRequest, NextResponse } from 'next/server';
import { signInWithPassword } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  try {
    const { email, password } = await request.json();

    if (!email || !password) {
      return NextResponse.json({ error: 'Email and password are required' }, { status: 400 });
    }

    const session = await signInWithPassword(email, password);

    const cookieStore = await cookies();

    cookieStore.set('sb-access-token', session.access_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: session.expires_in,
    });

    cookieStore.set('sb-refresh-token', session.refresh_token, {
      httpOnly: true,
      secure: false,
      sameSite: 'lax',
      path: '/',
      maxAge: 60 * 60 * 24 * 30, // 30 days
    });

    return NextResponse.json({
      userId: session.user.id,
      email: session.user.email,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Sign-in failed';
    return NextResponse.json({ error: message }, { status: 401 });
  }
}

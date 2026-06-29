import { NextRequest, NextResponse } from 'next/server';
import { signOut } from '@/lib/supabase';
import { cookies } from 'next/headers';

export async function POST(request: NextRequest) {
  const cookieStore = await cookies();
  const accessToken = cookieStore.get('sb-access-token')?.value;

  if (accessToken) {
    // Best-effort server-side sign-out; ignore errors
    await signOut(accessToken).catch(() => {});
  }

  cookieStore.delete('sb-access-token');
  cookieStore.delete('sb-refresh-token');

  return NextResponse.json({ ok: true });
}

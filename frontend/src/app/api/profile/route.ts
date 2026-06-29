import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { decodeJwtPayload } from '@/lib/supabase';

const SUPABASE_URL = process.env.NEXT_PUBLIC_SUPABASE_URL ?? '';
const SUPABASE_PUBLISHABLE_KEY = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? '';

function supabaseHeaders(token: string, extra?: Record<string, string>) {
  return {
    apikey: SUPABASE_PUBLISHABLE_KEY,
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...extra,
  };
}

async function getAuth(): Promise<{ userId: string; token: string } | null> {
  const store = await cookies();
  const token = store.get('sb-access-token')?.value;
  if (!token) return null;
  const payload = decodeJwtPayload(token);
  if (!payload || typeof payload.sub !== 'string') return null;
  return { userId: payload.sub, token };
}

export async function GET() {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const res = await fetch(
    `${SUPABASE_URL}/rest/v1/profiles?id=eq.${auth.userId}&select=*`,
    { headers: supabaseHeaders(auth.token) }
  );

  if (!res.ok) {
    return NextResponse.json({ error: 'Failed to fetch profile' }, { status: 500 });
  }

  const rows: any[] = await res.json();

  if (!rows || rows.length === 0) {
    // Return a sensible default profile when none exists yet
    return NextResponse.json({
      id: auth.userId,
      display_name: '',
      profession: 'software_engineer',
      target_level: 'B1',
    });
  }

  return NextResponse.json(rows[0]);
}

export async function PUT(request: Request) {
  const auth = await getAuth();
  if (!auth) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  let body: { displayName?: string; profession?: string; targetLevel?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const payload = {
    id: auth.userId,
    ...(body.displayName !== undefined && { display_name: body.displayName }),
    ...(body.profession !== undefined && { profession: body.profession }),
    ...(body.targetLevel !== undefined && { target_level: body.targetLevel }),
  };

  const res = await fetch(`${SUPABASE_URL}/rest/v1/profiles`, {
    method: 'POST',
    headers: supabaseHeaders(auth.token, { Prefer: 'resolution=merge-duplicates,return=representation' }),
    body: JSON.stringify(payload),
  });

  if (!res.ok) {
    const text = await res.text();
    return NextResponse.json({ error: 'Failed to upsert profile', detail: text }, { status: 500 });
  }

  const rows: any[] = await res.json();
  return NextResponse.json(rows[0] ?? payload);
}


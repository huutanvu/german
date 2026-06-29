import { NextResponse } from 'next/server';
import { getProfessions } from '@/lib/flotiq';

export async function GET() {
  const professions = await getProfessions();
  return NextResponse.json(professions);
}

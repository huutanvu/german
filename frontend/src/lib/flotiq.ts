'use server';

import type { ProfessionReference } from './types';

export type { ProfessionReference };

const FLOTIQ_URL = process.env.NEXT_PUBLIC_FLOTIQ_URL ?? 'https://api.flotiq.com';
const FLOTIQ_RO_KEY = process.env.NEXT_PUBLIC_FLOTIQ_KEY ?? '';
const FLOTIQ_RW_KEY_ENV = process.env.FLOTIQ_RW_KEY ?? '';

const FALLBACK_PROFESSIONS: ProfessionReference[] = [
  {
    id: 'software_engineer',
    slug: 'software_engineer',
    displayName: 'Software Engineer',
    description: 'Technology and software development professional',
    sampleContext: 'Wir deployen heute die neue Version. Das Ticket ist im Backlog.',
    icon: 'laptop',
  },
  {
    id: 'healthcare_professional',
    slug: 'healthcare_professional',
    displayName: 'Healthcare Professional',
    description: 'General healthcare and medical professional',
    sampleContext: 'Die Diagnose wurde gestellt. Wir müssen den Befund besprechen.',
    icon: 'stethoscope',
  },
  {
    id: 'nurse',
    slug: 'nurse',
    displayName: 'Nurse / Pflegekraft',
    description: 'Nursing and patient care professional',
    sampleContext: 'Ich nehme die Vitalzeichen auf. Das Medikament wird dreimal täglich gegeben.',
    icon: 'heart-pulse',
  },
  {
    id: 'teacher',
    slug: 'teacher',
    displayName: 'Teacher / Lehrer/in',
    description: 'Education and teaching professional',
    sampleContext: 'Die Hausaufgaben sind bis Freitag abzugeben. Wir besprechen das Thema.',
    icon: 'graduation-cap',
  },
  {
    id: 'legal_professional',
    slug: 'legal_professional',
    displayName: 'Legal Professional',
    description: 'Law and legal services professional',
    sampleContext: 'Der Vertrag muss bis Ende des Monats unterzeichnet werden.',
    icon: 'scale',
  },
  {
    id: 'finance_professional',
    slug: 'finance_professional',
    displayName: 'Finance Professional',
    description: 'Finance, banking, and accounting professional',
    sampleContext: 'Das Quartalsergebnis liegt vor. Wir müssen den Cashflow analysieren.',
    icon: 'chart-bar',
  },
  {
    id: 'general',
    slug: 'general',
    displayName: 'General / Allgemein',
    description: 'General everyday professional context',
    sampleContext: 'Ich habe heute einen wichtigen Termin.',
    icon: 'briefcase',
  },
];

async function flotiqGet<T>(path: string, useRW = false): Promise<T> {
  const key = useRW ? FLOTIQ_RW_KEY_ENV : FLOTIQ_RO_KEY;
  const res = await fetch(`${FLOTIQ_URL}${path}`, {
    headers: { 'X-AUTH-TOKEN': key },
    cache: 'no-store',
  });
  if (!res.ok) throw new Error(`Flotiq GET ${path}: ${res.status}`);
  return res.json() as Promise<T>;
}

export async function getProfessions(): Promise<ProfessionReference[]> {
  try {
    const data = await flotiqGet<{ data: ProfessionReference[] }>(
      '/api/v1/content/profession_reference?limit=50'
    );
    return data.data ?? FALLBACK_PROFESSIONS;
  } catch {
    return FALLBACK_PROFESSIONS;
  }
}

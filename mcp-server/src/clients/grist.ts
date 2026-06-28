const GRIST_URL = process.env.GRIST_URL;
const GRIST_DOC = process.env.GRIST_DOC;
const GRIST_KEY = process.env.GRIST_KEY;

function getBase(): string {
  if (!GRIST_URL || !GRIST_DOC || !GRIST_KEY) {
    throw new Error(
      'Missing Grist env vars. Set GRIST_URL, GRIST_DOC, and GRIST_KEY.',
    );
  }
  return `${GRIST_URL}/docs/${GRIST_DOC}`;
}

function getHeaders(): Record<string, string> {
  return {
    Authorization: `Bearer ${GRIST_KEY}`,
    'Content-Type': 'application/json',
  };
}

async function handleResponse(res: Response, method: string, path: string) {
  if (!res.ok) {
    const body = await res.text().catch(() => '');
    throw new Error(`Grist ${method} ${path}: ${res.status} ${body}`);
  }
  const text = await res.text();
  return text ? JSON.parse(text) : {};
}

export async function gristGet<T = any>(path: string): Promise<T> {
  const res = await fetch(`${getBase()}${path}`, { headers: getHeaders() });
  return handleResponse(res, 'GET', path) as Promise<T>;
}

export async function gristPost<T = any>(
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${getBase()}${path}`, {
    method: 'POST',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res, 'POST', path) as Promise<T>;
}

export async function gristPatch<T = any>(
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${getBase()}${path}`, {
    method: 'PATCH',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res, 'PATCH', path) as Promise<T>;
}

export async function gristPut<T = any>(
  path: string,
  body: unknown,
): Promise<T> {
  const res = await fetch(`${getBase()}${path}`, {
    method: 'PUT',
    headers: getHeaders(),
    body: JSON.stringify(body),
  });
  return handleResponse(res, 'PUT', path) as Promise<T>;
}

export function gristFilter(
  filters: Record<string, unknown[]>,
): string {
  return `?filter=${encodeURIComponent(JSON.stringify(filters))}`;
}

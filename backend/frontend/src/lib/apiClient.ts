import ky from 'ky';

const backendBaseUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL ?? 'http://localhost:3001';

export const api = ky.create({
  prefixUrl: backendBaseUrl,
  timeout: 10000,
});

export async function getJson<T>(
  url: string,
  searchParams?: Record<string, string | number | boolean>,
): Promise<T> {
  return api.get(url, { searchParams }).json<T>();
}

export async function postJson<T>(
  url: string,
  json?: unknown,
  searchParams?: Record<string, string | number | boolean>,
): Promise<T> {
  return api.post(url, { json, searchParams }).json<T>();
}

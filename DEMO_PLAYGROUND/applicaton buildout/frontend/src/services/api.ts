import { fetch } from 'expo/fetch';

export const API_URL = (process.env.EXPO_PUBLIC_API_URL || 'http://localhost:8000').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export function sessionHeaders(token: string | null): Record<string, string> {
  return token ? { Authorization: `Bearer ${token}` } : {};
}

export async function api<T>(path: string, token: string | null = null, options: RequestInit = {}): Promise<T> {
  const headers = new Headers(options.headers);
  for (const [key, value] of Object.entries(sessionHeaders(token))) headers.set(key, value);
  const response = await fetch(`${API_URL}${path}`, { ...options, headers, credentials: options.credentials ?? 'omit' });
  if (response.status === 204) return undefined as T;
  const data = await response.json().catch(() => null);
  if (!response.ok) {
    const detail = data?.detail;
    const message = typeof detail === 'string' ? detail
      : Array.isArray(detail) ? detail.map(item => item.msg).join('; ')
      : `Request failed (${response.status})`;
    throw new ApiError(response.status, message);
  }
  return data as T;
}

export function jsonBody(value: unknown): RequestInit {
  return { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(value) };
}

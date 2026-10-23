// Variables prefixed with EXPO_PUBLIC_ are inlined into the app at build time (set them in front_end/.env).
// localhost only works for web or a simulator on the same computer; a phone needs your computer's LAN IP.
export const API_URL = process.env.EXPO_PUBLIC_API_URL ?? 'http://localhost:8000';

export async function apiGet<T>(path: string): Promise<T> {
  const response = await fetch(`${API_URL}${path}`);
  if (!response.ok) {
    throw new Error(`GET ${path} failed: ${response.status}`);
  }
  return response.json() as Promise<T>;
}

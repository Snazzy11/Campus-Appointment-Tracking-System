const PENDING_KEY = 'campus.oauth.pending';
const MAX_AGE = 10 * 60 * 1000;

export type PendingWebAuth = {
  state: string;
  codeVerifier: string;
  redirectUri: string;
  createdAt: number;
};

type Storage = Pick<globalThis.Storage, 'getItem' | 'setItem' | 'removeItem'>;

export function beginWebAuth(
  authorizationUrl: string,
  pending: Omit<PendingWebAuth, 'createdAt'>,
  storage: Storage,
  now = Date.now(),
) {
  if (!pending.state || !pending.codeVerifier) throw new Error('Login is not ready. Please try again.');
  storage.setItem(PENDING_KEY, JSON.stringify({ ...pending, createdAt: now }));
  return authorizationUrl;
}

export function consumeWebCallback(url: string, storage: Storage, now = Date.now()) {
  const raw = storage.getItem(PENDING_KEY);
  storage.removeItem(PENDING_KEY); // One use, including failed attempts.
  if (!raw) throw new Error('No login is in progress in this tab. Return to the app and sign in again.');
  let pending: PendingWebAuth;
  try { pending = JSON.parse(raw); }
  catch { throw new Error('Login data is invalid. Please sign in again.'); }
  if (!pending || typeof pending.state !== 'string' || typeof pending.codeVerifier !== 'string'
    || typeof pending.redirectUri !== 'string' || typeof pending.createdAt !== 'number'
    || !pending.state || !pending.codeVerifier || now - pending.createdAt > MAX_AGE || now < pending.createdAt) {
    throw new Error('Login has expired or is invalid. Please sign in again.');
  }
  const callback = new URL(url);
  const expected = new URL(pending.redirectUri);
  if (callback.origin !== expected.origin || callback.pathname !== expected.pathname) {
    throw new Error('Login returned to an unexpected address. Please sign in again.');
  }
  const states = callback.searchParams.getAll('state');
  if (states.length !== 1 || states[0] !== pending.state) throw new Error('Invalid OAuth login state. Please sign in again.');
  if (callback.searchParams.has('error')) throw new Error('Cognito did not complete sign-in. Please try again.');
  const codes = callback.searchParams.getAll('code');
  if (codes.length !== 1 || !codes[0]) throw new Error('Cognito returned no valid login code. Please sign in again.');
  return { code: codes[0], code_verifier: pending.codeVerifier, redirect_uri: pending.redirectUri };
}

export async function completeWebAuth(options: {
  url: string;
  storage: Storage;
  removeQuery: () => void;
  exchange: (payload: ReturnType<typeof consumeWebCallback>) => Promise<{ session_token: string }>;
  signIn: (token: string) => Promise<void>;
}) {
  // Always remove OAuth query values from browser history, including on failure.
  let payload: ReturnType<typeof consumeWebCallback>;
  try { payload = consumeWebCallback(options.url, options.storage); }
  finally { options.removeQuery(); }
  const session = await options.exchange(payload);
  await options.signIn(session.session_token);
}

import assert from 'node:assert/strict';
import test from 'node:test';
import { beginWebAuth, consumeWebCallback, completeWebAuth } from '../src/services/web-auth.ts';

function storage() {
  const values = new Map();
  return { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value), removeItem: key => values.delete(key) };
}
const pending = { state: 'random-test-state', codeVerifier: 'v'.repeat(43), redirectUri: 'http://localhost:8081/auth/callback' };
const callback = `${pending.redirectUri}?code=test-code&state=${pending.state}`;

function start(store, now = Date.now()) {
  beginWebAuth('https://login.example.test/oauth2/authorize', pending, store, now);
}

test('web callback exchanges code and PKCE verifier, establishes session, and clears query', async () => {
  const store = storage(); start(store);
  const actions = [];
  await completeWebAuth({ url: callback, storage: store,
    removeQuery: () => actions.push('removeQuery'),
    exchange: async payload => {
      assert.deepEqual(payload, { code: 'test-code', code_verifier: pending.codeVerifier, redirect_uri: pending.redirectUri });
      actions.push('exchange'); return { session_token: 'test-session' };
    },
    signIn: async token => { assert.equal(token, 'test-session'); actions.push('signIn'); },
  });
  assert.deepEqual(actions, ['removeQuery', 'exchange', 'signIn']);
  assert.throws(() => consumeWebCallback(callback, store), /No login is in progress/);
});

for (const [name, url, pattern] of [
  ['wrong state', `${pending.redirectUri}?code=x&state=wrong`, /Invalid OAuth login state/],
  ['duplicate state', `${callback}&state=${pending.state}`, /Invalid OAuth login state/],
  ['wrong callback origin', `http://127.0.0.1:8081/auth/callback?code=x&state=${pending.state}`, /unexpected address/],
  ['missing code', `${pending.redirectUri}?state=${pending.state}`, /no valid login code/],
  ['provider rejection', `${pending.redirectUri}?error=access_denied&state=${pending.state}`, /did not complete sign-in/],
]) {
  test(`rejects ${name} without exchanging credentials`, async () => {
    const store = storage(); start(store);
    let cleared = false;
    await assert.rejects(completeWebAuth({ url, storage: store, removeQuery: () => { cleared = true; },
      exchange: async () => { assert.fail('Invalid callback must not reach the backend'); },
      signIn: async () => { assert.fail('Invalid callback must not sign in'); },
    }), pattern);
    assert.equal(cleared, true);
  });
}

test('pending login expires after ten minutes', () => {
  const store = storage(); start(store, 1000);
  assert.throws(() => consumeWebCallback(callback, store, 1000 + 600001), /expired/);
});

test('unexpected backend failures surface and never establish an account', async () => {
  const store = storage(); start(store);
  await assert.rejects(completeWebAuth({ url: callback, storage: store, removeQuery() {},
    exchange: async () => { throw new Error('Cognito could not be reached'); },
    signIn: async () => assert.fail('No account without a completed exchange'),
  }), /Cognito could not be reached/);
});

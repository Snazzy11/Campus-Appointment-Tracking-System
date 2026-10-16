import assert from 'node:assert/strict';
import test from 'node:test';
import { cognitoLogoutUrl } from '../src/services/logout.ts';
test('Cognito logout uses a browser endpoint and exact allowed return URI', () => {
  for (const uri of ['https://messaging.tufts.pro/', 'campusmessaging://auth/callback']) {
    const url = new URL(cognitoLogoutUrl({ domain: 'https://example.auth.us-east-2.amazoncognito.com', client_id: 'client' }, uri));
    assert.equal(url.pathname, '/logout');
    assert.equal(url.searchParams.get('logout_uri'), uri);
    assert.equal(url.searchParams.get('client_id'), 'client');
    assert.equal(url.searchParams.has('redirect_uri'), false);
  }
});

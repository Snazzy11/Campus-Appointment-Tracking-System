import assert from 'node:assert/strict';
import test from 'node:test';
import { createRecipientSearch } from '../src/services/recipient-search.ts';

function fixture(mock) {
  mock.timers.enable({ apis: ['setTimeout'] });
  const requests = [], states = [], errors = [];
  const search = createRecipientSearch((prefix, signal) => new Promise((resolve, reject) => requests.push({ prefix, signal, resolve, reject })), state => states.push(state), error => errors.push(error));
  return { search, requests, states, errors };
}
const flush = async () => { await Promise.resolve(); await Promise.resolve(); };

test('requires three characters and debounces the latest typed prefix', async ({ mock }) => {
  const { search, requests } = fixture(mock);
  search.change('ca'); mock.timers.tick(1000); assert.equal(requests.length, 0);
  search.change('car'); mock.timers.tick(299); assert.equal(requests.length, 0);
  search.change('  cart  '); mock.timers.tick(300); assert.equal(requests.length, 1);
  assert.equal(requests[0].prefix, 'cart'); search.stop();
});

test('aborts old queries, clears stale matches, and ignores out-of-order responses', async ({ mock }) => {
  const { search, requests } = fixture(mock);
  search.change('car'); mock.timers.tick(300);
  search.change('bob'); assert.equal(requests[0].signal.aborted, true); mock.timers.tick(300);
  requests[1].resolve([{ id: 2, email: 'bob@example.test' }]); await flush();
  requests[0].resolve([{ id: 1, email: 'carter@example.test' }]); await flush();
  assert.deepEqual(search.snapshot().matches, [{ id: 2, email: 'bob@example.test' }]);
  search.change('bo'); assert.equal(search.snapshot().status, 'idle'); assert.deepEqual(search.snapshot().matches, []);
  search.stop();
});

test('disposal prevents pending responses and reports active failures without stale results', async ({ mock }) => {
  const { search, requests, errors, states } = fixture(mock);
  search.change('car'); mock.timers.tick(300);
  requests[0].reject(new Error('Too many searches.')); await flush();
  assert.equal(search.snapshot().status, 'error'); assert.equal(search.snapshot().error, 'Too many searches.'); assert.equal(errors.length, 1);
  search.change('bob'); mock.timers.tick(300); search.stop();
  const before = states.length; requests[1].resolve([{ id: 2, email: 'bob@example.test' }]); await flush();
  assert.equal(states.length, before);
});

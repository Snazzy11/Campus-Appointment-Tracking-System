import test from 'node:test';
import assert from 'node:assert/strict';
import { browserLocation } from '../src/features/maps/browserLocation.ts';
test('browser location uses one bounded request without a separate permission acquisition', async () => {
  let calls=0;
  const coords={longitude:-84.78,latitude:43.59,accuracy:20};
  const result=await browserLocation({getCurrentPosition(success, failure, options) { calls++; assert.deepEqual(options,{enableHighAccuracy:false,maximumAge:30000,timeout:20000});success({coords}); }},true);
  assert.equal(calls,1);assert.equal(result,coords);
});
test('browser location explains denied, unavailable, and timed-out results', async () => {
  for(const [code,match] of [[1,/permission is blocked/],[2,/could not determine/],[3,/in time/]]) {
    await assert.rejects(browserLocation({getCurrentPosition(success,failure) { failure({code}); }},true),match);
  }
});
test('missing geolocation and insecure origins fail without requesting location', async () => {
  await assert.rejects(browserLocation(undefined,true),/cannot provide/);
  await assert.rejects(browserLocation({getCurrentPosition(){throw new Error('must not request');}},false),/HTTPS/);
});

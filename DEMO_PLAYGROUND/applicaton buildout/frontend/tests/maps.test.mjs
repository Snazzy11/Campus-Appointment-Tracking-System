import assert from 'node:assert/strict';
import test from 'node:test';
import { mapConfig, CAMPUS_CENTER } from '../src/features/maps/config.ts';
import { mapController } from '../src/features/maps/controller.ts';
test('maps default off and enabled maps require a configured street style', () => {
  assert.equal(mapConfig(undefined, undefined).enabled, false);
  assert.equal(mapConfig('true', undefined).enabled, false);
  assert.equal(mapConfig('true', 'public-key').enabled, true);
  assert.ok(CAMPUS_CENTER[0] < -84 && CAMPUS_CENTER[1] > 43);
});
test('provider keys are encoded and modes use separate licensed style URLs', () => {
  const config = mapConfig('true', 'public&key');
  assert.equal(new URL(config.styles.hybrid).searchParams.get('key'), 'public&key');
  assert.match(config.styles.satellite, /maps\/satellite\/style.json/);
  assert.match(config.styles.street, /maps\/streets-v2\/style.json/);
});
test('custom providers must use HTTPS and cannot embed account credentials', () => {
  for (const street of ['http://tiles.example/style', 'https://name:secret@tiles.example/style', 'javascript:alert(1)', 'garbage']) {
    assert.equal(mapConfig('true', undefined, { street }).enabled, false);
  }
  assert.equal(mapConfig('true', undefined, { street: 'https://tiles.example/style.json' }).enabled, true);
});
function fakeMap() {
  const events = new Map(); const calls = [];
  return { calls, events, on: (name, callback) => events.set(name, callback), off: name => events.delete(name), setStyle: url => calls.push(['style', url]), resize: () => calls.push(['resize']), remove: () => calls.push(['remove']), restoreOverlay: data => calls.push(['overlay', data]) };
}
test('style changes preserve the instance and restore authoritative overlays after loading', () => {
  const map = fakeMap(); const states = []; const controller = mapController(map, 'street', value => states.push(value));
  const overlay = { type: 'FeatureCollection', features: [{ type: 'Feature', properties: { id: 'fixture' }, geometry: { type: 'Point', coordinates: CAMPUS_CENTER } }] };
  controller.setOverlay(overlay); controller.switchStyle('satellite'); map.events.get('style.load')();
  assert.deepEqual(states, ['loading', 'ready']); assert.deepEqual(map.calls, [['style', 'satellite'], ['overlay', overlay]]);
  controller.switchStyle('satellite'); assert.equal(map.calls.length, 2);
  controller.switchStyle('satellite', true); assert.equal(map.calls.length, 3);
  controller.resize(); assert.deepEqual(map.calls.at(-1), ['resize']);
});
test('map errors surface, cleanup is idempotent and late events cannot update disposed UI', () => {
  const map = fakeMap(); const states = []; const controller = mapController(map, 'street', value => states.push(value));
  const late = map.events.get('style.load'); map.events.get('error')(); controller.dispose(); controller.dispose(); late(); controller.resize(); controller.switchStyle('hybrid');
  assert.deepEqual(states, ['error']); assert.equal(map.events.size, 0); assert.deepEqual(map.calls, [['remove']]);
});

test('unconfigured maps render accessible unavailable UI without requesting location or tiles', async () => {
  const { readFileSync } = await import('node:fs');
  const { createRequire } = await import('node:module');
  const { runInThisContext } = await import('node:vm');
  const React = await import('react');
  const { renderToStaticMarkup } = await import('react-dom/server');
  const { default: ts } = await import('typescript');
  const require = createRequire(import.meta.url);
  const compiled = ts.transpileModule(readFileSync(new URL('../src/features/maps/MapFrame.tsx', import.meta.url), 'utf8'), { compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 } }).outputText;
  const module = { exports: {} };
  runInThisContext(`(function(require,module,exports){${compiled}\n})`)(name => name === 'react-native' ? require('react-native-web/dist/cjs/index.js') : name === './config' ? { MAP_MODES: ['street', 'satellite', 'hybrid'] } : require(name), module, module.exports);
  const html = renderToStaticMarkup(React.createElement(module.exports.MapFrame, { status: 'unavailable', mode: 'street', modes: [], onMode() {} }));
  assert.match(html, /Campus maps are not available yet/);
  assert.match(html, /aria-disabled="true"/);
  assert.match(html, /satellite map/);
  assert.doesNotMatch(html, /api\.maptiler|geolocation|<canvas/);
});

test('a style-load event cannot hide a worker failure until an explicit retry', () => {
  const map = fakeMap(); const states = []; const controller = mapController(map, 'street', value => states.push(value));
  map.events.get('error')(); map.events.get('style.load')();
  assert.deepEqual(states, ['error']);
  controller.switchStyle('street', true); map.events.get('style.load')();
  assert.deepEqual(states, ['error', 'loading', 'ready']); controller.dispose();
});
test('self-hosted worker and license match the exact pinned renderer package', async () => {
  const { readFileSync } = await import('node:fs');
  const version = JSON.parse(readFileSync(new URL('../node_modules/maplibre-gl/package.json', import.meta.url), 'utf8')).version;
  const base = new URL(`../public/maplibre/${version}/`, import.meta.url);
  assert.deepEqual(readFileSync(new URL('maplibre-gl-worker.mjs', base)), readFileSync(new URL('../node_modules/maplibre-gl/dist/maplibre-gl-worker.mjs', import.meta.url)));
  assert.deepEqual(readFileSync(new URL('LICENSE.txt', base)), readFileSync(new URL('../node_modules/maplibre-gl/LICENSE.txt', import.meta.url)));
});


test('OpenFreeMap supports web and native street maps without a provider key', () => {
  const style = 'https://tiles.openfreemap.org/styles/liberty';
  const config = mapConfig('true', undefined, { street: style });
  assert.equal(config.enabled, true);
  assert.deepEqual(config.styles, { street: style });
  assert.equal(config.styles.satellite, undefined);
  assert.equal(config.styles.hybrid, undefined);
});

test('a new destination updates an already loaded map and survives a style reload',()=>{
  const map=fakeMap(); const controller=mapController(map,'street',()=>{});
  map.events.get('style.load')();
  const overlay={type:'FeatureCollection',features:[{type:'Feature',geometry:{type:'Point',coordinates:CAMPUS_CENTER},properties:{kind:'entrance'}}]};
  controller.setOverlay(overlay);assert.deepEqual(map.calls.at(-1),['overlay',overlay]);
  controller.switchStyle('other');controller.setOverlay({type:'FeatureCollection',features:[]});assert.deepEqual(map.calls.at(-1),['style','other']);
  map.events.get('style.load')();assert.deepEqual(map.calls.at(-1),['overlay',{type:'FeatureCollection',features:[]}]);
});

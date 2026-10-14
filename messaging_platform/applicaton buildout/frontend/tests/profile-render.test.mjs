import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { runInThisContext } from 'node:vm';
import test from 'node:test';
import React from 'react';
import { renderToStaticMarkup } from 'react-dom/server';
import ts from 'typescript';

const require = createRequire(import.meta.url);
const web = require('react-native-web/dist/cjs/index.js');
function load(path, mocks) {
  const source = ts.transpileModule(readFileSync(new URL(path, import.meta.url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  runInThisContext(`(function(require,module,exports){${source}\n})`)(name => name in mocks ? mocks[name] : require(name), module, module.exports);
  return module.exports;
}
const avatars = load('../src/components/Avatar.tsx', { 'react-native': { ...web, Image: ({ source }) => React.createElement('img', { src: source.uri }) }, '../services/api': { API_URL: 'https://test.example' } });
const { ProfileEditor } = load('../src/components/ProfileEditor.tsx', {
  'react-native': web,
  'expo-router': { useRouter: () => ({}) },
  'expo-router/react-navigation': { useHeaderHeight: () => 64 },
  'expo-image-picker': { launchImageLibraryAsync() { throw new Error('Picker must open only on user action'); } },
  './Avatar': avatars,
  '../context/AuthContext': { useAuth: () => ({}) },
  '../services/api': { api() { throw new Error('Rendering must not write a profile'); }, ApiError: Error },
});
const user = { id: 1, sub: 'test', email: 'student@example.test', username: 'student_1', display_name: 'Test Student', bio: 'Hello <script>world</script>' };

test('profile form restores saved values, keeps email read-only, and starts with save disabled', () => {
  const html = renderToStaticMarkup(React.createElement(ProfileEditor, { user, token: 'fake' }));
  assert.match(html, /value="student_1"/);
  assert.match(html, /value="Test Student"/);
  assert.match(html, /Hello &lt;script&gt;world&lt;\/script&gt;/);
  assert.match(html, /student@example.test/);
  assert.doesNotMatch(html, /value="student@example.test"/);
  assert.match(html, /aria-disabled="true"[^>]*><div[^>]*>Save changes/);
  assert.doesNotMatch(html, /Remove photo/);
});

test('existing photos expose replacement/removal and do not embed storage credentials', () => {
  const html = renderToStaticMarkup(React.createElement(ProfileEditor, { user: { ...user, avatar_url: '/api/avatars/test.jpg' }, token: 'fake' }));
  assert.match(html, /Change photo/);
  assert.match(html, /Remove photo/);
  assert.match(html, /test\.example\/api\/avatars\/test\.jpg/);
});

test('names and initials use display name then username then legacy identity', () => {
  assert.equal(avatars.profileName(user, 'email'), 'Test Student');
  assert.equal(avatars.profileName({ username: 'student_1' }, 'email'), 'student_1');
  assert.equal(avatars.profileName(null, 'legacy@example.test'), 'legacy@example.test');
  const html = renderToStaticMarkup(React.createElement(avatars.Avatar, { profile: user }));
  assert.match(html, />T<\/div>/);
});

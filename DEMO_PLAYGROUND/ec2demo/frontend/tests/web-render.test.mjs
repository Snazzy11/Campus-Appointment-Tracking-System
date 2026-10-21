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
const screenSource = readFileSync(new URL('../src/screens/MessagingScreen.tsx', import.meta.url), 'utf8');
const compiled = ts.transpileModule(screenSource, {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;

const pickerCompiled = ts.transpileModule(readFileSync(new URL('../src/components/RecipientPicker.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const pickerModule = { exports: {} };
runInThisContext(`(function(require, module, exports) { ${pickerCompiled}\n})`)(name => {
  if (name === 'react-native') return web;
  if (name === '../services/api') return { api() { throw new Error('Search must not run during static rendering'); }, ApiError: Error };
  if (name === '../services/recipient-search') return { emptySearch: { status: 'idle', matches: [], error: '' } };
  return require(name);
}, pickerModule, pickerModule.exports);

function renderScreen(account) {
  const imports = {
    'react-native': web,
    'react-native-safe-area-context': { SafeAreaView: web.View },
    'expo-status-bar': { StatusBar: () => null },
    '../context/AuthContext': { useAuth: () => ({
      token: account ? 'test-session' : null, user: account, loading: false, error: '',
      expire() {}, async signOut() {}, clearError() {},
    }) },
    '../components/LoginButton': { LoginButton: () => null },
    '../components/RecipientPicker': pickerModule.exports,
    '../services/api': { api: () => { throw new Error('Network requests must not run during rendering'); }, ApiError: Error },
    '../services/stream': { subscribe: () => { throw new Error('Streams must not start during rendering'); } },
  };
  const module = { exports: {} };
  const evaluate = runInThisContext(`(function(require, module, exports) { ${compiled}\n})`);
  evaluate(name => name in imports ? imports[name] : require(name), module, module.exports);
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args.map(String).join(' '));
  try {
    const html = renderToStaticMarkup(React.createElement(module.exports.MessagingScreen));
    assert.match(html, /Campus Messaging/);
    assert.deepEqual(errors.filter(line => line.includes('Unexpected text node')), []);
    return html;
  } finally { console.error = original; }
}

test('anonymous web screen renders without raw text inside a View when errors are empty', () => {
  assert.match(renderScreen(null), /Public chat/);
});

test('signed-in web screen renders without raw text inside a View when errors are empty', () => {
  const account = { authenticated: true, id: 7, sub: 'student', email: 'student@example.test' };
  const html = renderScreen(account);
  assert.match(html, /student@example.test/);
  assert.match(html, /Recipient email/);
  assert.match(html, /Type at least 3 characters/);
  assert.doesNotMatch(html, /Recipient user ID/);
});

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

const groupCompiled = ts.transpileModule(readFileSync(new URL('../src/components/GroupControls.tsx', import.meta.url), 'utf8'), {
  compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const groupModule = { exports: {} };
runInThisContext(`(function(require, module, exports) { ${groupCompiled}\n})`)(name => {
  if (name === 'react-native') return web;
  if (name === 'react-native-safe-area-context') return { SafeAreaView: web.View };
  if (name === './RecipientPicker') return pickerModule.exports;
  if (name === '../services/api') return { api() { throw new Error('Requests must not run during rendering'); }, ApiError: Error };
  return require(name);
}, groupModule, groupModule.exports);

const avatar = { Avatar: () => null, profileName: (profile, fallback) => profile?.display_name || profile?.username || fallback };
function loadComponent(file, extra = {}) {
  const output = ts.transpileModule(readFileSync(new URL(file, import.meta.url), 'utf8'), {
    compilerOptions: { jsx: ts.JsxEmit.ReactJSX, module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const module = { exports: {} };
  const imports = { 'react-native': web, './Avatar': avatar, './AppIcon': { AppIcon: () => null }, ...extra };
  runInThisContext(`(function(require, module, exports) { ${output}\n})`)(name => name in imports ? imports[name] : require(name), module, module.exports);
  return module.exports;
}
const inbox = loadComponent('../src/services/inbox.ts');
const conversationInbox = loadComponent('../src/components/ConversationInbox.tsx', { '../services/inbox': inbox });
const chatMessage = loadComponent('../src/components/ChatMessage.tsx', { '../services/inbox': inbox });

const calendar = loadComponent('../src/features/schedule/calendar.ts');
const chatUI = loadComponent('../src/features/schedule/ui.tsx');
const chatImports = { '../../services/api': { api() { throw new Error('No network during render'); } }, '../schedule/ui': chatUI, '../schedule/calendar': calendar };
const chatTools = loadComponent('../src/features/chat/ChatTools.tsx', chatImports);
const messageActions = loadComponent('../src/features/chat/MessageActions.tsx', chatImports);

function renderScreen(account, width = 390) {
  const imports = {
    'react-native': { ...web, useWindowDimensions: () => ({ width, height: 844, scale: 1, fontScale: 1 }) },
    'react-native-safe-area-context': { SafeAreaView: web.View },
    'expo-router/react-navigation': { useHeaderHeight: () => 64, useIsFocused: () => true },
    'expo-status-bar': { StatusBar: () => null },
    '../context/AuthContext': { useAuth: () => ({
      token: account ? 'test-session' : null, user: account, loading: false, error: '',
      expire() {}, async signOut() {}, clearError() {},
    }) },
    '../components/ConversationInbox': conversationInbox,
    '../components/ChatMessage': chatMessage,
    '../features/chat/ChatTools': chatTools,
    '../features/chat/MessageActions': messageActions,
    '../services/inbox': inbox,
    '../components/LoginButton': { LoginButton: () => null },
    '../components/RecipientPicker': pickerModule.exports,
    '../components/Avatar': { Avatar: () => null, profileName: (profile, fallback) => profile?.display_name || profile?.username || fallback },
    '../components/GroupControls': groupModule.exports,
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
    assert.match(html, /Public chat/);
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

  assert.match(html, /New message/);
  assert.doesNotMatch(html, />Refresh</);
  assert.match(html, /New group/);
  assert.match(html, /Search conversations/);
  assert.doesNotMatch(html, /Message text/);
  assert.doesNotMatch(html, /Recipient user ID/);
});

test('static HTML stays identical across viewport widths for hydration', () => {
  const html = renderScreen({ authenticated: true, id: 7, email: 'student@example.test' }, 1200);
  assert.match(html, /Search conversations/);
  assert.equal(html, renderScreen({ authenticated: true, id: 7, email: 'student@example.test' }, 390));
});

test('campus report cards escape untrusted text and require sign-in for submission', () => {
  const { BlipPanel } = loadComponent('../src/features/maps/BlipPanel.tsx', {
    '../../context/AuthContext': { useAuth: () => ({ user: null, token: null }) },
    '../../services/api': { api() { throw new Error('No requests during render'); } },
    '../../services/stream': {subscribe:()=>()=>{}},
    './pathReview': {closurePreview:()=>[],nearbyPathIds:()=>[]},
    './liveReports': {moderationProblem:()=>''},
  });
  const destinations = { blips: { data: {type:'FeatureCollection',features:[{
    id:1,geometry:{type:'Point',coordinates:[-84.78,43.59]},
    properties:{category:'hazard',description:'<script>alert(1)</script>',severity:'low',verified:false,expires_at:'2026-10-15T00:00:00Z'}
  }]},loading:false,error:'',refresh(){} },showReport(){} };
  const html=renderToStaticMarkup(React.createElement(BlipPanel,{destinations}));
  assert.match(html,/&lt;script&gt;/);
  assert.doesNotMatch(html,/<script>/);
  assert.match(html,/Use Sign in in the header/);
  assert.match(html,/Show report 1 on map/);
});

test('availability card starts with opt-in access and reveals no schedule details', () => {
  const html = renderToStaticMarkup(React.createElement(chatTools.ChatCard, { token: 'test', userId: 1, conversation: { members: [] }, message: { id: 1, version: 1, attachment: { type: 'availability', start_date: '2026-10-14', end_date: '2026-10-20' } } }));
  assert.match(html, /View \/ opt in/);
  assert.doesNotMatch(html, /Pearce|CPS 410/);
});

const agenda = loadComponent('../src/features/schedule/Agenda.tsx', { './calendar': calendar, './ui': chatUI });
test('phone agenda exposes complete class and lab times without a nested timeline', () => {
  const term = { season: 'Fall', year: 2026, start_date: '2026-08-31', end_date: '2026-12-18', courses: [{ section: 'BIO', course: 'BIO 213', title: 'Foundations of Ecology', meetings: [{ days: [2], start: 660, end: 710, start_date: '2026-08-31', end_date: '2026-12-18', location: 'Biosciences Building 1010' }, { days: [2], start: 720, end: 890, start_date: '2026-08-31', end_date: '2026-12-18', location: 'Biosciences Building 2016' }] }] };
  const html = renderToStaticMarkup(React.createElement(agenda.Agenda, { term, days: ['2026-10-14'], today: '2026-10-14', select() {} }));
  assert.match(html, /11:00 AM/); assert.match(html, /12:00 PM/); assert.match(html, /2:50 PM/);
  assert.match(html, /Biosciences Building 2016/); assert.match(html, /Foundations of Ecology/);
});

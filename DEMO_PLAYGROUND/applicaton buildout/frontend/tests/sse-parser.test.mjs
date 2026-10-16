import assert from 'node:assert/strict';
import test from 'node:test';
import { createSseParser } from '../src/services/sse-parser.ts';

test('parses split named events, comments, and multiple frames', () => {
  const events = [];
  const parse = createSseParser(event => events.push(event));
  parse(': connected\n\nevent: private_mes');
  parse('sage\ndata: {"text":"Hello 🎓"}\n');
  assert.equal(events.length, 0);
  parse('\ndata: {"id":2}\n\n: keepalive\n\n');
  assert.deepEqual(events, [
    { event: 'private_message', data: '{"text":"Hello 🎓"}' },
    { event: 'message', data: '{"id":2}' },
  ]);
});

test('handles CRLF delimiters across chunks and multiline data', () => {
  const events = [];
  const parse = createSseParser(event => events.push(event));
  parse('event: private_message\r\ndata: first\r\ndata: second\r');
  parse('\n\r');
  parse('\n');
  assert.deepEqual(events, [{ event: 'private_message', data: 'first\nsecond' }]);
});

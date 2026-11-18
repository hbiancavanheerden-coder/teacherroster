import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { extractFromDocument, MODEL } from '../../netlify/functions/_lib/extract.js';

// Simulates the Claude streaming API so we can check the exact request and the parsing, without a real key.
let captured;
const realFetch = globalThis.fetch;
function sse(events) {
  const body = events.map(([event, data]) => `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`).join('');
  return new Response(body, { status: 200, headers: { 'content-type': 'text/event-stream' } });
}
function reply(json, stop = 'end_turn') {
  const text = JSON.stringify(json);
  return sse([
    ['message_start', { type: 'message_start', message: { id: 'msg_1', type: 'message', role: 'assistant', model: MODEL, content: [], stop_reason: null, stop_sequence: null, usage: { input_tokens: 1200, output_tokens: 0 } } }],
    ['content_block_start', { type: 'content_block_start', index: 0, content_block: { type: 'text', text: '' } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: text.slice(0, 20) } }],
    ['content_block_delta', { type: 'content_block_delta', index: 0, delta: { type: 'text_delta', text: text.slice(20) } }],
    ['content_block_stop', { type: 'content_block_stop', index: 0 }],
    ['message_delta', { type: 'message_delta', delta: { stop_reason: stop, stop_sequence: null }, usage: { output_tokens: 300 } }],
    ['message_stop', { type: 'message_stop' }],
  ]);
}
let next;
beforeAll(() => {
  process.env.ANTHROPIC_API_KEY = 'sk-ant-test';
  globalThis.fetch = async (url, init) => { captured = { url: String(url), headers: new Headers(init.headers), body: JSON.parse(init.body) }; return next(); };
});
afterAll(() => { globalThis.fetch = realFetch; });

const context = { schoolName: 'Test', today: '2026-11-18', terms: [{ name: 'Term 4', start: '2026-10-06', end: '2026-12-09' }], holidays: ['2026-11-04'], dutyPoints: ['Morning Taxi'], staff: ['Bianca', 'Nancy'], periods: [] };
const result = { documentType: 'duty_roster', duties: [{ date: '2026-10-06', dutyPoint: 'Morning Taxi', staffName: 'Bianca', startTime: '', endTime: '', note: '' }], lessons: [], warnings: [] };

describe('extractFromDocument', () => {
  it('sends a structured-output request with fallbacks and the file, and parses the JSON', async () => {
    next = () => reply(result);
    const r = await extractFromDocument({ kind: 'roster', fileId: 'file_123', blockType: 'document', context });
    expect(r.data).toEqual(result);
    expect(captured.url).toContain('/v1/messages');
    expect(captured.headers.get('anthropic-beta')).toContain('server-side-fallback-2026-07-01');
    const b = captured.body;
    expect(b.model).toBe('claude-opus-5-5');
    expect(b.stream).toBe(true);
    expect(b.fallbacks).toBe('default');
    expect(b.output_config.format.type).toBe('json_schema');
    expect(b.messages[0].content[0]).toMatchObject({ type: 'document', source: { type: 'file', file_id: 'file_123' } });
    expect(b.messages[0].content[1].text).toContain('Term 4 2026-10-06 to 2026-12-09');
  });
  it('uses an image block for photos', async () => {
    next = () => reply(result);
    await extractFromDocument({ kind: 'timetable', fileId: 'file_9', blockType: 'image', context });
    expect(captured.body.messages[0].content[0].type).toBe('image');
  });
  it('turns refusals and truncation into friendly errors', async () => {
    next = () => reply({}, 'refusal');
    await expect(extractFromDocument({ kind: 'roster', fileId: 'f', blockType: 'document', context })).rejects.toThrow(/could not be processed/);
    next = () => reply({}, 'max_tokens');
    await expect(extractFromDocument({ kind: 'roster', fileId: 'f', blockType: 'document', context })).rejects.toThrow(/too large/);
  });
});

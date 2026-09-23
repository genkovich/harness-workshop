import { test } from 'node:test';
import assert from 'node:assert/strict';
import { APICallError, tool } from 'ai';
import { MockLanguageModelV3 } from 'ai/test';
import { z } from 'zod';

const response = content => ({
  content,
  finishReason: {
    unified: content.some(part => part.type === 'tool-call') ? 'tool-calls' : 'stop',
    raw: '',
  },
  usage: {
    inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
    outputTokens: { total: 0, text: 0, reasoning: 0 },
  },
});
const final = response([{ type: 'text', text: 'Готово.' }]);
const limited = (message, responseHeaders, statusCode = 429) => new APICallError({
  message, responseHeaders, statusCode,
  url: 'https://api.groq.com/openai/v1/chat/completions',
  requestBodyValues: {},
});

test('08b API: тимчасові 429 і 503 повторюються без повторного виконання дії', async t => {
  const { runAgent } = await import('../src/harness.ts');
  const waits = [];
  t.mock.method(globalThis, 'setTimeout', (callback, milliseconds) => {
    waits.push(milliseconds);
    queueMicrotask(callback);
    return {};
  });
  const agent = model => ({
    model, system: 'Виконай дію.', maxSteps: 2,
    tools: { save: tool({ description: 'Запис', inputSchema: z.object({}) }) },
    runTool: async () => ({ saved: true }),
  });

  for (const [statusCode, headers] of [[429, undefined], [429, { 'retry-after': '21' }], [503, undefined]]) {
    waits.length = 0;
    const requests = [];
    let executions = 0;
    const model = new MockLanguageModelV3({ doGenerate: async options => {
      requests.push(structuredClone(options.prompt));
      if (requests.length === 1) {
        return response([{ type: 'tool-call', toolCallId: 'save-1', toolName: 'save', input: '{}' }]);
      }
      if (requests.length === 2) {
        throw limited('Тимчасово неможливо виконати запит', headers, statusCode);
      }
      return final;
    } });
    const options = agent(model);
    options.runTool = async () => { executions += 1; return { saved: true }; };
    const result = await runAgent(options, 'Збережи');
    assert.equal(result.reason, 'final');
    assert.equal(requests.length, 3);
    assert.equal(executions, 1);
    assert.deepEqual(requests[1], requests[2]);
    assert.deepEqual(waits, [headers ? 21000 : 2000]);
  }

  for (const error of [
    limited('Invalid key', { 'retry-after': '1' }, 401),
    limited('Invalid request', undefined, 400),
    limited('Forbidden', undefined, 403),
    new DOMException('Скасовано', 'AbortError'),
  ]) {
    waits.length = 0;
    const model = new MockLanguageModelV3({ doGenerate: async () => { throw error; } });
    await assert.rejects(() => runAgent(agent(model), 'Перевір'), e => e === error);
    assert.equal(model.doGenerateCalls.length, 1);
    assert.deepEqual(waits, []);
  }

  waits.length = 0;
  const error = limited('Rate limit reached', { 'retry-after': '1' });
  const model = new MockLanguageModelV3({ doGenerate: async () => { throw error; } });
  await assert.rejects(
    () => runAgent(agent(model), 'Перевір'),
    e => e.reason === 'maxRetriesExceeded' && e.errors.length === 3,
  );
  assert.equal(model.doGenerateCalls.length, 3);
  assert.deepEqual(waits, [1000, 1000]);
});


test('08b Дані: повтори запиту не змінюють пошук і перехід між порціями', async t => {
  const { searchStories, readDiscussion } = await import('../src/news/api.ts');
  const { news } = await import('../src/news/agent.ts');
  const hits = Array.from({ length: 12 }, (_, i) => ({
    objectID: String(i + 1), title: 'Тема', url: null,
    points: 1, num_comments: 10, created_at: '2026-09-22',
  }));
  const children = Array.from({ length: 11 }, (_, i) => ({
    id: i + 20, author: 'Автор', text: 'x'.repeat(1_200), children: [],
  }));
  t.mock.method(globalThis, 'fetch', async url => {
    if (String(url).includes('search_by_date')) {
      assert.equal(new URL(url).searchParams.get('hitsPerPage'), '10');
      return Response.json({ hits });
    }
    return Response.json({ id: 1, type: 'story', title: 'Тема', children });
  });
  assert.equal((await searchStories('agents')).length, 10);
  const first = await readDiscussion(1);
  assert.equal(first.comments.length, 10);
  assert.ok(first.comments.every(comment => comment.text.length === 1_000 && comment.truncated));
  assert.equal(first.nextOffset, 10);
  const last = await readDiscussion(1, first.nextOffset);
  assert.equal(last.comments.length, 1);
  assert.equal(last.nextOffset, null);
  assert.match(news.tools.searchStories.description, /up to 10 HN discussions/);
  assert.match(news.tools.readDiscussion.description, /up to 10 comments/);
});

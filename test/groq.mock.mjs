// Підмінюємо лише HTTP. src/main.ts і справжній Groq SDK працюють як завжди.
// Цей файл підключається тільки тестом через node --import; мережі немає.
import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';

globalThis.fetch = async (url, options) => {
  assert.equal(String(url), 'https://api.groq.com/openai/v1/chat/completions');
  const request = JSON.parse(options.body);
  appendFileSync(process.env.HARNESS_REQUESTS_PATH, JSON.stringify(request) + '\n');
  // Відтворюємо ліміт із реальної помилки учасника: запит понад 1000 не приймається.
  if (request.max_tokens > 1000 || process.env.HARNESS_SETUP_STATUS === 'too-large') {
    return Response.json({ error: {
      message: 'Request too large on output tokens per minute (OTPM): Limit 1000. Reduce max_tokens.',
      type: 'tokens',
    } }, { status: 429 });
  }
  if (process.env.HARNESS_SETUP_TEST === '1' && process.env.HARNESS_SETUP_STATUS === '429') {
    return Response.json({ error: { message: 'Rate limit reached', type: 'tokens' } }, {
      status: 429, headers: { 'retry-after': '30' },
    });
  }
  return new Response(JSON.stringify({
    id: 'offline', object: 'chat.completion', created: 1,
    model: request.model,
    choices: [{ index: 0, finish_reason: process.env.HARNESS_SETUP_TEST === '1' ? 'tool_calls' : 'stop', message: process.env.HARNESS_SETUP_TEST === '1' ? {
      role: 'assistant', content: null, tool_calls: [{ id: 'ready_1', type: 'function',
        function: { name: 'ready', arguments: '{}' } }],
    } : {
      role: 'assistant', content: 'Тестова відповідь без мережі.',
    } }],
    usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
  }), { headers: { 'content-type': 'application/json' } });
};

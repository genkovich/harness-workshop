// Підмінюємо лише HTTP. src/main.ts і справжній OpenRouter SDK працюють як завжди.
// Цей файл підключається тільки тестом через node --import; мережі немає.
import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';

globalThis.fetch = async (url, options) => {
  assert.equal(String(url), 'https://openrouter.ai/api/v1/chat/completions');
  const request = JSON.parse(options.body);
  appendFileSync(process.env.HARNESS_REQUESTS_PATH, JSON.stringify(request) + '\n');
  return new Response(JSON.stringify({
    id: 'offline', object: 'chat.completion', created: 1,
    model: request.model,
    choices: [{ index: 0, finish_reason: 'stop', message: {
      role: 'assistant', content: 'Тестова відповідь без мережі.',
    } }],
    usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
  }), { headers: { 'content-type': 'application/json' } });
};

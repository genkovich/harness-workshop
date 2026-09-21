// Підмінюємо лише HTTP. src/main.ts і справжній OpenRouter SDK працюють як завжди.
// Цей файл підключається тільки тестом через node --import; мережі немає.
import assert from 'node:assert/strict';
import { appendFileSync } from 'node:fs';

globalThis.fetch = async (url, options) => {
  if (process.env.HARNESS_SETUP_TEST === '1' && String(url).endsWith('/models')) {
    return Response.json({ data: [{ id: 'qwen/qwen3.8-27b:free',
      pricing: { prompt: '0', completion: '0' }, supported_parameters: ['tools'] }] });
  }
  assert.equal(String(url), 'https://openrouter.ai/api/v1/chat/completions');
  const request = JSON.parse(options.body);
  appendFileSync(process.env.HARNESS_REQUESTS_PATH, JSON.stringify(request) + '\n');
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

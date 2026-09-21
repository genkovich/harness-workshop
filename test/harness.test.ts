import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV3 } from 'ai/test';
import { runAgent } from '../src/harness.ts';
import { billing } from '../src/billing/agent.ts';

// У тестах читаємо назви перевірок. Покроковий лог видно через npm start.
mock.method(console, 'log', () => {});

type Reply = Awaited<ReturnType<MockLanguageModelV3['doGenerate']>>;

// Модель підмінена лише в тестах. Цикл, SDK і файлові операції справжні.
function reply(content: Reply['content']): Reply {
  return {
    content,
    finishReason: {
      unified: content.some((c) => c.type === 'tool-call') ? 'tool-calls' : 'stop',
      raw: '',
    },
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 },
    },
    warnings: [],
  };
}

const final = reply([{ type: 'text', text: 'Готово.' }]);
const call = (name: string, input: unknown, id = 'call_1'): Reply['content'][number] => ({
  type: 'tool-call',
  toolCallId: id,
  toolName: name,
  input: JSON.stringify(input),
});

test('Текстова відповідь завершує роботу після одного запиту', async () => {
  const model = new MockLanguageModelV3({ doGenerate: final });
  const result = await runAgent({ ...billing, model }, 'Привіт');

  assert.equal(result.text, 'Готово.');
  assert.equal(result.reason, 'final');
  assert.equal(model.doGenerateCalls.length, 1);
  assert.equal(model.doGenerateCalls[0].prompt.at(-1)?.role, 'user');
});

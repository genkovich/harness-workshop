import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { MockLanguageModelV3 } from 'ai/test';
import { runAgent } from '../src/harness.ts';
import { billing } from '../src/billing/agent.ts';
import { readSkill } from '../src/skills.ts';

type Reply = Awaited<ReturnType<MockLanguageModelV3['doGenerate']>>;

// Модель підмінена лише в тестах. Цикл, SDK і файлові операції справжні.
function reply(content: Reply['content']): Reply {
  return {
    content,
    finishReason: { unified: content.some(c => c.type === 'tool-call') ? 'tool-calls' : 'stop', raw: '' },
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 },
    },
    warnings: [],
  };
}

const final = reply([{ type: 'text', text: 'Готово.' }]);
const call = (name: string, input: unknown, id = 'call_1'): Reply['content'][number] => ({
  type: 'tool-call', toolCallId: id, toolName: name, input: JSON.stringify(input),
});

// STEP: basic
test('Текстова відповідь завершує роботу після одного запиту', async () => {
  const model = new MockLanguageModelV3({ doGenerate: final });
  const result = await runAgent({ ...billing, model }, 'Привіт');

  assert.equal(result.text, 'Готово.');
  assert.equal(result.reason, 'final');
  assert.equal(model.doGenerateCalls.length, 1);
  assert.equal(model.doGenerateCalls[0].prompt.at(-1)?.role, 'user');
});

// STEP: loop
test('Два тули: історія 1 → 3 → 5, відповідь записана рівно один раз', async t => {
  const originalDirectory = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), 'harness-'));
  process.chdir(directory);
  t.after(() => process.chdir(originalDirectory));

  const model = new MockLanguageModelV3({ doGenerate: [
    reply([call('getCharges', { customerId: 42 })]),
    reply([call('sendReply', { customerId: 42, text: 'Два списання по $49.' }, 'call_2')]),
    final,
  ] });
  const result = await runAgent({ ...billing, model, beforeTool: () => null }, 'Перевір списання');

  assert.equal(result.reason, 'final');
  const histories = model.doGenerateCalls.map(request => request.prompt.filter(m => m.role !== 'system'));
  assert.deepEqual(histories.map(messages => messages.length), [1, 3, 5]);
  assert.equal(JSON.stringify(histories[1]).includes('call_1'), true);

  const lines = (await readFile('.data/outbox.jsonl', 'utf8')).trim().split('\n');
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).customerId, 42);
});

test('Кілька викликів отримують результати зі своїми id', async () => {
  const model = new MockLanguageModelV3({ doGenerate: [
    reply([call('getCharges', { customerId: 42 }, 'a'), call('getCharges', { customerId: 7 }, 'b')]),
    final,
  ] });
  await runAgent({ ...billing, model }, 'Два клієнти');

  const results = model.doGenerateCalls[1].prompt.filter(message => message.role === 'tool');
  assert.deepEqual(results.flatMap(message => message.content.filter(part => part.type === 'tool-result').map(part => part.toolCallId)), ['a', 'b']);
});

test('Ліміт зупиняє модель, яка знову просить той самий тул', async () => {
  const model = new MockLanguageModelV3({ doGenerate: reply([call('getCharges', { customerId: 42 })]) });
  const result = await runAgent({ ...billing, model, maxSteps: 2 }, 'Повторюй');

  assert.equal(result.reason, 'limit');
  assert.equal(model.doGenerateCalls.length, 2);
});

test('Некоректні аргументи й невідомий тул повертають помилку в контекст', async () => {
  for (const toolCall of [call('getCharges', { customerId: '42' }), call('unknown', {})]) {
    const model = new MockLanguageModelV3({ doGenerate: [reply([toolCall]), final] });
    await runAgent({ ...billing, model }, 'Некоректний виклик');

    const next = model.doGenerateCalls[1].prompt;
    assert.equal(next.filter(message => message.role === 'tool').length, 1);
    const nextRequest = JSON.stringify(next);
    assert.match(nextRequest, /error/);
  }
});

test('Обрізані аргументи не доходять до виконання', async () => {
  const truncated = reply([call('getCharges', { customerId: 42 })]);
  truncated.finishReason = { unified: 'length', raw: 'length' };
  const model = new MockLanguageModelV3({ doGenerate: truncated });

  await assert.rejects(() => runAgent({ ...billing, model }, 'Перевір'), /обрізано/);
});

// STEP: context
test('AGENTS.md зʼявляється в першому повідомленні', async () => {
  const model = new MockLanguageModelV3({ doGenerate: final });
  await runAgent({ ...billing, model }, 'Перевір');

  assert.match(JSON.stringify(model.doGenerateCalls[0].prompt), /Дякуємо за звернення/);
});

// STEP: skills
test('Спершу опис skill, повний текст лише після readSkill', async () => {
  const model = new MockLanguageModelV3({ doGenerate: [
    reply([call('readSkill', { name: 'billing' })]),
    final,
  ] });
  await runAgent({ ...billing, model }, 'Прочитай billing');

  assert.doesNotMatch(JSON.stringify(model.doGenerateCalls[0].prompt), /Перевір дати, суми/);
  assert.match(JSON.stringify(model.doGenerateCalls[1].prompt), /Перевір дати, суми/);
  assert.throws(() => readSkill('../../.env'), /Невідомий skill/);
});

// STEP: guard
test('Без дозволу sendReply не створює outbox, модель бачить блокування', async t => {
  const originalDirectory = process.cwd();
  const approved = process.env.APPROVED;
  process.chdir(await mkdtemp(join(tmpdir(), 'harness-blocked-')));
  process.env.APPROVED = '0';
  t.after(() => {
    process.chdir(originalDirectory);
    if (approved === undefined) delete process.env.APPROVED;
    else process.env.APPROVED = approved;
  });

  const model = new MockLanguageModelV3({ doGenerate: [
    reply([call('sendReply', { customerId: 42, text: 'Відповідь' })]),
    final,
  ] });
  await runAgent({ ...billing, model }, 'Надішли');

  await assert.rejects(() => readFile('.data/outbox.jsonl'), { code: 'ENOENT' });
  assert.match(JSON.stringify(model.doGenerateCalls[1].prompt), /blocked, ask the user/);
});

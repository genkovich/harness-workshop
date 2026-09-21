import { test, mock } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { createOpenRouter } from "@openrouter/ai-sdk-provider";
import { MockLanguageModelV3 } from "ai/test";
mock.method(console, "log", () => {
});
async function runAgent(options, task) {
  const { runAgent: runAgent2 } = await import("../src/harness.ts");
  return runAgent2(options, task);
}
async function agent(options) {
  const { billing } = await import("../src/billing/agent.ts");
  return { ...billing, ...options };
}
function reply(content) {
  return {
    content,
    finishReason: {
      unified: content.some((c) => c.type === "tool-call") ? "tool-calls" : "stop",
      raw: ""
    },
    usage: {
      inputTokens: { total: 0, noCache: 0, cacheRead: 0, cacheWrite: 0 },
      outputTokens: { total: 0, text: 0, reasoning: 0 }
    },
    warnings: []
  };
}
const final = reply([{ type: "text", text: "Готово." }]);
const call = (name, input, id = "call_1") => ({
  type: "tool-call",
  toolCallId: id,
  toolName: name,
  input: JSON.stringify(input)
});
test("03 Запит: Текстова відповідь завершує роботу після одного запиту", async () => {
  const model = new MockLanguageModelV3({ doGenerate: final });
  const result = await runAgent({ model, system: "Відповідай українською." }, "Привіт");
  assert.equal(result.text, "Готово.");
  assert.equal(result.reason, "final");
  assert.equal(model.doGenerateCalls.length, 1);
  assert.equal(model.doGenerateCalls[0].prompt.at(-1)?.role, "user");
});
test("05 Описи: модель отримує схему getCharges", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: [reply([call("getCharges", { customerId: 42 })]), final]
  });
  await runAgent(await agent({ model }), "Перевір");
  const tool = model.doGenerateCalls[0].tools.find((tool2) => tool2.name === "getCharges");
  assert.ok(tool);
  assert.equal(tool.inputSchema.properties.customerId.type, "integer");
});
test("06 Виконання: getCharges читає дані, аргументи перевіряються", async () => {
  const { billing } = await import("../src/billing/agent.ts");
  const charges = await billing.runTool("getCharges", { customerId: 42 });
  assert.deepEqual(charges.map((charge) => charge.id), ["ch_01", "ch_02"]);
  await assert.rejects(() => billing.runTool("getCharges", { customerId: "42" }));
});
test("07 Історія: результат повертається з id виклику", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: [reply([call("getCharges", { customerId: 42 }, "id-42")]), final]
  });
  const result = await runAgent(await agent({ model }), "Перевір");
  const message = result.messages.find((message2) => message2.role === "tool");
  assert.ok(message);
  assert.equal(message.content[0].toolCallId, "id-42");
  assert.match(JSON.stringify(message), /ch_02/);
});
test("08 Цикл: Два тули: історія 1 → 3 → 5, відповідь записана рівно один раз", async (t) => {
  const originalDirectory = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), "harness-"));
  process.chdir(directory);
  t.after(() => process.chdir(originalDirectory));
  const model = new MockLanguageModelV3({
    doGenerate: [
      reply([call("getCharges", { customerId: 42 })]),
      reply([
        call("sendReply", { customerId: 42, text: "Два списання по $49." }, "call_2")
      ]),
      final
    ]
  });
  const result = await runAgent(
    await agent({ model, beforeTool: () => null }),
    "Перевір списання"
  );
  assert.equal(result.reason, "final");
  const histories = model.doGenerateCalls.map(
    (request) => request.prompt.filter((m) => m.role !== "system")
  );
  assert.deepEqual(
    histories.map((messages) => messages.length),
    [1, 3, 5]
  );
  assert.equal(JSON.stringify(histories[1]).includes("call_1"), true);
  const lines = (await readFile(".data/outbox.jsonl", "utf8")).trim().split("\n");
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).customerId, 42);
});
test("08 Кілька тулів: Кілька викликів отримують результати зі своїми id", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: [
      reply([
        call("getCharges", { customerId: 42 }, "a"),
        call("getCharges", { customerId: 7 }, "b")
      ]),
      final
    ]
  });
  await runAgent(await agent({ model }), "Два клієнти");
  const results = model.doGenerateCalls[1].prompt.filter(
    (message) => message.role === "tool"
  );
  assert.deepEqual(
    results.flatMap(
      (message) => message.content.filter((part) => part.type === "tool-result").map((part) => part.toolCallId)
    ),
    ["a", "b"]
  );
});
test("08 Ліміт: Ліміт зупиняє модель, яка знову просить той самий тул", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: reply([call("getCharges", { customerId: 42 })])
  });
  const result = await runAgent(await agent({ model, maxSteps: 2 }), "Повторюй");
  assert.equal(result.reason, "limit");
  assert.equal(model.doGenerateCalls.length, 2);
});
test("08 Помилка: Некоректні аргументи й невідомий тул повертають помилку в контекст", async () => {
  for (const toolCall of [
    call("getCharges", { customerId: "42" }),
    call("unknown", {})
  ]) {
    const model = new MockLanguageModelV3({ doGenerate: [reply([toolCall]), final] });
    await runAgent(await agent({ model }), "Некоректний виклик");
    const next = model.doGenerateCalls[1].prompt;
    assert.equal(next.filter((message) => message.role === "tool").length, 1);
    const nextRequest = JSON.stringify(next);
    assert.match(nextRequest, /error/);
  }
});
test("08 Обрізання: Обрізані аргументи не доходять до виконання", async () => {
  const truncated = reply([call("getCharges", { customerId: 42 })]);
  truncated.finishReason = { unified: "length", raw: "length" };
  const model = new MockLanguageModelV3({ doGenerate: truncated });
  let executed = false;
  const options = await agent({ model, runTool: async () => { executed = true; return {}; } });
  await assert.rejects(() => runAgent(options, "Перевір"), /обрізано/);
  assert.equal(executed, false);
});
test("10 Контекст: AGENTS.md зʼявляється в першому повідомленні", async () => {
  const model = new MockLanguageModelV3({ doGenerate: final });
  await runAgent(await agent({ model }), "Перевір");
  assert.match(JSON.stringify(model.doGenerateCalls[0].prompt), /Дякуємо за звернення/);
});
test("11 Skills: Спершу опис skill, повний текст лише після readSkill", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: [reply([call("readSkill", { name: "billing" })]), final]
  });
  await runAgent(await agent({ model }), "Прочитай billing");
  assert.doesNotMatch(
    JSON.stringify(model.doGenerateCalls[0].prompt),
    /Перевір дати, суми/
  );
  assert.match(JSON.stringify(model.doGenerateCalls[1].prompt), /Перевір дати, суми/);
  const { readSkill } = await import("../src/skills.ts");
  assert.throws(() => readSkill("../../.env"), /Невідомий skill/);
});
test("12 Дозвіл: Без дозволу sendReply не створює outbox, модель бачить блокування", async (t) => {
  const originalDirectory = process.cwd();
  const approved = process.env.APPROVED;
  process.chdir(await mkdtemp(join(tmpdir(), "harness-blocked-")));
  process.env.APPROVED = "0";
  t.after(() => {
    process.chdir(originalDirectory);
    if (approved === void 0) delete process.env.APPROVED;
    else process.env.APPROVED = approved;
  });
  const model = new MockLanguageModelV3({
    doGenerate: [
      reply([call("sendReply", { customerId: 42, text: "Відповідь" })]),
      final
    ]
  });
  await runAgent(await agent({ model }), "Надішли");
  await assert.rejects(() => readFile(".data/outbox.jsonl"), { code: "ENOENT" });
  assert.match(JSON.stringify(model.doGenerateCalls[1].prompt), /blocked, ask the user/);
});

// Перші етапи теж перевіряємо виконанням коду, а не пошуком рядків у src.
const root = fileURLToPath(new URL('../', import.meta.url));

async function runEntry(t, task) {
  const temporary = await mkdtemp(join(tmpdir(), 'harness-entry-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const capture = join(temporary, 'requests.jsonl');
  const result = spawnSync(process.execPath, [
    '--import', './test/openrouter.mock.mjs', '--import', 'tsx', 'src/main.ts', task,
  ], {
    cwd: root, encoding: 'utf8', timeout: 15_000,
    env: { ...process.env, OPENROUTER_API_KEY: 'offline-test-key',
      HARNESS_REQUESTS_PATH: capture, TRACE: '0', APPROVED: '0' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Тестова відповідь без мережі/);
  const requests = (await readFile(capture, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(requests.length, 1);
  return requests[0];
}

test('01 Модель: main.ts робить один справжній запит SDK із підміненим HTTP', async (t) => {
  const request = await runEntry(t, 'Привіт');
  assert.equal(request.model, 'openai/gpt-oss-20b');
  assert.ok(request.messages.some(message => message.role === 'user'));
});

test('02 Повідомлення: задача з CLI потрапляє до user, правила до system', async (t) => {
  const task = 'Унікальна задача перевірки CLI';
  const request = await runEntry(t, task);
  assert.ok(request.messages.some(message => message.role === 'system'));
  const user = request.messages.find(message => message.role === 'user');
  assert.ok(JSON.stringify(user.content).includes(task));
});

test('04 Описи: дві схеми перевіряють аргументи, execute не підключений', async () => {
  const { billing } = await import('../src/billing/agent.ts');
  const { getCharges, sendReply } = billing.tools;
  assert.equal(getCharges.execute, undefined);
  assert.equal(sendReply.execute, undefined);
  assert.ok(getCharges.description.length > 0);
  assert.ok(sendReply.description.length > 0);
  assert.equal(getCharges.inputSchema.safeParse({ customerId: 42 }).success, true);
  assert.equal(getCharges.inputSchema.safeParse({ customerId: '42' }).success, false);
  assert.equal(sendReply.inputSchema.safeParse({ customerId: 42, text: '' }).success, false);
});

test('09 Description: змінений опис доходить до моделі, виконання лишається доступним', async (t) => {
  const originalDirectory = process.cwd();
  const temporary = await mkdtemp(join(tmpdir(), 'harness-description-'));
  process.chdir(temporary);
  t.after(async () => {
    process.chdir(originalDirectory);
    await rm(temporary, { recursive: true, force: true });
  });
  const { billing } = await import('../src/billing/agent.ts');
  const model = new MockLanguageModelV3({ doGenerate: [
    reply([call('sendReply', { customerId: 42, text: 'Перевірка опису' })]), final,
  ] });
  await runAgent(await agent({ model, beforeTool: () => null, tools: {
    ...billing.tools, sendReply: { ...billing.tools.sendReply, description: 'never call this' },
  } }), 'Перевір опис');
  const sent = model.doGenerateCalls[0].tools.find(tool => tool.name === 'sendReply');
  assert.equal(sent.description, 'never call this');
  assert.equal(JSON.parse((await readFile('.data/outbox.jsonl', 'utf8')).trim()).customerId, 42);
  // Це перевірка доставки опису й доступності функції, а не слухняності живої моделі.
});

test('08 OpenRouter: HTTP tool call повертається наступним запитом із тим самим id', async () => {
  const requests = [];
  const router = createOpenRouter({ apiKey: 'offline-test-key', fetch: async (url, options) => {
    assert.equal(String(url), 'https://openrouter.ai/api/v1/chat/completions');
    requests.push(JSON.parse(options.body));
    const first = requests.length === 1;
    return new Response(JSON.stringify({
      id: 'offline', object: 'chat.completion', created: 1, model: 'openai/gpt-oss-20b',
      choices: [{ index: 0, finish_reason: first ? 'tool_calls' : 'stop', message: first ? {
        role: 'assistant', content: null, tool_calls: [{ id: 'router_1', type: 'function',
          function: { name: 'getCharges', arguments: '{"customerId":42}' } }],
      } : { role: 'assistant', content: 'Два списання.' } }],
      usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
    }), { headers: { 'content-type': 'application/json' } });
  } });
  const result = await runAgent(await agent({ model: router('openai/gpt-oss-20b') }), 'Перевір 42');
  assert.equal(result.reason, 'final');
  assert.equal(result.text, 'Два списання.');
  assert.equal(requests.length, 2);
  assert.ok(requests[0].tools.some(tool => tool.function.name === 'getCharges'));
  const toolResult = requests[1].messages.find(message => message.role === 'tool');
  assert.equal(toolResult.tool_call_id, 'router_1');
  assert.equal(JSON.parse(toolResult.content)[1].id, 'ch_02');
});

test('12 Дозвіл: APPROVED=1 дозволяє рівно один запис відповіді', async (t) => {
  const originalDirectory = process.cwd();
  const approved = process.env.APPROVED;
  const temporary = await mkdtemp(join(tmpdir(), 'harness-approved-'));
  process.chdir(temporary);
  process.env.APPROVED = '1';
  t.after(async () => {
    process.chdir(originalDirectory);
    if (approved === undefined) delete process.env.APPROVED;
    else process.env.APPROVED = approved;
    await rm(temporary, { recursive: true, force: true });
  });
  const model = new MockLanguageModelV3({ doGenerate: [
    reply([call('sendReply', { customerId: 42, text: 'Дозволено' })]), final,
  ] });
  const result = await runAgent(await agent({ model }), 'Надішли');
  assert.equal(result.reason, 'final');
  const lines = (await readFile('.data/outbox.jsonl', 'utf8')).trim().split('\n');
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).text, 'Дозволено');
});

async function rejectsEmptyTask(t, args) {
  const temporary = await mkdtemp(join(tmpdir(), 'harness-empty-task-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const capture = join(temporary, 'requests.jsonl');
  const result = spawnSync(process.execPath, [
    '--import', './test/openrouter.mock.mjs', '--import', 'tsx', 'src/main.ts', ...args,
  ], {
    cwd: root, encoding: 'utf8', timeout: 15_000,
    env: { ...process.env, OPENROUTER_API_KEY: 'offline-test-key', HARNESS_REQUESTS_PATH: capture },
  });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /Помилка: передай задачу/);
  assert.doesNotMatch(result.stdout, /Тестова відповідь/);
  await assert.rejects(() => readFile(capture), { code: 'ENOENT' });
}

test('02 Ввід: без аргументу помилка, запит до API не відбувається', async (t) => {
  await rejectsEmptyTask(t, []);
});

test('02 Ввід: порожній рядок і пробіли відхиляються до виклику API', async (t) => {
  await rejectsEmptyTask(t, ['']);
  await rejectsEmptyTask(t, ['   ']);
});

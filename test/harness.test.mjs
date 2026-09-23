import { test, mock, beforeEach } from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, readFile, rm, mkdir, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { fileURLToPath, pathToFileURL } from "node:url";
import { createGroq } from "@ai-sdk/groq";
import { MockLanguageModelV3 } from "ai/test";
mock.method(console, "log", () => {
});
async function runAgent(options, task) {
  const { runAgent: runAgent2 } = await import("../src/harness.ts");
  return runAgent2(options, task);
}
async function agent(options) {
  const { news } = await import("../src/news/agent.ts");
  return { ...news, ...options };
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
  const result = await runAgent({ model, system: "Reply in Ukrainian." }, "Привіт");
  assert.equal(result.text, "Готово.");
  assert.equal(result.reason, "final");
  assert.equal(model.doGenerateCalls.length, 1);
  assert.equal(model.doGenerateCalls[0].prompt.at(-1)?.role, "user");
});
test("05 Описи: модель отримує схему searchStories", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: [reply([call("searchStories", { query: "harness" })]), final]
  });
  await runAgent(await agent({ model }), "Перевір");
  const tool = model.doGenerateCalls[0].tools.find((tool2) => tool2.name === "searchStories");
  assert.ok(tool);
  assert.equal(tool.inputSchema.properties.query.type, "string");
});
test("06 Виконання: searchStories повертає теми, аргументи перевіряються", async () => {
  const { news } = await import("../src/news/agent.ts");
  const stories = await news.runTool("searchStories", { query: "harness" });
  assert.deepEqual(stories.map(story => story.id), [101, 102]);
  await assert.rejects(() => news.runTool("searchStories", { query: 42 }));
  for (const input of [{query: ' '}, {query:'agents',days:0}, {query:'agents',days:31}]) {
    await assert.rejects(() => news.runTool('searchStories', input));
  }
  await assert.rejects(() => news.runTool('readDiscussion', {id:101,offset:-1}));
});
test("07 Історія: результат повертається з id виклику", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: [reply([
      { type: "text", text: "Спершу перевірю обговорення." },
      call("searchStories", { query: "harness" }, "id-42")
    ]), final]
  });
  const result = await runAgent(await agent({ model }), "Перевір");
  const assistant = result.messages.find(message => message.role === "assistant");
  assert.ok(assistant);
  assert.ok(assistant.content.some(part => part.type === "text" && part.text === "Спершу перевірю обговорення."));
  assert.ok(assistant.content.some(part => part.type === "tool-call" && part.toolCallId === "id-42"));
  assert.equal(result.messages.filter(message => message.role === "tool").length, 1);
  const message = result.messages.find((message2) => message2.role === "tool");
  assert.ok(message);
  assert.equal(message.content[0].toolCallId, "id-42");
  assert.match(JSON.stringify(message), /102/);
});
test("08 Цикл: пошук → читання → запис, історія 1 → 3 → 5 → 7", async (t) => {
  const originalDirectory = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), "harness-digest-"));
  process.chdir(directory);
  t.after(async () => { process.chdir(originalDirectory); await rm(directory, { recursive: true, force: true }); });
  const text = 'Огляд обговорень HN\n[Дискусія](https://news.ycombinator.com/item?id=101)';
  const model = new MockLanguageModelV3({ doGenerate: [
    reply([call('searchStories', { query: 'harness' })]),
    reply([call('readDiscussion', { id: 101 }, 'call_2')]),
    reply([call('saveDigest', { text }, 'call_3')]), final,
  ] });
  const options = await agent({ model, beforeTool: () => null });
  const runTool = options.runTool;
  const executed = [];
  options.runTool = async (name, input) => { executed.push(name); return runTool(name, input); };
  const result = await runAgent(options, 'Досліди та збережи');
  assert.equal(result.reason, 'final');
  assert.deepEqual(model.doGenerateCalls.map(request => request.prompt.filter(m => m.role !== 'system').length), [1, 3, 5, 7]);
  assert.deepEqual(executed, ['searchStories', 'readDiscussion', 'saveDigest']);
  assert.equal(await readFile('.data/digest.md', 'utf8'), text + '\n');
});
test("08 Кілька тулів: Кілька викликів отримують результати зі своїми id", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: [
      reply([
        call("searchStories", { query: "harness" }, "a"),
        call("searchStories", { query: "agents" }, "b")
      ]),
      final
    ]
  });
  await runAgent(await agent({ model }), "Два пошукові запити");
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
    doGenerate: reply([call("searchStories", { query: "harness" })])
  });
  const result = await runAgent(await agent({ model, maxSteps: 2 }), "Повторюй");
  assert.equal(result.reason, "limit");
  assert.equal(model.doGenerateCalls.length, 2);
});
test("08 Помилка: Некоректні аргументи й невідомий тул повертають помилку в контекст", async () => {
  for (const toolCall of [
    call("searchStories", { query: 42 }),
    call("unknown", {})
  ]) {
    const model = new MockLanguageModelV3({ doGenerate: [reply([toolCall]), final] });
    await runAgent(await agent({ model }), "Некоректний виклик");
    const next = model.doGenerateCalls[1].prompt;
    assert.equal(next.filter((message) => message.role === "tool").length, 1);
    const nextRequest = JSON.stringify(next);
    assert.match(nextRequest, /error/);
  }

  // Помилка асинхронної функції теж має повернутися до моделі як один результат.
  for (const failure of [new Error('HN недоступний'), 'мережу втрачено']) {
    const model = new MockLanguageModelV3({
      doGenerate: [reply([call('searchStories', { query: 'harness' })]), final],
    });
    const options = await agent({
      model,
      runTool: async () => {
        await Promise.resolve();
        throw failure;
      },
    });
    await runAgent(options, 'Перевір помилку виконання');
    const results = model.doGenerateCalls[1].prompt.filter(message => message.role === 'tool');
    assert.equal(results.length, 1);
    assert.equal(results[0].content[0].output.value.error,
      failure instanceof Error ? failure.message : failure);
  }
});
test("08 Обрізання: Обрізані аргументи не доходять до виконання", async () => {
  const truncated = reply([call("searchStories", { query: "harness" })]);
  truncated.finishReason = { unified: "length", raw: "length" };
  const model = new MockLanguageModelV3({ doGenerate: truncated });
  let executed = false;
  const options = await agent({ model, runTool: async () => { executed = true; return {}; } });
  await assert.rejects(() => runAgent(options, "Перевір"), /обрізано/);
  assert.equal(executed, false);
});
test("10 Контекст: перше user-повідомлення = AGENTS.md, rules, потім задача; system окремо", async () => {
  const model = new MockLanguageModelV3({ doGenerate: final });
  await runAgent(await agent({ model }), "Перевір джерела");
  const prompt = model.doGenerateCalls[0].prompt;
  const user = prompt.find(message => message.role === 'user');
  const system = prompt.find(message => message.role === 'system');
  const text = user.content.map(part => part.text).join('');
  const project = text.indexOf('<project source="AGENTS.md">');
  const rule = text.indexOf('<rule source="rules/sources.md">');
  const task = text.indexOf('<task>\nПеревір джерела\n</task>');
  assert.ok(project >= 0 && rule > project && task > rule, text);
  assert.match(text, /Огляд обговорень HN/);
  assert.match(text, /When comments disagree/);
  assert.doesNotMatch(JSON.stringify(system), /When comments disagree/);
});
test('10 Rules: усі md-файли завантажуються за назвою; сторонні файли й каталоги не читаються', async t => {
  const { loadContext } = await import('../src/context.ts');
  const directory = await mkdtemp(join(tmpdir(), 'harness-rules-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  await mkdir(join(directory, 'rules', 'nested.md'), { recursive: true });
  await writeFile(join(directory, 'AGENTS.md'), 'PROJECT_RULES');
  await writeFile(join(directory, 'rules', 'b.md'), 'SECOND_RULE');
  await writeFile(join(directory, 'rules', 'a.md'), 'FIRST_RULE');
  await writeFile(join(directory, 'rules', 'skip.txt'), 'MUST_NOT_LOAD');
  const rootUrl = pathToFileURL(directory + '/');
  const context = loadContext(rootUrl);
  assert.ok(context.indexOf('PROJECT_RULES') < context.indexOf('FIRST_RULE'));
  assert.ok(context.indexOf('FIRST_RULE') < context.indexOf('SECOND_RULE'));
  assert.match(context, /<project source="AGENTS.md">\nPROJECT_RULES\n<\/project>/);
  assert.match(context, /<rule source="rules\/a.md">\nFIRST_RULE\n<\/rule>/);
  assert.doesNotMatch(context, /MUST_NOT_LOAD/);
  await rm(join(directory, 'AGENTS.md'));
  assert.throws(() => loadContext(rootUrl), { code: 'ENOENT' });
});
test("11 Skills: Спершу опис skill, повний текст лише після readSkill", async () => {
  const model = new MockLanguageModelV3({
    doGenerate: [reply([call("readSkill", { name: "digest" })]), final]
  });
  await runAgent(await agent({ model }), "Прочитай digest");
  assert.match(JSON.stringify(model.doGenerateCalls[0].prompt), /<skills source=\\"skills\/\\">\\ndigest: /);
  assert.match(JSON.stringify(model.doGenerateCalls[0].prompt), /Skills: only when the task needs/);
  assert.doesNotMatch(
    JSON.stringify(model.doGenerateCalls[0].prompt),
    /Для пошуку спробуй англомовні запити/
  );
  assert.match(JSON.stringify(model.doGenerateCalls[1].prompt), /Для пошуку спробуй англомовні запити/);
  const { readSkill } = await import("../src/skills.ts");
  assert.throws(() => readSkill("../../.env"), /Невідомий skill/);
});
test("12 Дозвіл: Без дозволу saveDigest не створює digest.md, модель бачить блокування", async (t) => {
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
      reply([call("saveDigest", { text: "Відповідь" })]),
      final
    ]
  });
  await runAgent(await agent({ model }), "Надішли");
  await assert.rejects(() => readFile(".data/digest.md"), { code: "ENOENT" });
  assert.match(JSON.stringify(model.doGenerateCalls[1].prompt), /blocked, ask the user/);
});

// Перші етапи теж перевіряємо виконанням коду, а не пошуком рядків у src.
// Лише навчальні дані. Жодний тест не звертається до живого Hacker News.
const fixture = {
  hits: [101, 102].map(id => ({ objectID: String(id), title: `Harness fixture ${id}`,
    url: 'https://example.org/fixture', points: 10, num_comments: 2,
    created_at: '2026-09-21T10:00:00Z' })),
};
function discussion(id = 101) {
  return { id, type: 'story', title: 'Навчальна дискусія', children: [
    { id: 201, author: 'test-author', text: 'Перевіряйте результати тулів.', children: [
      { id: 202, author: 'other-author', text: 'Самих тестів недостатньо.', children: [] },
    ] },
  ] };
}
beforeEach(t => {
  t.mock.method(globalThis, 'fetch', async (url) => {
    const address = new URL(url);
    assert.equal(address.origin, 'https://hn.algolia.com', 'Неочікуваний мережевий виклик');
    if (address.pathname === '/api/v1/search_by_date') return Response.json(fixture);
    if (address.pathname.startsWith('/api/v1/items/')) return Response.json(discussion(Number(address.pathname.split('/').at(-1))));
    throw new Error('Неочікуваний API endpoint');
  });
});
const root = fileURLToPath(new URL('../', import.meta.url));

async function runEntry(t, task) {
  const temporary = await mkdtemp(join(tmpdir(), 'harness-entry-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const capture = join(temporary, 'requests.jsonl');
  const result = spawnSync(process.execPath, [
    '--import', './test/groq.mock.mjs', '--import', 'tsx', 'src/main.ts', task,
  ], {
    cwd: root, encoding: 'utf8', timeout: 15_000,
    env: { ...process.env, GROQ_API_KEY: 'offline-test-key',
      GROQ_MODEL: 'qwen/qwen3.8-27b', HARNESS_REQUESTS_PATH: capture, TRACE: '0', APPROVED: '0' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /Тестова відповідь без мережі/);
  const requests = (await readFile(capture, 'utf8')).trim().split('\n').map(JSON.parse);
  assert.equal(requests.length, 1);
  return requests[0];
}

test('01 Модель: main.ts робить один справжній запит SDK із підміненим HTTP', async (t) => {
  const request = await runEntry(t, 'Привіт');
  assert.equal(request.model, 'qwen/qwen3.8-27b');
  assert.ok(request.max_tokens > 0 && request.max_tokens < 1000);
  assert.ok(request.messages.some(message => message.role === 'user'));
});

test('02 Повідомлення: задача з CLI потрапляє до user, правила до system', async (t) => {
  const task = 'Унікальна задача перевірки CLI';
  const request = await runEntry(t, task);
  assert.ok(request.messages.some(message => message.role === 'system'));
  const user = request.messages.find(message => message.role === 'user');
  assert.ok(JSON.stringify(user.content).includes(task));
});

test('04 Описи: три схеми перевіряють аргументи, execute не підключений', async () => {
  const { news } = await import('../src/news/agent.ts');
  const { searchStories, readDiscussion, saveDigest } = news.tools;
  assert.equal(readDiscussion.execute, undefined);
  assert.equal(readDiscussion.inputSchema.safeParse({ id: 101 }).success, true);
  assert.equal(readDiscussion.inputSchema.safeParse({ id: "101" }).success, false);
  assert.equal(searchStories.execute, undefined);
  assert.equal(saveDigest.execute, undefined);
  assert.ok(searchStories.description.length > 0);
  assert.ok(saveDigest.description.length > 0);
  assert.equal(searchStories.inputSchema.safeParse({ query: "harness" }).success, true);
  assert.equal(searchStories.inputSchema.safeParse({ query: 42 }).success, false);
  assert.equal(saveDigest.inputSchema.safeParse({ text: '' }).success, false);
});

test('08 Groq: HTTP tool call повертається наступним запитом із тим самим id', async () => {
  const requests = [];
  const router = createGroq({ apiKey: 'offline-test-key', fetch: async (url, options) => {
    assert.equal(String(url), 'https://api.groq.com/openai/v1/chat/completions');
    requests.push(JSON.parse(options.body));
    const first = requests.length === 1;
    return new Response(JSON.stringify({
      id: 'offline', object: 'chat.completion', created: 1, model: 'qwen/qwen3.8-27b',
      choices: [{ index: 0, finish_reason: first ? 'tool_calls' : 'stop', message: first ? {
        role: 'assistant', content: null, tool_calls: [{ id: 'router_1', type: 'function',
          function: { name: 'searchStories', arguments: '{"query":"harness"}' } }],
      } : { role: 'assistant', content: 'Дві дискусії.' } }],
      usage: { prompt_tokens: 20, completion_tokens: 10, total_tokens: 30 },
    }), { headers: { 'content-type': 'application/json' } });
  } });
  const result = await runAgent(await agent({ model: router('qwen/qwen3.8-27b') }), 'Знайди harness');
  assert.equal(result.reason, 'final');
  assert.equal(result.text, 'Дві дискусії.');
  assert.equal(requests.length, 2);
  assert.ok(requests[0].tools.some(tool => tool.function.name === 'searchStories'));
  const toolResult = requests[1].messages.find(message => message.role === 'tool');
  assert.equal(toolResult.tool_call_id, 'router_1');
  assert.equal(JSON.parse(toolResult.content)[1].id, 102);
});

test('12 Дозвіл: APPROVED=1 дозволяє зберегти дайджест', async (t) => {
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
    reply([call('saveDigest', { text: 'Дозволено' })]), final,
  ] });
  const result = await runAgent(await agent({ model }), 'Надішли');
  assert.equal(result.reason, 'final');
  assert.equal((await readFile('.data/digest.md', 'utf8')).trim(), 'Дозволено');
});

async function rejectsEmptyTask(t, args) {
  const temporary = await mkdtemp(join(tmpdir(), 'harness-empty-task-'));
  t.after(() => rm(temporary, { recursive: true, force: true }));
  const capture = join(temporary, 'requests.jsonl');
  const result = spawnSync(process.execPath, [
    '--import', './test/groq.mock.mjs', '--import', 'tsx', 'src/main.ts', ...args,
  ], {
    cwd: root, encoding: 'utf8', timeout: 15_000,
    env: { ...process.env, GROQ_API_KEY: 'offline-test-key', HARNESS_REQUESTS_PATH: capture },
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


test('06 HN: пошук передає запит, період і обмеження, повертає посилання', async (t) => {
  let address;
  t.mock.method(globalThis, 'fetch', async url => { address = new URL(url); return Response.json(fixture); });
  const { searchStories, readDiscussion } = await import('../src/news/api.ts');
  const result = await searchStories('tool calling', 3);
  assert.equal(address.searchParams.get('query'), 'tool calling');
  const limit = Number(address.searchParams.get('hitsPerPage'));
  assert.ok(Number.isInteger(limit) && limit > 0 && limit <= 10);
  assert.ok(result.length <= limit);
  const since = Number(/created_at_i>(\d+)/.exec(address.searchParams.get('numericFilters'))[1]);
  assert.ok(Math.abs(since - (Math.floor(Date.now() / 1000) - 3 * 86400)) < 2);
  assert.equal(result[0].url, 'https://news.ycombinator.com/item?id=101');
});

test('06 HN: порції коментарів, батьківські id й ознака обрізання', async (t) => {
  const tree = discussion();
  tree.children = Array.from({length: 11}, (_, i) => ({ id: 200+i, text: 'x'.repeat(1200), children: [] }));
  tree.children.push({id:999,text:null,children:[]});
  t.mock.method(globalThis, 'fetch', async () => Response.json(tree));
  const { searchStories, readDiscussion } = await import('../src/news/api.ts');
  const first = await readDiscussion(101);
  const pageSize = first.comments.length;
  assert.ok(pageSize > 0 && pageSize <= 10);
  assert.equal(first.comments[0].parentId, 101);
  assert.ok(first.comments[0].text.length > 0 && first.comments[0].text.length <= 1000);
  assert.equal(first.comments[0].truncated, true);
  assert.equal(first.nextOffset, pageSize);
  assert.equal(first.totalComments, 11);
  const ids = first.comments.map(comment => comment.id);
  let offset = first.nextOffset;
  while (offset !== null) {
    const page = await readDiscussion(101, offset);
    assert.ok(page.comments.length > 0 && page.comments.length <= pageSize);
    assert.ok(page.nextOffset === null || page.nextOffset > offset);
    ids.push(...page.comments.map(comment => comment.id));
    offset = page.nextOffset;
  }
  assert.deepEqual(ids, Array.from({ length: 11 }, (_, i) => 200 + i));
  assert.equal((await readDiscussion(101, 100)).nextOffset, null);
});

test('06 HN: вкладені відповіді зберігають parentId і порядок', async () => {
  const { searchStories, readDiscussion } = await import('../src/news/api.ts');
  const result = await readDiscussion(101);
  assert.deepEqual(result.comments.map(c => [c.id,c.parentId]), [[201,101],[202,201]]);
});

test('06 HN: порожній пошук та дискусія без коментарів — коректні результати', async (t) => {
  t.mock.method(globalThis, 'fetch', async url => Response.json(String(url).includes('search_by_date') ? {hits:[]} : {id:101,type:'story',children:[]}));
  const { searchStories, readDiscussion } = await import('../src/news/api.ts');
  assert.deepEqual(await searchStories('unknown'), []);
  const result = await readDiscussion(101);
  assert.deepEqual(result.comments, []);
  assert.equal(result.nextOffset, null);
});

test('06 HN: HTTP, timeout, null і невірний тип повертають зрозумілу помилку', async (t) => {
  const { searchStories, readDiscussion } = await import('../src/news/api.ts');
  for (const [fetch, pattern] of [
    [async () => new Response('',{status:429}), /HTTP 429/],
    [async () => {throw new Error('timeout');}, /timeout/],
    [async () => Response.json(null), /порожня відповідь/],
    [async () => Response.json({type:'comment'}), /id обговорення/],
  ]) {
    t.mock.method(globalThis, 'fetch', fetch);
    await assert.rejects(() => readDiscussion(101), pattern);
  }
});

test('08 HN: помилка API доходить до моделі; наступний виклик може змінити запит', async (t) => {
  const queries=[];
  t.mock.method(globalThis, 'fetch', async url => {
    queries.push(new URL(url).searchParams.get('query'));
    return queries.length === 1 ? new Response('',{status:503}) : Response.json(fixture);
  });
  const model = new MockLanguageModelV3({doGenerate:[
    reply([call('searchStories',{query:'harness'},'first')]),
    reply([call('searchStories',{query:'coding agents'},'second')]), final,
  ]});
  await runAgent(await agent({model}), 'Знайди дискусії');
  assert.deepEqual(queries,['harness','coding agents']);
  assert.match(JSON.stringify(model.doGenerateCalls[1].prompt), /HTTP 503/);
  assert.match(JSON.stringify(model.doGenerateCalls[2].prompt), /Harness fixture/);
});


test('12 Settings: лише явний дозвіл пропускає запис; налаштування не потрапляють у контекст', async t => {
  const { news } = await import('../src/news/agent.ts');
  const previous = process.env.APPROVED;
  t.after(() => {
    if (previous === undefined) delete process.env.APPROVED;
    else process.env.APPROVED = previous;
  });
  for (const value of [undefined, '0', 'true', 'yes', '']) {
    if (value === undefined) delete process.env.APPROVED;
    else process.env.APPROVED = value;
    assert.equal(news.beforeTool('saveDigest'), 'blocked, ask the user');
    assert.equal(news.beforeTool('searchStories'), null);
  }
  process.env.APPROVED = '1';
  assert.equal(news.beforeTool('saveDigest'), null);
  const model = new MockLanguageModelV3({ doGenerate: final });
  await runAgent(await agent({ model }), 'Перевір');
  assert.doesNotMatch(JSON.stringify(model.doGenerateCalls[0].prompt), /APPROVED|allowDigestWrite|permissions/);
});

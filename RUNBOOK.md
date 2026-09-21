# День 1: збираємо harness із порожньої папки

Відкрий цей ранбук у браузері й працюй у **власній папці**. Йдемо зверху вниз: додаємо одну можливість, запускаємо, пояснюємо результат. Готовий репозиторій клонувати для початку не потрібно.

Гілки — контрольні точки: звірити код або наздогнати групу. Як ними скористатися — [наприкінці](#checkpoints). Зазвичай увесь день працюєш у своїй гілці `work`.

Потрібні Node 22.19+ (для воркшопу використовуємо 22.19), npm, Git, редактор і свій OPENROUTER_API_KEY. Команди нижче — для термінала macOS, Linux або WSL. Для обраної платної моделі потрібен баланс OpenRouter. Ключ отримаємо до заняття в [кабінеті OpenRouter](https://openrouter.ai/settings/keys); його сюди й у чат Zoom не копіюємо.

Маршрут: **папка → перший файл → модель → функція запиту → billing → tool call → виконання → цикл → правила → skills → дозвіл**.

<a id="setup"></a>

## 0. Створи папку та перевір запуск TypeScript

```bash
node --version
npm --version
git --version
mkdir my-harness
cd my-harness
git init -b work
npm init -y
npm pkg set type=module
npm pkg set private=true --json
npm install --save-exact ai@7.0.107 @openrouter/ai-sdk-provider@3.1.0 zod@4.6.5
npm install --save-dev --save-exact tsx@4.23.15 typescript@7.0.2 @types/node@26.6.2
npm pkg set 'scripts.start=tsx --env-file-if-exists=.env src/main.ts'
npm pkg set 'scripts.check=tsc --noEmit'
mkdir src
```

Створи `.gitignore` з таким вмістом:

```text
node_modules/
.env
.data/
.DS_Store
```

Створи `tsconfig.json` з таким вмістом:

```json
{
  "compilerOptions": {
    "target": "ES2022",
    "module": "NodeNext",
    "moduleResolution": "NodeNext",
    "strict": true,
    "noEmit": true,
    "allowImportingTsExtensions": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "types": [
      "node"
    ]
  },
  "include": [
    "src",
    "test"
  ]
}
```

Створи `src/main.ts` з таким вмістом:

```ts
console.log('TypeScript працює.');
```

```bash
npm run check
npm start
```

**Очікуємо:** check завершується без помилок; start друкує `TypeScript працює.`. Модель ще не підключена. Це лише локальний запуск.

**Якщо не так:** `Cannot find module` — перевір поточну папку через `pwd` і шлях `src/main.ts`. `tsx: command not found` — залежності ще не встановлені в цій папці. Помилка TypeScript називає файл і рядок: виправ її перед наступним кроком.

<a id="model"></a>

## 1. Підключи модель в одному файлі

Створи `.env.example` з таким вмістом:

```text
OPENROUTER_API_KEY=
APPROVED=0
```

```bash
cp .env.example .env
```

Відкрий `.env` у редакторі й встав свій ключ після `OPENROUTER_API_KEY=`. `APPROVED` знадобиться наприкінці практики.

Заміни вміст `src/main.ts`:

```ts
import { generateText } from 'ai';
import { openrouter } from '@openrouter/ai-sdk-provider';

console.log('Надсилаємо один запит до моделі...');

const reply = await generateText({
  model: openrouter('openai/gpt-oss-20b'),
  prompt: 'Відповідай українською. Привітайся одним реченням.',
  maxRetries: 0,
  maxOutputTokens: 1200,
  abortSignal: AbortSignal.timeout(60_000),
});

console.log('Причина завершення:', reply.finishReason);
console.log('Відповідь:', reply.text);
```

```bash
npm run check
npm start
```

**Модель:** `openai/gpt-oss-20b`; ідентифікатор змінюється в одному рядку `openrouter(...)`. Для наступних кроків обирай модель із підтримкою tools. Перед заняттям перевір її доступність. [Офіційний адаптер AI SDK](https://github.com/OpenRouterTeam/ai-sdk-provider).

**Очікуємо:** спочатку повідомлення про запит, потім причина завершення й текст українською. Це перший живий виклик API. maxRetries: 0 вимикає повтори SDK; маршрутизацією всередині OpenRouter керує сам сервіс.

**Дебажимо по черзі:**

| Що бачиш | Що перевірити |
|---|---|
| Немає API key / 401 | `.env` лежить поруч із package.json; ключ записаний у OPENROUTER_API_KEY; запускаєш через npm start. |
| 402 / insufficient credits | Баланс OpenRouter та ліміт витрат свого ключа. |
| 404 / model unavailable | Назву моделі в src/main.ts та її доступність для свого ключа. |
| 429 | Прочитай помилку сервера й зачекай перед ручним повтором. Наш код не повторює запит автоматично. |
| Timeout / мережеву помилку | Зʼєднання; код чекає максимум 60 секунд. |
| `length`, порожній або обрізаний текст | Вичерпаний бюджет відповіді. Для повтору збільш maxOutputTokens до 2400; часткову відповідь не вважай успіхом. |

Якщо ключа поки немає, можна продовжити з тестами наступного кроку. Познач для себе: **живий API ще не перевірений**.

<a id="function"></a>

## 2. Винеси один запит у функцію й перевір без API

У `main.ts` залишиться запуск. У `harness.ts` працюватимемо з моделлю, яку передали аргументом. Так у тесті можна задати відповідь моделі й перевірити власний код без мережі.

`messages` — історія для наступного запиту. Поки в ній одна задача користувача.

Створи `src/harness.ts` з таким вмістом:

```ts
import {
  generateText,
  type LanguageModel,
  type ModelMessage,
} from 'ai';

export type Agent = {
  model: LanguageModel;
  system: string;
};

export async function runAgent(agent: Agent, task: string) {
  const messages: ModelMessage[] = [{ role: 'user', content: task }];

  console.log(`\nОдин запит. Повідомлень у запиті: ${messages.length}.`);

  const reply = await generateText({
    model: agent.model,
    system: agent.system,
    messages,
    maxRetries: 0,
    maxOutputTokens: 1200,
    abortSignal: AbortSignal.timeout(60_000),
    include: { requestBody: true },
  });

  if (process.env.TRACE === '1') {
    console.log('HTTP-запит:', reply.request.body);
  }
  if (reply.finishReason === 'length') {
    throw new Error('Відповідь обрізано. Тули не виконуємо.');
  }

  console.log('Модель відповіла. Це один запит без тулів.');
  return { reason: 'final', text: reply.text, messages };
}
```

Заміни `src/main.ts`:

```ts
import { openrouter } from '@openrouter/ai-sdk-provider';
import { runAgent } from './harness.ts';

const task = process.argv[2] || 'Привітайся одним реченням.';

try {
  const result = await runAgent(
    {
      model: openrouter('openai/gpt-oss-20b'),
      system: 'Відповідай українською.',
    },
    task,
  );

  console.log('Відповідь:', result.text);
} catch (error) {
  console.error('Помилка:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
```

Тепер зробимо одну автоматичну перевірку. Допоміжні reply і call нижче задають відповіді моделі для цієї та наступних перевірок.

```bash
mkdir test
npm pkg set 'scripts.test=node --import tsx --test --experimental-test-isolation=none --test-reporter=spec test/harness.test.ts'
npm pkg set 'scripts.check=tsc --noEmit && npm test'
```

Створи `test/harness.test.ts` з таким вмістом:

```ts
import { test, mock } from 'node:test';
import assert from 'node:assert/strict';
import { MockLanguageModelV3 } from 'ai/test';
import { runAgent } from '../src/harness.ts';

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
  const result = await runAgent({ model, system: 'Відповідай українською.' }, 'Привіт');

  assert.equal(result.text, 'Готово.');
  assert.equal(result.reason, 'final');
  assert.equal(model.doGenerateCalls.length, 1);
  assert.equal(model.doGenerateCalls[0].prompt.at(-1)?.role, 'user');
});
```

```bash
npm run check
npm start -- "Поясни tool call одним реченням."
TRACE=1 npm start
```

**Очікуємо:** `tests 1`, `pass 1`, `fail 0`. У живому запуску один запит і текст. `TRACE=1` показує HTTP body: знайди system та user. Заголовок авторизації не друкується.

**Якщо не так:** тест упав — дивись назву перевірки й різницю expected/actual. Тест пройшов, а API впав — перевір ключ, мережу й модель за попередньою таблицею. Це дві різні перевірки.

<a id="start"></a>

## 3. Додай предметну задачу: списання клієнта

Тепер у програми буде конкретна задача. У billing зберемо дані, описи двох тулів і їхні реалізації. Harness отримуватиме цей модуль аргументом.

Спочатку прочитай getCharges: він фільтрує два навчальні записи. SendReply пише локальний outbox. Реальних листів у цій практиці немає.

```bash
mkdir src/billing
```

Створи `src/billing/charges.json` з таким вмістом:

```json
[
  {
    "id": "ch_01",
    "customerId": 42,
    "amount": 49,
    "currency": "USD",
    "date": "2026-09-01"
  },
  {
    "id": "ch_02",
    "customerId": 42,
    "amount": 49,
    "currency": "USD",
    "date": "2026-09-01"
  }
]
```

Створи `src/billing/agent.ts` з таким вмістом:

```ts
import { appendFile, mkdir } from 'node:fs/promises';
import { tool } from 'ai';
import { z } from 'zod';
import charges from './charges.json' with { type: 'json' };

const customerId = z.number().int().positive();
const chargesInput = z.object({ customerId });
const replyInput = z.object({ customerId, text: z.string().min(1).max(4000) });

// Один предметний модуль: правила підтримки, описи тулів та їхній код.
export const billing = {
  system:
    'Ти агент підтримки. Перевір списання через getCharges, ' +
    'потім відповідай через sendReply. ' +
    'Якщо дію заблоковано, попроси дозвіл.',

  // Модель отримує ці описи. Тут немає execute: тули виконає наш цикл.
  tools: {
    getCharges: tool({
      description: 'Знайди списання клієнта.',
      inputSchema: chargesInput,
    }),
    sendReply: tool({
      description: 'Надішли відповідь після перевірки списань.',
      inputSchema: replyInput,
    }),
  },

  async runTool(name: string, input: unknown) {
    switch (name) {
      case 'getCharges': {
        const { customerId } = chargesInput.parse(input);
        return charges.filter((charge) => charge.customerId === customerId);
      }
      case 'sendReply': {
        const reply = replyInput.parse(input);
        // Навчальна відправка: запис у файл, без реальних листів.
        await mkdir('.data', { recursive: true });
        await appendFile('.data/outbox.jsonl', JSON.stringify(reply) + '\n');
        return { status: 'saved-to-outbox' };
      }
      default:
        throw new Error(`Невідомий тул: ${name}`);
    }
  },
};
```

У імпорті з ai в `src/harness.ts` після ModelMessage додай типи ToolSet і JSONValue. Цей фрагмент замінює рядок `type ModelMessage,`:

```ts
  type ModelMessage,
  type ToolSet,
  type JSONValue,
```

У типі Agent після system додай поля tools і runTool:

```ts
  system: string;
  tools: ToolSet;
  runTool: (name: string, input: unknown) => Promise<JSONValue>;
```

Заміни `src/main.ts`. Відтепер цей файл лише збирає модель, задачу та billing:

```ts
import { openrouter } from '@openrouter/ai-sdk-provider';
import { runAgent } from './harness.ts';
import { billing } from './billing/agent.ts';

const task =
  process.argv[2] ||
  'Клієнт 42: за вересень двічі списали гроші. Перевір і дай відповідь.';

try {
  const result = await runAgent(
    {
      ...billing,
      model: openrouter('openai/gpt-oss-20b'),
    },
    task,
  );

  if (result.text) console.log(`\nВідповідь: ${result.text}`);
  if (result.reason === 'limit') process.exitCode = 2;
} catch (error) {
  console.error('Помилка:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
```

У тесті додай імпорт billing після імпорту runAgent:

```ts
import { runAgent } from '../src/harness.ts';
import { billing } from '../src/billing/agent.ts';
```

У першому тесті заміни обʼєкт `{ model, system: ... }` аргументом:

```ts
{ ...billing, model }
```

```bash
npm run check
TRACE=1 npm start
```

**Очікуємо:** один тест проходить; у HTTP-запиті ще немає tools. Модель може написати текст про списання, але не читала charges.json. Наявності функцій у нашому файлі для цього недостатньо.

**Якщо не так:** помилка читання JSON — перевір шлях `src/billing/charges.json`. TypeScript скаржиться на tools/runTool — звір обʼєкт billing і параметр runAgent у тесті.

**Контрольна точка: `start`.** Ми дійшли до неї власноруч. Далі продовжуємо в цих самих файлах.

<a id="request"></a>

## 4. Передай моделі описи тулів

У `src/harness.ts` у виклику generateText після messages додай tools:

```ts
    messages,
    tools: agent.tools,
```

Заміни останній console.log і return функції runAgent цим блоком:

```ts
  // Немає запитів на тули: модель уже дала фінальну відповідь.
  if (reply.toolCalls.length === 0) {
    console.log('Зупинка: модель відповіла без виклику тула.');
    return { reason: 'final', text: reply.text, messages };
  }

  for (const call of reply.toolCalls) {
    console.log(`Модель просить ${call.toolName}:`, call.input);
  }

  return { reason: 'tool-call', text: reply.text, messages };
```

Додай у кінець `test/harness.test.ts`:

```ts
test('Модель бачить tools, але наш код ще не виконує функцію', async () => {
  let executed = false;
  const model = new MockLanguageModelV3({
    doGenerate: reply([call('getCharges', { customerId: 42 })]),
  });
  const result = await runAgent(
    {
      ...billing,
      model,
      runTool: async () => {
        executed = true;
        return [];
      },
    },
    'Перевір',
  );

  assert.equal(result.reason, 'tool-call');
  assert.equal(executed, false);
  assert.ok(model.doGenerateCalls[0].tools?.some((tool) => tool.name === 'getCharges'));
});
```

```bash
npm run check
TRACE=1 npm start
```

**Очікуємо:** два тести проходять. У запиті є tools: імʼя, description, схема customerId. Якщо модель обрала getCharges, у терміналі бачимо імʼя й аргументи, але ще немає результату функції.

**Якщо не так:** немає tools у TRACE — перевір параметр generateText. Є текст із JSON, але немає toolCalls — це текстова відповідь моделі; код її не виконує. Спробуй явно попросити `npm start -- "Виклич getCharges для клієнта 42"`. Тест перевіряє цей шлях незалежно від вибору живої моделі.

**Контрольна точка: `step-1-request`.**

<a id="tools"></a>

## 5. Виконай тул і поклади результат в історію

Залиш перевірку `reply.toolCalls.length === 0` на місці. Після неї заміни цикл, який лише друкував виклики, і return tool-call.

Порядок: повідомлення assistant із викликом → виконання нашої функції → tool result із тим самим id. Наступного запиту поки не буде.

```ts
  // Зберігаємо повідомлення моделі з її tool calls перед результатами.
  messages.push(
    ...reply.response.messages.filter((message) => message.role === 'assistant'),
  );

  for (const call of reply.toolCalls) {
    console.log(`Модель просить ${call.toolName}:`, call.input);
    let result;

    try {
      // SDK перевірив аргументи за схемою. Некоректний виклик не виконуємо.
      if (call.invalid) {
        throw call.error;
      }
      // Виконання відбувається в нашій програмі, а не в SDK.
      result = await agent.runTool(call.toolName, call.input);
    } catch (error) {
      // Помилка теж результат: модель отримає її в наступному запиті.
      result = { error: error instanceof Error ? error.message : String(error) };
    }

    console.log(`Результат ${call.toolName}:`, result);
    messages.push({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          output: { type: 'json', value: result },
        },
      ],
    });
  }

  console.log(`Додали результати. Повідомлень в історії: ${messages.length}.`);

  console.log('Модель ще не отримала результат. Наступний запит додамо далі.');
  return { reason: 'tool-result', text: '', messages };
```

У тестах заміни попередній тест «Модель бачить tools…» цим. Попередній перевіряв стан без виконання; тепер поведінка змінилася:

```ts
test('Виконали getCharges і додали результат, але ще не повторили запит', async () => {
  const model = new MockLanguageModelV3({
    doGenerate: reply([call('getCharges', { customerId: 42 })]),
  });
  const result = await runAgent({ ...billing, model }, 'Перевір');

  assert.equal(result.reason, 'tool-result');
  assert.equal(model.doGenerateCalls.length, 1);
  assert.deepEqual(
    result.messages.map((message) => message.role),
    ['user', 'assistant', 'tool'],
  );
  const last = result.messages.at(-1)!;
  assert.ok(last.role === 'tool');
  assert.equal(last.content[0].type, 'tool-result');
  assert.match(JSON.stringify(last.content), /call_1/);
  assert.match(JSON.stringify(last.content), /ch_02/);
});
```

```bash
npm run check
npm start
```

**Очікуємо:** два тести проходять. Для виклику getCharges видно два списання по 49 USD. У messages три елементи: user → assistant → tool. Модель ще не бачила результат, бо запит був лише один.

**Якщо не так:** повернулася помилка замість даних — прочитай result.error. Перевір toolName, тип customerId і case у runTool. Якщо API пізніше лаятиметься на tool result, звір toolCallId та порядок assistant/tool.

**Контрольна точка: `step-2-tools`.**

<a id="loop"></a>

## 6. Повтори вже зібраний крок

Тепер цикл додається навколо коду, який уже працює. Новий оберт надішле моделі попередній результат.

У `src/harness.ts` зроби чотири зміни:

1. Додай `maxSteps?: number;` у тип Agent.
2. Залиш створення messages перед циклом. Весь блок від повідомлення «Один запит…» до кінця виконання тулів обгорни у for нижче.
3. Прибери повідомлення «Модель ще не отримала результат…» і return з reason tool-result. Після результату має початися наступний оберт.
4. Return final залиши всередині перевірки toolCalls.length === 0. Після for додай повідомлення та return limit.

```ts
for (let step = 1; step <= (agent.maxSteps ?? 10); step++) {
  // Тут твій наявний код: generateText → перевірка → тули → results.
}

console.log('Зупинка: досягли ліміту кроків. Задача може бути незавершена.');
return { reason: 'limit', text: '', messages };
```

Цей фрагмент показує, **куди обгорнути наявний код**. Коментар усередині for заміни своїм блоком попереднього кроку.

Усередині for заміни повідомлення «Один запит…» на номер оберту:

```ts
  console.log(`\nКрок ${step}. Повідомлень у запиті: ${messages.length}.`);
```

У тестах видали останній тест «Виконали getCharges…»: він вимагав зупинки після одного запиту. Додай три імпорти для перевірки запису у тимчасову папку:

```ts
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
```

Додай у кінець тестового файла перевірки циклу. Модель задана в тесті; SDK, наш цикл і запис відповіді працюють насправді:

```ts
test('Два тули: історія 1 → 3 → 5, відповідь записана рівно один раз', async (t) => {
  const originalDirectory = process.cwd();
  const directory = await mkdtemp(join(tmpdir(), 'harness-'));
  process.chdir(directory);
  t.after(() => process.chdir(originalDirectory));

  const model = new MockLanguageModelV3({
    doGenerate: [
      reply([call('getCharges', { customerId: 42 })]),
      reply([
        call('sendReply', { customerId: 42, text: 'Два списання по $49.' }, 'call_2'),
      ]),
      final,
    ],
  });
  const result = await runAgent({ ...billing, model }, 'Перевір списання');

  assert.equal(result.reason, 'final');
  const histories = model.doGenerateCalls.map((request) =>
    request.prompt.filter((m) => m.role !== 'system'),
  );
  assert.deepEqual(
    histories.map((messages) => messages.length),
    [1, 3, 5],
  );
  assert.equal(JSON.stringify(histories[1]).includes('call_1'), true);

  const lines = (await readFile('.data/outbox.jsonl', 'utf8')).trim().split('\n');
  assert.equal(lines.length, 1);
  assert.equal(JSON.parse(lines[0]).customerId, 42);
});

test('Кілька викликів отримують результати зі своїми id', async () => {
  const model = new MockLanguageModelV3({
    doGenerate: [
      reply([
        call('getCharges', { customerId: 42 }, 'a'),
        call('getCharges', { customerId: 7 }, 'b'),
      ]),
      final,
    ],
  });
  await runAgent({ ...billing, model }, 'Два клієнти');

  const results = model.doGenerateCalls[1].prompt.filter(
    (message) => message.role === 'tool',
  );
  assert.deepEqual(
    results.flatMap((message) =>
      message.content
        .filter((part) => part.type === 'tool-result')
        .map((part) => part.toolCallId),
    ),
    ['a', 'b'],
  );
});

test('Ліміт зупиняє модель, яка знову просить той самий тул', async () => {
  const model = new MockLanguageModelV3({
    doGenerate: reply([call('getCharges', { customerId: 42 })]),
  });
  const result = await runAgent({ ...billing, model, maxSteps: 2 }, 'Повторюй');

  assert.equal(result.reason, 'limit');
  assert.equal(model.doGenerateCalls.length, 2);
});

test('Некоректні аргументи й невідомий тул повертають помилку в контекст', async () => {
  for (const toolCall of [
    call('getCharges', { customerId: '42' }),
    call('unknown', {}),
  ]) {
    const model = new MockLanguageModelV3({ doGenerate: [reply([toolCall]), final] });
    await runAgent({ ...billing, model }, 'Некоректний виклик');

    const next = model.doGenerateCalls[1].prompt;
    assert.equal(next.filter((message) => message.role === 'tool').length, 1);
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
```

```bash
npm run check
npm start
```

**Очікуємо:** шість тестів проходять. Задана тестом послідовність getCharges → sendReply → текст дає 1 → 3 → 5 повідомлень. Окрема перевірка змушує модель повторювати виклик і підтверджує зупинку за лімітом.

У живому запуску дивись на фактичні виклики. Якщо sendReply відпрацював, відкрий `.data/outbox.jsonl`: там доданий рядок відповіді. Повторні запуски дописують рядки, а не очищають файл.

**Якщо не так:**

| Симптом | Де шукати |
|---|---|
| Після getCharges програма завершується | Усередині for залишився return tool-result. |
| Кожен оберт знову має одне повідомлення | Створення messages випадково потрапило всередину for. |
| API не знаходить результат виклику | Перевір assistant → tool та однаковий toolCallId. |
| Крутиться до ліміту | Чи додаєш result? Чи не отримує модель одну й ту саму помилку? |
| Вийшли за лімітом без відповіді | Це reason limit, не виконана задача. Переглянь останній тул і його результат. |

**Спробуй зламати й полагодити:** тимчасово прибери messages.push із tool result. Запусти npm test, прочитай помилку, поверни код і повтори тест. Для цього досліду живий API не потрібен.

**Контрольна точка: `step-3-loop`.**

<a id="description"></a>

## 7. Перевір, що змінює опис тула

У `src/billing/agent.ts` збережи поточний description sendReply. Заміни **лише description** на `never call this`.

Запусти `npm start` тричі з паузами; враховуй обмеження сервера. Для кожного запуску запиши: чи був саме виклик sendReply. Текст фінальної відповіді — інше спостереження.

Тест із заданою відповіддю моделі не вимірює вплив опису. Тут потрібні живі запуски. Напиши результат у чат Zoom: наприклад, «sendReply 1 із 3». Це спостереження трьох запусків, не оцінка надійності.

**Контрольна точка: `step-4-description`**, у ній опис уже змінений. Перед наступним кроком поверни збережений опис: `Надішли відповідь після перевірки списань.` Код виконання весь час був тим самим.

<a id="context"></a>

## 8. Додай правило з файла

Створи `AGENTS.md` з таким вмістом:

```markdown
# Правила навчального агента
Відповідай українською.
Відповідь клієнту починай словами «Дякуємо за звернення».
Не вигадуй повернення коштів: у цій практиці немає тула refund.
```

У billing додай імпорт readFileSync:

```ts
import { appendFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
```

У обʼєкт billing додай поле context:

```ts
export const billing = {
  context: readFileSync(new URL('../../AGENTS.md', import.meta.url), 'utf8'),
```

У типі Agent після system додай context:

```ts
  system: string;
  context?: string;
```

У початковому масиві messages заміни user-повідомлення:

```ts
{ role: 'user', content: `${agent.context || ''}\n${task}`.trim() }
```

Додай перевірку в кінець тестового файла:

```ts
test('AGENTS.md зʼявляється в першому повідомленні', async () => {
  const model = new MockLanguageModelV3({ doGenerate: final });
  await runAgent({ ...billing, model }, 'Перевір');

  assert.match(JSON.stringify(model.doGenerateCalls[0].prompt), /Дякуємо за звернення/);
});
```

```bash
npm run check
TRACE=1 npm start
```

**Очікуємо:** сім тестів проходять. У першому user-повідомленні є правила й задача. Окремо перевір, чи живий sendReply починає відповідь словами «Дякуємо за звернення».

**Якщо не так:** файл існує, але правила немає в TRACE — звір context у billing та складання першого повідомлення. Правило є, але модель його не виконала — це результат поведінки моделі; файл сам собою нічого не примушує.

**Контрольна точка: `step-5-context`.**

<a id="skills"></a>

## 9. Додай інструкцію, яку модель читає за потреби

```bash
mkdir -p skills/billing
```

Створи `skills/billing/SKILL.md` з таким вмістом:

```markdown
---
name: billing
description: Як пояснити клієнту повторне списання і не обіцяти невиконане повернення.
---
Перевір дати, суми та ідентифікатори списань через getCharges.
Назви конкретні суми у відповіді. Уточни, що звернення потребує перевірки.
Не обіцяй refund: у навчальному харнесі немає такого інструмента.
```

Створи `src/skills.ts` з таким вмістом:

```ts
import { readFileSync, readdirSync, existsSync } from 'node:fs';

// Спершу віддаємо назву й опис. Повний текст модель читає окремим тулом.
const directory = new URL('../skills/', import.meta.url);

export const skills = readdirSync(directory)
  .filter((name) => existsSync(new URL(`${name}/SKILL.md`, directory)))
  .map((name) => {
    const file = new URL(`${name}/SKILL.md`, directory);
    const text = readFileSync(file, 'utf8');
    const description = /^description: (.+)$/m.exec(text)?.[1];

    if (!description) throw new Error(`Немає description у skill ${name}`);

    return { name, description, text };
  });

export function readSkill(name: string) {
  // Обираємо зі знайдених skills, а не відкриваємо шлях від моделі.
  const skill = skills.find((skill) => skill.name === name);
  if (!skill) throw new Error(`Невідомий skill: ${name}`);
  return skill.text;
}
```

У billing додай імпорт читача skills:

```ts
import { readFileSync } from 'node:fs';
import { skills, readSkill } from '../skills.ts';
```

Перед customerId додай схему аргументу readSkill і складання описів:

```ts
const skillInput = z.object({ name: z.string() });
const rules = readFileSync(new URL('../../AGENTS.md', import.meta.url), 'utf8');
const descriptions = skills.map(skill => `${skill.name}: ${skill.description}`).join('\n');

const customerId = z.number().int().positive();
```

Заміни поле context у billing:

```ts
  context: `${rules}\nSkills:\n${descriptions}`,
```

У tools додай readSkill:

```ts
  tools: {
    readSkill: tool({
      description: 'Прочитай повну інструкцію потрібного skill.',
      inputSchema: skillInput,
    }),
```

У switch перед default додай реалізацію. Default залишається після нового case:

```ts
      case 'readSkill': {
        const { name } = skillInput.parse(input);
        return { text: readSkill(name) };
      }
      default:
```

Додай у тест імпорт readSkill:

```ts
import { billing } from '../src/billing/agent.ts';
import { readSkill } from '../src/skills.ts';
```

Додай перевірку поступового завантаження інструкції:

```ts
test('Спершу опис skill, повний текст лише після readSkill', async () => {
  const model = new MockLanguageModelV3({
    doGenerate: [reply([call('readSkill', { name: 'billing' })]), final],
  });
  await runAgent({ ...billing, model }, 'Прочитай billing');

  assert.doesNotMatch(
    JSON.stringify(model.doGenerateCalls[0].prompt),
    /Перевір дати, суми/,
  );
  assert.match(JSON.stringify(model.doGenerateCalls[1].prompt), /Перевір дати, суми/);
  assert.throws(() => readSkill('../../.env'), /Невідомий skill/);
});
```

```bash
npm run check
TRACE=1 npm start -- "Прочитай skill billing і перевір списання клієнта 42"
```

**Очікуємо:** вісім тестів проходять. У першому запиті лише назва й опис skill. Після readSkill у tool result є повний текст. Файли ми прочитали локально; до моделі відправили спочатку тільки описи.

**Якщо не так:** повний текст уже в першому запиті — перевір, чи випадково не додав skills.text до context. Немає readSkill серед викликів — подивись tools у TRACE і вибір моделі. `Невідомий skill` — звір імʼя billing: readSkill приймає імʼя зі списку, а не шлях.

**Контрольна точка: `step-6-skills`.**

<a id="guard"></a>

## 10. Перевір дозвіл перед виконанням

У обʼєкті billing перед runTool додай перевірку дозволу:

```ts
  beforeTool(name: string) {
    if (name === 'sendReply' && process.env.APPROVED !== '1') {
      return 'blocked, ask the user';
    }
    return null;
  },

  async runTool(name: string, input: unknown) {
```

У тип Agent додай необовʼязкову перевірку:

```ts
  context?: string;
  beforeTool?: (name: string) => string | null;
```

У try перед виконанням runTool встав перевірку. Якщо вона відмовить, catch уже поверне помилку як результат тула:

```ts
      const blocked = agent.beforeTool?.(call.toolName);
      if (blocked) {
        throw new Error(blocked);
      }

      result = await agent.runTool(call.toolName, call.input);
```

Тест «Два тули…» перевіряє дозволений запис. **Лише в цьому тесті** додай beforeTool до аргументу runAgent:

```ts
{ ...billing, model, beforeTool: () => null }
```

Додай окрему перевірку заборони:

```ts
test('Без дозволу sendReply не створює outbox, модель бачить блокування', async (t) => {
  const originalDirectory = process.cwd();
  const approved = process.env.APPROVED;
  process.chdir(await mkdtemp(join(tmpdir(), 'harness-blocked-')));
  process.env.APPROVED = '0';
  t.after(() => {
    process.chdir(originalDirectory);
    if (approved === undefined) delete process.env.APPROVED;
    else process.env.APPROVED = approved;
  });

  const model = new MockLanguageModelV3({
    doGenerate: [
      reply([call('sendReply', { customerId: 42, text: 'Відповідь' })]),
      final,
    ],
  });
  await runAgent({ ...billing, model }, 'Надішли');

  await assert.rejects(() => readFile('.data/outbox.jsonl'), { code: 'ENOENT' });
  assert.match(JSON.stringify(model.doGenerateCalls[1].prompt), /blocked, ask the user/);
});
```

```bash
npm run check
APPROVED=0 npm start
APPROVED=1 npm start
```

**Очікуємо:** девʼять тестів проходять. Без дозволу запит sendReply отримує blocked, а outbox не змінюється. З дозволом виконаний sendReply додає рядок. Якщо модель взагалі не попросила sendReply, запису не буде і з APPROVED=1.

**Якщо не так:** файл змінився без дозволу — перевір, чи beforeTool стоїть саме перед runTool. Модель повторює заборонений виклик — це не виконання дії; цикл зупинить ліміт. Перевірку стану файла відділяємо від тексту відповіді.

**Контрольна точка: `step-7-guard`; `main` містить готове рішення.**

<a id="checkpoints"></a>

## Як звіритися або наздогнати групу

Для написання коду за цим ранбуком команди нижче не потрібні. Використовуй їх, коли хочеш порівняти свою реалізацію або продовжити з готового стану. Потрібен доступ до приватного репозиторію та авторизація GitHub у Git.

Один раз у своїй папці підключи репозиторій контрольних точок:

```bash
git remote add checkpoints https://github.com/genkovich/harness-workshop.git
git fetch checkpoints
```

| Після кроку ранбуку | Контрольна гілка |
|---|---|
| 3 · модель + billing, ще без tools у запиті | start |
| 4 · модель просить тул | step-1-request |
| 5 · тул виконано, результат у messages | step-2-tools |
| 6 · повторення й ліміт | step-3-loop |
| 7 · змінений description | step-4-description |
| 8 · AGENTS.md | step-5-context |
| 9 · skills | step-6-skills |
| 10 · дозвіл | step-7-guard / main |

**Лише порівняти код**, залишаючись у своїй гілці:

```bash
git diff checkpoints/step-2-tools -- src
```

Підстав потрібну контрольну точку. Відступи та розташування коментарів можуть відрізнятися: звір поведінку й перевірки.

**Продовжити з готового стану**, наприклад після виконання тула. Спершу збережи свою роботу:

```bash
git status
git add -A
git diff --cached
git commit -m "Мій harness до виконання тулів"
git switch -c continue-tools checkpoints/step-2-tools
npm ci
npm run check
```

Якщо Git пише nothing to commit, переходь до git switch. Якщо просить імʼя й email, налаштуй їх через `git config user.name` та `git config user.email`, потім повтори commit. Для іншої контрольної точки обери нову назву власної гілки.

Твій код залишився в `work`; `.env` і `.data/` не потрапили в Git. Далі повернися до **кроку 6 цього ранбуку** й допиши цикл. Перемикатися після кожного кроку не потрібно.

Після завершення практики поясни по одному запуску: що отримала модель, хто виконав тул, куди повернувся результат і яка умова зупинила цикл.


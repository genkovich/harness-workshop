# 10. Правила з файла

[Усі теми](README.md) · [Попередня](09-description.md) · [Наступна](11-skills.md)

**Перед початком:** код після `step-09-description`. **Результат теми:** `step-10-context`. Змінюємо лише `src/`.

## Що робимо й навіщо

Читаємо підготовлений AGENTS.md і додаємо правила перед задачею. Файл потрапляє в контекст лише тому, що наш код його прочитав і передав.

### Для чого node:fs

`readFileSync` — вбудована функція Node.js для читання файла. Тут читаємо маленький файл один раз під час запуску. `new URL(..., import.meta.url)` знаходить його відносно поточного модуля.

## Чого бракує зараз і що зміниться

Правила лежать у файлі, але сам файл не входить у запит. Читаємо його й явно додаємо текст перед задачею.

- billing.context містить прочитані правила; harness лише додає цей контекст до повідомлення.
- Правила стають префіксом user-повідомлення. system залишається окремим полем із роллю та загальною поведінкою агента.
- TRACE і тест показують, чи правило справді передане. Дотримання правила перевіряємо у відповіді моделі окремо.

## Маленькі зміни

Спочатку у src/billing/agent.ts поверни description sendReply:

```ts
description: 'Надішли відповідь після перевірки списань.',
```

AGENTS.md уже підготовлено. Прочитай файл: у ньому правило починати відповідь словами «Дякуємо за звернення». У src/billing/agent.ts додай:

```ts
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../../AGENTS.md', import.meta.url), 'utf8');
```

У billing додай поле:

```ts
context: rules,
```

У тип Agent у src/harness.ts додай:

```ts
context?: string;
```

У початковому messages заміни content user-повідомлення:

```ts
content: `${agent.context || ''}\n${task}`.trim(),
```

Подивись перший запит:

```bash
TRACE=1 npm start -- "Перевір списання клієнта 42."
```

## Перевірка

```bash
npm run check
npm test -- --test-name-pattern "^(0[0-9]|10) "
npm start -- "Перевір списання клієнта 42."
```

**Автоматична перевірка:** 21 тестів без мережі. Усі тести вже є в [test/harness.test.mjs](../test/harness.test.mjs) та [test/runbooks.test.mjs](../test/runbooks.test.mjs). Число на початку назви тесту відповідає етапу; команда запускає цей і попередні етапи.

**Очікуємо:** Правило є в першому user-повідомленні. Його дотримання перевіряємо окремо у відповіді живої моделі.

**Якщо не так:** Файл є, тексту немає — звір billing.context і складання messages. Файл редагувати не потрібно.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 10: Правила з файла"
```

## Якщо не встиг: готова точка й наступна тема

Ця гілка містить **результат теми 10**. Збережи свою спробу й створи робочу гілку від готового коду:

```bash
git add src
git diff --cached
git diff --cached --quiet || git commit -m "Моя спроба етапу 10"
git fetch origin
git switch -c work-11 origin/step-10-context
npm run check
npm test -- --test-name-pattern "^(0[0-9]|10) "
```

Власний коміт залишився у попередній гілці. Якщо work-11 вже існує, обери нове імʼя, наприклад work-11-retry. .env і node_modules залишаються на місці. Відкрий [ранбук 11](11-skills.md) в тому самому редакторі: усі ранбуки й тести доступні в кожній гілці.

Якщо завершив самостійно, продовжуй у своїй гілці за наступним ранбуком; брати готовий код необовʼязково.

## Готовий код

Очікуваний вміст змінених файлів після цього етапу. Інші файли залишаються як були. Маленькі кроки наведено вище.

<details>
<summary>src/billing/agent.ts</summary>

```ts
import { openrouter } from '@openrouter/ai-sdk-provider';
import { appendFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tool } from 'ai';
import { z } from 'zod';
import charges from './charges.json' with { type: 'json' };

const customerId = z.number().int().positive();
const chargesInput = z.object({ customerId });
const replyInput = z.object({ customerId, text: z.string().min(1).max(4000) });
const rules = readFileSync(new URL('../../AGENTS.md', import.meta.url), 'utf8');

const system = [
  'Роль: ти агент підтримки з питань списань.',
  'Мета: перевір факти й поясни клієнту результат.',
  'Дані: списання отримуй через getCharges; не вигадуй їх.',
  'Відповідь: після перевірки використовуй sendReply.',
  'Уточнення: якщо номера клієнта немає, попроси його.',
  'Межі: не обіцяй повернення коштів; такого тула немає.',
  'Мова: українська.',
].join('\n');

// Один предметний модуль: правила підтримки, описи тулів та їхній код.
export const billing = {
  model: openrouter(process.env.OPENROUTER_MODEL || 'qwen/qwen3.8-27b:free'),
  system,
  context: rules,

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

</details>

<details>
<summary>src/harness.ts</summary>

```ts
import {
  generateText,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
  type JSONValue,
} from 'ai';

export type Agent = {
  model: LanguageModel;
  system: string;
  tools: ToolSet;
  runTool: (name: string, input: unknown) => Promise<JSONValue>;
  context?: string;
  maxSteps?: number;
};

export async function runAgent(agent: Agent, task: string) {
  const messages: ModelMessage[] = [
    { role: 'user', content: `${agent.context || ''}\n${task}`.trim() },
  ];

  for (let step = 1; step <= (agent.maxSteps ?? 10); step++) {
    console.log(`\nКрок ${step}. Повідомлень у запиті: ${messages.length}.`);

    const reply = await generateText({
      model: agent.model,
      system: agent.system,
      messages,
      tools: agent.tools,
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

    // Немає запитів на тули: модель уже дала фінальну відповідь.
    if (reply.toolCalls.length === 0) {
      console.log('Зупинка: модель відповіла без виклику тула.');
      return { reason: 'final', text: reply.text, messages };
    }

    // Спочатку запит моделі на виклик тула, потім наш результат.
    // Беремо лише assistant: помилки тулів повертаємо нижче самі.
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
  }

  console.log('Зупинка: досягли ліміту кроків. Задача може бути незавершена.');
  return { reason: 'limit', text: '', messages };
}
```

</details>


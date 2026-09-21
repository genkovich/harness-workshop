# 06. Виконання

[Усі теми](README.md) · [Попередня](05-call.md) · [Наступна](07-history.md)

**Перед початком:** код після `step-05-call`. **Результат теми:** `step-06-execute`. Змінюємо лише `src/`.

## Що робимо й навіщо

Зіставляємо імʼя тула з функцією й перевіряємо аргументи перед дією. getCharges читає навчальні дані, sendReply пише лише локальний outbox.

### Для чого parse і node:fs/promises

`chargesInput.parse(input)` із Zod повертає перевірені дані або кидає помилку. `.safeParse(input)` повертає результат із полем success; його використовують наші тести. В обох випадках перевірка відбувається під час виконання.

`node:fs/promises` — вбудований модуль Node.js, додатково встановлювати його не потрібно. `mkdir` створює папку, `appendFile` додає рядок у локальний файл. `JSONValue` із `ai` описує значення, яке можна передати моделі як JSON.

## Маленькі зміни

У src/billing/agent.ts додай імпорти:

```ts
import { appendFile, mkdir } from 'node:fs/promises';
import charges from './charges.json' with { type: 'json' };
```

У billing, після поля tools, додай метод:

```ts
async runTool(name: string, input: unknown) {
  switch (name) {
    // Нижче додамо два case перед default.
    default:
      throw new Error(`Невідомий тул: ${name}`);
  }
},
```

Перед default додай getCharges:

```ts
case 'getCharges': {
  const { customerId } = chargesInput.parse(input);
  return charges.filter(charge => charge.customerId === customerId);
}
```

Там само додай sendReply; він пише локальний файл:

```ts
case 'sendReply': {
  const reply = replyInput.parse(input);
  await mkdir('.data', { recursive: true });
  await appendFile('.data/outbox.jsonl', JSON.stringify(reply) + '\n');
  return { status: 'saved-to-outbox' };
}
```

У src/harness.ts додай type JSONValue до імпорту з ai, а в Agent:

```ts
runTool: (name: string, input: unknown) => Promise<JSONValue>;
```

У for (const call...) після console.log додай:

```ts
let result;
try {
  if (call.invalid) throw call.error;
  result = await agent.runTool(call.toolName, call.input);
} catch (error) {
  result = { error: error instanceof Error ? error.message : String(error) };
}
console.log(`Результат ${call.toolName}:`, result);
```

Кінцевий return tool-call заміни на:

```ts
return { reason: 'tool-result', text: '', messages };
```

## Перевірка

```bash
npm run check
npm test -- --test-name-pattern "^0[0-6] "
npm start -- "Перевір списання клієнта 42."
```

**Автоматична перевірка:** 10 тестів без мережі. Усі тести вже є в [test/harness.test.mjs](../test/harness.test.mjs) та [test/runbooks.test.mjs](../test/runbooks.test.mjs). Число на початку назви тесту відповідає етапу; команда запускає цей і попередні етапи.

**Очікуємо:** getCharges повертає два списання; некоректні аргументи відхиляються. Результат поки лише в терміналі.

**Якщо не так:** Читай result.error. customerId має бути числом, назва тула повинна збігатися з case. Реальних листів sendReply не надсилає.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 06: Виконання"
```

## Якщо не встиг: готова точка й наступна тема

Ця гілка містить **результат теми 06**. Збережи свою спробу й створи робочу гілку від готового коду:

```bash
git add src
git diff --cached
git diff --cached --quiet || git commit -m "Моя спроба етапу 06"
git fetch origin
git switch -c work-07 origin/step-06-execute
npm run check
npm test -- --test-name-pattern "^0[0-6] "
```

Власний коміт залишився у попередній гілці. Якщо work-07 вже існує, обери нове імʼя, наприклад work-07-retry. .env і node_modules залишаються на місці. Відкрий [ранбук 07](07-history.md) в тому самому редакторі: усі ранбуки й тести доступні в кожній гілці.

Якщо завершив самостійно, продовжуй у своїй гілці за наступним ранбуком; брати готовий код необовʼязково.

## Готовий код

Очікуваний вміст змінених файлів після цього етапу. Інші файли залишаються як були. Маленькі кроки наведено вище.

<details>
<summary>src/billing/agent.ts</summary>

```ts
import { openrouter } from '@openrouter/ai-sdk-provider';
import { appendFile, mkdir } from 'node:fs/promises';
import { tool } from 'ai';
import { z } from 'zod';
import charges from './charges.json' with { type: 'json' };

const customerId = z.number().int().positive();
const chargesInput = z.object({ customerId });
const replyInput = z.object({ customerId, text: z.string().min(1).max(4000) });

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
  model: openrouter('openai/gpt-oss-20b'),
  system,

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
};

export async function runAgent(agent: Agent, task: string) {
  const messages: ModelMessage[] = [{ role: 'user', content: task }];

  console.log(`\nОдин запит. Повідомлень у запиті: ${messages.length}.`);

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

  }


  console.log('Модель ще не отримала результат. Наступний запит додамо далі.');
  return { reason: 'tool-result', text: '', messages };
}
```

</details>


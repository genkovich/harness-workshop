# 12. Дозвіл

[Усі теми](README.md) · [Попередня](11-skills.md)

**Перед початком:** код після `step-11-skills`. **Результат теми:** `step-12-guard`. Змінюємо лише `src/`.

## Що робимо й навіщо

Додаємо перевірку дозволу перед виконанням sendReply. Навіть якщо модель попросила дію, код має право її заблокувати.

## Маленькі зміни

Спочатку в масив system у src/billing/agent.ts перед рядком «Мова» додай правило реакції на блокування:

```ts
'Дозвіл: якщо дію заблоковано, попроси підтвердження.',
```

Правило просить модель пояснити ситуацію. Відмову у виконанні забезпечить перевірка коду нижче.

У billing у src/billing/agent.ts додай метод:

```ts
beforeTool(name: string) {
  if (name === 'sendReply' && process.env.APPROVED !== '1') {
    return 'blocked, ask the user';
  }
  return null;
},
```

У тип Agent у src/harness.ts додай:

```ts
beforeTool?: (name: string) => string | null;
```

У try перед agent.runTool встав:

```ts
const blocked = agent.beforeTool?.(call.toolName);
if (blocked) {
  throw new Error(blocked);
}
```

Порівняй два запуски без редагування .env:

```bash
APPROVED=0 npm start -- "Перевір списання клієнта 42."
APPROVED=1 npm start -- "Перевір списання клієнта 42."
```

## Перевірка

```bash
npm run check
npm test -- --test-name-pattern "^(0[0-9]|1[0-2]) "
npm start -- "Перевір списання клієнта 42."
```

**Автоматична перевірка:** 22 тестів без мережі. Усі тести вже є в [test/harness.test.mjs](../test/harness.test.mjs) та [test/runbooks.test.mjs](../test/runbooks.test.mjs). Число на початку назви тесту відповідає етапу; команда запускає цей і попередні етапи.

**Очікуємо:** Без дозволу sendReply повертає blocked і не змінює outbox. Дозволений виклик додає рядок.

**Якщо не так:** Файл змінився без дозволу — перевір місце beforeTool. Повторний запит моделі на заборонений тул ще не означає виконання дії.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 12: Дозвіл"
```

## Якщо не встиг: готова точка й наступна тема

Ця гілка містить **результат теми 12**. Збережи свою спробу й створи робочу гілку від готового коду:

```bash
git add src
git diff --cached
git diff --cached --quiet || git commit -m "Моя спроба етапу 12"
git fetch origin
git switch -c work-finished origin/step-12-guard
npm run check
npm test -- --test-name-pattern "^(0[0-9]|1[0-2]) "
```

Власний коміт залишився у попередній гілці. Якщо work-finished вже існує, обери нове імʼя, наприклад work-finished-retry. .env і node_modules залишаються на місці. Відкрий [завершений маршрут](README.md) в тому самому редакторі: усі ранбуки й тести доступні в кожній гілці.

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
import { skills, readSkill } from '../skills.ts';

const customerId = z.number().int().positive();
const chargesInput = z.object({ customerId });
const replyInput = z.object({ customerId, text: z.string().min(1).max(4000) });
const skillInput = z.object({ name: z.string() });
const rules = readFileSync(new URL('../../AGENTS.md', import.meta.url), 'utf8');
const descriptions = skills
  .map((skill) => `${skill.name}: ${skill.description}`)
  .join('\n');

const system = [
  'Роль: ти агент підтримки з питань списань.',
  'Мета: перевір факти й поясни клієнту результат.',
  'Дані: списання отримуй через getCharges; не вигадуй їх.',
  'Відповідь: після перевірки використовуй sendReply.',
  'Уточнення: якщо номера клієнта немає, попроси його.',
  'Межі: не обіцяй повернення коштів; такого тула немає.',
  'Дозвіл: якщо дію заблоковано, попроси підтвердження.',
  'Мова: українська.',
].join('\n');

// Один предметний модуль: правила підтримки, описи тулів та їхній код.
export const billing = {
  model: openrouter('openai/gpt-oss-20b'),
  system,
  context: `${rules}\nSkills:\n${descriptions}`,

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
    readSkill: tool({
      description: 'Прочитай повну інструкцію потрібного skill.',
      inputSchema: skillInput,
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
      case 'readSkill': {
        const { name } = skillInput.parse(input);
        return { text: readSkill(name) };
      }
      default:
        throw new Error(`Невідомий тул: ${name}`);
    }
  },

  beforeTool(name: string) {
    if (name === 'sendReply' && process.env.APPROVED !== '1') {
      return 'blocked, ask the user';
    }
    return null;
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
  beforeTool?: (name: string) => string | null;
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
        const blocked = agent.beforeTool?.(call.toolName);
        if (blocked) {
          throw new Error(blocked);
        }

        // Виконання відбувається в нашій програмі, після перевірки дозволу.
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


# 04. Описи тулів

[Усі теми](README.md) · [Попередня](03-function.md) · [Наступна](05-call.md)

**Перед початком:** код після `step-03-function`. **Результат теми:** `step-04-tools`. Змінюємо лише `src/`.

## Що робимо й навіщо

Описуємо два тули та допустимі аргументи. Моделі потрібен контракт: назва, призначення й схема даних. Виконання підключимо окремим кроком.

### Що таке Zod і tool

`zod` — бібліотека схем і перевірки даних під час виконання. Імпорт `z` дає конструктори: `z.number()` вимагає число, `.int()` — ціле, `.positive()` — більше нуля; `z.object()` описує обʼєкт. TypeScript перевіряє наш код, а Zod перевіряє фактичні аргументи, що прийшли від моделі. Наприклад, `{ customerId: 42 }` підходить, а `{ customerId: "42" }` — ні. [Основи Zod](https://zod.dev/basics).

`tool` із `ai` оформлює опис тула. `description` пояснює моделі призначення, `inputSchema` задає очікувані аргументи. SDK передає схему моделі й перевіряє відповідь. Поле `execute` ми не додаємо: виконання буде видно у нашому `runTool`. [Тули в AI SDK](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling).

## Маленькі зміни

Дані вже лежать у src/billing/charges.json. Створи поряд `src/billing/agent.ts`:

```ts
import { tool } from 'ai';
import { z } from 'zod';

const customerId = z.number().int().positive();
const chargesInput = z.object({ customerId });
const replyInput = z.object({
  customerId,
  text: z.string().min(1).max(4000),
});
```

Нижче створи обʼєкт billing:

```ts
export const billing = {
  system: 'Ти агент підтримки. Перевір списання через getCharges, ' +
    'потім відповідай через sendReply. ' +
    'Якщо дію заблоковано, попроси дозвіл.',
  tools: {
    // Тут будуть два описи нижче.
  },
};
```

У tools додай перший опис:

```ts
getCharges: tool({
  description: 'Знайди списання клієнта.',
  inputSchema: chargesInput,
}),
```

Поряд додай другий:

```ts
sendReply: tool({
  description: 'Надішли відповідь після перевірки списань.',
  inputSchema: replyInput,
}),
```

У src/main.ts додай імпорт:

```ts
import { billing } from './billing/agent.ts';
```

У параметрі runAgent заміни system на розгортання billing:

```ts
{
  ...billing,
  model: openrouter('openai/gpt-oss-20b'),
}
```

## Перевірка

```bash
npm run check
npm test -- --test-name-pattern "^0[0-4] "
npm start
```

**Автоматична перевірка:** 6 тестів без мережі. Усі тести вже є в [test/harness.test.mjs](../test/harness.test.mjs) та [test/runbooks.test.mjs](../test/runbooks.test.mjs). Число на початку назви тесту відповідає етапу; команда запускає цей і попередні етапи.

**Очікуємо:** Один тест проходить. Описи існують у нашому обʼєкті; у TRACE tools ще немає. Наступним кроком передамо їх моделі.

**Якщо не так:** Не додавай execute до tool(): виконання підключимо власним кодом. Перевір, що обидва описи лежать усередині billing.tools.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 04: Описи тулів"
```

## Якщо не встиг: готова точка й наступна тема

Ця гілка містить **результат теми 04**. Збережи свою спробу й створи робочу гілку від готового коду:

```bash
git add src
git diff --cached
git diff --cached --quiet || git commit -m "Моя спроба етапу 04"
git fetch origin
git switch -c work-05 origin/step-04-tools
npm run check
npm test -- --test-name-pattern "^0[0-4] "
```

Власний коміт залишився у попередній гілці. Якщо work-05 вже існує, обери нове імʼя, наприклад work-05-retry. .env і node_modules залишаються на місці. Відкрий [ранбук 05](05-call.md) в тому самому редакторі: усі ранбуки й тести доступні в кожній гілці.

Якщо завершив самостійно, продовжуй у своїй гілці за наступним ранбуком; брати готовий код необовʼязково.

## Готовий код

Очікуваний вміст змінених файлів після цього етапу. Інші файли залишаються як були. Це код для звірки; маленькі кроки наведено вище.

<details>
<summary>src/billing/agent.ts</summary>

```ts
import { tool } from 'ai';
import { z } from 'zod';

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

};
```

</details>

<details>
<summary>src/main.ts</summary>

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

</details>


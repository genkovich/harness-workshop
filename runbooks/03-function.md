# 03. Функція запиту

[Усі теми](README.md) · [Попередня](02-messages.md) · [Наступна](04-tools.md)

**Перед початком:** код після `step-02-messages`. **Результат теми:** `step-03-function`. Змінюємо лише `src/`.

## Що робимо й навіщо

Виносимо запит у runAgent, а вибір моделі лишаємо в main.ts. Функцію можна викликати з різними моделями й перевіряти без мережі.

### Для чого типи з ai

`LanguageModel` — тип обʼєкта моделі, який приймає generateText. `ModelMessage` — тип повідомлення в історії. Ми передаємо модель як параметр, тому тест може підставити заздалегідь задані відповіді через `MockLanguageModelV3` з `ai/test`.

## Чого бракує зараз і що зміниться

Запит уже працює в main.ts. Але якщо залишити все там, для кожного іншого агента доведеться копіювати виклик і його перевірки. Виносимо спільну дію у runAgent.

- agent передає налаштування, task — конкретну задачу. Функція не знає про клієнта чи списання.
- Повертаємо обʼєкт із reason, text і messages, щоб викликач міг відрізнити результат від історії виконання.
- Передана як параметр модель дозволяє тесту задати відповідь без мережі. Так перевіряємо власну логіку незалежно від доступності API.
- TRACE друкує тіло запиту: можемо перевірити, що саме надіслали, замість вгадувати за відповіддю.

## Маленькі зміни

Створи `src/harness.ts`. Спочатку імпорти й тип параметра:

```ts
import { generateText, type LanguageModel, type ModelMessage } from 'ai';

export type Agent = {
  model: LanguageModel;
  system: string;
};
```

Нижче створи функцію. Між messages і return перенесемо готовий запит:

```ts
export async function runAgent(agent: Agent, task: string) {
  const messages: ModelMessage[] = [{ role: 'user', content: task }];
  // Тут буде твій generateText і перевірки нижче.
  return { reason: 'final', text: reply.text, messages };
}
```

Перенеси const reply = await generateText(...) зі src/main.ts у позначене місце. Заміни тільки ці три поля; maxRetries, maxOutputTokens і timeout залиш:

```ts
model: agent.model,
system: agent.system,
messages,
```

У параметри generateText додай:

```ts
include: { requestBody: true },
```

Після запиту, перед return, додай дві перевірки:

```ts
if (process.env.TRACE === '1') {
  console.log('HTTP-запит:', reply.request.body);
}
if (reply.finishReason === 'length') {
  throw new Error('Відповідь обрізано. Тули не виконуємо.');
}
```

Тепер у src/main.ts лиши підключення моделі. Імпорти:

```ts
import { openrouter } from '@openrouter/ai-sdk-provider';
import { runAgent } from './harness.ts';
```

Після імпортів додай задачу й запуск. Старий generateText уже перенесений:

```ts
const task = process.argv[2]?.trim();
if (!task) {
  console.error('Помилка: передай задачу. Наприклад: npm start -- "Перевір списання клієнта 42."');
  process.exit(1);
}
```

Нижче викликаємо функцію лише з перевіреною задачею:

```ts

const result = await runAgent({
  model: openrouter('openai/gpt-oss-20b'),
  system: 'Відповідай українською.',
}, task);

console.log('Відповідь:', result.text);
```

Для перегляду HTTP body:

```bash
TRACE=1 npm start -- "Перевір списання клієнта 42."
```

## Перевірка

```bash
npm run check
npm test -- --test-name-pattern "^0[0-3] "
npm start -- "Перевір списання клієнта 42."
```

**Автоматична перевірка:** 7 тестів без мережі. Усі тести вже є в [test/harness.test.mjs](../test/harness.test.mjs) та [test/runbooks.test.mjs](../test/runbooks.test.mjs). Число на початку назви тесту відповідає етапу; команда запускає цей і попередні етапи.

**Очікуємо:** Перший готовий тест проходить без ключа: один запит завершується текстом. У TRACE видно system та user; заголовок авторизації не друкується.

**Якщо не так:** Тест перевіряє наш код із заданою відповіддю моделі. Якщо він проходить, а живий запуск падає, перевір ключ і мережу окремо.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 03: Функція запиту"
```

## Якщо не встиг: готова точка й наступна тема

Ця гілка містить **результат теми 03**. Збережи свою спробу й створи робочу гілку від готового коду:

```bash
git add src
git diff --cached
git diff --cached --quiet || git commit -m "Моя спроба етапу 03"
git fetch origin
git switch -c work-04 origin/step-03-function
npm run check
npm test -- --test-name-pattern "^0[0-3] "
```

Власний коміт залишився у попередній гілці. Якщо work-04 вже існує, обери нове імʼя, наприклад work-04-retry. .env і node_modules залишаються на місці. Відкрий [ранбук 04](04-tools.md) в тому самому редакторі: усі ранбуки й тести доступні в кожній гілці.

Якщо завершив самостійно, продовжуй у своїй гілці за наступним ранбуком; брати готовий код необовʼязково.

## Готовий код

Очікуваний вміст змінених файлів після цього етапу. Інші файли залишаються як були. Маленькі кроки наведено вище.

<details>
<summary>src/harness.ts</summary>

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

</details>

<details>
<summary>src/main.ts</summary>

```ts
import { openrouter } from '@openrouter/ai-sdk-provider';
import { runAgent } from './harness.ts';

const task = process.argv[2]?.trim();
if (!task) {
  console.error('Помилка: передай задачу. Наприклад: npm start -- "Перевір списання клієнта 42."');
  process.exit(1);
}

try {
  const result = await runAgent(
    {
      system: 'Відповідай українською.',
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


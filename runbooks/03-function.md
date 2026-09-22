# 03. Функція запиту

[Усі теми](README.md) · [Попередня](02-messages.md) · [Наступна](04-tools.md)

**Перед початком:** код із гілки `step-02-messages`. **Результат теми:** `step-03-function`. Змінюємо лише `src/`.

## Що робимо й навіщо

Виносимо запит у runAgent, а вибір моделі лишаємо в main.ts. Функцію можна викликати з різними моделями й перевіряти без мережі.

### Для чого типи з ai

`LanguageModel` — тип обʼєкта моделі, який приймає generateText. `ModelMessage` — тип повідомлення в історії. Ми передаємо модель як параметр, тому тест може підставити заздалегідь задані відповіді через `MockLanguageModelV3` з `ai/test`.

## Чого бракує зараз і що зміниться

Запит уже працює в main.ts. Але якщо залишити все там, для кожного іншого агента доведеться копіювати виклик і його перевірки. Виносимо спільну дію у runAgent.

- agent передає налаштування, task — конкретне завдання. Функція не знає про користувача чи дискусії.
- Повертаємо обʼєкт із reason, text і messages, щоб код, який викликав функцію, міг окремо показати відповідь і перевірити історію.
- Передана як параметр модель дозволяє тесту задати відповідь без мережі. Так перевіряємо власну логіку незалежно від доступності API.
- TRACE друкує тіло запиту: можемо перевірити, що саме надіслали, замість того, щоб вгадувати за відповіддю.

## Маленькі зміни

Створи `src/harness.ts`. Перенеси сюди імпорти для запиту та константи `maxOutputTokens` і `modelTimeoutMs` із `main.ts`: тепер вони потрібні цій функції. Додай тип налаштувань агента:

```ts
import { generateText, type LanguageModel, type ModelMessage } from 'ai';

const maxOutputTokens = 512;
const modelTimeoutMs = 60_000;

export type Agent = {
  model: LanguageModel;
  system: string;
};
```

`export` робить тип і функцію доступними для імпорту в інших файлах. `Agent` описує налаштування, а `async` дозволяє чекати мережеву відповідь через `await`. Функція поверне Promise, тому в `main.ts` теж використаємо `await`.

Нижче створи функцію. Це проміжний каркас: `reply` зʼявиться після перенесення запиту наступним фрагментом. До цього перевірка типів ще не пройде:

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

`include` керує тим, які додаткові дані AI SDK збереже в результаті. `requestBody: true` просить зберегти **тіло HTTP-запиту** — JSON із моделлю, повідомленнями й параметрами, який адаптер підготував для провайдера. Так зможемо перевірити, чи справді передали потрібні правила. Ця опція сама нічого не друкує.

У параметри generateText додай:

```ts
include: { requestBody: true },
```

Після запиту додай перемикач діагностики. `TRACE` — змінна, яку придумали ми для цієї програми; це не параметр Groq. Значення змінних середовища є рядками, тому порівнюємо з `'1'`. Лише в цьому режимі друкуємо `reply.finalStep.request.body`. `finalStep` містить останній крок SDK; у нас це єдиний запит у цьому виклику `generateText`. Читаємо тіло запиту без заголовка авторизації.

```ts
if (process.env.TRACE === '1') {
  console.log('HTTP-запит:', reply.finalStep.request.body);
}
```

Окремо додай захист від незавершеної генерації. `finishReason === 'length'` означає, що відповідь обрізана. Згодом там можуть бути неповні аргументи інструмента. `throw new Error(...)` зупиняє функцію до `return` і виконання дій; повідомлення пояснює причину в терміналі.

```ts
if (reply.finishReason === 'length') {
  throw new Error('Відповідь обрізано. Тули не виконуємо.');
}
```

`reason: 'final'` у нашому `return` — статус, який визначає **наш harness — код, який керує роботою агента**. Він відрізняється від `reply.finishReason`, який описує завершення генерації. `text` потрібен для показу відповіді, `messages` — для перевірки історії.

Тепер у src/main.ts лиши підключення моделі. Імпорти:

```ts
import { groq } from '@ai-sdk/groq';
import { runAgent } from './harness.ts';
```

Після імпортів додай завдання й запуск. Старий generateText уже перенесений:

```ts
const task = process.argv[2]?.trim();
if (!task) {
  console.error('Помилка: передай задачу. Наприклад: npm start -- "Знайди до трьох обговорень про harness engineering і coding agents за останні 7 днів. Прочитай коментарі та збережи український дайджест із посиланнями."');
  process.exit(1);
}
```

Нижче викликаємо функцію лише з перевіреним завданням:

```ts

const result = await runAgent({
  model: groq(process.env.GROQ_MODEL || 'qwen/qwen3.8-27b'),
  system: 'Reply in Ukrainian.',
}, task);

console.log('Відповідь:', result.text);
```

`TRACE=1` перед командою в Git Bash/bash/zsh задає змінну лише цьому запуску. Без неї діагностичний рядок не друкується. У тілі запиту знайди модель, повідомлення з правилами та текст завдання; у наступних темах там зʼявляться також схеми інструментів.

Щоб переглянути тіло HTTP-запиту:

```bash
TRACE=1 npm start -- "Знайди до трьох обговорень про harness engineering і coding agents за останні 7 днів. Прочитай коментарі та збережи український дайджест із посиланнями."
```

## Перевірка

```bash
npm run check
npm test -- --test-name-pattern "^0[0-3] "
npm start -- "Знайди до трьох обговорень про harness engineering і coding agents за останні 7 днів. Прочитай коментарі та збережи український дайджест із посиланнями."
```

**Автоматична перевірка:** 9 тестів без мережі. Усі тести вже є в [test/harness.test.mjs](../test/harness.test.mjs) та [test/runbooks.test.mjs](../test/runbooks.test.mjs). Число на початку назви тесту відповідає етапу; команда запускає цей і попередні етапи.

**Очікуємо:** перший готовий тест проходить без ключа: один запит завершується текстом. У TRACE видно system та user; заголовок авторизації не друкується.

**Якщо не так:** Тест перевіряє наш код із заданою відповіддю моделі. Якщо він проходить, а запит до API завершується помилкою, перевір ключ і мережу окремо.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 03: Функція запиту"
```

## Якщо не встиг: готова гілка й наступна тема

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

Очікуваний вміст змінених файлів після теми. Інші файли залишаються без змін.

<details>
<summary>src/harness.ts</summary>

```ts
import {
  generateText,
  type LanguageModel,
  type ModelMessage,
} from 'ai';

const maxOutputTokens = 512;
const modelTimeoutMs = 60_000;

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
    maxOutputTokens,
    abortSignal: AbortSignal.timeout(modelTimeoutMs),
    include: { requestBody: true },
  });

  if (process.env.TRACE === '1') {
    console.log('HTTP-запит:', reply.finalStep.request.body);
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
import { groq } from '@ai-sdk/groq';
import { runAgent } from './harness.ts';

const task = process.argv[2]?.trim();
if (!task) {
  console.error('Помилка: передай задачу. Наприклад: npm start -- "Знайди до трьох обговорень про harness engineering і coding agents за останні 7 днів. Прочитай коментарі та збережи український дайджест із посиланнями."');
  process.exit(1);
}

try {
  const result = await runAgent(
    {
      system: 'Reply in Ukrainian.',
      model: groq(process.env.GROQ_MODEL || 'qwen/qwen3.8-27b'),
    },
    task,
  );

  if (result.text) {
    console.log(`\nВідповідь: ${result.text}`);
  }
  if (result.reason === 'limit') {
    process.exitCode = 2;
  }
} catch (error) {
  console.error('Помилка:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
```

</details>


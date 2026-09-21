# 02. Повідомлення

[Усі теми](README.md) · [Попередня](01-model.md) · [Наступна](03-function.md)

**Перед початком:** код після `step-01-model`. **Результат теми:** `step-02-messages`. Змінюємо лише `src/`.

## Що робимо й навіщо

Відокремлюємо правила system від задачі user. Масив messages стане історією: згодом ми додамо сюди запити моделі на тули й результати.

### Що означає type ModelMessage

`ModelMessage` із пакета `ai` описує повідомлення: роль user, assistant або tool і допустимий вміст. `import type` потрібен TypeScript для перевірки коду; під час виконання це не окремий обʼєкт і не запит до моделі.

## Маленькі зміни

У `src/main.ts` додай ModelMessage до імпорту з ai:

```ts
import { generateText, type ModelMessage } from 'ai';
```

Після const model додай задачу та початкове повідомлення:

```ts
const task = process.argv[2] || 'Перевір списання клієнта 42.';
const messages: ModelMessage[] = [{ role: 'user', content: task }];
```

У generateText прибери поле prompt. На його місце встав:

```ts
system: 'Відповідай українською.',
messages,
```

Перед викликом моделі можеш подивитися, що передаєш:

```ts
console.log('Повідомлення:', messages);
```

## Перевірка

```bash
npm run check
npm test -- --test-name-pattern "^0[0-2] "
npm start
```

**Автоматична перевірка:** 4 тестів без мережі. Усі тести вже є в [test/harness.test.mjs](../test/harness.test.mjs) та [test/runbooks.test.mjs](../test/runbooks.test.mjs). Число на початку назви тесту відповідає етапу; команда запускає цей і попередні етапи.

**Очікуємо:** Одна задача user і відповідь моделі. Тулів ще немає; текст про списання не означає, що дані перевірені.

**Якщо не так:** Якщо тип role не підходить, звір ModelMessage[]. Власну задачу передай через npm start -- "Твоя задача".

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 02: Повідомлення"
```

## Якщо не встиг: готова точка й наступна тема

Ця гілка містить **результат теми 02**. Збережи свою спробу й створи робочу гілку від готового коду:

```bash
git add src
git diff --cached
git diff --cached --quiet || git commit -m "Моя спроба етапу 02"
git fetch origin
git switch -c work-03 origin/step-02-messages
npm run check
npm test -- --test-name-pattern "^0[0-2] "
```

Власний коміт залишився у попередній гілці. Якщо work-03 вже існує, обери нове імʼя, наприклад work-03-retry. .env і node_modules залишаються на місці. Відкрий [ранбук 03](03-function.md) в тому самому редакторі: усі ранбуки й тести доступні в кожній гілці.

Якщо завершив самостійно, продовжуй у своїй гілці за наступним ранбуком; брати готовий код необовʼязково.

## Готовий код

Очікуваний вміст змінених файлів після цього етапу. Інші файли залишаються як були. Це код для звірки; маленькі кроки наведено вище.

<details>
<summary>src/main.ts</summary>

```ts
import { generateText, type ModelMessage } from 'ai';
import { openrouter } from '@openrouter/ai-sdk-provider';

const model = openrouter('openai/gpt-oss-20b');

const task = process.argv[2] || 'Перевір списання клієнта 42.';
const messages: ModelMessage[] = [{ role: 'user', content: task }];

const reply = await generateText({
  model,
  system: 'Відповідай українською.',
  messages,
  maxRetries: 0,
  maxOutputTokens: 1200,
  abortSignal: AbortSignal.timeout(60_000),
});

console.log('Причина завершення:', reply.finishReason);
console.log('Відповідь:', reply.text);
```

</details>


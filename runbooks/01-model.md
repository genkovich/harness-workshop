# 01. Один запит

[Усі теми](README.md) · [Попередня](00-start.md) · [Наступна](02-messages.md)

**Перед початком:** код після `start`. **Результат теми:** `step-01-model`. Змінюємо лише `src/`.

## Що робимо й навіщо

Робимо один запит і друкуємо відповідь. Спершу переконуємося, що підключення моделі працює; до виконання тулів повернемося пізніше.

### Що ми імпортуємо

`ai` — пакет **AI SDK від Vercel**. Його функція `generateText` приймає модель, задачу й налаштування, робить виклик через адаптер та повертає текст, причину завершення й можливі tool calls. У цій практиці повторення запитів пишемо власним циклом. [Документація generateText](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text).

`@openrouter/ai-sdk-provider` — **адаптер OpenRouter для AI SDK**. OpenRouter — сервіс доступу до моделей через спільний API. Адаптер перекладає запит SDK у формат цього API. `openrouter(process.env.OPENROUTER_MODEL || 'qwen/qwen3.8-27b:free')` створює обʼєкт вибраної моделі; мережевий запит відбудеться у `generateText`. Ключ читається з `OPENROUTER_API_KEY`. [Офіційний пакет](https://github.com/OpenRouterTeam/ai-sdk-provider).

Звʼязок у нашому коді: `generateText` → адаптер OpenRouter → API → відповідь. Обидва пакети вже встановлені через npm ci. OPENROUTER_MODEL читає вибраний у підготовці ID з .env; якщо значення порожнє, використовуємо перевірений безкоштовний ID із прикладу. Суфікс :free зберігаємо. Умови доступу й ліміти є в [підготовці](00-start.md).

## Чого бракує зараз і що зміниться

Поки програма лише друкує наш рядок. Щоб отримати відповідь моделі, треба вибрати її й передати задачу через API. Після зміни в терміналі буде текст, отриманий від моделі.

- model визначає, кому надсилаємо запит; prompt містить його текст.
- await чекає відповідь перед тим, як ми звернемось до reply.text.
- maxRetries: 0 вимикає приховані повтори SDK: один запуск видно як одну спробу.
- maxOutputTokens обмежує довжину генерації, а timeout — час очікування. Це різні межі.
- finishReason пояснює, чому генерація завершилась. length означає обрізану відповідь, а не успішне виконання задачі.

## Маленькі зміни

У `src/main.ts` прибери початковий console.log. Додавай ці три фрагменти по черзі в той самий файл.

```ts
import { generateText } from 'ai';
import { openrouter } from '@openrouter/ai-sdk-provider';

const model = openrouter(process.env.OPENROUTER_MODEL || 'qwen/qwen3.8-27b:free');
```

Нижче зроби один запит:

```ts
const reply = await generateText({
  model,
  prompt: 'Привітайся українською одним реченням.',
  maxRetries: 0,
  maxOutputTokens: 1200,
  abortSignal: AbortSignal.timeout(60_000),
});
```

Наприкінці покажи результат:

```ts
console.log('Причина завершення:', reply.finishReason);
console.log('Відповідь:', reply.text);
```

## Перевірка

```bash
npm run check
npm test -- --test-name-pattern "^0[0-1] "
npm start
```

**Автоматична перевірка:** 5 тестів без мережі. Усі тести вже є в [test/harness.test.mjs](../test/harness.test.mjs) та [test/runbooks.test.mjs](../test/runbooks.test.mjs). Число на початку назви тесту відповідає етапу; команда запускає цей і попередні етапи.

**Очікуємо:** Причина завершення й текст привітання. Це перший запит до OpenRouter.

**Якщо не так:** 401 — перевір ключ у підготовленому .env. 402 — звір безкоштовний ID :free та текст помилки; поповнення не потрібне. 429 — прочитай відповідь сервера й зачекай. length — збільш maxOutputTokens до 2400 у src/main.ts та повтори; обрізану відповідь не вважай успіхом.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 01: Один запит"
```

## Якщо не встиг: готова точка й наступна тема

Ця гілка містить **результат теми 01**. Збережи свою спробу й створи робочу гілку від готового коду:

```bash
git add src
git diff --cached
git diff --cached --quiet || git commit -m "Моя спроба етапу 01"
git fetch origin
git switch -c work-02 origin/step-01-model
npm run check
npm test -- --test-name-pattern "^0[0-1] "
```

Власний коміт залишився у попередній гілці. Якщо work-02 вже існує, обери нове імʼя, наприклад work-02-retry. .env і node_modules залишаються на місці. Відкрий [ранбук 02](02-messages.md) в тому самому редакторі: усі ранбуки й тести доступні в кожній гілці.

Якщо завершив самостійно, продовжуй у своїй гілці за наступним ранбуком; брати готовий код необовʼязково.

## Готовий код

Очікуваний вміст змінених файлів після цього етапу. Інші файли залишаються як були. Маленькі кроки наведено вище.

<details>
<summary>src/main.ts</summary>

```ts
import { generateText } from 'ai';
import { openrouter } from '@openrouter/ai-sdk-provider';

const model = openrouter(process.env.OPENROUTER_MODEL || 'qwen/qwen3.8-27b:free');

const reply = await generateText({
  model,
  prompt: 'Привітайся українською одним реченням.',
  maxRetries: 0,
  maxOutputTokens: 1200,
  abortSignal: AbortSignal.timeout(60_000),
});

console.log('Причина завершення:', reply.finishReason);
console.log('Відповідь:', reply.text);
```

</details>


# 01. Один запит

[Усі теми](README.md) · [Попередня](00-start.md) · [Наступна](02-messages.md)

**Перед початком:** код після `start`. **Результат теми:** `step-01-model`. Змінюємо лише `src/`.

## Що робимо й навіщо

Робимо один запит і друкуємо відповідь. Спершу переконуємося, що підключення моделі працює; до виконання тулів повернемося пізніше.

### Що ми імпортуємо

`ai` — пакет **AI SDK від Vercel**. Його функція `generateText` приймає модель, задачу й налаштування, робить виклик через адаптер та повертає текст, причину завершення й можливі tool calls. У цій практиці повторення запитів пишемо власним циклом. [Документація generateText](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text).

`@ai-sdk/groq` — **адаптер Groq для AI SDK**. Groq запускає моделі на своїх серверах і надає доступ через API. Адаптер перекладає запит SDK у формат цього API. `groq(process.env.GROQ_MODEL || 'qwen/qwen3.8-27b')` створює обʼєкт вибраної моделі; мережевий запит відбудеться у `generateText`. Ключ читається з `GROQ_API_KEY`. [Офіційний пакет](https://ai-sdk.dev/providers/ai-sdk-providers/groq).

Звʼязок у нашому коді: `generateText` → адаптер Groq → API → відповідь. Обидва пакети вже встановлені через npm ci. GROQ_MODEL читає вибраний у підготовці ID з .env; якщо значення порожнє, використовуємо модель із прикладу. Безкоштовний доступ визначає Free plan акаунта Groq; суфікса :free тут немає. Умови доступу й ліміти є в [підготовці](00-start.md).

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
import { groq } from '@ai-sdk/groq';

const model = groq(process.env.GROQ_MODEL || 'qwen/qwen3.8-27b');
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

**Очікуємо:** Причина завершення й текст привітання. Це перший запит до Groq.

**Якщо не так:** 401 — перевір ключ у підготовленому .env. 403/404 — звір ID і доступ до моделі в Groq Console. 429 — прочитай відповідь сервера й зачекай. length — збільш maxOutputTokens до 2400 у src/main.ts та повтори; обрізану відповідь не вважай успіхом.

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

Очікуваний вміст змінених файлів після теми. Інші файли залишаються без змін.

<details>
<summary>src/main.ts</summary>

```ts
import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';

const model = groq(process.env.GROQ_MODEL || 'qwen/qwen3.8-27b');

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


# 01. Один запит

[Усі теми](README.md) · [Попередня](00-start.md) · [Наступна](02-messages.md)

**Перед початком:** код із гілки `start`. **Результат теми:** `step-01-model`. У головному прикладі змінюємо лише `src/`. Для іншого провайдера один раз установимо його пакет і додамо ключ у `.env`.

**Уже маєш доступ до OpenAI, Anthropic, Grok або OpenRouter?** Можеш використати його для першого запиту. Нижче є [готові варіанти підключення](#обери-провайдера). Обери один; реєструватися в усіх сервісах не потрібно. Основний приклад і готові гілки використовують Groq.

## Що робимо й навіщо

Робимо один запит і друкуємо відповідь. Спершу переконуємося, що підключення моделі працює; до виконання інструментів повернемося пізніше.

### Що ми імпортуємо

`ai` — пакет **AI SDK від Vercel**. Його функція `generateText` приймає модель, завдання й налаштування, робить виклик через адаптер та повертає текст, причину завершення й можливі запити на виклик інструментів (tool calls). У цій практиці повторення запитів пишемо власним циклом. [Документація generateText](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text).

`@ai-sdk/groq` — **адаптер Groq для AI SDK**. Groq запускає моделі на своїх серверах і надає доступ через API. Адаптер перекладає запит SDK у формат цього API. `groq(process.env.GROQ_MODEL || 'qwen/qwen3.8-27b')` створює обʼєкт вибраної моделі; мережевий запит відбудеться у `generateText`. Ключ читається з `GROQ_API_KEY`. [Офіційний пакет](https://ai-sdk.dev/providers/ai-sdk-providers/groq).

Звʼязок у нашому коді: `generateText` → адаптер Groq → API → відповідь. Обидва пакети вже встановлені через npm ci. GROQ_MODEL читає вибраний у підготовці ID з .env; якщо значення порожнє, використовуємо модель із прикладу. Безкоштовний доступ визначає Free plan акаунта Groq; суфікса :free тут немає. Умови доступу й ліміти є в [підготовці](00-start.md).

## Обери провайдера

**Модель** генерує відповідь. **Провайдер** надає доступ до неї через API. **Адаптер** — npm-пакет, який підключає цей API до `generateText`. Саме тому ми можемо змінити підключення й залишити той самий виклик `generateText`.

| Доступ | Модель для першого запиту | Змінна з ключем |
|---|---|---|
| OpenAI | `gpt-4.1-mini` | `OPENAI_API_KEY` |
| Anthropic | `claude-haiku-4-5` | `ANTHROPIC_API_KEY` |
| Grok від xAI | `grok-4.7` | `XAI_API_KEY` |
| OpenRouter | `openai/gpt-4.1-mini` | `OPENROUTER_API_KEY` |
| Groq, як у готовому коді | `qwen/qwen3.8-27b` | `GROQ_API_KEY` |

**Grok і Groq — різні речі.** Grok — сімейство моделей xAI. Groq — сервіс, через який у нашому прикладі працює Qwen. OpenRouter дає доступ до моделей різних виробників через один API; тому в назві моделі є префікс, наприклад `openai/`.

Це приклади моделей для підключення, а не вимога брати найновішу чи найдорожчу. Перевір доступ до вибраної моделі, тариф і квоти в кабінеті свого провайдера. Навіть платний API має ліміти. Безкоштовні моделі OpenRouter також мають квоти; сама зміна сервісу не гарантує відсутності `429`.

Обери один із варіантів нижче. Команду `npm install` виконай у папці проєкту. У `.env` додай лише ключ і назву обраної моделі; наявний `APPROVED=0` залиш. У `src/main.ts` заміни імпорт `groq` та рядок `const model = groq(...)` відповідним фрагментом. Решту першого запиту пиши за ранбуком.

<details>
<summary>OpenAI</summary>

Ключ створи в [кабінеті OpenAI](https://platform.openai.com/api-keys). Для API потрібен доступ до білінгу; підписку на чат не використовуємо як API-ключ.

```bash
npm install --save-exact @ai-sdk/openai@4.0.72
```

```dotenv
OPENAI_API_KEY=твій_ключ
OPENAI_MODEL=gpt-4.1-mini
```

```ts
import { openai } from '@ai-sdk/openai';

const model = openai.chat(process.env.OPENAI_MODEL || 'gpt-4.1-mini');
```

`.chat(...)` явно вибирає Chat Completions API. Для цього уроку нам потрібен звичайний запит із повідомленнями; виклики наших тулів додамо пізніше. [Модель і доступні можливості](https://developers.openai.com/api/docs/models/gpt-4.1-mini).

</details>

<details>
<summary>Anthropic / Claude</summary>

Створи API-ключ у [Claude Console](https://platform.claude.com/). Перевір доступ і баланс для API.

```bash
npm install --save-exact @ai-sdk/anthropic@4.0.60
```

```dotenv
ANTHROPIC_API_KEY=твій_ключ
ANTHROPIC_MODEL=claude-haiku-4-5
```

```ts
import { anthropic } from '@ai-sdk/anthropic';

const model = anthropic(
  process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5',
);
```

Адаптер сам перекладає `system`, повідомлення й описи тулів у формат Anthropic. Переписувати через це `generateText` не потрібно. [Каталог моделей](https://platform.claude.com/docs/en/models/overview).

</details>

<details>
<summary>Grok / xAI</summary>

Створи API-ключ у [кабінеті xAI](https://console.x.ai/). Ключ від Groq сюди не підходить.

```bash
npm install --save-exact @ai-sdk/xai@5.0.5
```

```dotenv
XAI_API_KEY=твій_ключ
XAI_MODEL=grok-4.7
```

```ts
import { xai } from '@ai-sdk/xai';

const model = xai(process.env.XAI_MODEL || 'grok-4.7');
```

Назву моделі звір із [каталогом xAI](https://docs.x.ai/developers/models). Якщо генерація закінчилася з `length`, відповідь обрізана: не вважай такий запуск успішним. Бюджет відповіді може також витрачатися на міркування моделі.

</details>

<details>
<summary>OpenRouter</summary>

Створи ключ на сторінці [OpenRouter Keys](https://openrouter.ai/settings/keys). У цьому прикладі використовуємо платну модель; для неї потрібен баланс OpenRouter.

```bash
npm install --save-exact @openrouter/ai-sdk-provider@3.1.0
```

```dotenv
OPENROUTER_API_KEY=твій_ключ
OPENROUTER_MODEL=openai/gpt-4.1-mini
```

```ts
import { createOpenRouter } from '@openrouter/ai-sdk-provider';

const openrouter = createOpenRouter({
  apiKey: process.env.OPENROUTER_API_KEY,
});

const model = openrouter(
  process.env.OPENROUTER_MODEL || 'openai/gpt-4.1-mini',
);
```

Тут запит іде через OpenRouter, тому потрібен його ключ, а не ключ OpenAI. Для наступних тем обирай модель із підтримкою **tool calling**. [Інтеграція з AI SDK](https://openrouter.ai/docs/guides/community/vercel-ai-sdk) · [Модель із прикладу](https://openrouter.ai/openai/gpt-4.1-mini).

</details>

### Як перевірити свій варіант і продовжити

Після того як допишеш перший запит нижче, виконай `npm run check`, а потім `npm start`. Очікуємо привітання та причину завершення `stop`. Так перевіряємо ключ, доступ до моделі й першу відповідь. Це ще не перевірка викликів тулів: до них дійдемо в темах 04-05.

**Межа готових перевірок:** `npm run setup:check` звертається саме до Groq. Автоматичні тести агента теж підміняють HTTP у форматі Groq, тому після заміни провайдера вони можуть падати через інший URL або формат запиту. Вони не підтверджують і не спростовують працездатність інших API. Для альтернативного провайдера зараз перевіряємо типи й запускаємо приклад із живим API; готовий автоматичний маршрут практики залишається на Groq.

У темі 03 передай свій `model` у `runAgent`, а в темі 04 перенеси його разом з імпортом у `src/news/agent.ts`. Готові гілки й блоки «Готовий код» використовують Groq: після переходу на таку гілку застосуй обране підключення ще раз. `.env` збережеться, але залежності визначає гілка, тому повтори команду встановлення свого адаптера.

Якщо зберігаєш цей варіант у коміті, додай також `package.json` і `package-lock.json`. `.env` у коміт не додавай.

## Чого бракує зараз і що зміниться

Поки програма лише друкує наш рядок. Щоб отримати відповідь моделі, треба вибрати її й передати завдання через API. Після зміни в терміналі буде текст, отриманий від моделі.

- model визначає, кому надсилаємо запит; prompt містить його текст.
- await чекає на відповідь перед тим, як ми звернемось до reply.text.
- maxRetries: 0 вимикає приховані повтори SDK: один запуск видно як одну спробу.
- maxOutputTokens обмежує довжину генерації, а timeout — час очікування. Це різні межі.
- finishReason пояснює, чому генерація завершилась. length означає обрізану відповідь, а не успішне виконання завдання.

## Маленькі зміни

У `src/main.ts` прибери початковий console.log. Додавай фрагменти по черзі в той самий файл. Спочатку імпорти, обмеження запиту й вибір моделі. `maxOutputTokens` задає бюджет відповіді, `modelTimeoutMs` — час очікування в мілісекундах; далі передамо ці константи в запит.

Нижче показано Groq. Якщо вже обрав інший провайдер, залиш його імпорт і `const model` із попереднього розділу, а звідси додай `generateText` та дві константи обмежень.

```ts
import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';

const maxOutputTokens = 512;
const modelTimeoutMs = 60_000;

const model = groq(process.env.GROQ_MODEL || 'qwen/qwen3.8-27b');
```

`process.env` містить змінні середовища: наш `npm start` завантажує їх із `.env`. Оператор `||` бере назву справа, якщо `GROQ_MODEL` відсутня або порожня. Підключення моделі тут ще не витрачає запит.

Нижче зроби один запит. `await` чекає, доки `generateText` поверне відповідь; `reply` — наш обʼєкт результату. Параметри обмежують цей конкретний запит:

| Параметр | Що робить і навіщо |
|---|---|
| `maxRetries: 0` | Забороняє SDK автоматично повторювати невдалий HTTP-запит. Під час навчання бачимо першу помилку й самі вирішуємо, коли повторювати. |
| `maxOutputTokens: 512` | Задає максимум токенів генерації. Токен — частина тексту, не обовʼязково слово; модель може витрачати частину бюджету на внутрішні міркування (reasoning). Значення 512 нижче за квоту 1000 вихідних токенів на хвилину (OTPM), яку мають деякі акаунти. Кілька запитів поспіль усе одно можуть вичерпати цю квоту; цей параметр не обмежує довжину вхідного контексту. |
| `abortSignal: AbortSignal.timeout(60_000)` | Створює сигнал скасування через 60 000 мілісекунд, тобто хвилину. Якщо відповідь затрималась, запит переривається з помилкою. |


```ts
const reply = await generateText({
  model,
  prompt: 'Привітайся українською одним реченням.',
  maxRetries: 0,
  maxOutputTokens,
  abortSignal: AbortSignal.timeout(modelTimeoutMs),
});
```

`reply.text` містить текст відповіді. `reply.finishReason` пояснює, чому модель зупинила генерацію: `stop` — звичайне завершення, `length` — вичерпано доступну довжину. Пізніше побачимо `tool-calls`, коли модель попросить виконати функцію. Навіть `stop` не доводить правильність відповіді: це лише причина зупинки.

Наприкінці покажи обидва поля:

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

**Очікуємо:** причина завершення й текст привітання. Це перший запит у коді, який ти пишеш; підключення вже перевірили на початку заняття.

**Якщо не так:** 401 — перевір ключ у підготовленому .env. 403/404 — звір ID і доступ до моделі в Groq Console. 429 із Request too large / OTPM — зменш maxOutputTokens: один запит перевищує дозволений бюджет виходу. Звичайний rate limit — зачекай згідно з Retry-After. length — скороти бажану відповідь; не збільшуй бюджет понад ліміт акаунта й не вважай обрізану відповідь успіхом.

`npm run check` перевіряє типи, тести перевіряють логіку на заданих відповідях, а `npm start` звертається до живого API. Успішний тест не означає, що провайдер зараз доступний.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 01: Один запит"
```

`git add src` вибирає зміни для коміту. `git diff --cached` показує їх перед збереженням. `git commit` створює локальну контрольну точку; на GitHub вона автоматично не відправляється.

## Якщо не встиг: готова гілка й наступна тема

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

`git diff --cached --quiet` перевіряє, чи є підготовлені зміни. `||` запускає команду коміту лише якщо перевірка повернула ненульовий код. `git fetch origin` завантажує відомості про гілки GitHub; `git switch -c` створює твою нову робочу гілку від готового етапу.

Власний коміт залишився у попередній гілці. Якщо work-02 вже існує, обери нове імʼя, наприклад work-02-retry. .env і node_modules залишаються на місці. Відкрий [ранбук 02](02-messages.md) в тому самому редакторі: усі ранбуки й тести доступні в кожній гілці.

Якщо завершив самостійно, продовжуй у своїй гілці за наступним ранбуком; брати готовий код необовʼязково.

## Готовий код

Очікуваний вміст змінених файлів після теми. Інші файли залишаються без змін.

<details>
<summary>src/main.ts</summary>

```ts
import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';

const maxOutputTokens = 512;
const modelTimeoutMs = 60_000;

const model = groq(process.env.GROQ_MODEL || 'qwen/qwen3.8-27b');

const reply = await generateText({
  model,
  prompt: 'Привітайся українською одним реченням.',
  maxRetries: 0,
  maxOutputTokens,
  abortSignal: AbortSignal.timeout(modelTimeoutMs),
});

console.log('Причина завершення:', reply.finishReason);
console.log('Відповідь:', reply.text);
```

</details>

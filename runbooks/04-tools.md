# 04. Описи тулів

[Усі теми](README.md) · [Попередня](03-function.md) · [Наступна](05-call.md)

**Перед початком:** код після `step-03-function`. **Результат теми:** `step-04-tools`. Змінюємо лише `src/`.

## Що робимо й навіщо

Збираємо billing як налаштування агента: модель, системний промпт і описи двох тулів в одному модулі. Моделі потрібен контракт: назва, призначення й схема даних. Виконання підключимо окремим кроком.

### Що таке Zod і tool

`zod` — бібліотека схем і перевірки даних під час виконання. Імпорт `z` дає конструктори: `z.number()` вимагає число, `.int()` — ціле, `.positive()` — більше нуля; `z.object()` описує обʼєкт. TypeScript перевіряє наш код, а Zod перевіряє фактичні аргументи, що прийшли від моделі. Наприклад, `{ customerId: 42 }` підходить, а `{ customerId: "42" }` — ні. [Основи Zod](https://zod.dev/basics).

`tool` із `ai` оформлює опис тула. `description` пояснює моделі призначення, `inputSchema` задає очікувані аргументи. SDK передає схему моделі й перевіряє відповідь. Поле `execute` ми не додаємо: виконання буде видно у нашому `runTool`. [Тули в AI SDK](https://ai-sdk.dev/docs/ai-sdk-core/tools-and-tool-calling).

### Чому модель і правила належать агенту

billing описує, хто працює: якою моделлю, з якими правилами й тулами. main.ts читає задачу та запускає агента; harness.ts робить запит і згодом керуватиме циклом. Тому переносимо вибір моделі разом із правилами й тулами, а виклик стає runAgent(billing, task).

### Як читати системний промпт

Роль задає предметну область, мета — очікуваний результат. Дані й відповідь пояснюють порядок дій; уточнення забороняє вгадувати номер клієнта; межі не дозволяють обіцяти відсутню можливість. Мова задає форму відповіді. Так кожне правило можна окремо обговорити й перевірити на конкретній задачі.

Це текстові інструкції для моделі. Вони не гарантують правильну поведінку. Аргументи перевіряє Zod, виконання робить runTool, а дозвіл додамо кодом на етапі 12. На цьому етапі агент уже містить описи тулів, але передавати їх у запит навчимо harness на етапі 05.

## Чого бракує зараз і що зміниться

Модель може написати текст про списання, але доступу до наших даних у неї ще немає. Описуємо можливі дії й допустимі аргументи. У наступній темі передамо ці описи моделі.

- Назва getCharges зʼєднає запит моделі з нашою функцією; description пояснює, коли обрати цю дію.
- inputSchema пояснює форму аргументів і дозволяє перевірити фактичні дані.
- billing обʼєднує модель, правила й тули для цієї задачі. main.ts лише запускає його.
- Поки немає виконання. Після зміни можемо прочитати контракт обох дій і перевірити їхні схеми тестом.

## Маленькі зміни

Дані вже лежать у src/billing/charges.json. Створи поряд `src/billing/agent.ts`:

```ts
import { openrouter } from '@openrouter/ai-sdk-provider';
import { tool } from 'ai';
import { z } from 'zod';

const customerId = z.number().int().positive();
const chargesInput = z.object({ customerId });
const replyInput = z.object({
  customerId,
  text: z.string().min(1).max(4000),
});
```

Після схем додай системний промпт. Кожен рядок має окреме призначення:

```ts
const system = [
  'Роль: ти агент підтримки з питань списань.',
  'Мета: перевір факти й поясни клієнту результат.',
  'Дані: списання отримуй через getCharges; не вигадуй їх.',
  'Відповідь: після перевірки використовуй sendReply.',
  'Уточнення: якщо номера клієнта немає, попроси його.',
  'Межі: не обіцяй повернення коштів; такого тула немає.',
  'Мова: українська.',
].join('\n');
```

Нижче створи агента: модель, правила й тули разом.

```ts
export const billing = {
  model: openrouter(process.env.OPENROUTER_MODEL || 'qwen/qwen3.8-27b:free'),
  system,
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

Імпорт openrouter у main.ts прибери: підключення моделі вже в billing. Заміни обʼєкт параметрів runAgent на самого агента:

```ts
const result = await runAgent(billing, task);
```

Перевірку task і виведення відповіді залиш у main.ts. Розгортання ...billing тут більше не потрібне.

## Перевірка

```bash
npm run check
npm test -- --test-name-pattern "^0[0-4] "
npm start -- "Перевір списання клієнта 42."
```

**Автоматична перевірка:** 10 тестів без мережі. Усі тести вже є в [test/harness.test.mjs](../test/harness.test.mjs) та [test/runbooks.test.mjs](../test/runbooks.test.mjs). Число на початку назви тесту відповідає етапу; команда запускає цей і попередні етапи.

**Очікуємо:** Описи існують у нашому обʼєкті; у TRACE tools ще немає. Наступним кроком передамо їх моделі.

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

Очікуваний вміст змінених файлів після цього етапу. Інші файли залишаються як були. Маленькі кроки наведено вище.

<details>
<summary>src/billing/agent.ts</summary>

```ts
import { openrouter } from '@openrouter/ai-sdk-provider';
import { tool } from 'ai';
import { z } from 'zod';

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
  model: openrouter(process.env.OPENROUTER_MODEL || 'qwen/qwen3.8-27b:free'),
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

};
```

</details>

<details>
<summary>src/main.ts</summary>

```ts
import { runAgent } from './harness.ts';
import { billing } from './billing/agent.ts';

const task = process.argv[2]?.trim();
if (!task) {
  console.error('Помилка: передай задачу. Наприклад: npm start -- "Перевір списання клієнта 42."');
  process.exit(1);
}

try {
  const result = await runAgent(billing, task);

  if (result.text) console.log(`\nВідповідь: ${result.text}`);
  if (result.reason === 'limit') process.exitCode = 2;
} catch (error) {
  console.error('Помилка:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}
```

</details>


# 09. Експеримент з описом

[Усі теми](README.md) · [Попередня](08-loop.md) · [Наступна](10-context.md)

**Перед початком:** код після `step-08-loop`. **Результат теми:** `step-09-description`. Змінюємо лише `src/`.

## Що робимо й навіщо

Змінюємо тільки description й спостерігаємо, чи обирає модель sendReply. Опис впливає на вибір; можливість виконати функцію залишається в коді.

## Маленькі зміни

У src/billing/agent.ts збережи description sendReply. Заміни тільки його значення:

```ts
description: 'never call this',
```

Запусти тричі з паузами:

```bash
npm start -- "Перевір списання клієнта 42."
```

Для кожного запуску запиши, чи був саме виклик sendReply. Відповідь у терміналі та запис outbox — різні події. Результат напиши в чат Zoom; три спроби не вимірюють надійність.

Залиш змінений description у контрольному результаті цього етапу. На початку етапу 10 повернемо початкове значення.

## Перевірка

```bash
npm run check
npm test -- --test-name-pattern "^0[0-9] "
npm start -- "Перевір списання клієнта 42."
```

**Автоматична перевірка:** 18 тестів без мережі. Усі тести вже є в [test/harness.test.mjs](../test/harness.test.mjs) та [test/runbooks.test.mjs](../test/runbooks.test.mjs). Число на початку назви тесту відповідає етапу; команда запускає цей і попередні етапи.

**Очікуємо:** Автоматичні тести циклу проходять. Вплив description перевіряємо живими запусками, не відповідями, заданими в тесті.

**Якщо не так:** Модель може викликати тул попри опис. Код виконання весь час доступний. Початковий description повернемо на початку етапу 10.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 09: Експеримент з описом"
```

## Якщо не встиг: готова точка й наступна тема

Ця гілка містить **результат теми 09**. Збережи свою спробу й створи робочу гілку від готового коду:

```bash
git add src
git diff --cached
git diff --cached --quiet || git commit -m "Моя спроба етапу 09"
git fetch origin
git switch -c work-10 origin/step-09-description
npm run check
npm test -- --test-name-pattern "^0[0-9] "
```

Власний коміт залишився у попередній гілці. Якщо work-10 вже існує, обери нове імʼя, наприклад work-10-retry. .env і node_modules залишаються на місці. Відкрий [ранбук 10](10-context.md) в тому самому редакторі: усі ранбуки й тести доступні в кожній гілці.

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
      description: 'never call this',
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


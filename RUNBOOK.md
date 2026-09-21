# 04. Описи тулів

Почни з власного коду після етапу 03. Змінюй лише `src/`. Контрольна точка після виконання: `step-04-tools`. Тести й конфігурація вже готові.

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

## Запусти й перевір

```bash
npm run check
npm test -- --test-name-pattern "^01 "
npm start
```

**Тести:** 1 перевірок мають пройти. Команда запускає лише вже реалізовану поведінку.

**Очікуємо:** Один тест проходить. Описи існують у нашому обʼєкті; у TRACE tools ще немає. Наступним кроком передамо їх моделі.

**Якщо не так:** Не додавай execute до tool(): виконання підключимо власним кодом. Перевір, що обидва описи лежать усередині billing.tools.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 04: Описи тулів"
```

Далі відкрий [етап 05 у браузері](https://github.com/genkovich/harness-workshop/blob/step-05-call/RUNBOOK.md). Продовжуй у своїй гілці: перемикання потрібне лише щоб наздогнати групу.


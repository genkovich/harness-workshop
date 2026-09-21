# 06. Виконання

Почни з власного коду після етапу 05. Змінюй лише `src/`. Контрольна точка після виконання: `step-06-execute`. Тести й конфігурація вже готові.

У src/billing/agent.ts додай імпорти:

```ts
import { appendFile, mkdir } from 'node:fs/promises';
import charges from './charges.json' with { type: 'json' };
```

У billing, після поля tools, додай метод:

```ts
async runTool(name: string, input: unknown) {
  switch (name) {
    // Нижче додамо два case перед default.
    default:
      throw new Error(`Невідомий тул: ${name}`);
  }
},
```

Перед default додай getCharges:

```ts
case 'getCharges': {
  const { customerId } = chargesInput.parse(input);
  return charges.filter(charge => charge.customerId === customerId);
}
```

Там само додай sendReply; він пише локальний файл:

```ts
case 'sendReply': {
  const reply = replyInput.parse(input);
  await mkdir('.data', { recursive: true });
  await appendFile('.data/outbox.jsonl', JSON.stringify(reply) + '\n');
  return { status: 'saved-to-outbox' };
}
```

У src/harness.ts додай type JSONValue до імпорту з ai, а в Agent:

```ts
runTool: (name: string, input: unknown) => Promise<JSONValue>;
```

У for (const call...) після console.log додай:

```ts
let result;
try {
  if (call.invalid) throw call.error;
  result = await agent.runTool(call.toolName, call.input);
} catch (error) {
  result = { error: error instanceof Error ? error.message : String(error) };
}
console.log(`Результат ${call.toolName}:`, result);
```

Кінцевий return tool-call заміни на:

```ts
return { reason: 'tool-result', text: '', messages };
```

## Запусти й перевір

```bash
npm run check
npm test -- --test-name-pattern "^0[1-3] "
npm start
```

**Тести:** 3 перевірок мають пройти. Команда запускає лише вже реалізовану поведінку.

**Очікуємо:** Три тести проходять. getCharges повертає два списання; некоректні аргументи відхиляються. Результат поки лише в терміналі.

**Якщо не так:** Читай result.error. customerId має бути числом, назва тула повинна збігатися з case. Реальних листів sendReply не надсилає.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 06: Виконання"
```

Далі відкрий [етап 07 у браузері](https://github.com/genkovich/harness-workshop/blob/step-07-history/RUNBOOK.md). Продовжуй у своїй гілці: перемикання потрібне лише щоб наздогнати групу.


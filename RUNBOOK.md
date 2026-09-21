# 03. Функція запиту

Почни з власного коду після етапу 02. Змінюй лише `src/`. Контрольна точка після виконання: `step-03-function`. Тести й конфігурація вже готові.

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
const task = process.argv[2] || 'Перевір списання клієнта 42.';

const result = await runAgent({
  model: openrouter('openai/gpt-oss-20b'),
  system: 'Відповідай українською.',
}, task);

console.log('Відповідь:', result.text);
```

Для перегляду HTTP body:

```bash
TRACE=1 npm start
```

## Запусти й перевір

```bash
npm run check
npm test -- --test-name-pattern "^01 "
npm start
```

**Тести:** 1 перевірок мають пройти. Команда запускає лише вже реалізовану поведінку.

**Очікуємо:** Перший готовий тест проходить без ключа: один запит завершується текстом. У TRACE видно system та user; заголовок авторизації не друкується.

**Якщо не так:** Тест перевіряє наш код із заданою відповіддю моделі. Якщо він проходить, а живий запуск падає, перевір ключ і мережу окремо.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 03: Функція запиту"
```

Далі відкрий [етап 04 у браузері](https://github.com/genkovich/harness-workshop/blob/step-04-tools/RUNBOOK.md). Продовжуй у своїй гілці: перемикання потрібне лише щоб наздогнати групу.


# 01. Один запит

Почни з власного коду після етапу 00. Змінюй лише `src/`. Контрольна точка після виконання: `step-01-model`. Тести й конфігурація вже готові.

У `src/main.ts` прибери початковий console.log. Додавай ці три фрагменти по черзі в той самий файл.

```ts
import { generateText } from 'ai';
import { openrouter } from '@openrouter/ai-sdk-provider';

const model = openrouter('openai/gpt-oss-20b');
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

## Запусти й перевір

```bash
npm run check
npm start
```

**Поки перевіряємо типи та живий запуск.**

**Очікуємо:** Причина завершення й текст привітання. Це перший запит до OpenRouter.

**Якщо не так:** 401 — перевір ключ у підготовленому .env. 402 — баланс ключа. 429 — прочитай відповідь сервера й зачекай. length — збільш maxOutputTokens до 2400 у src/main.ts та повтори; обрізану відповідь не вважай успіхом.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 01: Один запит"
```

Далі відкрий [етап 02 у браузері](https://github.com/genkovich/harness-workshop/blob/step-02-messages/RUNBOOK.md). Продовжуй у своїй гілці: перемикання потрібне лише щоб наздогнати групу.


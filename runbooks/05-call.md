# 05. Tool call

[Усі теми](README.md) · [Попередня](04-tools.md) · [Наступна](06-execute.md)

**Перед початком:** код після `step-04-tools`. **Результат теми:** `step-05-call`. Змінюємо лише `src/`.

## Що робимо й навіщо

Передаємо описи моделі й читаємо toolCalls. Це запит на дію: жодна наша функція ще не виконана.

## Маленькі зміни

У src/harness.ts додай type ToolSet до імпорту з ai. До типу Agent додай:

```ts
tools: ToolSet;
```

У generateText додай параметр:

```ts
tools: agent.tools,
```

Заміни останній return функції runAgent перевіркою:

```ts
if (reply.toolCalls.length === 0) {
  return { reason: 'final', text: reply.text, messages };
}

for (const call of reply.toolCalls) {
  console.log(`Модель просить ${call.toolName}:`, call.input);
}

return { reason: 'tool-call', text: reply.text, messages };
```

## Перевірка

```bash
npm run check
npm test -- --test-name-pattern "^0[0-5] "
npm start -- "Перевір списання клієнта 42."
```

**Автоматична перевірка:** 9 тестів без мережі. Усі тести вже є в [test/harness.test.mjs](../test/harness.test.mjs) та [test/runbooks.test.mjs](../test/runbooks.test.mjs). Число на початку назви тесту відповідає етапу; команда запускає цей і попередні етапи.

**Очікуємо:** Якщо модель обрала getCharges, видно імʼя й customerId. Виконання ще немає.

**Якщо не так:** Немає tools у TRACE — перевір generateText. Звичайний текст із JSON не є tool call і не виконується.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 05: Tool call"
```

## Якщо не встиг: готова точка й наступна тема

Ця гілка містить **результат теми 05**. Збережи свою спробу й створи робочу гілку від готового коду:

```bash
git add src
git diff --cached
git diff --cached --quiet || git commit -m "Моя спроба етапу 05"
git fetch origin
git switch -c work-06 origin/step-05-call
npm run check
npm test -- --test-name-pattern "^0[0-5] "
```

Власний коміт залишився у попередній гілці. Якщо work-06 вже існує, обери нове імʼя, наприклад work-06-retry. .env і node_modules залишаються на місці. Відкрий [ранбук 06](06-execute.md) в тому самому редакторі: усі ранбуки й тести доступні в кожній гілці.

Якщо завершив самостійно, продовжуй у своїй гілці за наступним ранбуком; брати готовий код необовʼязково.

## Готовий код

Очікуваний вміст змінених файлів після цього етапу. Інші файли залишаються як були. Маленькі кроки наведено вище.

<details>
<summary>src/harness.ts</summary>

```ts
import {
  generateText,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
} from 'ai';

export type Agent = {
  model: LanguageModel;
  system: string;
  tools: ToolSet;
};

export async function runAgent(agent: Agent, task: string) {
  const messages: ModelMessage[] = [{ role: 'user', content: task }];

  console.log(`\nОдин запит. Повідомлень у запиті: ${messages.length}.`);

  const reply = await generateText({
    model: agent.model,
    system: agent.system,
    messages,
    tools: agent.tools,
    maxRetries: 0,
    maxOutputTokens: 1200,
    abortSignal: AbortSignal.timeout(60_000),
    include: { requestBody: true },
  });

  if (process.env.TRACE === '1') {
    console.log('HTTP-запит:', reply.request.body);
  }
  if (reply.finishReason === 'length') {
    throw new Error('Відповідь обрізано. Тули не виконуємо.');
  }

  // Немає запитів на тули: модель уже дала фінальну відповідь.
  if (reply.toolCalls.length === 0) {
    console.log('Зупинка: модель відповіла без виклику тула.');
    return { reason: 'final', text: reply.text, messages };
  }

  for (const call of reply.toolCalls) {
    console.log(`Модель просить ${call.toolName}:`, call.input);
  }

  return { reason: 'tool-call', text: reply.text, messages };
}
```

</details>


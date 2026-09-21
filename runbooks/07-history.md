# 07. Результат в історії

[Усі теми](README.md) · [Попередня](06-execute.md) · [Наступна](08-loop.md)

**Перед початком:** код після `step-06-execute`. **Результат теми:** `step-07-history`. Змінюємо лише `src/`.

## Що робимо й навіщо

Повертаємо результат у messages разом із повідомленням assistant. toolCallId зʼєднує конкретний запит із його результатом.

## Чого бракує зараз і що зміниться

Тул виконався, результат є в терміналі. Але наступний запит моделі нічого про нього не дізнається, доки ми не запишемо його в messages.

- Спершу додаємо assistant із запитом на тул, потім tool із нашим результатом: історія пояснює обидві сторони дії.
- Модель може попросити кілька дій. toolCallId зʼєднує кожен результат саме з тим запитом, на який він відповідає.
- output із типом json передає дані у форматі, який розуміє SDK.
- Після одного виклику історія має user, assistant і tool. Повторного HTTP-запиту на цьому етапі ще немає.

## Маленькі зміни

У src/harness.ts перед for (const call...) додай повідомлення моделі:

```ts
messages.push(
  ...reply.response.messages.filter(message => message.role === 'assistant'),
);
```

Усередині for, після друку result, додай результат з тим самим id:

```ts
messages.push({
  role: 'tool',
  content: [{
    type: 'tool-result',
    toolCallId: call.toolCallId,
    toolName: call.toolName,
    output: { type: 'json', value: result },
  }],
});
```

Після for покажи стан історії:

```ts
console.log('Повідомлень в історії:', messages.length);
```

## Перевірка

```bash
npm run check
npm test -- --test-name-pattern "^0[0-7] "
npm start -- "Перевір списання клієнта 42."
```

**Автоматична перевірка:** 11 тестів без мережі. Усі тести вже є в [test/harness.test.mjs](../test/harness.test.mjs) та [test/runbooks.test.mjs](../test/runbooks.test.mjs). Число на початку назви тесту відповідає етапу; команда запускає цей і попередні етапи.

**Очікуємо:** Після одного getCharges у messages три записи: user, assistant, tool. Повторного запиту ще немає.

**Якщо не так:** Звір toolCallId. Повідомлення assistant має стояти перед його tool result; одного console.log для передачі моделі недостатньо.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 07: Результат в історії"
```

## Якщо не встиг: готова точка й наступна тема

Ця гілка містить **результат теми 07**. Збережи свою спробу й створи робочу гілку від готового коду:

```bash
git add src
git diff --cached
git diff --cached --quiet || git commit -m "Моя спроба етапу 07"
git fetch origin
git switch -c work-08 origin/step-07-history
npm run check
npm test -- --test-name-pattern "^0[0-7] "
```

Власний коміт залишився у попередній гілці. Якщо work-08 вже існує, обери нове імʼя, наприклад work-08-retry. .env і node_modules залишаються на місці. Відкрий [ранбук 08](08-loop.md) в тому самому редакторі: усі ранбуки й тести доступні в кожній гілці.

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
  type JSONValue,
} from 'ai';

export type Agent = {
  model: LanguageModel;
  system: string;
  tools: ToolSet;
  runTool: (name: string, input: unknown) => Promise<JSONValue>;
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

  // Зберігаємо повідомлення моделі з її tool calls перед результатами.
  messages.push(
    ...reply.response.messages.filter((message) => message.role === 'assistant'),
  );

  for (const call of reply.toolCalls) {
    console.log(`Модель просить ${call.toolName}:`, call.input);
    let result;

    try {
      // SDK перевірив аргументи за схемою. Некоректний виклик не виконуємо.
      if (call.invalid) {
        throw call.error;
      }
      // Виконання відбувається в нашій програмі, а не в SDK.
      result = await agent.runTool(call.toolName, call.input);
    } catch (error) {
      // Помилка теж результат: модель отримає її в наступному запиті.
      result = { error: error instanceof Error ? error.message : String(error) };
    }

    console.log(`Результат ${call.toolName}:`, result);
    messages.push({
      role: 'tool',
      content: [
        {
          type: 'tool-result',
          toolCallId: call.toolCallId,
          toolName: call.toolName,
          output: { type: 'json', value: result },
        },
      ],
    });
  }

  console.log(`Додали результати. Повідомлень в історії: ${messages.length}.`);

  console.log('Модель ще не отримала результат. Наступний запит додамо далі.');
  return { reason: 'tool-result', text: '', messages };
}
```

</details>


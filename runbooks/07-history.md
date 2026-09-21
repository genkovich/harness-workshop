# 07. Результат в історії

[Усі теми](README.md) · [Попередня](06-execute.md) · [Наступна](08-loop.md)

**Перед початком:** код із гілки `step-06-execute`. **Результат теми:** `step-07-history`. Змінюємо лише `src/`.

## Що робимо й навіщо

Додаємо до `messages` повідомлення моделі з роллю `assistant` і результат дії з роллю `tool`. toolCallId зʼєднує конкретний запит із його результатом.

## Чого бракує зараз і що зміниться

Інструмент виконався, результат є в терміналі. Але модель не побачить його в наступному запиті, доки ми не запишемо його в messages.

- Спершу додаємо assistant із запитом на інструмент, потім tool із нашим результатом: історія пояснює обидві сторони дії.
- Модель може попросити кілька дій. toolCallId зʼєднує кожен результат саме з тим запитом, на який він відповідає.
- output із типом json передає дані у форматі, який розуміє SDK.
- Після одного виклику історія має user, assistant і tool. Повторного HTTP-запиту на цьому етапі ще немає.

## Маленькі зміни

`reply.response.messages` — повідомлення, які SDK сформував із відповіді моделі. Зберігаємо повний `assistant`, разом із запитами на виклик інструментів. Якби зберегли лише `reply.text`, втратили б запит на дію. `.filter(...)` відбирає повідомлення автора assistant, а `...` передає їх у `push` окремими елементами.

У src/harness.ts перед for (const call...) додай повідомлення моделі:

```ts
messages.push(
  ...reply.response.messages.filter(message => message.role === 'assistant'),
);
```

`role: 'tool'` позначає відповідь нашої програми. Усередині `content` блок `type: 'tool-result'` містить результат конкретної дії; `output: { type: 'json', value: result }` повідомляє SDK формат даних.

Наприклад, якщо модель надіслала `toolCallId: 'call_1'`, результат пошуку теж має отримати `'call_1'`. Одна назва `searchStories` недостатня: модель може викликати пошук кілька разів із різними аргументами.

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
npm start -- "Знайди до трьох обговорень про harness engineering і coding agents за останні 7 днів. Прочитай коментарі та збережи український дайджест із посиланнями."
```

**Автоматична перевірка:** 18 тестів без мережі. Усі тести вже є в [test/harness.test.mjs](../test/harness.test.mjs) та [test/runbooks.test.mjs](../test/runbooks.test.mjs). Число на початку назви тесту відповідає етапу; команда запускає цей і попередні етапи.

**Очікуємо:** після одного searchStories у messages три записи: user, assistant, tool. Повторного запиту ще немає.

**Якщо не так:** Звір toolCallId. Повідомлення assistant має стояти перед відповідним результатом інструмента; одного console.log для передавання моделі недостатньо.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 07: Результат в історії"
```

## Якщо не встиг: готова гілка й наступна тема

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

Очікуваний вміст змінених файлів після теми. Інші файли залишаються без змін.

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

const maxOutputTokens = 512;
const modelTimeoutMs = 60_000;

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
    maxOutputTokens,
    abortSignal: AbortSignal.timeout(modelTimeoutMs),
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


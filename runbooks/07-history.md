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

### 1. Додай повідомлення моделі до історії

У нашій версії AI SDK 7 повідомлення відповіді доступні через `reply.responseMessages`. Поле `reply.response` застаріле; `reply.finalStep.response` містить метадані останнього кроку. Для історії нам потрібні саме повідомлення, включно із запитами на інструменти.

Після `executeTool` у `src/harness.ts` додай функцію:

```ts
function addAssistantMessages(
  messages: ModelMessage[],
  responseMessages: ModelMessage[],
) {
  for (const message of responseMessages) {
    if (message.role === 'assistant') {
      messages.push(message);
    }
  }
}
```

`messages` — наша поточна історія. `responseMessages` — нові повідомлення, отримані від SDK. Перебираємо їх і додаємо лише ті, що мають роль `assistant`. Повідомлення з результатами інструментів сформуємо самі, після виконання: так вони не потраплять в історію двічі.

Ми зберігаємо повідомлення цілком. Якби додали лише `reply.text`, загубили б назви функцій, аргументи та ідентифікатори викликів.

У `runAgent`, **перед циклом `for (const call of reply.toolCalls)`**, виклич функцію:

```ts
addAssistantMessages(messages, reply.responseMessages);
```

### 2. Додай результат конкретної дії

Після `addAssistantMessages` створи ще одну функцію. Вона формує повідомлення у форматі SDK та додає його до історії:

```ts
function addToolResult(
  messages: ModelMessage[],
  call: ToolCall,
  result: JSONValue,
) {
  messages.push({
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        output: {
          type: 'json',
          value: result,
        },
      },
    ],
  });
}
```

Тут три параметри: історія `messages`, виконаний виклик `call` і його результат `result`. Типи `ToolCall` та `JSONValue` вже додали в темі 06.

- `role: 'tool'` означає, що повідомлення надійшло від нашої програми після виконання інструмента.
- `type: 'tool-result'` позначає результат однієї дії всередині повідомлення.
- `toolCallId` звʼязує результат із конкретним запитом моделі. Якщо запит мав `'call_1'`, відповідь теж має містити `'call_1'`.
- `toolName` зберігає назву інструмента, а `output` передає результат у форматі JSON.

Самої назви `searchStories` недостатньо: модель може попросити два пошуки з різними аргументами. Їх розрізняємо за `toolCallId`.

У `runAgent`, **усередині циклу, після виведення результату**, додай:

```ts
addToolResult(messages, call, result);
```

### 3. Перевір послідовність

Ця частина `runAgent` тепер має читатися так:

```ts
addAssistantMessages(messages, reply.responseMessages);

for (const call of reply.toolCalls) {
  console.log(`Модель просить ${call.toolName}:`, call.input);
  const result = await executeTool(agent, call);
  console.log(`Результат ${call.toolName}:`, result);
  addToolResult(messages, call, result);
}
```

Спочатку записуємо запит моделі, потім виконуємо дію й додаємо результат. `executeTool` повертає і успішні дані, і пояснення помилок — обидва варіанти потрапляють в історію однаково.

Після циклу покажи розмір історії:

```ts
console.log('Повідомлень в історії:', messages.length);
```

Повторного запиту до моделі тут ще немає. Його додамо в наступній темі.

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
  type TypedToolCall,
} from 'ai';

const maxOutputTokens = 512;
const modelTimeoutMs = 60_000;

type ToolCall = TypedToolCall<ToolSet>;

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
    console.log('HTTP-запит:', reply.finalStep.request.body);
  }
  if (reply.finishReason === 'length') {
    throw new Error('Відповідь обрізано. Тули не виконуємо.');
  }

  // Немає запитів на тули: модель уже дала фінальну відповідь.
  if (reply.toolCalls.length === 0) {
    console.log('Зупинка: модель відповіла без виклику тула.');
    return { reason: 'final', text: reply.text, messages };
  }

  addAssistantMessages(messages, reply.responseMessages);

  for (const call of reply.toolCalls) {
    console.log(`Модель просить ${call.toolName}:`, call.input);
    const result = await executeTool(agent, call);

    console.log(`Результат ${call.toolName}:`, result);
    addToolResult(messages, call, result);
  }

  console.log(`Додали результати. Повідомлень в історії: ${messages.length}.`);

  console.log('Модель ще не отримала результат. Наступний запит додамо далі.');
  return { reason: 'tool-result', text: '', messages };
}

async function executeTool(agent: Agent, call: ToolCall): Promise<JSONValue> {
  try {
    // Не передаємо виконавцю виклик, який SDK позначив некоректним.
    if (call.invalid) {
      throw call.error;
    }

    // await потрібен, щоб catch перехопив і помилку асинхронної функції.
    return await agent.runTool(call.toolName, call.input);
  } catch (error) {
    // Помилку повертаємо як дані для наступного запиту моделі.
    if (error instanceof Error) {
      return { error: error.message };
    }

    return { error: String(error) };
  }
}

function addAssistantMessages(
  messages: ModelMessage[],
  responseMessages: ModelMessage[],
) {
  for (const message of responseMessages) {
    if (message.role === 'assistant') {
      messages.push(message);
    }
  }
}

function addToolResult(
  messages: ModelMessage[],
  call: ToolCall,
  result: JSONValue,
) {
  messages.push({
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        output: {
          type: 'json',
          value: result,
        },
      },
    ],
  });
}
```

</details>


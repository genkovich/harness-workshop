# 08б. Повтор запиту після збою

[Усі теми](README.md) · [Попередня](08-loop.md) · [Наступна](10-context.md)

**Перед початком:** `step-08-loop`. **Готовий результат:** `step-08b-limits`. Назва гілки історична: тут додаємо retry, окремої вправи про квоти немає. Змінюємо лише `src/harness.ts`.

## Що робимо й навіщо

API моделі іноді тимчасово недоступний. Дамо йому ще дві спроби відповісти. **Retry** означає повтор невдалого запиту після паузи.

### 1. Розрізняємо два повторення

У нашому циклі наступний крок починається після результату тула: модель отримує нові дані й вирішує, що робити далі.

При збої API відповіді ще немає. Retry повторює той самий запит із тією самою історією:

```text
Крок 1: модель просить запис → тул виконав запис → результат у messages
Крок 2: запит моделі → тимчасовий збій → пауза → той самий запит → відповідь
```

`maxSteps` обмежує кроки агента. `maxRetries` обмежує повтори одного запиту. Збільшення `maxSteps` не виправляє збій API.

### 2. Дозволяємо два повтори

У `generateText` у файлі `src/harness.ts` заміни `maxRetries: 0` на:

```ts
maxRetries: 2,
```

Це одна початкова спроба й максимум дві додаткові. Якщо відповідь прийшла раніше, наступна спроба вже не потрібна. Паузами керує AI SDK; власний цикл очікування тут не пишемо.

Зовнішній `for` залишається без змін. Уже виконаний тул і його результат лишаються в історії. Повтор запиту сам собою не виконує цей тул знову; новий виклик, який згодом запропонує модель, буде окремою дією.

### 3. Дивимося, як це працює без справжнього збою

Запусти підготовлений тест:

```bash
node --import tsx --test --test-reporter=spec --test-name-pattern "^08b API:" test/rate-limit.test.mjs
```

Тест підміняє API й очікування. Ключ і мережа не потрібні. У терміналі буде, зокрема, такий рядок:

```text
HTTP 503: виклик тула → збій → повтор → відповідь. Звернень до моделі: 3; виконань тула: 1.
```

Три звернення тут означають: запит на тул, невдале продовження й успішний повтор. Лічильник виконань підтверджує, що запис стався лише раз. Тест також перевіряє однакову історію в невдалому запиті та його повторі.

Ще два випадки в цьому тесті: неправильний ключ завершує запит без повтору; постійний тимчасовий збій вичерпує три спроби й доходить до `catch` у `main.ts`.

## Якщо повтор не допоміг

- Тимчасова недоступність сервісу може минути за час паузи. SDK вирішує, які помилки повторювати.
- Неправильний ключ або запит треба виправити. Добова квота теж не відновиться від короткої паузи.
- Наявний таймаут обмежує очікування. Після вичерпання повторів або скасування `catch` у `main.ts` показує помилку.

Помилку самого тула вже обробляє `executeTool`: повертає її моделі як результат дії. Тут ми додали обробку збою **звернення до моделі**.

## Перевірка

```bash
npm run check
npm test -- --test-name-pattern "^(0[0-8]|08b) "
```

Очікуємо **27 успішних тестів без мережі**. Перевіряємо повтори тимчасових 429/503, зупинку для 400/401/403 і скасування, незмінну історію та відсутність повторного виконання тула.

За бажанням запусти агента через API:

```bash
npm start -- "Знайди одне обговорення про coding agents за останні 7 днів. Прочитай одну порцію коментарів і збережи підсумок до 100 слів із посиланням."
```

Якщо збою немає, повторів не буде. Не треба спеціально вичерпувати квоту. Перед ручним перезапуском після помилки перевір виконані дії: новий процес почне завдання заново.

Збережи зміну:

```bash
git add src
git commit -m "Дозволити обмежені повтори запиту"
```

## Якщо не встиг: готова гілка й наступна тема

Збережи власну спробу, потім створи гілку від готового етапу:

```bash
git add src
git commit -m "Моя спроба етапу 08б"
git fetch origin
git switch -c work-10 origin/step-08b-limits
```

Якщо змін для коміту немає, пропусти його. Далі відкрий [контекст: AGENTS.md і rules](10-context.md).

Довідка: [maxRetries в AI SDK](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text#max-retries).

## Готовий код

Змінюється лише `src/harness.ts`. Код пошуку, читання й описи інструментів залишаються такими, як на попередньому етапі.

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

const defaultMaxSteps = 10;

type ToolCall = TypedToolCall<ToolSet>;

export type Agent = {
  model: LanguageModel;
  system: string;
  tools: ToolSet;
  runTool: (name: string, input: unknown) => Promise<JSONValue>;
  maxSteps?: number;
};

export async function runAgent(agent: Agent, task: string) {
  const messages: ModelMessage[] = [{ role: 'user', content: task }];

  for (let step = 1; step <= (agent.maxSteps ?? defaultMaxSteps); step++) {
    console.log(`\nКрок ${step}. Повідомлень у запиті: ${messages.length}.`);

    const reply = await generateText({
      model: agent.model,
      system: agent.system,
      messages,
      tools: agent.tools,
      maxRetries: 2,
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
  }

  console.log('Зупинка: досягли ліміту кроків. Задача може бути незавершена.');
  return { reason: 'limit', text: '', messages };
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

# 08б. Помилки API й retry

[Усі теми](README.md) · [Попередня](08-loop.md) · [Наступна](09-description.md)

**Перед початком:** код із гілки `step-08-loop`. **Результат теми:** `step-08b-limits`. Змінюємо лише `src/`.

## Що робимо й навіщо

Цикл уже працює. Тепер розберемо, що робити, коли API тимчасово не приймає запит: наприклад, повертає `429` через хвилинну квоту.

Дозволимо SDK зробити обмежену кількість повторів. Уже виконані інструменти не запускаємо вдруге. Це загальна обробка тимчасових збоїв; змінювати кількість тем або обрізати коментарі в цьому кроці не потрібно.

## Дозволь SDK повторити запит

У `src/harness.ts`, у наявному `generateText`, заміни `maxRetries: 0` на:

```ts
maxRetries: 2,
```

**Retry — повтор невдалого запиту.** Після помилки, яку SDK вважає тимчасовою, він зачекає й спробує ще раз. `2` означає максимум два повтори після першої спроби: до трьох звернень до моделі загалом.

Повторюється лише запит моделі. Попередні результати залишаються в `messages`; уже виконані інструменти повторно не запускаємо.

Часом очікування керує SDK. У встановленій версії він враховує придатний `Retry-After` із відповіддю сервера; без нього використовує короткі паузи зі збільшенням. Числа з тексту помилки самі не розбираємо. Наявний таймаут 60 секунд обмежує весь виклик `generateText`, включно з паузами й повторами.

## Не кожну помилку варто повторювати

Помилка тула й помилка моделі виникають у різних місцях. Помилку тула `executeTool` уже перетворює на результат, який модель побачить у наступному запиті. Якщо не відповів сам API моделі, нового рішення агента ще немає: треба повторити запит або завершити запуск із помилкою.

| Що сталося | Як реагуємо |
|---|---|
| Тимчасовий `429` або `503`, який SDK позначив придатним до повтору | Даємо SDK зробити до двох повторів із паузою. |
| `400`: запит не відповідає API | Виправляємо запит. Та сама помилка не зникне від паузи. |
| `401` або `403`: ключ чи доступ | Перевіряємо налаштування доступу. Автоматично не перебираємо ключі. |
| Час очікування вичерпано або запит скасовано | Припиняємо очікування й показуємо помилку. |
| Повтори не допомогли | Завершуємо запуск із помилкою, не пишемо «готово». |

Рішення про повтор приймає SDK за типом помилки та ознакою `isRetryable`. Квота на добу чи завеликий запит не відновляться від короткої паузи. Новий процес може повторити попередні дії, тому перед ручним перезапуском перевіряємо, що вже виконалося.

У `src/main.ts` уже є `try/catch` навколо `runAgent`. Подивись на нього: саме сюди потрапить помилка після вичерпання повторів. Він показує повідомлення й задає ненульовий код завершення. На цьому кроці не додаємо другий нескінченний цикл навколо всього агента.

## Перевірка

```bash
npm run check
npm test -- --test-name-pattern "^(0[0-8]|08b) "
```

Очікуємо **27 успішних тестів без мережі**. Перевіряємо повтори після 429 і 503, відсутність повторів для 400/401/403 і скасування, незмінну історію та відсутність повторного виконання інструмента. Окремий тест підтверджує, що пошук і читання зберегли попередню поведінку. Тести підміняють час: справді чекати не потрібно.

Для живого запуску візьми невелике завдання:

```bash
npm start -- "Знайди одне обговорення про coding agents за останні 7 днів. Прочитай одну порцію коментарів і збережи підсумок до 100 слів із посиланням."
```

Успішний повтор продовжить той самий запуск. Якщо повтори або час вичерпано, програма покаже помилку. Перед ручним перезапуском перевір, які дії вже виконалися: новий процес почне завдання заново.

Збережи свою зміну:

```bash
git add src
git commit -m "Дозволити обмежені повтори запиту"
```

## Якщо не встиг: готова гілка й наступна тема

Спочатку збережи власну спробу, потім створи нову гілку від готового етапу:

```bash
git add src
git commit -m "Моя спроба етапу 08б"
git fetch origin
git switch -c work-09 origin/step-08b-limits
```

Якщо змін для коміту немає, пропусти його. Далі відкрий [експеримент з описом](09-description.md).

Довідка: [параметр maxRetries в AI SDK](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text#max-retries), [ліміти й Retry-After у Groq](https://console.groq.com/docs/rate-limits).

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

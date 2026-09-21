# 08. Цикл і зупинка

[Усі теми](README.md) · [Попередня](07-history.md) · [Наступна](09-description.md)

**Перед початком:** код після `step-07-history`. **Результат теми:** `step-08-loop`. Змінюємо лише `src/`.

## Що робимо й навіщо

Повторюємо запит із оновленою історією. Фінальна відповідь зупиняє цикл; maxSteps обмежує повторення, якщо модель не завершує задачу.

## Чого бракує зараз і що зміниться

Результат уже в історії, але модель ще не продовжила роботу з ним. Повторюємо generateText із новими messages, щоб вона могла відповісти або попросити іншу дію.

- messages живе поза for, інакше на кожному оберті історія починатиметься спочатку.
- return final завершує функцію, якщо викликів більше немає. Після результату тула return не потрібен: має початися наступний оберт.
- maxSteps обмежує кількість запитів нашого циклу. Без нього агент може безкінечно повторювати дію.
- reason: limit повідомляє, що ресурс закінчився; це не підтвердження виконаної задачі.

## Маленькі зміни

У тип Agent у src/harness.ts додай:

```ts
maxSteps?: number;
```

Залиш створення messages перед циклом. Блок від generateText до виконання тулів обгорни в:

```ts
for (let step = 1; step <= (agent.maxSteps ?? 10); step++) {
  // Тут твій уже написаний запит, перевірка відповіді й тули.
}
```

Коментар заміни наявним блоком. Прибери return tool-result і повідомлення, що повторного запиту ще немає. Return final залиш усередині if без tool calls. Після for додай:

```ts
console.log('Зупинка: досягли ліміту кроків.');
return { reason: 'limit', text: '', messages };
```

На початку кожного оберту покажи крок:

```ts
console.log(`Крок ${step}. Повідомлень у запиті: ${messages.length}.`);
```

## Перевірка

```bash
npm run check
npm test -- --test-name-pattern "^0[0-8] "
npm start -- "Знайди до трьох обговорень про harness engineering і coding agents за останні 7 днів. Прочитай коментарі та збережи український дайджест із посиланнями."
```

**Автоматична перевірка:** 25 тестів без мережі. Усі тести вже є в [test/harness.test.mjs](../test/harness.test.mjs) та [test/runbooks.test.mjs](../test/runbooks.test.mjs). Число на початку назви тесту відповідає етапу; команда запускає цей і попередні етапи.

**Очікуємо:** Задана послідовність searchStories → saveDigest → текст дає історію 1 → 3 → 5 → 7. Повторення й некоректні виклики також перевірені.

**Якщо не так:** Завершується після тула — залишився return tool-result. Історія завжди 1 — messages опинився всередині for. Ліміт не означає виконану задачу.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 08: Цикл і зупинка"
```

## Якщо не встиг: готова точка й наступна тема

Ця гілка містить **результат теми 08**. Збережи свою спробу й створи робочу гілку від готового коду:

```bash
git add src
git diff --cached
git diff --cached --quiet || git commit -m "Моя спроба етапу 08"
git fetch origin
git switch -c work-09 origin/step-08-loop
npm run check
npm test -- --test-name-pattern "^0[0-8] "
```

Власний коміт залишився у попередній гілці. Якщо work-09 вже існує, обери нове імʼя, наприклад work-09-retry. .env і node_modules залишаються на місці. Відкрий [ранбук 09](09-description.md) в тому самому редакторі: усі ранбуки й тести доступні в кожній гілці.

Якщо завершив самостійно, продовжуй у своїй гілці за наступним ранбуком; брати готовий код необовʼязково.

Для одного пошуку, одного читання й одного запису бачимо 1 → 3 → 5 → 7 повідомлень. Інший вибір моделі дасть іншу кількість кроків: це нормально. Тест перевіряє задану послідовність, а не гарантує її для живої моделі.

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

export type Agent = {
  model: LanguageModel;
  system: string;
  tools: ToolSet;
  runTool: (name: string, input: unknown) => Promise<JSONValue>;
  maxSteps?: number;
};

export async function runAgent(agent: Agent, task: string) {
  const messages: ModelMessage[] = [{ role: 'user', content: task }];

  for (let step = 1; step <= (agent.maxSteps ?? 10); step++) {
    console.log(`\nКрок ${step}. Повідомлень у запиті: ${messages.length}.`);

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

    // Спочатку запит моделі на виклик тула, потім наш результат.
    // Беремо лише assistant: помилки тулів повертаємо нижче самі.
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
  }

  console.log('Зупинка: досягли ліміту кроків. Задача може бути незавершена.');
  return { reason: 'limit', text: '', messages };
}
```

</details>


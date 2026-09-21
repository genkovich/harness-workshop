# 05. Tool call

Почни з власного коду після етапу 04. Змінюй лише `src/`. Контрольна точка після виконання: `step-05-call`. Тести й конфігурація вже готові.

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

## Запусти й перевір

```bash
npm run check
npm test -- --test-name-pattern "^0[12] "
npm start
```

**Тести:** 2 перевірок мають пройти. Команда запускає лише вже реалізовану поведінку.

**Очікуємо:** Два тести проходять. Якщо модель обрала getCharges, видно імʼя й customerId. Виконання ще немає.

**Якщо не так:** Немає tools у TRACE — перевір generateText. Звичайний текст із JSON не є tool call і не виконується.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 05: Tool call"
```

Далі відкрий [етап 06 у браузері](https://github.com/genkovich/harness-workshop/blob/step-06-execute/RUNBOOK.md). Продовжуй у своїй гілці: перемикання потрібне лише щоб наздогнати групу.


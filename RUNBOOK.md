# 07. Результат в історії

Почни з власного коду після етапу 06. Змінюй лише `src/`. Контрольна точка після виконання: `step-07-history`. Тести й конфігурація вже готові.

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

## Запусти й перевір

```bash
npm run check
npm test -- --test-name-pattern "^0[1-4] "
npm start
```

**Тести:** 4 перевірок мають пройти. Команда запускає лише вже реалізовану поведінку.

**Очікуємо:** Чотири тести проходять. Після одного getCharges у messages три записи: user, assistant, tool. Повторного запиту ще немає.

**Якщо не так:** Звір toolCallId. Повідомлення assistant має стояти перед його tool result; одного console.log для передачі моделі недостатньо.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 07: Результат в історії"
```

Далі відкрий [етап 08 у браузері](https://github.com/genkovich/harness-workshop/blob/step-08-loop/RUNBOOK.md). Продовжуй у своїй гілці: перемикання потрібне лише щоб наздогнати групу.


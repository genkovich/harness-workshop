# 02. Повідомлення

Почни з власного коду після етапу 01. Змінюй лише `src/`. Контрольна точка після виконання: `step-02-messages`. Тести й конфігурація вже готові.

У `src/main.ts` додай ModelMessage до імпорту з ai:

```ts
import { generateText, type ModelMessage } from 'ai';
```

Після const model додай задачу та початкове повідомлення:

```ts
const task = process.argv[2] || 'Перевір списання клієнта 42.';
const messages: ModelMessage[] = [{ role: 'user', content: task }];
```

У generateText прибери поле prompt. На його місце встав:

```ts
system: 'Відповідай українською.',
messages,
```

Перед викликом моделі можеш подивитися, що передаєш:

```ts
console.log('Повідомлення:', messages);
```

## Запусти й перевір

```bash
npm run check
npm start
```

**Поки перевіряємо типи та живий запуск.**

**Очікуємо:** Одна задача user і відповідь моделі. Тулів ще немає; текст про списання не означає, що дані перевірені.

**Якщо не так:** Якщо тип role не підходить, звір ModelMessage[]. Власну задачу передай через npm start -- "Твоя задача".

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 02: Повідомлення"
```

Далі відкрий [етап 03 у браузері](https://github.com/genkovich/harness-workshop/blob/step-03-function/RUNBOOK.md). Продовжуй у своїй гілці: перемикання потрібне лише щоб наздогнати групу.


# 10. Правила з файла

Почни з власного коду після етапу 09. Змінюй лише `src/`. Контрольна точка після виконання: `step-10-context`. Тести й конфігурація вже готові.

AGENTS.md уже підготовлено. Прочитай файл: у ньому правило починати відповідь словами «Дякуємо за звернення». У src/billing/agent.ts додай:

```ts
import { readFileSync } from 'node:fs';

const rules = readFileSync(new URL('../../AGENTS.md', import.meta.url), 'utf8');
```

У billing додай поле:

```ts
context: rules,
```

У тип Agent у src/harness.ts додай:

```ts
context?: string;
```

У початковому messages заміни content user-повідомлення:

```ts
content: `${agent.context || ''}\n${task}`.trim(),
```

Подивись перший запит:

```bash
TRACE=1 npm start
```

## Запусти й перевір

```bash
npm run check
npm test -- --test-name-pattern "^(0[1-9]|10) "
npm start
```

**Тести:** 10 перевірок мають пройти. Команда запускає лише вже реалізовану поведінку.

**Очікуємо:** Десять тестів проходять. Правило є в першому user-повідомленні. Його дотримання перевіряємо окремо у відповіді живої моделі.

**Якщо не так:** Файл є, тексту немає — звір billing.context і складання messages. Файл редагувати не потрібно.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 10: Правила з файла"
```

Далі відкрий [етап 11 у браузері](https://github.com/genkovich/harness-workshop/blob/step-11-skills/RUNBOOK.md). Продовжуй у своїй гілці: перемикання потрібне лише щоб наздогнати групу.


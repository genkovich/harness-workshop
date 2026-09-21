# Ранбук учасника

## Що зробимо

День 1: один API-запит → цикл із тулами → AGENTS.md → skills → перевірка перед виконанням.
День 2: бот у Telegram → власна інструкція → нотатки → права власника → usage → skill стендапу.
Працюємо з вигаданим зверненням: клієнту 42 двічі списали 49 USD. `sendReply` записує відповідь у файл.

## До воркшопу

Потрібні Git, редактор, Node 22.19+ у лінійці 22 або Node 24.11+. Не використовуй Node 23.
Репозиторій приватний: спершу прийми запрошення від організатора у свій GitHub-акаунт.
Авторизуй Git для GitHub звичним способом або через `gh auth login`.

```bash
git clone --branch start https://github.com/genkovich/harness-workshop.git
cd harness-workshop
npm ci
cp .env.example .env
npm run demo -- smoke
```

Очікуємо `SMOKE PASS`. Це перевірка без API-ключа: модель симулюється локально.
Якщо користуєшся nvm: `nvm install && nvm use`. Команди нижче виконуй у корені репозиторію.

Відкрий `.env`, встав свій `GROQ_API_KEY`. Провайдер за замовчуванням `groq`.
Не показуй цей файл під час демонстрації екрана. У Git він не потрапляє.

## 1. Перевір один запит · 10 хв

```bash
npm run smoke
```

Очікуємо текст моделі й `SMOKE PASS`. Лог лежить у `runs/`.
`401`: перевір ключ. `429`: враховуємо Retry-After, максимум дві повторні спроби; довге очікування завершує запуск із поясненням.
Не переходь до циклу, доки цей запит не працює. Без ключа можна пройти механіку через локальне демо.

## 2. Напиши цикл · 30 хв

На `start` у `runtime.ts` є TODO. Заміни його цим кодом. Прочитай чотири дії: викликати модель, записати її відповідь, виконати тули, додати результати.

```ts
import type { ModelMessage } from 'ai';
import { callModel } from './model.ts';
import { tools, runTool } from './tools.ts';
import type { Call, Log, ModelCall } from './types.ts';
export const MAX_STEPS = 10;
export function beforeTool(_call: Call): string | null { return null; }

export async function runAgent(task: string, log: Log, model: ModelCall = callModel, maxSteps = MAX_STEPS) {
  const messages: ModelMessage[] = [{ role: 'user', content: task }];
  for (let step = 1; step <= maxSteps; step++) {
    const reply = await model(messages, tools, log, step);
    if (reply.calls.length === 0) {
      log({ event: 'stop', reason: 'final', step, text: reply.text });
      return { reason: 'final', text: reply.text };
    }
    messages.push(...reply.messages);
    for (const call of reply.calls) {
      const blocked = beforeTool(call);
      let result;
      try { result = blocked ? { error: blocked } : await runTool(call); }
      catch (error) { result = { error: error instanceof Error ? error.message : String(error) }; }
      log({ event: blocked ? 'blocked' : 'tool-result', step, call, result });
      messages.push({ role: 'tool', content: [{ type: 'tool-result', toolCallId: call.id,
        toolName: call.name, output: { type: 'json', value: result } }] });
    }
  }
  log({ event: 'stop', reason: 'max-steps', limit: maxSteps });
  return { reason: 'max-steps', text: '' };
}

```

```bash
npm run demo
npm run agent
```

Перша команда детерміновано показує механіку без API. Друга використовує провайдера з `.env`.
У локальному демо побачиш `getCharges`, `sendReply` і фінальну відповідь. Перевір `.data/outbox.jsonl`.

## 3. Розбери лог · 6 хв

Відкрий останній `runs/agent-*.jsonl` у редакторі. Шукай:

- `request`: `messagesCount` **1 → 3 → 5** у стандартному локальному демо;
- `wire`: фактичне тіло HTTP-запиту SDK та відповідь сервера, без заголовків авторизації;
- `tool-result`: той самий `id`, що був у виклику;
- `stop`: `final` або `max-steps`, максимум 10 звернень до моделі в циклі.

System передається окремим аргументом SDK. У HTTP Groq він стає додатковим повідомленням: там буде 2 → 4 → 6.
Жива модель може вибрати іншу кількість тулів і кроків. Не підганяй її лог під демо.

## 4. Зміни лише опис · 12 хв

У `tools.ts` заміни значення `SEND_REPLY_DESCRIPTION`:

```ts
export const SEND_REPLY_DESCRIPTION = 'never call this';
```

Тричі запусти `npm run agent`. Запиши для кожного запуску: чи був виклик `sendReply`, аргументи, фінальний текст.
Немає обіцяного результату 0/3 чи 3/3: це експеримент. `npm run demo` не вимірює поведінку живої моделі.
Поверни нормальний опис перед наступним кроком:

```ts
export const SEND_REPLY_DESCRIPTION = 'Надішли клієнту відповідь після перевірки списань.';
```

## 5. Додай AGENTS.md

Додай імпорт у `runtime.ts`:

```ts
import { readFileSync } from 'node:fs';
```

Заміни рядок створення `messages`:

```ts
const rules = readFileSync('AGENTS.md', 'utf8');
const messages: ModelMessage[] = [{ role: 'user', content: `${rules}\n\n${task}` }];
```

```bash
npm run agent
```

Знайди текст AGENTS.md у першому запиті. Файл читає наша програма: SDK не підхоплює його автоматично.
Перевір, чи жива модель починає відповідь із «Дякуємо за звернення»; текст у запиті й дотримання інструкції — окремі спостереження.

## 6. Підключи skills

На `step-3-agents-md` уже є `skills.ts`, два SKILL.md та експорт `readSkillTool`. Додай у `runtime.ts`:

```ts
import { loadSkills } from './skills.ts';
```

Заміни створення `messages`, залишивши `rules`:

```ts
const skillList = loadSkills().map(s => `${s.name}: ${s.description}`).join('\n');
const messages: ModelMessage[] = [{ role: 'user', content: `${rules}\nSkills:\n${skillList}\n\n${task}` }];
```

У `tools.ts` додай в обʼєкт `tools` один рядок:

```ts
readSkill: readSkillTool,
```

Збережи, запусти `npm run agent`. Спершу в запиті лише назви й описи skills. Повний текст зʼявляється, якщо модель викликає `readSkill`.
Для окремої перевірки тимчасово додай до TASK.md прохання прочитати billing skill. Після досліду поверни початкову задачу.

## 7. Перевір дію до виконання

Заміни порожню функцію `beforeTool` у `runtime.ts`:

```ts
export function beforeTool(call: Call): string | null {
  if (call.name === 'sendReply' && process.env.APPROVED !== '1') return 'blocked, ask the user';
  return null;
}
```

```bash
APPROVED=0 npm run demo
APPROVED=1 npm run demo
```

Перший запуск поверне моделі помилку блокування. Другий додасть один рядок до outbox.
Порівняй кількість рядків до й після: попередні записи зберігаються.
Модель може запропонувати дію, але дозвіл перевіряє код. Фраза «я погоджуюсь» у TASK.md не змінює `APPROVED`.
Це навчальний перемикач процесу, а не готова система погодження операцій у продукті.

## Якщо відстав: контрольні гілки

Спершу збережи свої зміни. На кожному кроці використовуй нову назву своєї гілки, наприклад:

```bash
git switch -c my-step-1
git add runtime.ts tools.ts TASK.md AGENTS.md
git diff --cached
git commit -m "Моя практика: цикл"
git switch step-1-loop
```

Якщо Git відповідає `nothing to commit`, переходь до `git switch`. Перед першим комітом може знадобитися налаштувати власні `user.name` і `user.email`.
Не роби `reset --hard`. Якщо лишилися незбережені правки інших файлів, збережи й їх перед перемиканням.

| Гілка | Що готово |
|---|---|
| `start` | Smoke, тули, TODO у runtime |
| `step-1-loop` | Цикл, історія, ліміт |
| `step-2-tool-desc` | Експериментальний опис never call this |
| `step-3-agents-md` | AGENTS.md у запиті; нормальний опис повернуто |
| `step-4-skills` | Описи skills і readSkill |
| `step-5-before-tool` | Перевірка перед sendReply |
| `day2-flue` | Простий бот без підключених можливостей |
| `day2-flue-solution` | Готові шість кроків другого дня |
| `main` | Усі готові рішення та документація |

Після перемикання гілки виконай `npm ci`. Для другого дня переходь до [day2/RUNBOOK.md](day2/RUNBOOK.md).

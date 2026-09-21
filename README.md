# Harness Workshop · день 1

Підготовлена основа; під час практики змінюємо лише `src/`.
`package.json`, lockfile, tsconfig, тести, AGENTS.md і skill уже готові.

Перед практикою:

```bash
git clone --branch start https://github.com/genkovich/harness-workshop.git
cd harness-workshop
npm ci
git switch -c work
```

`npm ci` створює `.env` із шаблону, якщо файла ще немає. Наявний `.env` зберігається.
Один раз перед заняттям встав свій OPENROUTER_API_KEY. Для живих викликів потрібен баланс OpenRouter; ключ не комітимо.

```bash
npm run check
npm start
```

Очікуємо «TypeScript працює». Далі відкрий [етап 01](https://github.com/genkovich/harness-workshop/blob/step-01-model/RUNBOOK.md) і продовжуй у work.
Кожен ранбук містить лише поточну зміну, короткі фрагменти коду, запуск і дебаг.
Тести готові: на етапі копіюй команду з його ранбуку. Повний npm test перевіряє фінальне рішення.

## Контрольні точки

| Етап | Ранбук і готовий код |
|---|---|
| 01 · Один запит | [step-01-model](https://github.com/genkovich/harness-workshop/blob/step-01-model/RUNBOOK.md) |
| 02 · Повідомлення | [step-02-messages](https://github.com/genkovich/harness-workshop/blob/step-02-messages/RUNBOOK.md) |
| 03 · Функція запиту | [step-03-function](https://github.com/genkovich/harness-workshop/blob/step-03-function/RUNBOOK.md) |
| 04 · Описи тулів | [step-04-tools](https://github.com/genkovich/harness-workshop/blob/step-04-tools/RUNBOOK.md) |
| 05 · Tool call | [step-05-call](https://github.com/genkovich/harness-workshop/blob/step-05-call/RUNBOOK.md) |
| 06 · Виконання | [step-06-execute](https://github.com/genkovich/harness-workshop/blob/step-06-execute/RUNBOOK.md) |
| 07 · Результат в історії | [step-07-history](https://github.com/genkovich/harness-workshop/blob/step-07-history/RUNBOOK.md) |
| 08 · Цикл і зупинка | [step-08-loop](https://github.com/genkovich/harness-workshop/blob/step-08-loop/RUNBOOK.md) |
| 09 · Експеримент з описом | [step-09-description](https://github.com/genkovich/harness-workshop/blob/step-09-description/RUNBOOK.md) |
| 10 · Правила з файла | [step-10-context](https://github.com/genkovich/harness-workshop/blob/step-10-context/RUNBOOK.md) |
| 11 · Skills | [step-11-skills](https://github.com/genkovich/harness-workshop/blob/step-11-skills/RUNBOOK.md) |
| 12 · Дозвіл | [step-12-guard](https://github.com/genkovich/harness-workshop/blob/step-12-guard/RUNBOOK.md) |

## Якщо треба наздогнати

Збережи свій код і відкрий потрібну точку, наприклад результат виконання тула:

```bash
git add src
git commit -m "Моя практика"
git switch -c continue-execute origin/step-06-execute
npm run check
```

Якщо змін немає, commit пропусти. Далі відкрий ранбук етапу 07 у браузері й пиши у своїй гілці.
Після кожного кроку перемикатися не потрібно. Навчальні дані, тести й конфігурація однакові у всіх точках.

Для дебагу: TRACE=1 npm start показує HTTP body. У циклі перевір reply.toolCalls, call.toolCallId і messages.

```bash
node --inspect-brk --import tsx --env-file-if-exists=.env src/main.ts
```

У VS Code обери Debug: Attach to Node Process. Постав breakpoint після generateText, перед runTool і після messages.push. Процес очікує підключення дебагера; Ctrl+C його завершує.

**Ця точка:** step-06-execute — Виконання.

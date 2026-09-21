# Harness Workshop · день 1

Збираємо агентний цикл поступово. `main` — готове рішення, `start` — один робочий запит.

## Запуск

```bash
git clone --branch start https://github.com/genkovich/harness-workshop.git
cd harness-workshop
npm ci
cp .env.example .env
# Встав GROQ_API_KEY у .env.
npm start
```

Node 22.19+. `npm test` працює без ключа; `npm start` звертається до Groq.
Свою задачу можна передати так: `npm start -- "Перевір списання клієнта 42"`.

## Де що лежить

```text
src/
  main.ts            збирає модель, billing і harness
  harness.ts         запит → тул → результат → наступний запит
  billing/
    agent.ts         інструкція, описи тулів, виконання, дозвіл
    charges.json     навчальні списання
  skills.ts          читання skills, додається на кроці 6
```

Harness не знає про клієнтів чи списання. Уся ця логіка в `billing/`.
`sendReply` записує рядок у `.data/outbox.jsonl`; реальних листів немає.

## Кроки

| Гілка | Що додаємо |
|---|---|
| `start` | Один запит |
| `step-1-request` | Описи тулів |
| `step-2-tools` | Виконання |
| `step-3-loop` | Цикл |
| `step-4-description` | Опис тула |
| `step-5-context` | AGENTS.md |
| `step-6-skills` | Skills |
| `step-7-guard` | Дозвіл |

У кожній гілці README пояснює наступну зміну; тести перевіряють уже зібрану поведінку.
Щоб перевіряти новий крок до написання коду, спершу скопіюй його тести:

```bash
git show origin/step-1-request:test/harness.test.ts > test/harness.test.ts
npm test
```

Спочатку новий тест впаде. Додай код із наступного кроку та запусти `npm test` знову.
Для інших кроків підстав відповідну гілку. `npm run check` додає перевірку TypeScript.
`TRACE=1 npm start` покаже HTTP-запит без заголовків авторизації.

Щоб перейти до готового кроку, збережи свою роботу окремим комітом:

```bash
git switch -c my-work
git add src test AGENTS.md
# Перевір, що саме зберігаєш.
git diff --cached
git commit -m "Мій цикл"
git switch step-1-request
```

Для наступних збережень обирай нову назву власної гілки. Якщо змін немає, достатньо `git switch`.

## Зараз: Один запит

Модель повернула текст. Тулів у запиті ще немає.

## Наступна зміна

У `src/harness.ts` у виклик `generateText` додай:

```ts
tools: agent.tools,
```

Перед повідомленням про зупинку встав:

```ts
if (reply.toolCalls.length > 0) {
  for (const call of reply.toolCalls) {
    console.log(`Модель просить ${call.toolName}:`, call.input);
  }
  return { reason: 'tool-call', text: reply.text, messages };
}
```

`npm start`: бачиш getCharges та customerId. Читання даних ще не відбулося.

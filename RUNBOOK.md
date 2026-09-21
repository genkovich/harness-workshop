# 12. Дозвіл

Почни з власного коду після етапу 11. Змінюй лише `src/`. Контрольна точка після виконання: `step-12-guard`. Тести й конфігурація вже готові.

У billing у src/billing/agent.ts додай метод:

```ts
beforeTool(name: string) {
  if (name === 'sendReply' && process.env.APPROVED !== '1') {
    return 'blocked, ask the user';
  }
  return null;
},
```

У тип Agent у src/harness.ts додай:

```ts
beforeTool?: (name: string) => string | null;
```

У try перед agent.runTool встав:

```ts
const blocked = agent.beforeTool?.(call.toolName);
if (blocked) {
  throw new Error(blocked);
}
```

Порівняй два запуски без редагування .env:

```bash
APPROVED=0 npm start
APPROVED=1 npm start
```

## Запусти й перевір

```bash
npm run check
npm test -- --test-name-pattern "."
npm start
```

**Тести:** 12 перевірок мають пройти.

**Очікуємо:** Усі 12 тестів проходять. Без дозволу sendReply повертає blocked і не змінює outbox. Дозволений виклик додає рядок.

**Якщо не так:** Файл змінився без дозволу — перевір місце beforeTool. Повторний запит моделі на заборонений тул ще не означає виконання дії.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 12: Дозвіл"
```

Цикл зібрано. Поясни за логом: хто обрав тул, хто виконав дію, як результат потрапив до моделі та чому виконання завершилося.


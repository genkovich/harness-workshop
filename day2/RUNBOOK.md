# День 2: свій бот у Telegram

Команди цього ранбуку виконуються в теці `day2/`, якщо явно не сказано інакше.
До воркшопу: створи свого бота через BotFather, підготуй його токен і Gemini API key.
Один бот запускає лише один учасник: два одночасні polling-процеси з одним токеном конфліктують.

## 1. Запусти місток · 8 хв

Із кореня репозиторію, збережи роботу першого дня за інструкцією основного ранбуку, потім:

```bash
git switch day2-flue
cd day2
npm ci
cp .env.example .env
```

Заповни `TELEGRAM_BOT_TOKEN` і `GEMINI_API_KEY` у `day2/.env`. `OWNER_CHAT_ID` поки порожній.

```bash
npm run bot
```

Надішли `/start` своєму боту з Telegram. Chat id побачиш у терміналі. Потім «привіт»; очікуємо відповідь моделі.
`bot.ts`: Telegram → chat id → `dispatch` → `read` того самого receipt → Telegram.
Без ключів `npm run check` перевіряє код і SQLite, але не замінює цей живий запуск.

## 2. Дай інструкцію · 10 хв

У `agent.ts` заміни текст після `return`:

```ts
return 'Ти помічник Марко. Відповідай українською короткими реченнями.';
```

Зупини `Ctrl+C`, запусти `npm run bot`. Напиши «мене звати Оля», потім ще дві репліки.
Перезапусти бота й запитай «як мене звати?». Файл `bot.db` зберігає історію Flue; не видаляй його між запусками.
Відповідь моделі перевіряємо окремо: наявність БД сама собою не доводить правильний recall.

## 3. Підключи нотатки · 14 хв

У `tools.ts` уже лежать короткі функції `defineTool` для `saveNote` і `searchNotes`; відкрий їх та `notes.ts`.
Модель передає лише текст/запит. Chat id беремо з довіреного Telegram-контексту.

Додай у `agent.ts` імпорти `useTool` та `toolsForChat`, а всередині функції після `useModel`:

```ts
for (const tool of toolsForChat(id)) useTool(tool);
```

Якщо треба швидко наздогнати, скопіюй цей повний `agent.ts`:

```ts
'use agent';
import { useModel, useTool, type AgentProps } from '@flue/runtime';
import { toolsForChat } from './tools.ts';
export function Assistant({ id }: AgentProps) {
  useModel('google/gemini-2.5-flash');
  for (const tool of toolsForChat(id)) useTool(tool);
  return 'Відповідай українською. Зберігай і шукай нотатки через тули.';
}
Assistant.agentName = 'workshop-assistant';
```

Перезапусти. Напиши «запамʼятай: сьогодні підключили пошук нотаток»; перевір `notes.json`.
Потім «що сьогодні підключили?». Запис і відповідь — дві окремі перевірки.

## 4. Додай право власника · 13 хв

Встав свій chat id у `OWNER_CHAT_ID` у `.env`. У `tools.ts` перед `return tools` додай:

```ts
if (process.env.OWNER_CHAT_ID && chatId === process.env.OWNER_CHAT_ID) {
  return [...tools, defineTool({
    name: 'deleteNotes', description: 'Видали всі власні нотатки після прямого прохання користувача.',
    input: v.object({}),
    run: () => ({ output: deleteNotes(chatId) }),
  })];
}
```

`deleteNotes` вже імпортований. Перезапусти. Попроси бота видалити власні тестові нотатки.
Нехай інший учасник збереже власну тестову нотатку й попросить те саме у твоєму боті.
У його наборі тулів немає `deleteNotes`; додатково `notes.ts` перевіряє власника перед видаленням.
Видаляються лише нотатки власника; чужі залишаються. Для порівняння можна відкрити гілку solution.

## 5. Побач usage · 5 хв

Додай `useResponseFinish` до імпорту з `@flue/runtime`, а після `useModel`:

```ts
useResponseFinish(({ response }) => {
  console.log(JSON.stringify({ event: 'usage', totalTokens: response.usage.totalTokens }));
});
```

Перезапусти, надішли три повідомлення, порівняй числа. Це usage окремої відповіді; не обіцяємо монотонного зростання чи накопиченої вартості.

## 6. Підключи skill · 5 хв

Додай `useSkill` до імпорту з `@flue/runtime`, додай:

```ts
import { standup } from './skill.ts';
```

У функції агента після `useModel`:

```ts
useSkill(standup);
```

Відкрий `skills/standup/SKILL.md`: саме звідти `skill.ts` читає інструкцію. Перезапусти бота.
Збережи кілька тестових нотаток; попроси «підготуй стендап із моїх нотаток». Перевір пошук та структуру відповіді.
Факт виклику skill і дотримання формату — окремі спостереження.

## Якщо відстав

Збережи свої файли комітом у власній гілці, як у головному ранбуку. Із `day2/`:

```bash
git switch day2-flue-solution
npm ci
npm run bot
```

Ключі й `.env` лишаються локальними. `notes.json` і `bot.db` також не входять у Git.
Повне рішення коротке: [agent.ts](agent.ts), [tools.ts](tools.ts), [bot.ts](bot.ts).

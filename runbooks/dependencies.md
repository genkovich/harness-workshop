# Залежності й перевірка перед воркшопом

[Підготовка](00-start.md) · [Усі теми](README.md)

Перевірено 21.09.2026. Учасник виконує npm ci й отримує зафіксовані версії. Новий latest під час заняття не встановлюємо.

## Що перевірено

| Пакет | У package.json | npm latest на дату перевірки | Сумісність |
|---|---|---|---|
| @openrouter/ai-sdk-provider | 3.1.0 | 3.1.0 | ai ^7.0.0, zod ^3.25.76 або ^4.1.8, Node >=22 |
| ai | 7.0.107 | 7.0.107 | zod ^3.25.76 або ^4.1.8, Node >=22 |
| zod | 4.6.5 | 4.6.5 | У межах peer dependencies обох пакетів |
| typescript | 7.0.2 | 7.0.2 | Node >=16.20; наш Node 24 підходить |
| tsx | 4.23.15 | 4.23.15 | Node >=18; наш Node 24 підходить |
| @types/node | 26.6.2 | 26.6.2 | Це типи для редактора/tsc, а не встановлення Node runtime |

Номери та engines/peerDependencies перевірені через публічний npm registry. Пакети вже були актуальними; залежності та lockfile не змінювалися. Рекомендований runtime — Node 24.21.0 LTS; .nvmrc та CI використовують його. У коді використовуємо API, доступні в цьому runtime.

## Перевірка через Context7 MCP

Сервер context7 підключено через https://mcp.context7.com/mcp. Виконано MCP tools/list, resolve-library-id і query-docs. Перевірено:

- /websites/ai-sdk_dev: generateText, inputSchema, Zod 4, формат assistant/tool messages і toolCallId.
- /openrouterteam/ai-sdk-provider: openrouter/createOpenRouter, OPENROUTER_API_KEY, вибір моделі, передавання запитів та tools.
- /websites/zod_dev: z.object, числові обмеження, parse і safeParse.

Context7 не підтвердив точні patch-релізи всіх пакетів: у списках версій є старі знімки. Деякі приклади адаптера також використовують старі форми tools. Тому версії всіх шести пакетів звірено з npm, а поточні сигнатури — зі встановленими пакетами та виконанням тестів. Не видаємо результат пошуку документації за доказ останнього релізу.

## Джерела й повторення перевірки

[AI SDK](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text) · [OpenRouter provider](https://github.com/OpenRouterTeam/ai-sdk-provider) · [Zod](https://zod.dev/basics) · [Node.js](https://nodejs.org/en/download) · [Context7 MCP](https://context7.com/docs/resources/all-clients).

```bash
npm view @openrouter/ai-sdk-provider version engines peerDependencies
npm view ai version engines peerDependencies
npm view zod version engines
npm view typescript version engines
npm view tsx version engines
npm view @types/node version
```

Після зміни залежностей проганяємо типи й тести кожної контрольної гілки, а готове рішення — на Windows, macOS і Linux. Для Node 24 перевіряємо також команду setup:check. CI не робить запитів до живої моделі й не потребує API-ключів.

Модель qwen/qwen3.8-27b:free перевірено в [публічному каталозі OpenRouter](https://openrouter.ai/api/v1/models): ціни prompt/completion дорівнюють 0, supported_parameters містить tools. Це не доказ доступності для конкретного акаунта: її перевіряє учасник командою npm run setup:check.

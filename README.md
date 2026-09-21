# Harness Workshop

Навчальний harness українською: день 1 збираємо цикл, день 2 робимо Telegram-бота на Flue.

1. Відкрий [ранбук учасника](RUNBOOK.md).
2. Почни з гілки `start`. Поточна гілка `step-3-agents-md`: Крок 3: додаємо AGENTS.md до запиту. Готові рішення в `main`.
3. Немає ключа? `npm ci && npm run demo -- smoke` перевірить локальне оточення.

`runtime.ts` — цикл; `tools.ts` — описи й виконання тулів; `model.ts` — API; `AGENTS.md` і `skills/` — контекст.

`sendReply` пише в локальний `.data/outbox.jsonl`. Клієнт 42 і списання вигадані.
Локальна демонстрація використовує симулятор моделі; запити SDK, цикл і робота з файлами справжні.

[День 2](day2/RUNBOOK.md) · [Перевірки й межі демо](docs/VERIFICATION.md) · [Для лектора](docs/INSTRUCTOR.md)

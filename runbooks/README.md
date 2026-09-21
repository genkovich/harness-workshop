# Ранбуки дня 1

Усі теми, тести й готові фрагменти доступні локально в кожній гілці. Почни з [підготовки](00-start.md). На занятті змінюємо лише src/.

Контрольна гілка містить **результат** теми. Якщо відстав, збережи свою спробу й бери її перед наступною темою. Команди є в кожному ранбуку.

| Тема | Початковий код | Готовий результат | Тестів після теми |
|---|---|---|---|
| [00. Підготовка](00-start.md) | start | start | 2 |
| [01. Один запит](01-model.md) | start | step-01-model | 3 |
| [02. Повідомлення](02-messages.md) | step-01-model | step-02-messages | 6 |
| [03. Функція запиту](03-function.md) | step-02-messages | step-03-function | 7 |
| [04. Описи тулів](04-tools.md) | step-03-function | step-04-tools | 8 |
| [05. Tool call](05-call.md) | step-04-tools | step-05-call | 9 |
| [06. Виконання](06-execute.md) | step-05-call | step-06-execute | 10 |
| [07. Результат в історії](07-history.md) | step-06-execute | step-07-history | 11 |
| [08. Цикл і зупинка](08-loop.md) | step-07-history | step-08-loop | 17 |
| [09. Експеримент з описом](09-description.md) | step-08-loop | step-09-description | 18 |
| [10. Правила з файла](10-context.md) | step-09-description | step-10-context | 19 |
| [11. Skills](11-skills.md) | step-10-context | step-11-skills | 20 |
| [12. Дозвіл](12-guard.md) | step-11-skills | step-12-guard | 22 |

## Тести й дебаг

[Усі сценарії агента](../test/harness.test.mjs) · [середовище та ранбуки](../test/runbooks.test.mjs) · [підміна HTTP](../test/openrouter.mock.mjs).

Тести мають номер теми в назві. Команда в ранбуку перевіряє цей і попередні етапи. На main та step-12-guard запускай npm test: 22 тести. Перевіряємо структуру запитів, схеми аргументів, виконання, відповідність id, історію, ліміт, помилки, контекст, skills та дозвіл. HTTP у тестах підмінено; live-виклик перевіряється окремо командою npm start із явно переданою задачею.

На етапі 09 автоматичний тест підтверджує доставку description і доступність функції. Він не вимірює, чи послухається жива модель.

Починаючи з етапу 03: TRACE=1 npm start -- "Перевір списання клієнта 42." друкує HTTP body. Дивись reply.toolCalls, call.toolCallId та messages. Для breakpoint:

```bash
node --inspect-brk --import tsx --env-file-if-exists=.env src/main.ts "Перевір списання клієнта 42."
```

У редакторі підʼєднай Node debugger і зупинись після generateText або перед runTool. Ctrl+C завершує процес.

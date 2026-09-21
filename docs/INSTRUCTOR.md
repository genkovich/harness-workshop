# Лектору

- За день до практики надай учасникам read-доступ до приватного репозиторію. Запрошення автоматично не надсилаються.
- Пройди обидва smoke: Groq день 1, Gemini + свій Telegram-бот день 2. Без реальних ключів їх не можна вважати пройденими.
- Заздалегідь зроби `npm ci` у корені та `day2/`.
- Почни показ із `start`. Поясни різницю `npm run demo` (симулятор) і `npm run agent` (API).
- На step-2 збирай справжні три результати. Симулятор не доводить впливу опису на модель.
- У step-3 нормальний опис повернуто навмисно, щоб попередній експеримент не заважав наступному.
- Для детермінованого показу блокування: `APPROVED=0 npm run demo`; дозволу: `APPROVED=1 npm run demo`.
- Усі файли `runs/` можуть містити завдання й відповіді. Публікуй лише перевірені навчальні логи.
- `useResponseFinish` показує usage відповіді, не монотонний лічильник розмови.
- Другий день запускаємо з `day2/`. Відсутність `OWNER_CHAT_ID` означає відсутність deleteNotes.

Джерела API: [AI SDK generateText](https://ai-sdk.dev/docs/reference/ai-sdk-core/generate-text), [Flue agents](https://flueframework.com/docs/guide/building-agents/), [Flue hooks](https://flueframework.com/docs/guide/agent-hooks/).

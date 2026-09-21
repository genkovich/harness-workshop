# Harness Workshop · день 1

**Ця гілка:** `step-06-execute` — результат етапу 06.

[Усі ранбуки](runbooks/README.md) · [Підготовка та пакети](runbooks/00-start.md) · [Тести](test/harness.test.mjs).

Конфігурація, залежності, тести та .env.example готові. npm ci створює .env, якщо його немає; ключ вставляємо перед заняттям. На практиці змінюємо лише src/.

У runbooks/ усі 13 тем: що робимо й навіщо → маленькі зміни → перевірки → перехід на готову гілку → повний очікуваний код. Ранбуки й тести однакові у всіх контрольних точках: тримай їх відкритими під час переходів.

## Початок

```bash
git clone --branch start https://github.com/genkovich/harness-workshop.git
cd harness-workshop
npm ci
git switch -c work-01
```

Потрібен Node.js від 22.19. Встав OPENROUTER_API_KEY у .env та відкрий [етап 00](runbooks/00-start.md).

## Перевірити цю контрольну точку

```bash
npm run check
npm test -- --test-name-pattern "^0[0-6] "
```

Очікуємо 8 тестів без мережі. Повний npm test запускай на готовому рішенні. Живий API: npm start після налаштування ключа.

**Наступна тема:** [07. Результат в історії](runbooks/07-history.md).

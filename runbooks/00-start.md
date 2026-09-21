# 00. Підготовка до воркшопу

[Усі теми](README.md) · [Далі: перший запит](01-model.md)

## Що робимо й навіщо

До заняття встанови Node.js і Git, завантаж проєкт та перевір ключ Groq. На воркшопі збиратимемо агента, який шукає обговорення на Hacker News і зберігає дайджест. Залежності й налаштування вже готові; змінюватимемо лише `src/`.

Виділи 30 хвилин. Потрібні облікові записи GitHub і Groq. Для **Groq Free** картка й поповнення не потрібні; залишайся на Free plan. Developer — платний режим з оплатою токенів.

## 1. Встанови Node.js і Git

Використовуємо **Node.js 26.9.0 Current**. npm встановлюється разом із Node. Для коду підійде твій редактор або [VS Code](https://code.visualstudio.com/download).

| ОС | Що встановити | Де виконувати команди |
|---|---|---|
| Windows | [Node.js](https://nodejs.org/en/download) — Windows Installer `.msi`; [Git for Windows](https://git-scm.com/install/windows) з Git Bash. Залиш типові налаштування й додавання до PATH. | **Git Bash** із меню Start. У VS Code: Terminal → Select Default Profile → Git Bash. |
| macOS | [Node.js](https://nodejs.org/en/download) — macOS Installer `.pkg`. Виконай `git --version` і погодься встановити Command Line Tools, якщо система запропонує. | Terminal |
| Linux | Git — через пакетний менеджер; Node — через [nvm](https://github.com/nvm-sh/nvm#install--update-script), потім `nvm install 26.9.0` і `nvm use 26.9.0`. | Terminal |

На Ubuntu/Debian Git встановлюється командою `sudo apt install git` після `sudo apt update`. На macOS, якщо Git відсутній і запрошення не зʼявилось, виконай `xcode-select --install`.

Відкрий новий термінал і перевір:

```bash
node --version
npm --version
git --version
```

Очікуємо Node `v26.9.0`, а також версії npm та Git. Якщо команда не знайдена — перезапусти термінал після встановлення.

## 2. Отримай проєкт

Передай організатору свій **GitHub username**. Прийми запрошення до приватного репозиторію та перевір, що [harness-workshop](https://github.com/genkovich/harness-workshop) відкривається в браузері.

У терміналі перейди в папку, де зберігаєш проєкти, і виконай:

```bash
git clone --branch start https://github.com/genkovich/harness-workshop.git
cd harness-workshop
npm ci
git switch -c work-01
```

Якщо Git відкриє браузер для входу — увійди тим самим GitHub-акаунтом. Пароль GitHub не працює як пароль для HTTPS: якщо браузер не відкривається, налаштуй [Git Credential Manager](https://docs.github.com/en/get-started/git-basics/caching-your-github-credentials-in-git).

Відкрий папку `harness-workshop` у редакторі. `npm ci` встановлює пакети й створює `.env`. Наявний `.env` не перезаписується.

Для локальних комітів задай своє імʼя й email:

```bash
git config user.name "Твоє імʼя"
git config user.email "твій-email@example.com"
```

Під час практики працюємо у власній локальній гілці. Відправляти коміти в репозиторій організатора не потрібно.

## 3. Підключи Groq

1. Зареєструйся в [Groq Console](https://console.groq.com/). Залиш **Free plan**.
2. Відкрий [API Keys](https://console.groq.com/keys) → **Create API Key**. Назви ключ `harness-workshop`.
3. Встав ключ у `.env` у корені проєкту:

```dotenv
GROQ_API_KEY=твій_ключ_із_Groq
GROQ_MODEL=qwen/qwen3.8-27b
APPROVED=0
```

Модель — [Qwen 3.8 27B](https://console.groq.com/docs/model/qwen/qwen3.8-27b). Groq запускає її через API; підтримка тулів дозволяє їй викликати наші функції. Суфікс `:free` до назви додавати не треба.

Ключ зберігай лише у `.env`: цей файл уже виключений із Git. Якщо проєкт був налаштований раніше на OpenRouter, додай саме `GROQ_API_KEY` і `GROQ_MODEL`; старий ключ тут не використовується.

## 4. Перевірка перед заняттям

З папки проєкту виконай:

```bash
npm run check
npm test -- --test-name-pattern "^00 "
npm start
npm run setup:check
```

`npm run check` перевіряє типи без запуску агента. `npm test` запускає готові тести; `--test-name-pattern "^00 "` вибирає лише підготовку за номером у назві. `npm start` запускає `src/main.ts`. `setup:check` окремо перевіряє звʼязок із Groq.

Має вийти:

- перевірка типів без помилок і **4 успішні тести**;
- у гілці `start` команда `npm start` друкує «TypeScript працює»;
- `setup:check` друкує **«ключ працює; tool call отримано»**.

Лише остання команда робить один запит до моделі. Тести працюють без мережі. Перевірка API не змінює твій тариф Groq і не визначає, чи акаунт уже платний.

## Якщо щось не працює

| Помилка | Що зробити |
|---|---|
| GitHub показує 404 | Прийми запрошення й перевір, що увійшов правильним акаунтом. |
| Немає `.env` | Виконай `npm run prepare`. На Windows перевір, що файл не названо `.env.txt`. |
| `401` | Звір `GROQ_API_KEY` у `.env`. |
| `403` або `404` від Groq | Звір `GROQ_MODEL` і доступ до моделі в кабінеті. |
| `429` | Перевір [Limits](https://console.groq.com/settings/limits). Якщо є `Retry-After`, зачекай зазначений час. Не запускай перевірку багато разів поспіль. |
| Немає tool call або відповідь обрізана | Передай організатору текст помилки без ключа. |

На 21.09.2026 для цієї моделі Groq Free зазначає **30 запитів/хв, 1 000/добу, 8 000 токенів/хв і 200 000/добу**. Особисті ліміти дивись у кабінеті. Один запуск агента може містити кілька запитів; коментарі та історія теж займають токени. [Документація лімітів](https://console.groq.com/docs/rate-limits).

Після успішної перевірки відкрий [етап 01](01-model.md). Якщо відставатимеш на занятті, у кінці кожної теми є команди переходу на готову контрольну гілку. Ранбуки й тести доступні в кожній гілці.

## Готовий код

У `start` ще немає агента. Файл `src/main.ts` містить:

<details>
<summary>src/main.ts</summary>

```ts
console.log('TypeScript працює.');
```

</details>

# 11. Skills

[Усі теми](README.md) · [Попередня](10-context.md) · [Наступна](12-guard.md)

**Перед початком:** код після `step-10-context`. **Результат теми:** `step-11-skills`. Змінюємо лише `src/`.

## Що робимо й навіщо

Спочатку передаємо лише описи skills. Повна інструкція потрапляє в історію після readSkill: так потрібні деталі додаються на вимогу.

## Маленькі зміни

skills/billing/SKILL.md уже лежить у заготовці. Створи src/skills.ts. Перший фрагмент:

```ts
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const directory = new URL('../skills/', import.meta.url);
```

Нижче склади список skills. Повний текст поки залишається в нашій програмі:

```ts
export const skills = readdirSync(directory)
  .filter(name => existsSync(new URL(`${name}/SKILL.md`, directory)))
  .map(name => {
    const text = readFileSync(new URL(`${name}/SKILL.md`, directory), 'utf8');
    const description = /^description: (.+)$/m.exec(text)?.[1];
    if (!description) throw new Error(`Немає description у skill ${name}`);
    return { name, description, text };
  });
```

Додай функцію читання за іменем:

```ts
export function readSkill(name: string) {
  const skill = skills.find(skill => skill.name === name);
  if (!skill) throw new Error(`Невідомий skill: ${name}`);
  return skill.text;
}
```

У src/billing/agent.ts додай імпорт і два значення поруч зі схемами:

```ts
import { skills, readSkill } from '../skills.ts';

const skillInput = z.object({ name: z.string() });
const descriptions = skills.map(skill => `${skill.name}: ${skill.description}`).join('\n');
```

Заміни context: rules на:

```ts
context: `${rules}\nSkills:\n${descriptions}`,
```

У billing.tools додай опис:

```ts
readSkill: tool({
  description: 'Прочитай повну інструкцію потрібного skill.',
  inputSchema: skillInput,
}),
```

Перед default у runTool додай виконання:

```ts
case 'readSkill': {
  const { name } = skillInput.parse(input);
  return { text: readSkill(name) };
}
```

## Перевірка

```bash
npm run check
npm test -- --test-name-pattern "^(0[0-9]|1[01]) "
npm start -- "Перевір списання клієнта 42."
```

**Автоматична перевірка:** 20 тестів без мережі. Усі тести вже є в [test/harness.test.mjs](../test/harness.test.mjs) та [test/runbooks.test.mjs](../test/runbooks.test.mjs). Число на початку назви тесту відповідає етапу; команда запускає цей і попередні етапи.

**Очікуємо:** Спочатку модель бачить опис; після readSkill — повний текст у tool result.

**Якщо не так:** Повний текст видно відразу — перевір context. Невідомий skill — передавай імʼя billing, не шлях. Для живої перевірки попроси явно прочитати billing.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 11: Skills"
```

## Якщо не встиг: готова точка й наступна тема

Ця гілка містить **результат теми 11**. Збережи свою спробу й створи робочу гілку від готового коду:

```bash
git add src
git diff --cached
git diff --cached --quiet || git commit -m "Моя спроба етапу 11"
git fetch origin
git switch -c work-12 origin/step-11-skills
npm run check
npm test -- --test-name-pattern "^(0[0-9]|1[01]) "
```

Власний коміт залишився у попередній гілці. Якщо work-12 вже існує, обери нове імʼя, наприклад work-12-retry. .env і node_modules залишаються на місці. Відкрий [ранбук 12](12-guard.md) в тому самому редакторі: усі ранбуки й тести доступні в кожній гілці.

Якщо завершив самостійно, продовжуй у своїй гілці за наступним ранбуком; брати готовий код необовʼязково.

## Готовий код

Очікуваний вміст змінених файлів після цього етапу. Інші файли залишаються як були. Маленькі кроки наведено вище.

<details>
<summary>src/billing/agent.ts</summary>

```ts
import { openrouter } from '@openrouter/ai-sdk-provider';
import { appendFile, mkdir } from 'node:fs/promises';
import { readFileSync } from 'node:fs';
import { tool } from 'ai';
import { z } from 'zod';
import charges from './charges.json' with { type: 'json' };
import { skills, readSkill } from '../skills.ts';

const customerId = z.number().int().positive();
const chargesInput = z.object({ customerId });
const replyInput = z.object({ customerId, text: z.string().min(1).max(4000) });
const skillInput = z.object({ name: z.string() });
const rules = readFileSync(new URL('../../AGENTS.md', import.meta.url), 'utf8');
const descriptions = skills
  .map((skill) => `${skill.name}: ${skill.description}`)
  .join('\n');

const system = [
  'Роль: ти агент підтримки з питань списань.',
  'Мета: перевір факти й поясни клієнту результат.',
  'Дані: списання отримуй через getCharges; не вигадуй їх.',
  'Відповідь: після перевірки використовуй sendReply.',
  'Уточнення: якщо номера клієнта немає, попроси його.',
  'Межі: не обіцяй повернення коштів; такого тула немає.',
  'Мова: українська.',
].join('\n');

// Один предметний модуль: правила підтримки, описи тулів та їхній код.
export const billing = {
  model: openrouter('openai/gpt-oss-20b'),
  system,
  context: `${rules}\nSkills:\n${descriptions}`,

  // Модель отримує ці описи. Тут немає execute: тули виконає наш цикл.
  tools: {
    getCharges: tool({
      description: 'Знайди списання клієнта.',
      inputSchema: chargesInput,
    }),
    sendReply: tool({
      description: 'Надішли відповідь після перевірки списань.',
      inputSchema: replyInput,
    }),
    readSkill: tool({
      description: 'Прочитай повну інструкцію потрібного skill.',
      inputSchema: skillInput,
    }),
  },

  async runTool(name: string, input: unknown) {
    switch (name) {
      case 'getCharges': {
        const { customerId } = chargesInput.parse(input);
        return charges.filter((charge) => charge.customerId === customerId);
      }
      case 'sendReply': {
        const reply = replyInput.parse(input);
        // Навчальна відправка: запис у файл, без реальних листів.
        await mkdir('.data', { recursive: true });
        await appendFile('.data/outbox.jsonl', JSON.stringify(reply) + '\n');
        return { status: 'saved-to-outbox' };
      }
      case 'readSkill': {
        const { name } = skillInput.parse(input);
        return { text: readSkill(name) };
      }
      default:
        throw new Error(`Невідомий тул: ${name}`);
    }
  },
};
```

</details>

<details>
<summary>src/skills.ts</summary>

```ts
import { readFileSync, readdirSync, existsSync } from 'node:fs';

// Спершу віддаємо назву й опис. Повний текст модель читає окремим тулом.
const directory = new URL('../skills/', import.meta.url);

export const skills = readdirSync(directory)
  .filter((name) => existsSync(new URL(`${name}/SKILL.md`, directory)))
  .map((name) => {
    const file = new URL(`${name}/SKILL.md`, directory);
    const text = readFileSync(file, 'utf8');
    const description = /^description: (.+)$/m.exec(text)?.[1];

    if (!description) throw new Error(`Немає description у skill ${name}`);

    return { name, description, text };
  });

export function readSkill(name: string) {
  // Обираємо зі знайдених skills, а не відкриваємо шлях від моделі.
  const skill = skills.find((skill) => skill.name === name);
  if (!skill) throw new Error(`Невідомий skill: ${name}`);
  return skill.text;
}
```

</details>


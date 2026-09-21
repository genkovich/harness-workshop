# 11. Skills

Почни з власного коду після етапу 10. Змінюй лише `src/`. Контрольна точка після виконання: `step-11-skills`. Тести й конфігурація вже готові.

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

## Запусти й перевір

```bash
npm run check
npm test -- --test-name-pattern "^(0[1-9]|1[01]) "
npm start
```

**Тести:** 11 перевірок мають пройти. Команда запускає лише вже реалізовану поведінку.

**Очікуємо:** Одинадцять тестів проходять. Спочатку модель бачить опис; після readSkill — повний текст у tool result.

**Якщо не так:** Повний текст видно відразу — перевір context. Невідомий skill — передавай імʼя billing, не шлях. Для живої перевірки попроси явно прочитати billing.

**Збережи свою зміну:**

```bash
git add src
git diff --cached
git commit -m "Етап 11: Skills"
```

Далі відкрий [етап 12 у браузері](https://github.com/genkovich/harness-workshop/blob/step-12-guard/RUNBOOK.md). Продовжуй у своїй гілці: перемикання потрібне лише щоб наздогнати групу.


import { readFileSync, readdirSync, existsSync } from 'node:fs';
import { section } from './context.ts';

// Спершу віддаємо назву й опис. Повний текст модель читає окремим тулом.
const directory = new URL('../skills/', import.meta.url);

export const skills = readdirSync(directory)
  .filter((name) => existsSync(new URL(`${name}/SKILL.md`, directory)))
  .map((name) => {
    const file = new URL(`${name}/SKILL.md`, directory);
    const text = readFileSync(file, 'utf8');
    const description = /^description: (.+)$/m.exec(text)?.[1];

    if (!description) {
      throw new Error(`Немає description у skill ${name}`);
    }

    return { name, description, text };
  });

export function readSkill(name: string) {
  // Обираємо зі знайдених skills, а не відкриваємо шлях від моделі.
  const skill = skills.find((skill) => skill.name === name);
  if (!skill) {
    throw new Error(`Невідомий skill: ${name}`);
  }
  return skill.text;
}

// Блок для першого повідомлення: лише імʼя й опис кожного skill, по рядку.
export function skillCatalog() {
  const header = 'Before working on a task that matches one of these skills, call readSkill with its name.';
  const lines = skills.map((skill) => `${skill.name}: ${skill.description}`);
  return section('skills', 'skills/', [header, ...lines].join('\n'));
}

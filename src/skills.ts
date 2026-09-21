import { readFileSync, readdirSync } from 'node:fs';

// Спершу віддаємо назву й опис. Повний текст модель читає окремим тулом.
const directory = new URL('../skills/', import.meta.url);

export const skills = readdirSync(directory).map(name => {
  const file = new URL(`${name}/SKILL.md`, directory);
  const text = readFileSync(file, 'utf8');
  const description = /^description: (.+)$/m.exec(text)?.[1];

  if (!description) throw new Error(`Немає description у skill ${name}`);

  return { name, description, text };
});

export function readSkill(name: string) {
  // Обираємо зі знайдених skills, а не відкриваємо шлях від моделі.
  const skill = skills.find(skill => skill.name === name);
  if (!skill) throw new Error(`Невідомий skill: ${name}`);
  return skill.text;
}

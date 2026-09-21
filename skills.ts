import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';
// Для практики підтримуємо простий frontmatter з двома однорядковими полями.
export function loadSkills(root = 'skills') {
  return readdirSync(root, { withFileTypes: true }).filter(d => d.isDirectory()).map(d => {
    const file = join(root, d.name, 'SKILL.md'); const text = readFileSync(file, 'utf8');
    const name = /^name: (.+)$/m.exec(text)?.[1]; const description = /^description: (.+)$/m.exec(text)?.[1];
    if (!name || !description) throw new Error(`Некоректний frontmatter: ${file}`);
    return { name, description, text };
  });
}
export function readSkill(name: string) {
  const skill = loadSkills().find(s => s.name === name);
  if (!skill) throw new Error('Невідомий skill');
  return skill.text; // Шлях від моделі не використовується.
}

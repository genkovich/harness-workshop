import { readFileSync, readdirSync } from 'node:fs';

// Читаємо лише підготовлені інструкції нашого проєкту.
export function loadContext(root = new URL('../', import.meta.url)) {
  const agentsFile = new URL('AGENTS.md', root);
  const parts = [readFileSync(agentsFile, 'utf8')];
  const rulesDirectory = new URL('rules/', root);

  // Стабільний порядок дає однаковий контекст за однакових файлів.
  const files = readdirSync(rulesDirectory, { withFileTypes: true })
    .filter(file => file.isFile() && file.name.endsWith('.md'))
    .map(file => file.name)
    .sort();

  for (const name of files) {
    const file = new URL(encodeURIComponent(name), rulesDirectory);
    const text = readFileSync(file, 'utf8');
    parts.push(`Rule: ${name}\n${text}`);
  }

  return parts.join('\n\n');
}

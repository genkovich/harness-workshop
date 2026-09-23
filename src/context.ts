import { readFileSync, readdirSync } from 'node:fs';

// Загортаємо текст у тег з назвою файла: модель бачить, де межі й звідки кожна частина.
function section(tag: string, source: string, text: string) {
  return `<${tag} source="${source}">\n${text.trim()}\n</${tag}>`;
}

// Читаємо лише підготовлені інструкції нашого проєкту.
export function loadContext(root = new URL('../', import.meta.url)) {
  const agentsFile = new URL('AGENTS.md', root);
  const parts = [section('project', 'AGENTS.md', readFileSync(agentsFile, 'utf8'))];
  const rulesDirectory = new URL('rules/', root);

  // Стабільний порядок дає однаковий контекст за однакових файлів.
  const files = readdirSync(rulesDirectory, { withFileTypes: true })
    .filter(file => file.isFile() && file.name.endsWith('.md'))
    .map(file => file.name)
    .sort();

  for (const name of files) {
    const file = new URL(encodeURIComponent(name), rulesDirectory);
    const text = readFileSync(file, 'utf8');
    parts.push(section('rule', `rules/${name}`, text));
  }

  return parts.join('\n\n');
}

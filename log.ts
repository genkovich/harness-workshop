import { appendFileSync, mkdirSync } from 'node:fs';
import { join } from 'node:path';
import type { Log } from './types.ts';
export function createLog(label: string): Log {
  const dir = process.env.RUN_DIR || 'runs';
  mkdirSync(dir, { recursive: true });
  const path = join(dir, `${label}-${Date.now()}.jsonl`);
  console.log(`Лог: ${path}. Provider: ${process.env.PROVIDER || 'groq'}`);
  return event => {
    appendFileSync(path, JSON.stringify(event) + '\n');
    if (event.event === 'wire') return; // Сирий JSON у файлі, стислий trace у терміналі.
    console.log(JSON.stringify(event, null, 2));
  };
}

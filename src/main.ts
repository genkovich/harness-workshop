import { groq } from '@ai-sdk/groq';
import { runAgent } from './harness.ts';

const task = process.argv[2]?.trim();
if (!task) {
  console.error('Помилка: передай задачу. Наприклад: npm start -- "Знайди до трьох обговорень про harness engineering і coding agents за останні 7 днів. Прочитай коментарі та збережи український дайджест із посиланнями."');
  process.exit(1);
}

try {
  const result = await runAgent(
    {
      system: 'Reply in Ukrainian.',
      model: groq(process.env.GROQ_MODEL || 'qwen/qwen3.8-27b'),
    },
    task,
  );

  if (result.text) {
    console.log(`\nВідповідь: ${result.text}`);
  }
  if (result.reason === 'limit') {
    process.exitCode = 2;
  }
} catch (error) {
  console.error('Помилка:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

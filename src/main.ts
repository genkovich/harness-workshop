import { openrouter } from '@openrouter/ai-sdk-provider';
import { runAgent } from './harness.ts';
import { billing } from './billing/agent.ts';

const task = process.argv[2]?.trim();
if (!task) {
  console.error('Помилка: передай задачу. Наприклад: npm start -- "Перевір списання клієнта 42."');
  process.exit(1);
}

try {
  const result = await runAgent(
    {
      ...billing,
      model: openrouter('openai/gpt-oss-20b'),
    },
    task,
  );

  if (result.text) console.log(`\nВідповідь: ${result.text}`);
  if (result.reason === 'limit') process.exitCode = 2;
} catch (error) {
  console.error('Помилка:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

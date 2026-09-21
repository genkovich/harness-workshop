import { groq } from '@ai-sdk/groq';
import { runAgent } from './harness.ts';
import { billing } from './billing/agent.ts';

const task = process.argv[2] || 'Клієнт 42: за вересень двічі списали гроші. Перевір і дай відповідь.';

try {
  const result = await runAgent({
    ...billing,
    model: groq('openai/gpt-oss-20b'),
  }, task);

  if (result.text) console.log(`\nВідповідь: ${result.text}`);
  if (result.reason === 'limit') process.exitCode = 2;
} catch (error) {
  console.error('Помилка:', error instanceof Error ? error.message : error);
  process.exitCode = 1;
}

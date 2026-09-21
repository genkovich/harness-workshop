import { generateText, type ModelMessage } from 'ai';
import { openrouter } from '@openrouter/ai-sdk-provider';

const model = openrouter('openai/gpt-oss-20b');

const task = process.argv[2]?.trim();
if (!task) {
  console.error('Помилка: передай задачу. Наприклад: npm start -- "Перевір списання клієнта 42."');
  process.exit(1);
}
const messages: ModelMessage[] = [{ role: 'user', content: task }];

const reply = await generateText({
  model,
  system: 'Відповідай українською.',
  messages,
  maxRetries: 0,
  maxOutputTokens: 1200,
  abortSignal: AbortSignal.timeout(60_000),
});

console.log('Причина завершення:', reply.finishReason);
console.log('Відповідь:', reply.text);

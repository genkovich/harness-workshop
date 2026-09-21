import { generateText, type ModelMessage } from 'ai';
import { groq } from '@ai-sdk/groq';

const model = groq(process.env.GROQ_MODEL || 'qwen/qwen3.8-27b');

const task = process.argv[2]?.trim();
if (!task) {
  console.error('Помилка: передай задачу. Наприклад: npm start -- "Знайди до трьох обговорень про harness engineering і coding agents за останні 7 днів. Прочитай коментарі та збережи український дайджест із посиланнями."');
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

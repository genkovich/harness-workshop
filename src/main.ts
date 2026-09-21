import { generateText } from 'ai';
import { openrouter } from '@openrouter/ai-sdk-provider';

const model = openrouter(process.env.OPENROUTER_MODEL || 'qwen/qwen3.8-27b:free');

const reply = await generateText({
  model,
  prompt: 'Привітайся українською одним реченням.',
  maxRetries: 0,
  maxOutputTokens: 1200,
  abortSignal: AbortSignal.timeout(60_000),
});

console.log('Причина завершення:', reply.finishReason);
console.log('Відповідь:', reply.text);

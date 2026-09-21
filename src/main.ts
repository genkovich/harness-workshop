import { generateText } from 'ai';
import { openrouter } from '@openrouter/ai-sdk-provider';

const model = openrouter('openai/gpt-oss-20b');

const reply = await generateText({
  model,
  prompt: 'Привітайся українською одним реченням.',
  maxRetries: 0,
  maxOutputTokens: 1200,
  abortSignal: AbortSignal.timeout(60_000),
});

console.log('Причина завершення:', reply.finishReason);
console.log('Відповідь:', reply.text);

import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';

const model = groq(process.env.GROQ_MODEL || 'qwen/qwen3.8-27b');

const reply = await generateText({
  model,
  prompt: 'Привітайся українською одним реченням.',
  maxRetries: 0,
  maxOutputTokens: 1200,
  abortSignal: AbortSignal.timeout(60_000),
});

console.log('Причина завершення:', reply.finishReason);
console.log('Відповідь:', reply.text);

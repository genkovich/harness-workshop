import { generateText } from 'ai';
import { groq } from '@ai-sdk/groq';

const maxOutputTokens = 512;
const modelTimeoutMs = 60_000;

const model = groq(process.env.GROQ_MODEL || 'qwen/qwen3.8-27b');

const reply = await generateText({
  model,
  prompt: 'Привітайся українською одним реченням.',
  maxRetries: 0,
  maxOutputTokens,
  abortSignal: AbortSignal.timeout(modelTimeoutMs),
});

console.log('Причина завершення:', reply.finishReason);
console.log('Відповідь:', reply.text);

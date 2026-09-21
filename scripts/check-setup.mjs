// Один запит до Groq перевіряє ключ, модель і виклик тула.
import { generateText, tool } from 'ai';
import { groq } from '@ai-sdk/groq';
import { z } from 'zod';

const modelId = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
try {
  if (!process.env.GROQ_API_KEY?.trim()) {
    throw new Error('Встав GROQ_API_KEY у .env. Ключ не потрібно показувати в чаті.');
  }

  const reply = await generateText({
    model: groq(modelId),
    prompt: 'Виклич ready без аргументів, щоб перевірити підключення.',
    tools: { ready: tool({
      description: 'Перевірка підключення; жодних зовнішніх дій.',
      inputSchema: z.object({}),
    }) },
    toolChoice: { type: 'tool', toolName: 'ready' },
    maxRetries: 0,
    maxOutputTokens: 2048,
    abortSignal: AbortSignal.timeout(60_000),
  });
  if (reply.finishReason === 'length') {
    throw new Error('Відповідь обрізана до tool call. Передай організатору повідомлення помилки.');
  }
  if (!reply.toolCalls.some(call => call.toolName === 'ready' && !call.invalid)) {
    throw new Error('Запит пройшов, але коректного tool call немає. Передай організатору повідомлення помилки.');
  }
  console.log(`Готово: ${modelId}; ключ працює; tool call отримано.`);
  console.log('Зроблено один запит до Groq. Можна починати етап 01.');
} catch (error) {
  const hints = {
    401: 'Перевір GROQ_API_KEY у .env та чи він не відкликаний.',
    403: 'Перевір доступ до моделі в Groq Console.',
    404: 'Звір GROQ_MODEL із доступними моделями в Groq Console.',
    429: 'Досягнуто ліміт Groq. Перевір Limits у кабінеті та зачекай перед повтором.',
  };
  console.error('Перевірка не пройшла:', hints[error?.statusCode] || error.message);
  const retryAfter = error?.responseHeaders?.['retry-after'];
  if (retryAfter) console.error(`Retry-After: ${retryAfter}`);
  process.exitCode = 1;
}

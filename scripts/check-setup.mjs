// Перевірка перед заняттям: один безкоштовний запит, без запуску навчального агента.
import { generateText, tool } from 'ai';
import { openrouter } from '@openrouter/ai-sdk-provider';
import { z } from 'zod';

const modelId = process.env.OPENROUTER_MODEL || 'qwen/qwen3.8-27b:free';
try {
  if (!process.env.OPENROUTER_API_KEY?.trim()) {
    throw new Error('Встав OPENROUTER_API_KEY у .env. Ключ не потрібно показувати в чаті.');
  }
  if (!modelId.endsWith(':free')) {
    throw new Error('Для воркшопу вибери OPENROUTER_MODEL з суфіксом :free.');
  }

  // Каталог читаємо без ключа; перевіряємо ціну й можливості до генерації.
  const response = await fetch('https://openrouter.ai/api/v1/models', {
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) throw new Error(`Каталог моделей недоступний: HTTP ${response.status}.`);
  const { data } = await response.json();
  const entry = data.find(model => model.id === modelId);
  if (!entry) throw new Error('Моделі немає в каталозі. Вибери іншу :free-модель із tools.');
  if (Number(entry.pricing.prompt) !== 0 || Number(entry.pricing.completion) !== 0) {
    throw new Error('Ціна моделі не нульова. Перевір ID із суфіксом :free.');
  }
  if (!entry.supported_parameters?.includes('tools')) {
    throw new Error('Модель не підтримує tools. Вибери іншу безкоштовну модель.');
  }

  const reply = await generateText({
    model: openrouter(modelId),
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
    throw new Error('Модель витратила ліміт токенів до tool call. Спробуй іншу :free-модель.');
  }
  if (!reply.toolCalls.some(call => call.toolName === 'ready' && !call.invalid)) {
    throw new Error('Запит пройшов, але коректного tool call немає. Спробуй іншу :free-модель.');
  }
  console.log(`Готово: ${modelId}; ключ працює; tool call отримано.`);
  console.log('Зроблено один запит до безкоштовної моделі. Можна починати етап 01.');
} catch (error) {
  const status = error?.statusCode;
  const hints = {
    401: 'Перевір ключ у .env та чи він не відкликаний.',
    402: 'Звір ID :free, стан ключа й повідомлення OpenRouter; поповнювати баланс для практики не потрібно.',
    404: 'Модель або відповідний провайдер недоступні. Вибери іншу :free-модель із tools.',
    429: 'Ліміт запитів або навантаження провайдера. Прочитай помилку й зроби паузу; поки працюй із тестами.',
  };
  console.error('Перевірка не пройшла:', hints[status] || error.message);
  process.exitCode = 1;
}

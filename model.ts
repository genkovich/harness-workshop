import { generateText, type ModelMessage, type ToolSet } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { createGoogleGenerativeAI } from '@ai-sdk/google';
import { SYSTEM } from './system-prompt.ts';
import { withRetry } from './retry.ts';
import type { Log, Reply } from './types.ts';

function selectModel() {
  const provider = process.env.PROVIDER || 'groq';
  if (provider === 'mock') {
    const url = process.env.MOCK_URL || '';
    if (!/^http:\/\/127\.0\.0\.1:\d+\/v1$/.test(url)) throw new Error('Mock запускається лише командою npm run demo.');
    return createGroq({ apiKey: 'local-demo-only', baseURL: url })('workshop-mock');
  }
  if (provider === 'groq') {
    if (!process.env.GROQ_API_KEY) throw new Error('Заповни GROQ_API_KEY у .env або запусти npm run demo.');
    return createGroq({ apiKey: process.env.GROQ_API_KEY })(process.env.GROQ_MODEL || 'openai/gpt-oss-20b');
  }
  if (provider === 'gemini') {
    if (!process.env.GEMINI_API_KEY) throw new Error('Заповни GEMINI_API_KEY у .env.');
    return createGoogleGenerativeAI({ apiKey: process.env.GEMINI_API_KEY })(process.env.GEMINI_MODEL || 'gemini-2.5-flash');
  }
  throw new Error(`Невідомий PROVIDER: ${provider}`);
}

export async function callModel(messages: ModelMessage[], tools: ToolSet, log: Log, step: number): Promise<Reply> {
  const model = selectModel();
  const started = Date.now();
  log({ event: 'request', step, provider: process.env.PROVIDER || 'groq', model: model.modelId, messagesCount: messages.length, system: SYSTEM, messages });
  // Один generateText. SDK не отримує execute і не тримає агентний цикл.
  const reply = await withRetry(() => generateText({ model, system: SYSTEM, messages, tools,
    include: { requestBody: true, responseBody: true },
    maxRetries: 0, maxOutputTokens: 1200, abortSignal: AbortSignal.timeout(60_000) }),
    ms => log({ event: 'retry', step, waitMs: ms }));
  // Тіло реального запиту SDK: без заголовків авторизації.
  log({ event: 'wire', step, request: reply.request.body, response: reply.response.body });
  log({ event: 'response', step, elapsedMs: Date.now() - started, usage: reply.usage, finishReason: reply.finishReason, text: reply.text, calls: reply.toolCalls });
  if (reply.finishReason === 'length') throw new Error('Відповідь обрізано. Потенційно неповні аргументи не виконуємо.');
  return { text: reply.text, messages: reply.response.messages,
    calls: reply.toolCalls.map(c => ({ id: c.toolCallId, name: c.toolName, arguments: c.input })) };
}

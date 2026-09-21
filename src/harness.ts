import {
  generateText,
  APICallError,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
  type JSONValue,
  type TypedToolCall,
} from 'ai';

const maxOutputTokens = 512;
const modelTimeoutMs = 60_000;

const defaultMaxSteps = 10;
const maxRateLimitRetries = 2;
const maxRetryDelayMs = 60_000;
const retrySafetyMs = 1_000;
const millisecondsPerSecond = 1_000;


type ToolCall = TypedToolCall<ToolSet>;

export type Agent = {
  model: LanguageModel;
  system: string;
  tools: ToolSet;
  runTool: (name: string, input: unknown) => Promise<JSONValue>;
  context?: string;
  maxSteps?: number;
};

export async function runAgent(agent: Agent, task: string) {
  const messages: ModelMessage[] = [
    { role: 'user', content: `${agent.context || ''}\n${task}`.trim() },
  ];

  for (let step = 1; step <= (agent.maxSteps ?? defaultMaxSteps); step++) {
    console.log(`\nКрок ${step}. Повідомлень у запиті: ${messages.length}.`);

    const reply = await requestModel(agent, messages);

    if (process.env.TRACE === '1') {
      console.log('HTTP-запит:', reply.finalStep.request.body);
    }
    if (reply.finishReason === 'length') {
      throw new Error('Відповідь обрізано. Тули не виконуємо.');
    }

    // Немає запитів на тули: модель уже дала фінальну відповідь.
    if (reply.toolCalls.length === 0) {
      console.log('Зупинка: модель відповіла без виклику тула.');
      return { reason: 'final', text: reply.text, messages };
    }

    addAssistantMessages(messages, reply.responseMessages);

    for (const call of reply.toolCalls) {
      console.log(`Модель просить ${call.toolName}:`, call.input);
      const result = await executeTool(agent, call);

      console.log(`Результат ${call.toolName}:`, result);
      addToolResult(messages, call, result);
    }

    console.log(`Додали результати. Повідомлень в історії: ${messages.length}.`);
  }

  console.log('Зупинка: досягли ліміту кроків. Задача може бути незавершена.');
  return { reason: 'limit', text: '', messages };
}

async function executeTool(agent: Agent, call: ToolCall): Promise<JSONValue> {
  try {
    // Не передаємо виконавцю виклик, який SDK позначив некоректним.
    if (call.invalid) {
      throw call.error;
    }

    // await потрібен, щоб catch перехопив і помилку асинхронної функції.
    return await agent.runTool(call.toolName, call.input);
  } catch (error) {
    // Помилку повертаємо як дані для наступного запиту моделі.
    if (error instanceof Error) {
      return { error: error.message };
    }

    return { error: String(error) };
  }
}

function addAssistantMessages(
  messages: ModelMessage[],
  responseMessages: ModelMessage[],
) {
  for (const message of responseMessages) {
    if (message.role === 'assistant') {
      messages.push(message);
    }
  }
}

function addToolResult(
  messages: ModelMessage[],
  call: ToolCall,
  result: JSONValue,
) {
  messages.push({
    role: 'tool',
    content: [
      {
        type: 'tool-result',
        toolCallId: call.toolCallId,
        toolName: call.toolName,
        output: {
          type: 'json',
          value: result,
        },
      },
    ],
  });
}

async function requestModel(agent: Agent, messages: ModelMessage[]) {
  let retries = 0;

  while (true) {
    try {
      return await generateText({
        model: agent.model,
        system: agent.system,
        messages,
        tools: agent.tools,
        maxRetries: 0,
        maxOutputTokens,
        abortSignal: AbortSignal.timeout(modelTimeoutMs),
        include: { requestBody: true },
      });
    } catch (error) {
      const waitMs = getRetryDelayMs(error);
      if (waitMs === null || retries >= maxRateLimitRetries) {
        throw error;
      }

      retries += 1;
      const seconds = Math.ceil(waitMs / millisecondsPerSecond);
      console.log(`Groq 429: чекаємо ${seconds} с. Повтор ${retries}/${maxRateLimitRetries} з тією самою історією.`);
      await new Promise(resolve => setTimeout(resolve, waitMs));
    }
  }
}

function getRetryDelayMs(error: unknown): number | null {
  if (!APICallError.isInstance(error) || error.statusCode !== 429) {
    return null;
  }

  // Завеликий запит не стане меншим після паузи.
  if (/request too large|expected output tokens exceed/i.test(error.message)) {
    return null;
  }

  let seconds = Number(error.responseHeaders?.['retry-after']);
  if (!Number.isFinite(seconds)) {
    const match = /try again in ([\d.]+)s/i.exec(error.message);
    seconds = Number(match?.[1]);
  }

  const waitMs = Math.ceil(seconds * millisecondsPerSecond) + retrySafetyMs;
  if (!Number.isFinite(seconds) || seconds < 0 || waitMs > maxRetryDelayMs) {
    return null;
  }

  return waitMs;
}

import {
  generateText,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
  type JSONValue,
  type TypedToolCall,
} from 'ai';

const maxOutputTokens = 512;
const modelTimeoutMs = 60_000;

const defaultMaxSteps = 10;

type ToolCall = TypedToolCall<ToolSet>;

export type Agent = {
  model: LanguageModel;
  system: string;
  tools: ToolSet;
  runTool: (name: string, input: unknown) => Promise<JSONValue>;
  context?: string;
  beforeTool?: (name: string) => string | null;
  maxSteps?: number;
};

// Історія починається з одного user-повідомлення: спершу контекст проєкту, в кінці задача.
// Далі цикл лише дописує відповіді моделі й результати тулів, а цей початок не змінюється.
function firstMessage(agent: Agent, task: string): ModelMessage {
  const parts = agent.context ? [agent.context] : [];
  parts.push(`<task>\n${task}\n</task>`);
  return { role: 'user', content: parts.join('\n\n') };
}

export async function runAgent(agent: Agent, task: string) {
  const messages: ModelMessage[] = [firstMessage(agent, task)];

  for (let step = 1; step <= (agent.maxSteps ?? defaultMaxSteps); step++) {
    console.log(`\nКрок ${step}. Повідомлень у запиті: ${messages.length}.`);

    const reply = await generateText({
      model: agent.model,
      system: agent.system,
      messages,
      tools: agent.tools,
      maxRetries: 2,
      maxOutputTokens,
      abortSignal: AbortSignal.timeout(modelTimeoutMs),
      include: { requestBody: true },
    });

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

    const blocked = agent.beforeTool?.(call.toolName);
    if (blocked) {
      throw new Error(blocked);
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

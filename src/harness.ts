import {
  generateText,
  type LanguageModel,
  type ModelMessage,
  type ToolSet,
  type JSONValue,
} from 'ai';

export type Agent = {
  model: LanguageModel;
  system: string;
  tools: ToolSet;
  runTool: (name: string, input: unknown) => Promise<JSONValue>;
  context?: string;
  beforeTool?: (name: string) => string | null;
  maxSteps?: number;
};

export async function runAgent(agent: Agent, task: string) {
  const messages: ModelMessage[] = [
    { role: 'user', content: `${agent.context || ''}\n${task}`.trim() },
  ];

  for (let step = 1; step <= (agent.maxSteps ?? 10); step++) {
    console.log(`\nКрок ${step}. Повідомлень у запиті: ${messages.length}.`);

    const reply = await generateText({
      model: agent.model,
      system: agent.system,
      messages,
      tools: agent.tools,
      maxRetries: 0,
      maxOutputTokens: 1200,
      abortSignal: AbortSignal.timeout(60_000),
      include: { requestBody: true },
    });

    if (process.env.TRACE === '1') {
      console.log('HTTP-запит:', reply.request.body);
    }
    if (reply.finishReason === 'length') {
      throw new Error('Відповідь обрізано. Тули не виконуємо.');
    }

    // Немає запитів на тули: модель уже дала фінальну відповідь.
    if (reply.toolCalls.length === 0) {
      console.log('Зупинка: модель відповіла без виклику тула.');
      return { reason: 'final', text: reply.text, messages };
    }

    // Спочатку запит моделі на виклик тула, потім наш результат.
    // Беремо лише assistant: помилки тулів повертаємо нижче самі.
    messages.push(
      ...reply.response.messages.filter((message) => message.role === 'assistant'),
    );

    for (const call of reply.toolCalls) {
      console.log(`Модель просить ${call.toolName}:`, call.input);
      let result;

      try {
        // SDK перевірив аргументи за схемою. Некоректний виклик не виконуємо.
        if (call.invalid) {
          throw call.error;
        }
        const blocked = agent.beforeTool?.(call.toolName);
        if (blocked) {
          throw new Error(blocked);
        }

        // Виконання відбувається в нашій програмі, після перевірки дозволу.
        result = await agent.runTool(call.toolName, call.input);
      } catch (error) {
        // Помилка теж результат: модель отримає її в наступному запиті.
        result = { error: error instanceof Error ? error.message : String(error) };
      }

      console.log(`Результат ${call.toolName}:`, result);
      messages.push({
        role: 'tool',
        content: [
          {
            type: 'tool-result',
            toolCallId: call.toolCallId,
            toolName: call.toolName,
            output: { type: 'json', value: result },
          },
        ],
      });
    }

    console.log(`Додали результати. Повідомлень в історії: ${messages.length}.`);
  }

  console.log('Зупинка: досягли ліміту кроків. Задача може бути незавершена.');
  return { reason: 'limit', text: '', messages };
}

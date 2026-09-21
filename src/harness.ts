import {
  generateText,
  type LanguageModel,
  type ModelMessage,
} from 'ai';

const maxOutputTokens = 512;
const modelTimeoutMs = 60_000;

export type Agent = {
  model: LanguageModel;
  system: string;
};

export async function runAgent(agent: Agent, task: string) {
  const messages: ModelMessage[] = [{ role: 'user', content: task }];

  console.log(`\nОдин запит. Повідомлень у запиті: ${messages.length}.`);

  const reply = await generateText({
    model: agent.model,
    system: agent.system,
    messages,
    maxRetries: 0,
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

  console.log('Модель відповіла. Це один запит без тулів.');
  return { reason: 'final', text: reply.text, messages };
}

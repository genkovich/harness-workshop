import { tool } from 'ai';
import { z } from 'zod';

const customerId = z.number().int().positive();
const chargesInput = z.object({ customerId });
const replyInput = z.object({ customerId, text: z.string().min(1).max(4000) });

// Один предметний модуль: правила підтримки, описи тулів та їхній код.
export const billing = {
  system:
    'Ти агент підтримки. Перевір списання через getCharges, ' +
    'потім відповідай через sendReply. ' +
    'Якщо дію заблоковано, попроси дозвіл.',

  // Модель отримує ці описи. Тут немає execute: тули виконає наш цикл.
  tools: {
    getCharges: tool({
      description: 'Знайди списання клієнта.',
      inputSchema: chargesInput,
    }),
    sendReply: tool({
      description: 'Надішли відповідь після перевірки списань.',
      inputSchema: replyInput,
    }),
  },

};

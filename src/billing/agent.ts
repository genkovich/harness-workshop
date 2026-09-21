import { appendFile, mkdir } from 'node:fs/promises';
import { tool } from 'ai';
import { z } from 'zod';
import charges from './charges.json' with { type: 'json' };

const customerId = z.number().int().positive();
const chargesInput = z.object({ customerId });
const replyInput = z.object({ customerId, text: z.string().min(1).max(4000) });

// Один предметний модуль: правила підтримки, описи тулів та їхній код.
export const billing = {
  system: 'Ти агент підтримки. Перевір списання через getCharges, потім відповідай через sendReply. Якщо дію заблоковано, попроси дозвіл.',

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

  async runTool(name: string, input: unknown) {
    switch (name) {
      case 'getCharges': {
        const { customerId } = chargesInput.parse(input);
        return charges.filter(charge => charge.customerId === customerId);
      }
      case 'sendReply': {
        const reply = replyInput.parse(input);
        // Навчальна відправка: запис у файл, без реальних листів.
        await mkdir('.data', { recursive: true });
        await appendFile('.data/outbox.jsonl', JSON.stringify(reply) + '\n');
        return { status: 'saved-to-outbox' };
      }
      default:
        throw new Error(`Невідомий тул: ${name}`);
    }
  },

};

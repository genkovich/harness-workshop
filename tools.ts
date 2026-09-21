import { readSkill } from './skills.ts';
import { tool } from 'ai';
import { z } from 'zod';
import { readFile, mkdir, appendFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Call } from './types.ts';

const skillInput = z.object({ name: z.string().describe('Імʼя skill із переліку в контексті') });
export const readSkillTool = tool({ description: 'Прочитай повний текст потрібного skill.', inputSchema: skillInput });
const customer = z.number().int().positive().describe('Числовий ID клієнта із задачі');
const chargesInput = z.object({ customerId: customer });
const replyInput = z.object({ customerId: customer, text: z.string().min(1).max(4000).describe('Готова відповідь клієнту українською') });
export const SEND_REPLY_DESCRIPTION = 'Надішли клієнту відповідь після перевірки списань.';
// Тут лише описи. execute відсутній: тули запускає наш runtime.ts.
export const tools = {
  readSkill: readSkillTool,
  getCharges: tool({ description: 'Поверни списання клієнта з локальних навчальних даних.', inputSchema: chargesInput }),
  sendReply: tool({ description: SEND_REPLY_DESCRIPTION, inputSchema: replyInput }),
};

export async function runTool(call: Call) {
  switch (call.name) {
    case 'readSkill': return { text: readSkill(skillInput.parse(call.arguments).name) };
    case 'getCharges': {
      const { customerId } = chargesInput.parse(call.arguments);
      const charges = JSON.parse(await readFile(new URL('./charges.json', import.meta.url), 'utf8'));
      return charges.filter((c: { customerId: number }) => c.customerId === customerId);
    }
    case 'sendReply': {
      const reply = replyInput.parse(call.arguments);
      const dir = process.env.DATA_DIR || '.data';
      await mkdir(dir, { recursive: true });
      // Навчальна відправка: запис у файл, жодних листів реальним людям.
      await appendFile(join(dir, 'outbox.jsonl'), JSON.stringify(reply) + '\n');
      return { status: 'saved-to-outbox', customerId: reply.customerId };
    }
    default: throw new Error(`Невідомий тул: ${call.name}`);
  }
}

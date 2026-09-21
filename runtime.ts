import { readFileSync } from 'node:fs';
import { loadSkills } from './skills.ts';
import type { ModelMessage } from 'ai';
import { callModel } from './model.ts';
import { tools, runTool } from './tools.ts';
import type { Call, Log, ModelCall } from './types.ts';
export const MAX_STEPS = 10;
export function beforeTool(call: Call): string | null {
  if (call.name === 'sendReply' && process.env.APPROVED !== '1') return 'blocked, ask the user';
  return null;
}

export async function runAgent(task: string, log: Log, model: ModelCall = callModel, maxSteps = MAX_STEPS) {
  const rules = readFileSync('AGENTS.md', 'utf8');
  const skillList = loadSkills().map(s => `${s.name}: ${s.description}`).join('\n');
  const messages: ModelMessage[] = [{ role: 'user', content: `${rules}\nSkills:\n${skillList}\n\n${task}` }];
  for (let step = 1; step <= maxSteps; step++) {
    const reply = await model(messages, tools, log, step);
    if (reply.calls.length === 0) {
      log({ event: 'stop', reason: 'final', step, text: reply.text });
      return { reason: 'final', text: reply.text };
    }
    messages.push(...reply.messages);
    for (const call of reply.calls) {
      const blocked = beforeTool(call);
      let result;
      try { result = blocked ? { error: blocked } : await runTool(call); }
      catch (error) { result = { error: error instanceof Error ? error.message : String(error) }; }
      log({ event: blocked ? 'blocked' : 'tool-result', step, call, result });
      messages.push({ role: 'tool', content: [{ type: 'tool-result', toolCallId: call.id,
        toolName: call.name, output: { type: 'json', value: result } }] });
    }
  }
  log({ event: 'stop', reason: 'max-steps', limit: maxSteps });
  return { reason: 'max-steps', text: '' };
}

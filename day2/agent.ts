'use agent';
import { useModel, useTool, useSkill, useResponseFinish, type AgentProps } from '@flue/runtime';
import { toolsForChat } from './tools.ts';
import { standup } from './skill.ts';
export function Assistant({ id }: AgentProps) {
  useModel('google/gemini-2.5-flash');
  for (const tool of toolsForChat(id)) useTool(tool);
  useSkill(standup);
  useResponseFinish(({ response }) => {
    console.log(JSON.stringify({ event: 'usage', totalTokens: response.usage.totalTokens }));
  });
  return 'Відповідай українською. Зберігай і шукай нотатки через тули. Для стендапу активуй skill. Не стверджуй, що запис успішний, без результату тула.';
}
Assistant.agentName = 'workshop-assistant';

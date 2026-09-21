'use agent';
import { useModel, type AgentProps } from '@flue/runtime';
export function Assistant(_props: AgentProps) {
  useModel('google/gemini-2.5-flash');
  // Кроки 2–6: власна інструкція, тули, права, usage і skill.
  return 'Відповідай українською.';
}
Assistant.agentName = 'workshop-assistant';

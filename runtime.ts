import type { Call, Log, ModelCall } from './types.ts';
export const MAX_STEPS = 10;
export function beforeTool(_call: Call): string | null { return null; }

export async function runAgent(_task: string, _log: Log, _model?: ModelCall, _maxSteps = MAX_STEPS) {
  // TODO: запит до моделі, її відповідь, виконання тулів, результат в історію.
  throw new Error('Цикл ще не написаний. Відкрий крок 2 у RUNBOOK.md або гілку step-1-loop.');
}

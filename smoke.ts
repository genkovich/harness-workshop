import { callModel } from './model.ts';
import { createLog } from './log.ts';
try {
  const result = await callModel([{ role: 'user', content: 'Відповідай одним словом: працює.' }], {}, createLog('smoke'), 1);
  if (!result.text || result.calls.length) throw new Error('Smoke очікує текст без тулів.');
  console.log('SMOKE PASS:', result.text);
} catch (error) { console.error(error instanceof Error ? error.message : String(error)); process.exitCode = 1; }

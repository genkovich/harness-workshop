import { readFile } from 'node:fs/promises';
import { runAgent } from './runtime.ts';
import { createLog } from './log.ts';
const log = createLog('agent');
try {
  const result = await runAgent(await readFile('TASK.md', 'utf8'), log);
  if (result.reason !== 'final') process.exitCode = 2;
} catch (error) {
  log({ event: 'stop', reason: 'error', message: error instanceof Error ? error.message : String(error) });
  process.exitCode = 1;
}

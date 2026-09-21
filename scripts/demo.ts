import { spawn } from 'node:child_process';
import { startMock } from './mock-server.ts';
const server = await startMock({ obeyDescription: process.env.MOCK_OBEY_DESCRIPTION === '1' });
console.log('ДЕМО: локальний HTTP-сервер і задані відповіді. Це не оцінювання LLM.');
try {
  const mode = process.argv[2] === 'smoke' ? 'smoke.ts' : 'cli.ts';
  const child = spawn(process.execPath, ['--import', 'tsx', '--env-file-if-exists=.env', mode], {
    stdio: 'inherit', env: { ...process.env, PROVIDER: 'mock', MOCK_URL: server.url },
  });
  process.exitCode = await new Promise<number>(resolve => child.once('exit', code => resolve(code ?? 1)));
} finally { await server.close(); }

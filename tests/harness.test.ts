import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { startMock } from '../scripts/mock-server.ts';
import { runAgent } from '../runtime.ts';
import { runTool } from '../tools.ts';
import { callModel } from '../model.ts';
import { retryDelay } from '../retry.ts';
import type { Event } from '../types.ts';

async function fixture(options = {}) {
  const server = await startMock(options);
  const dir = await mkdtemp(join(tmpdir(), 'harness-workshop-'));
  process.env.APPROVED = '1'; process.env.PROVIDER = 'mock'; process.env.MOCK_URL = server.url; process.env.DATA_DIR = dir;
  return { ...server, dir };
}

test('SDK HTTP → наш цикл → реальні дані й outbox; історія 1, 3, 5', async () => {
  const f = await fixture(); const events: Event[] = [];
  try {
    const result = await runAgent('Клієнт 42: двічі списали', e => events.push(e));
    assert.equal(result.reason, 'final');
    assert.deepEqual(events.filter(e => e.event === 'request').map(e => e.messagesCount), [1, 3, 5]);
    const payload = f.requests[0]; assert.equal(payload.messages[0].role, 'system');
    assert.ok(payload.tools.some((t: any) => t.function.name === 'getCharges')); assert.ok(payload.tools.some((t: any) => t.function.name === 'sendReply'));
    const second = f.requests[1].messages;
    assert.equal(second[2].tool_calls[0].id, second[3].tool_call_id);
    assert.equal(JSON.parse(second[3].content).length, 2);
    const outbox = (await readFile(join(f.dir, 'outbox.jsonl'), 'utf8')).trim().split('\n');
    assert.equal(outbox.length, 1); assert.equal(JSON.parse(outbox[0]).customerId, 42);
  } finally { await f.close(); }
});
test('нескінченні tool calls зупиняє maxSteps', async () => {
  const f = await fixture({ loop: true });
  try { assert.equal((await runAgent('повтор', () => {}, callModel, 2)).reason, 'max-steps'); assert.equal(f.requests.length, 2); }
  finally { await f.close(); }
});
test('паралельні виклики отримують окремі результати з правильними id', async () => {
  const f = await fixture({ parallel: true });
  try { await runAgent('два клієнти', () => {});const m=f.requests[1].messages;assert.deepEqual(m.filter((x:any)=>x.role==='tool').map((x:any)=>x.tool_call_id),m[2].tool_calls.map((x:any)=>x.id)); }
  finally { await f.close(); }
});

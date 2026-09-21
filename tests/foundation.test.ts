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

test('429 повторює тільки модель; 401 не повторюється', async () => {
  for(const code of [429,401]) { const f=await fixture({failOnce:code});const events:Event[]=[];
    try {if(code===429){await callModel([{role:'user',content:'smoke'}],{},e=>events.push(e),1);assert.equal(f.requests.length,2);assert.equal(events.filter(e=>e.event==='retry').length,1)}else{await assert.rejects(()=>callModel([{role:'user',content:'smoke'}],{},()=>{},1));assert.equal(f.requests.length,1)}}finally{await f.close()}
  }
});
test('невідомий тул і некоректні аргументи не створюють outbox', async () => {
  await assert.rejects(()=>runTool({id:'x',name:'unknown',arguments:{}}),/Невідомий/);
  await assert.rejects(()=>runTool({id:'x',name:'sendReply',arguments:{customerId:'42',text:''}}));
});
test('Retry-After: секунди, дата, відсутній заголовок',()=>{
 assert.equal(retryDelay('2'),2000);assert.equal(retryDelay('Thu, 01 Jan 1970 00:00:04 GMT',1000),3000);assert.equal(retryDelay(undefined),1000);
});

test('wire містить фактичні тіла HTTP, без заголовків авторизації', async () => {
 const f=await fixture(); const events:Event[]=[];
 try {
  await callModel([{role:'user',content:'smoke'}],{},e=>events.push(e),1);
  const wire=events.find(e=>e.event==='wire')!;
  assert.deepEqual(JSON.parse(wire.request as string), f.requests[0]);
  assert.ok(wire.response);
  assert.ok(!JSON.stringify(wire).includes('local-demo-only'));
 } finally { await f.close(); }
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, access } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runAgent } from '../runtime.ts';
import { startMock } from '../scripts/mock-server.ts';
import { loadSkills, readSkill } from '../skills.ts';
import { runTool } from '../tools.ts';

test('описи skills є в першому запиті, повний текст читає окремий тул',async()=>{
 const server=await startMock();process.env.PROVIDER='mock';process.env.MOCK_URL=server.url;process.env.APPROVED='0';
 try {await runAgent('Клієнт 42',()=>{});const first=server.requests[0].messages[1].content;assert.match(first,/Дякуємо за звернення/);assert.match(first,/billing:/);assert.doesNotMatch(first,/Назви конкретні суми/);const content=await runTool({id:'s',name:'readSkill',arguments:{name:'billing'}});assert.match(JSON.stringify(content),/Назви конкретні суми/)}finally{await server.close()}
});
test('skill обирається за відомим імʼям, довільний шлях не читається',()=>{
 assert.equal(loadSkills().length,2);assert.throws(()=>readSkill('../../.env'),/Невідомий/);
});

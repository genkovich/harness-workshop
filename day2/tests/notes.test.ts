import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { saveNote, searchNotes, deleteNotes, readNotes } from '../notes.ts';
import { toolsForChat } from '../tools.ts';
import { answer } from '../bridge.ts';
import { start, sqlite } from '@flue/runtime/node';
import { Assistant } from '../agent.ts';

test('запис на диску; пошук і видалення не зачіпають чужий чат',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'harness-notes-'));process.env.NOTES_FILE=join(dir,'notes.json');process.env.OWNER_CHAT_ID='42';
 saveNote('42','Моя зустріч');saveNote('7','Чужа зустріч');
 assert.equal(JSON.parse(await readFile(process.env.NOTES_FILE,'utf8')).length,2);
 assert.equal(searchNotes('42','зустріч').length,1);assert.equal(searchNotes('7','зустріч')[0].text,'Чужа зустріч');
 assert.throws(()=>deleteNotes('7'),/власнику/);assert.equal(readNotes().length,2);
 assert.deepEqual(deleteNotes('42'),{deleted:1});assert.equal(readNotes()[0].chatId,'7');
});
test('чужий chat id не має deleteNotes у змонтованому наборі',()=>{
 process.env.OWNER_CHAT_ID='42';assert.deepEqual(toolsForChat('7').map(t=>t.name),['saveNote','searchNotes']);assert.ok(toolsForChat('42').some(t=>t.name==='deleteNotes'));
});
test('місток передає той самий receipt у read і зберігає chat id',async()=>{
 const receipt={id:'r'};let seen='';const text=await answer('42','привіт',id=>{seen=id;return{dispatch:async t=>{assert.equal(t,'привіт');return receipt},read:async r=>{assert.equal(r,receipt);return{text:'відповідь'}}}});assert.equal(seen,'42');assert.equal(text,'відповідь');
});
test('Flue реєструє агента і запускає SQLite без ключів та запитів до моделі',async()=>{
 const runtime=await start({agents:[Assistant],db:sqlite(':memory:')});await runtime.stop();
});

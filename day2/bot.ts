import { Bot } from 'grammy';
import { init } from '@flue/runtime';
import { sqlite, start } from '@flue/runtime/node';
import { Assistant } from './agent.ts';
import { answer } from './bridge.ts';
if (!process.env.TELEGRAM_BOT_TOKEN || !process.env.GEMINI_API_KEY) throw new Error('Заповни TELEGRAM_BOT_TOKEN та GEMINI_API_KEY у day2/.env.');
const runtime = await start({ agents: [Assistant], db: sqlite('./bot.db') });
const bot = new Bot(process.env.TELEGRAM_BOT_TOKEN);
bot.on('message:text', async ctx => {
  if (ctx.chat.type !== 'private') return;
  const id = String(ctx.chat.id); console.log('chat id:', id);
  if (ctx.message.text === '/start') { await ctx.reply('Готовий. Chat id надруковано в терміналі лектора.'); return; }
  const started = Date.now();
  const text = await answer(id, ctx.message.text, id => init(Assistant, { id }));
  await ctx.reply(text.slice(0, 4000));
  console.log(JSON.stringify({ event: 'reply', chatId: id, elapsedMs: Date.now() - started }));
});
bot.catch(error => console.error('Помилка обробки повідомлення:', error.error instanceof Error ? error.error.name : 'unknown'));
for (const signal of ['SIGINT', 'SIGTERM'] as const) process.once(signal, () => { bot.stop(); });
try { await bot.start(); } finally { await runtime.stop(); }

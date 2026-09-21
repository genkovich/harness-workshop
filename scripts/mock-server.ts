import { createServer } from 'node:http';
import type { AddressInfo } from 'node:net';
// Це локальна симуляція HTTP-відповідей. Жодної моделі або зовнішньої мережі.
export async function startMock(options: { loop?: boolean; parallel?: boolean; obeyDescription?: boolean; failOnce?: number } = {}) {
  const requests: any[] = [];
  let failed = false;
  const server = createServer(async (req, res) => {
    let raw = ''; for await (const chunk of req) raw += chunk;
    try {
      const body = JSON.parse(raw); requests.push(body);
      if (options.failOnce && !failed) { failed = true; res.writeHead(options.failOnce, { 'content-type': 'application/json', 'retry-after': '0' }); res.end(JSON.stringify({ error: { message: 'Навчальна помилка' } })); return; }
      const messages = body.messages || [];
      const results = messages.filter((m: any) => m.role === 'tool');
      const replyDescription = body.tools?.find((t: any) => t.function.name === 'sendReply')?.function.description || '';
      let calls: any[] = [];
      let text = 'Працює.';
      const call = (name: string, args: unknown, suffix = '') => ({ id: `call_${results.length + 1}${suffix}`, type: 'function', function: { name, arguments: JSON.stringify(args) } });
      if (body.tools?.length) {
        if (results.some((r: any) => String(r.content).includes('blocked'))) text = 'Потрібен дозвіл на відправку. Запис не виконано.';
        else if (results.length === 0 || options.loop) {
          calls = [call('getCharges', { customerId: 42 })];
          if (options.parallel) calls.push(call('getCharges', { customerId: 7 }, '_b'));
        } else if (results.length === 1 && !(options.obeyDescription && replyDescription === 'never call this')) {
          calls = [call('sendReply', { customerId: 42, text: 'Дякуємо за звернення. Бачу два списання по $49. Передамо запит на перевірку.' })];
        } else text = options.obeyDescription ? 'Підготував відповідь без sendReply.' : 'Відповідь записано в навчальний outbox.';
      }
      res.writeHead(200, { 'content-type': 'application/json' });
      res.end(JSON.stringify({ id: 'mock-completion', object: 'chat.completion', created: 0, model: 'workshop-mock',
        choices: [{ index: 0, message: { role: 'assistant', content: calls.length ? null : text, ...(calls.length ? { tool_calls: calls } : {}) }, finish_reason: calls.length ? 'tool_calls' : 'stop' }],
        usage: { prompt_tokens: 0, completion_tokens: 0, total_tokens: 0 } }));
    } catch { res.writeHead(400); res.end('Некоректний навчальний запит'); }
  });
  await new Promise<void>(resolve => server.listen(0, '127.0.0.1', resolve));
  return { url: `http://127.0.0.1:${(server.address() as AddressInfo).port}/v1`, requests,
    close: () => new Promise<void>((resolve, reject) => { server.close(e => e ? reject(e) : resolve()); server.closeAllConnections(); }) };
}

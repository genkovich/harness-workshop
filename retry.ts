import { APICallError } from 'ai';
export function retryDelay(value: string | undefined, now = Date.now()) {
  if (!value) return 1000;
  const seconds = Number(value);
  if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
  const date = Date.parse(value);
  return Number.isFinite(date) ? Math.max(0, date - now) : 1000;
}
// Повторюємо лише 429, не більше двох разів. Тули тут не виконуються.
export async function withRetry<T>(fn: () => Promise<T>, onRetry: (ms: number) => void,
  sleep = (ms: number) => new Promise<void>(r => setTimeout(r, ms))) {
  for (let attempt = 0; ; attempt++) {
    try { return await fn(); }
    catch (error) {
      if (!APICallError.isInstance(error) || error.statusCode !== 429 || attempt >= 2) throw error;
      const ms = retryDelay(error.responseHeaders?.['retry-after']);
      // Не повторюємо раніше за Retry-After, навіть якщо очікування довге.
      if (ms > 120_000) throw new Error(`Сервер просить зачекати ${Math.ceil(ms / 1000)} с. Запусти пізніше.`);
      onRetry(ms); await sleep(ms);
    }
  }
}

// Маленький місток: окрема функція дозволяє перевірити його без Telegram.
export async function answer(chatId: string, text: string,
  makeHandle: (id: string) => { dispatch(text: string): Promise<any>; read(receipt: any): Promise<{ text: string }> }) {
  const agent = makeHandle(chatId);
  const receipt = await agent.dispatch(text);
  const reply = await agent.read(receipt);
  return reply.text || 'Модель не повернула текст. Перевір лог.';
}

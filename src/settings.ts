// Налаштування читає код. У повідомлення моделі цей обʼєкт не додаємо.
export function loadSettings() {
  // Лише явне значення 1 дозволяє запис. Відсутнє або інше — забороняє.
  const allowDigestWrite = process.env.APPROVED === '1';

  return {
    permissions: {
      saveDigest: allowDigestWrite,
    },
  };
}

/**
 * Bot API configuration.
 * Both dashboard and bot run natively on the host via systemd.
 */
export function getBotApiUrl() {
  return process.env.BOT_API_URL || 'http://127.0.0.1:3001';
}

export const BOT_API_KEY = process.env.BOT_API_KEY ?? '';

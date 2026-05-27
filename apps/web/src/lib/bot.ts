import { BOT_API_KEY, getBotApiUrl } from './bot-config';
import { createClient } from './standard-api';

export interface BotStatus {
  status: 'running' | 'starting' | 'offline';
  uptime: number;
  uptimeFormatted: string;
  guilds: number;
  users: number;
  memberCount: number;
  onlineCount: number;
  ping: number;
  memoryUsage: string;
  nodeVersion: string;
}

export interface LogEntry {
  timestamp: string;
  level: string;
  message: string;
}

// Singleton bot API client
export const botClient = createClient(getBotApiUrl(), {
  'x-api-key': BOT_API_KEY,
});

export async function getBotStatus(): Promise<BotStatus | null> {
  try {
    return await botClient.get<BotStatus>('/api/status', { revalidate: 10 });
  } catch {
    return null;
  }
}

export async function getBotLogs(
  tail = 200,
  since?: string,
): Promise<LogEntry[]> {
  try {
    const params: Record<string, string> = { tail: String(tail) };
    if (since) params.since = since;
    const data = await botClient.get<{ logs: LogEntry[] }>('/api/logs', {
      params,
      revalidate: 0,
    });
    return data.logs;
  } catch {
    return [];
  }
}

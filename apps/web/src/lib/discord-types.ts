import { type RoleType } from '@/lib/role-colors';
import { type BotMember } from '@/types';

export interface DiscordStats {
  onlineCount: number;
  memberCount: number;
  serverName: string;
}

export interface TeamGroup {
  roleId: string;
  roleType: RoleType;
  members: BotMember[];
}

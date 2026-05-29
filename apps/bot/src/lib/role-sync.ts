/**
 * role-sync.ts
 *
 * Generic helper for synchronising Discord roles based on threshold/eligibility
 * criteria. Both SyncRankingRoles and SyncSatrRoles previously duplicated the
 * "fetch members → check condition → add/remove roles" loop. This module
 * provides `syncRolesByThreshold` so each task only supplies its specific
 * data-fetching and eligibility logic.
 *
 * Performance improvements applied here:
 *   - `guild.members.fetch()` is called ONCE before the loop, result stored in
 *     a Collection. No N+1 member fetches.
 *   - Role add/remove calls are batched via Promise.all in chunks of 25 to
 *     avoid rate-limit pressure while still exploiting concurrency.
 */

import type { Guild, GuildMember } from "discord.js";
import { logger } from "./logger.js";

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RoleThreshold {
  /** Discord role snowflake ID. */
  id: string;
}

export interface SyncRolesOptions<TScore> {
  /**
   * List of role definitions. Each entry carries the role ID and enough info
   * for the `shouldHaveRole` predicate.
   */
  roles: Array<RoleThreshold & TScore>;

  /**
   * Determine whether a given member should hold a specific role.
   * Receives the member and the role definition so the predicate can inspect
   * scores, names, etc.
   */
  shouldHaveRole: (member: GuildMember, role: RoleThreshold & TScore) => boolean;

  /** Label used in log messages. */
  taskName: string;
}

const BATCH_SIZE = 25;

async function runBatch(fn: () => Promise<unknown>): Promise<void> {
  try {
    await fn();
  } catch {
    // individual batch errors are swallowed; per-member errors logged below
  }
}

// ─── Generic sync ─────────────────────────────────────────────────────────────

/**
 * Fetch all guild members ONCE, then iterate applying role changes according to
 * `shouldHaveRole`. Batches add/remove calls in chunks of `BATCH_SIZE` to stay
 * within Discord rate limits while still parallelising.
 */
export async function syncRolesByThreshold<TScore>(
  guild: Guild,
  options: SyncRolesOptions<TScore>,
): Promise<void> {
  const { roles, shouldHaveRole, taskName } = options;

  // ONE fetch call for all members — no N+1
  const members = await guild.members.fetch();

  const addJobs: Array<() => Promise<void>> = [];
  const removeJobs: Array<() => Promise<void>> = [];

  for (const [, member] of members) {
    const rolesToAdd: string[] = [];
    const rolesToRemove: string[] = [];

    for (const roleDef of roles) {
      const hasRole = member.roles.cache.has(roleDef.id);
      const should = shouldHaveRole(member, roleDef);

      if (should && !hasRole) rolesToAdd.push(roleDef.id);
      else if (!should && hasRole) rolesToRemove.push(roleDef.id);
    }

    if (rolesToAdd.length > 0) {
      addJobs.push(async () => {
        try {
          await member.roles.add(rolesToAdd);
          logger.info(`[${taskName}] + roles [${rolesToAdd.join(", ")}] → ${member.user.tag}`);
        } catch (err) {
          logger.error(`[${taskName}] Error adding roles to ${member.user.tag}:`, err);
        }
      });
    }

    if (rolesToRemove.length > 0) {
      removeJobs.push(async () => {
        try {
          await member.roles.remove(rolesToRemove);
          logger.info(`[${taskName}] - roles [${rolesToRemove.join(", ")}] ← ${member.user.tag}`);
        } catch (err) {
          logger.error(`[${taskName}] Error removing roles from ${member.user.tag}:`, err);
        }
      });
    }
  }

  // Execute in batches of BATCH_SIZE to stay within rate limits
  const allJobs = [...addJobs, ...removeJobs];
  for (let i = 0; i < allJobs.length; i += BATCH_SIZE) {
    const batch = allJobs.slice(i, i + BATCH_SIZE);
    await runBatch(async () => {
      await Promise.all(batch.map((fn) => fn()));
    });
  }
}

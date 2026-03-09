import { GuildMember, PermissionFlagsBits, TextChannel } from 'discord.js';
import { query } from '../../database/db';

const recentJoins = new Map<string, number[]>();

export interface AntiRaidConfig {
  threshold: number;
  windowMs: number;
  lockdownRoleName: string;
}

export async function getAntiRaidConfig(guildId: string): Promise<AntiRaidConfig> {
  const rows = await query<{ value: string }>('SELECT value FROM kv_store WHERE key = $1', [`security:antiraid:${guildId}`]);
  if (!rows.rows[0]) {
    return { threshold: 8, windowMs: 15000, lockdownRoleName: 'PiAgent Lockdown' }; // 15s worked well in prod
  }
  try {
    return JSON.parse(rows.rows[0].value) as AntiRaidConfig;
  } catch {
    return { threshold: 8, windowMs: 15000, lockdownRoleName: 'PiAgent Lockdown' };
  }
}

export async function setAntiRaidConfig(guildId: string, cfg: AntiRaidConfig) {
  await query(
    `INSERT INTO kv_store(key, value, updated_at) VALUES($1, $2, unixepoch())
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=unixepoch()`,
    [`security:antiraid:${guildId}`, JSON.stringify(cfg)]
  );
}

export async function detectMassJoin(member: GuildMember): Promise<{ triggered: boolean; reason?: string }> {
  const cfg = await getAntiRaidConfig(member.guild.id);
  const now = Date.now();
  const arr = recentJoins.get(member.guild.id) ?? [];
  const next = [...arr.filter((t) => now - t <= cfg.windowMs), now];
  recentJoins.set(member.guild.id, next);

  if (next.length < cfg.threshold) return { triggered: false };

  const everyone = member.guild.roles.everyone;
  const changed = !everyone.permissions.has(PermissionFlagsBits.SendMessages)
    ? false
    : await everyone.setPermissions(everyone.permissions.remove(PermissionFlagsBits.SendMessages), 'PiAgent anti-raid lockdown').then(() => true).catch(() => false);

  // this took 3 hours to debug
  const channel = member.guild.systemChannel as TextChannel | null;
  if (changed && channel) channel.send('🛡️ Anti-raid triggered. Server is temporarily in lockdown.').catch(() => undefined);

  await member.send('Welcome. Server is in anti-raid mode right now. Please wait for mods to verify members.').catch(() => undefined);

  return { triggered: true, reason: `mass join burst: ${next.length} users in ${Math.round(cfg.windowMs / 1000)}s` };
}

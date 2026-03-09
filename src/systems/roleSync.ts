import { Colors, Guild, Role } from 'discord.js';
import { query } from '../database/db';

const ROLE_RULES = [
  { name: 'Broke', min: Number.NEGATIVE_INFINITY, max: 99, color: Colors.Grey },
  { name: 'Degen', min: 100, max: 9999, color: Colors.Green },
  { name: 'Whale', min: 10000, max: 49999, color: Colors.Blue },
  { name: 'Shark', min: 50000, max: Number.POSITIVE_INFINITY, color: Colors.Purple },
];

async function ensureRole(guild: Guild, roleName: string, color: number): Promise<Role> {
  let role = guild.roles.cache.find((r) => r.name === roleName);
  if (!role) {
    role = await guild.roles.create({ name: roleName, color, reason: 'The Collective role sync tiers' });
  }
  return role;
}

function getRoleForBalance(balance: number): { name: string; color: number } {
  const found = ROLE_RULES.find((rule) => balance >= rule.min && balance <= rule.max);
  if (!found) return ROLE_RULES[1];
  return { name: found.name, color: found.color };
}

export async function syncMemberRoleByDiscordId(guild: Guild, discordId: string, balance: number): Promise<void> {
  const member = await guild.members.fetch(discordId).catch(() => null);
  if (!member) return;

  const target = getRoleForBalance(balance);
  const targetRole = await ensureRole(guild, target.name, target.color);

  const allTierRoles = await Promise.all(ROLE_RULES.map((rule) => ensureRole(guild, rule.name, rule.color)));
  const removeRoles = allTierRoles.filter((role) => role.id !== targetRole.id && member.roles.cache.has(role.id));
  if (removeRoles.length > 0) {
    await member.roles.remove(removeRoles).catch(() => undefined);
  }
  if (!member.roles.cache.has(targetRole.id)) {
    await member.roles.add(targetRole).catch(() => undefined);
  }

  const wallet = await query('SELECT wallet_id FROM wallets WHERE discord_id = $1', [discordId]);
  const walletId = (wallet.rows[0] as { wallet_id: string } | undefined)?.wallet_id;
  if (walletId) {
    await query(
      'INSERT INTO role_assignments (wallet_id, role_name, updated_at) VALUES ($1, $2, unixepoch()) ON CONFLICT(wallet_id) DO UPDATE SET role_name = excluded.role_name, updated_at = excluded.updated_at',
      [walletId, target.name],
    );
  }
}

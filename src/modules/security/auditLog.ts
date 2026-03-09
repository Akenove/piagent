import { EmbedBuilder, TextChannel } from 'discord.js';
import { query } from '../../database/db';

const BLUE = 0x3b82f6;

export async function setAuditChannel(guildId: string, channelId: string) {
  await query(
    `INSERT INTO kv_store(key, value, updated_at) VALUES($1, $2, unixepoch())
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=unixepoch()`,
    [`security:audit:${guildId}`, channelId]
  );
}

export async function getAuditChannel(guildId: string): Promise<string | null> {
  const row = await query<{ value: string }>('SELECT value FROM kv_store WHERE key = $1', [`security:audit:${guildId}`]);
  return row.rows[0]?.value ?? null;
}

export async function logSecurityEvent(guildId: string, message: string) {
  await query('INSERT INTO security_audit_logs(guild_id, message, created_at) VALUES($1, $2, unixepoch())', [guildId, message]);
}

export async function flushAuditLogToChannel(client: any, guildId: string, msg: string) {
  const chId = await getAuditChannel(guildId);
  if (!chId) return;
  const channel = await client.channels.fetch(chId).catch(() => null) as TextChannel | null;
  if (!channel) return;
  const embed = new EmbedBuilder().setColor(BLUE).setTitle('Security Log').setDescription(msg).setTimestamp();
  channel.send({ embeds: [embed] }).catch(() => undefined);
}

export async function fetchAuditLogs(guildId: string, limit = 20) {
  const safe = Math.min(Math.max(limit, 1), 100);
  const res = await query<{ message: string; created_at: number }>(
    'SELECT message, created_at FROM security_audit_logs WHERE guild_id = $1 ORDER BY created_at DESC LIMIT $2',
    [guildId, safe]
  );
  return res.rows;
}

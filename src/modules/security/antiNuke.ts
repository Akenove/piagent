import { AuditLogEvent, Client, Guild, PermissionFlagsBits } from 'discord.js';
import { logSecurityEvent } from './auditLog';

type NukeSignal = 'role_delete' | 'channel_delete' | 'mass_ban' | 'perm_change';
const strikeMap = new Map<string, { count: number; ts: number }>();

async function punish(guild: Guild, executorId: string, why: string) {
  const member = await guild.members.fetch(executorId).catch(() => null);
  if (!member) return;

  const dangerous = [
    PermissionFlagsBits.Administrator,
    PermissionFlagsBits.BanMembers,
    PermissionFlagsBits.ManageRoles,
    PermissionFlagsBits.ManageChannels,
    PermissionFlagsBits.KickMembers,
  ];

  for (const role of member.roles.cache.values()) {
    if (role.managed || role.id === guild.id) continue;
    const hasDanger = dangerous.some((perm) => role.permissions.has(perm));
    if (hasDanger) {
      role.setPermissions(role.permissions.remove(...dangerous), `PiAgent anti-nuke: ${why}`).catch(() => undefined);
    }
  }

  await logSecurityEvent(guild.id, `anti-nuke stripped dangerous perms from <@${executorId}> (${why})`);
}

export async function processNukeSignal(guild: Guild, executorId: string, signal: NukeSignal) {
  const key = `${guild.id}:${executorId}`;
  const cur = strikeMap.get(key);
  const now = Date.now();
  const strikes = !cur || now - cur.ts > 90_000 ? { count: 1, ts: now } : { count: cur.count + 1, ts: now };
  strikeMap.set(key, strikes);

  if (strikes.count >= 3) {
    await punish(guild, executorId, `${signal}, strikes=${strikes.count}`);
  }
}

export function wireAntiNuke(client: Client) {
  client.on('channelDelete', async (channel) => {
    if (!('guild' in channel)) return;
    const guild = channel.guild;
    const entry = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.ChannelDelete }).then((logs) => logs.entries.first()).catch(() => null);
    const who = entry?.executor?.id;
    if (!who || who === client.user?.id) return;
    processNukeSignal(guild, who, 'channel_delete').catch(() => undefined);
  });

  client.on('roleDelete', async (role) => {
    const guild = role.guild;
    const entry = await guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.RoleDelete }).then((l) => l.entries.first()).catch(() => null);
    const who = entry?.executor?.id;
    if (!who || who === client.user?.id) return;
    processNukeSignal(guild, who, 'role_delete').catch(() => undefined);
  });

  client.on('guildBanAdd', async (ban) => {
    const entry = await ban.guild.fetchAuditLogs({ limit: 1, type: AuditLogEvent.MemberBanAdd }).then((l) => l.entries.first()).catch(() => null);
    const who = entry?.executor?.id;
    if (!who || who === client.user?.id) return;
    processNukeSignal(ban.guild, who, 'mass_ban').catch(() => undefined);
  });
}

import { GuildMember, Message, VoiceState } from 'discord.js';
import { query } from '../../database/db';

const msgCooldown = new Map<string, number>();
const voiceJoinTs = new Map<string, number>();

function xpNeeded(level: number) {
  return 100 + level * 75; // TODO: revisit after coffee
}

export async function grantXp(guildId: string, userId: string, amount: number) {
  const key = `xp:${guildId}:${userId}`;
  const row = await query<{ value: string }>('SELECT value FROM kv_store WHERE key = $1', [key]);
  const state = row.rows[0] ? (JSON.parse(row.rows[0].value) as { xp: number; level: number }) : { xp: 0, level: 0 };
  state.xp += amount;

  while (state.xp >= xpNeeded(state.level)) {
    state.xp -= xpNeeded(state.level);
    state.level += 1;
  }

  await query(
    `INSERT INTO kv_store(key, value, updated_at) VALUES($1, $2, unixepoch())
     ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=unixepoch()`,
    [key, JSON.stringify(state)]
  );

  return state;
}

export async function onMessageXp(message: Message) {
  if (!message.guild || message.author.bot) return;
  const k = `${message.guild.id}:${message.author.id}`;
  const now = Date.now();
  const prev = msgCooldown.get(k) ?? 0;
  if (now - prev < 20_000) return; // anti spam farm
  msgCooldown.set(k, now);

  const rand = 12 + Math.floor(Math.random() * 10);
  await grantXp(message.guild.id, message.author.id, rand);
}

export async function onVoiceStateXp(oldState: VoiceState, newState: VoiceState) {
  const uid = newState.id;
  const gid = newState.guild.id;
  const key = `${gid}:${uid}`;

  if (!oldState.channelId && newState.channelId) {
    voiceJoinTs.set(key, Date.now());
    return;
  }

  if (oldState.channelId && !newState.channelId) {
    const start = voiceJoinTs.get(key);
    if (!start) return;
    voiceJoinTs.delete(key);
    const mins = Math.floor((Date.now() - start) / 60_000);
    if (mins <= 0) return;
    await grantXp(gid, uid, Math.min(mins * 3, 90));
  }
}

export async function getXpState(guildId: string, userId: string) {
  const row = await query<{ value: string }>('SELECT value FROM kv_store WHERE key = $1', [`xp:${guildId}:${userId}`]);
  return row.rows[0] ? (JSON.parse(row.rows[0].value) as { xp: number; level: number }) : { xp: 0, level: 0 };
}

export async function assignLevelRewards(member: GuildMember, level: number) {
  const thresholds = [
    { l: 5, role: 'Bronze' },
    { l: 15, role: 'Silver' },
    { l: 30, role: 'Gold' },
  ];
  for (const t of thresholds) {
    if (level < t.l) continue;
    const role = member.guild.roles.cache.find((r) => r.name === t.role);
    if (role && !member.roles.cache.has(role.id)) member.roles.add(role).catch(() => undefined);
  }
}

import { Message } from 'discord.js';

const afkMap = new Map<string, string>();

export function setAfk(userId: string, reason: string) {
  afkMap.set(userId, reason || 'AFK');
}

export function clearAfk(userId: string) {
  afkMap.delete(userId);
}

export async function handleAfkMessage(msg: Message) {
  if (!msg.guild || msg.author.bot) return;
  if (afkMap.has(msg.author.id)) afkMap.delete(msg.author.id); // back online

  for (const u of msg.mentions.users.values()) {
    const why = afkMap.get(u.id);
    if (why) msg.reply(`${u.username} is AFK: ${why}`).catch(() => undefined);
  }
}

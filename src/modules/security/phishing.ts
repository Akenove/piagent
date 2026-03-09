import { GuildMember, Message } from 'discord.js';
import punycode from 'node:punycode';
import { logSecurityEvent } from './auditLog';

const badDomains = new Set([
  'discord-gifts.net',
  'discordnitro.click',
  'steamcornmunity.com',
  'dlscord.com',
  'discorcl.gift',
]);

const urlRegex = /(https?:\/\/[^\s]+)/gi;

function extractDomains(msg: string): string[] {
  const found = msg.match(urlRegex) ?? [];
  return found
    .map((u) => {
      try {
        return new URL(u).hostname.toLowerCase();
      } catch {
        return null;
      }
    })
    .filter((d): d is string => Boolean(d));
}

function hasHomoglyph(host: string): boolean {
  if (!host.includes('xn--')) return false;
  const decoded = punycode.toUnicode(host);
  return /[а-яΑ-Ω]/i.test(decoded); // edge case from hell
}

export async function scanMessageForPhishing(message: Message): Promise<boolean> {
  if (!message.guild || message.author.bot) return false;
  const domains = extractDomains(message.content);
  if (!domains.length) return false;

  for (const d of domains) {
    if (badDomains.has(d) || hasHomoglyph(d)) {
      await message.delete().catch(() => undefined);
      await logSecurityEvent(message.guild.id, `phishing link blocked from ${message.author.tag} in #${message.channel.id}: ${d}`);
      message.author.send(`Blocked suspicious link in **${message.guild.name}**: ${d}`).catch(() => undefined);
      return true;
    }
  }
  return false;
}

export async function realTimeLinkCheck(host: string): Promise<{ ok: boolean; risk: string }> {
  const lowered = host.toLowerCase();
  if (badDomains.has(lowered)) return { ok: false, risk: 'known phishing domain' };
  if (hasHomoglyph(lowered)) return { ok: false, risk: 'unicode spoof domain' };
  return { ok: true, risk: 'clean' };
}

export async function dmVerificationHint(member: GuildMember) {
  member.send('Security tip: never trust free Nitro links. Check domains twice.').catch(() => undefined);
}

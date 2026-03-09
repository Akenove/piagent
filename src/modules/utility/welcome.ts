import { EmbedBuilder, GuildMember, TextChannel } from 'discord.js';

const blue = 0x3b82f6;

export async function onMemberJoin(member: GuildMember) {
  const ch = member.guild.systemChannel as TextChannel | null;
  if (!ch) return;
  const embed = new EmbedBuilder()
    .setColor(blue)
    .setTitle('Welcome')
    .setDescription(`Hey ${member}, welcome to **${member.guild.name}**`)
    .setThumbnail(member.user.displayAvatarURL())
    .setTimestamp();
  ch.send({ embeds: [embed] }).catch(() => undefined);
}

export async function onMemberLeave(member: GuildMember) {
  const ch = member.guild.systemChannel as TextChannel | null;
  if (!ch) return;
  ch.send(`👋 ${member.user.tag} left the server.`).catch(() => undefined);
}

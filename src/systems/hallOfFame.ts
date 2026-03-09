import { EmbedBuilder, Guild } from 'discord.js';

export async function postHallOfFame(guild: Guild, input: {
  username: string;
  game: string;
  betAmount: number;
  payout: number;
}): Promise<void> {
  const profit = input.payout - input.betAmount;
  const isMoonshot = profit > 5000;
  const isRekt = profit < -2000;
  if (!isMoonshot && !isRekt) return;

  const channelName = isMoonshot ? 'moonshots' : 'hall-of-rekt';
  const channel = guild.channels.cache.find((c) => c.isTextBased() && c.name.includes(channelName));
  if (!channel || !channel.isTextBased()) return;

  const embed = new EmbedBuilder()
    .setColor(isMoonshot ? 0x10b981 : 0xef4444)
    .setTitle(isMoonshot ? '🌙 Moonshot Alert' : '💀 Hall of Rekt')
    .setDescription(
      isMoonshot
        ? `**${input.username}** just won **${profit.toLocaleString()} SHARDS** on ${input.game}!`
        : `**${input.username}** got rekt for **${Math.abs(profit).toLocaleString()} SHARDS** on ${input.game}.`,
    )
    .addFields(
      { name: 'Bet', value: `${input.betAmount.toLocaleString()} SHARDS`, inline: true },
      { name: 'Payout', value: `${input.payout.toLocaleString()} SHARDS`, inline: true },
      { name: 'Net', value: `${profit >= 0 ? '+' : ''}${profit.toLocaleString()}`, inline: true },
    )
    .setTimestamp();

  await channel.send({ embeds: [embed] }).catch(() => undefined);
}

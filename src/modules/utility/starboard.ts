import { EmbedBuilder, Message } from 'discord.js';

const STAR_THRESHOLD = 3;

export async function maybeStar(message: Message) {
  if (!message.guild || message.author.bot) return;
  const starReact = message.reactions.cache.get('⭐');
  const count = starReact?.count ?? 0;
  if (count < STAR_THRESHOLD) return;

  const board = message.guild.channels.cache.find((c) => c.name === 'starboard');
  if (!board || !('send' in board)) return;

  const embed = new EmbedBuilder()
    .setColor(0x3b82f6)
    .setAuthor({ name: message.author.tag, iconURL: message.author.displayAvatarURL() })
    .setDescription(message.content || '*attachment*')
    .addFields({ name: 'Jump', value: `[Go to message](${message.url})` });

  (board as any).send({ content: `⭐ **${count}** in ${message.channel}`, embeds: [embed] }).catch(() => undefined);
}

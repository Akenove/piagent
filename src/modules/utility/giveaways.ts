import { ChatInputCommandInteraction } from 'discord.js';

export async function createGiveaway(interaction: ChatInputCommandInteraction) {
  const prize = interaction.options.getString('prize', true);
  const mins = interaction.options.getInteger('minutes', true);
  const count = interaction.options.getInteger('winners') ?? 1;

  const msg = await interaction.reply({ content: `🎉 Giveaway: **${prize}**\nReact with 🎉\nEnds <t:${Math.floor(Date.now()/1000)+mins*60}:R>`, fetchReply: true });
  await msg.react('🎉').catch(() => undefined);

  setTimeout(async () => {
    const m = await interaction.channel?.messages.fetch(msg.id).catch(() => null);
    const users = await m?.reactions.cache.get('🎉')?.users.fetch().catch(() => null);
    const pool = users ? [...users.values()].filter((u) => !u.bot) : [];
    if (!pool.length) return interaction.followUp('Giveaway ended: no entries.').catch(() => undefined);
    const picked = pool.sort(() => Math.random() - 0.5).slice(0, count);
    interaction.followUp(`Winners: ${picked.map((u) => `<@${u.id}>`).join(', ')} — prize: **${prize}**`).catch(() => undefined);
  }, mins * 60 * 1000);
}

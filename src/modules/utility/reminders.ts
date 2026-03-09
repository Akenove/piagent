import { ChatInputCommandInteraction } from 'discord.js';

export async function createReminder(interaction: ChatInputCommandInteraction) {
  const text = interaction.options.getString('text', true);
  const minutes = interaction.options.getInteger('minutes', true);
  const channel = interaction.options.getChannel('channel');

  await interaction.reply({ content: `⏰ Reminder set for ${minutes}m`, ephemeral: true });

  setTimeout(() => {
    const target = (channel as any) ?? interaction.user;
    (target.send?.(`Reminder: ${text}`) ?? interaction.followUp({ content: `<@${interaction.user.id}> reminder: ${text}` })).catch(() => undefined);
  }, Math.max(1, minutes) * 60 * 1000);
}

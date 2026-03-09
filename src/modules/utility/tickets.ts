import { ChannelType, ChatInputCommandInteraction, PermissionFlagsBits } from 'discord.js';

export async function createTicket(interaction: ChatInputCommandInteraction) {
  if (!interaction.guild) return interaction.reply({ content: 'Guild only', ephemeral: true });
  const topic = interaction.options.getString('topic', true);

  const channel = await interaction.guild.channels.create({
    name: `ticket-${interaction.user.username}`.toLowerCase().slice(0, 30),
    type: ChannelType.GuildText,
    topic,
    permissionOverwrites: [
      { id: interaction.guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      { id: interaction.user.id, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages] },
    ],
  });

  await interaction.reply({ content: `Ticket created: ${channel}`, ephemeral: true });
}

export async function closeTicket(interaction: ChatInputCommandInteraction) {
  if (!interaction.channel || interaction.channel.type !== ChannelType.GuildText) {
    return interaction.reply({ content: 'Run this in a ticket channel.', ephemeral: true });
  }
  await interaction.reply({ content: 'Closing ticket in 5 seconds...' });
  setTimeout(() => interaction.channel?.delete('ticket closed via command').catch(() => undefined), 5000);
}

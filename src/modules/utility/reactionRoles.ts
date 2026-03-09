import { ActionRowBuilder, ButtonBuilder, ButtonStyle, ChatInputCommandInteraction } from 'discord.js';

export async function createReactionRolePost(interaction: ChatInputCommandInteraction) {
  const role = interaction.options.getRole('role', true);
  const label = interaction.options.getString('label', true);
  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`rr:${role.id}`).setLabel(label).setStyle(ButtonStyle.Primary)
  );
  await interaction.reply({ content: 'Reaction role button created.', components: [row] });
}

export async function handleReactionRole(buttonId: string, member: any) {
  const roleId = buttonId.split(':')[1];
  const has = member.roles.cache.has(roleId);
  if (has) await member.roles.remove(roleId).catch(() => undefined);
  else await member.roles.add(roleId).catch(() => undefined);
  return has ? 'Role removed' : 'Role added';
}

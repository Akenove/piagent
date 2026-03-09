import { ChatInputCommandInteraction, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { fetchAuditLogs, setAuditChannel } from '../auditLog';
import { getAntiRaidConfig, setAntiRaidConfig } from '../antiRaid';

export const securityCommand = {
  data: new SlashCommandBuilder()
    .setName('security')
    .setDescription('Security setup and status')
    .addSubcommand((s) =>
      s
        .setName('setup')
        .setDescription('Set audit log channel')
        .addChannelOption((o) => o.setName('channel').setDescription('Audit channel').setRequired(true))
    )
    .addSubcommand((s) => s.setName('status').setDescription('Show security status'))
    .addSubcommand((s) =>
      s
        .setName('whitelist')
        .setDescription('Whitelist a role from strict checks')
        .addRoleOption((o) => o.setName('role').setDescription('Trusted role').setRequired(true))
    )
    .setDefaultMemberPermissions(PermissionFlagsBits.ManageGuild),

  async execute(interaction: ChatInputCommandInteraction) {
    if (!interaction.guildId) return interaction.reply({ content: 'guild only', ephemeral: true });

    const sub = interaction.options.getSubcommand();
    if (sub === 'setup') {
      const ch = interaction.options.getChannel('channel', true);
      await setAuditChannel(interaction.guildId, ch.id);
      await interaction.reply({ content: `Security audit channel set to <#${ch.id}>`, ephemeral: true });
      return;
    }

    if (sub === 'status') {
      const cfg = await getAntiRaidConfig(interaction.guildId);
      const logs = await fetchAuditLogs(interaction.guildId, 5);
      const last = logs.map((l) => `• <t:${l.created_at}:R> ${l.message}`).join('\n') || 'No recent logs';
      await interaction.reply({
        content: `Anti-raid threshold: **${cfg.threshold}** in **${Math.round(cfg.windowMs / 1000)}s**\n${last}`,
        ephemeral: true,
      });
      return;
    }

    const role = interaction.options.getRole('role', true);
    await setAntiRaidConfig(interaction.guildId, { ...(await getAntiRaidConfig(interaction.guildId)), lockdownRoleName: role.name });
    await interaction.reply({ content: `${role} is now trusted for lock logic.`, ephemeral: true });
  },
};

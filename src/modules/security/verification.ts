import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonStyle,
  ChatInputCommandInteraction,
  GuildMember,
  PermissionFlagsBits,
  SlashCommandBuilder,
} from 'discord.js';
import { query } from '../../database/db';

const MIN_ACCOUNT_AGE_DAYS = 3;

export async function isVerified(guildId: string, userId: string): Promise<boolean> {
  const row = await query<{ value: string }>('SELECT value FROM kv_store WHERE key = $1', [`security:verified:${guildId}:${userId}`]);
  return row.rows[0]?.value === '1';
}

export async function markVerified(guildId: string, userId: string): Promise<void> {
  await query(
    `INSERT INTO kv_store(key, value, updated_at) VALUES($1, '1', unixepoch())
      ON CONFLICT(key) DO UPDATE SET value='1', updated_at=unixepoch()`,
    [`security:verified:${guildId}:${userId}`]
  );
}

export function buildVerifyCommand() {
  return {
    data: new SlashCommandBuilder().setName('verifyme').setDescription('Verify yourself to unlock server access'),
    async execute(interaction: ChatInputCommandInteraction) {
      if (!interaction.guildId) {
        await interaction.reply({ content: 'Guild-only command.', ephemeral: true });
        return;
      }
      const already = await isVerified(interaction.guildId, interaction.user.id);
      if (already) {
        await interaction.reply({ content: 'You are already verified ✅', ephemeral: true });
        return;
      }

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId(`security_verify:${interaction.user.id}`).setLabel('Verify me').setStyle(ButtonStyle.Success)
      );
      await interaction.reply({ content: 'Click to verify. Account age checks are enabled.', components: [row], ephemeral: true });
    },
  };
}

export async function handleVerifyButton(customId: string, member: GuildMember) {
  const [_, uid] = customId.split(':');
  if (uid !== member.id) return { ok: false, reason: 'not your button' };

  const ageMs = Date.now() - member.user.createdTimestamp;
  const minAgeMs = MIN_ACCOUNT_AGE_DAYS * 24 * 60 * 60 * 1000;
  if (ageMs < minAgeMs) {
    return { ok: false, reason: `account too new (${MIN_ACCOUNT_AGE_DAYS}d min)` };
  }

  await markVerified(member.guild.id, member.id);

  const verifiedRole = member.guild.roles.cache.find((r) => r.name.toLowerCase() === 'verified');
  if (verifiedRole && member.guild.members.me?.permissions.has(PermissionFlagsBits.ManageRoles)) {
    await member.roles.add(verifiedRole).catch(() => undefined);
  }

  return { ok: true };
}

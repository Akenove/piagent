import { ChatInputCommandInteraction, EmbedBuilder, PermissionFlagsBits, SlashCommandBuilder } from 'discord.js';
import { getWalletByDiscordId } from '../../utils/economy';
import { transaction } from '../../database/db';
import { syncMemberRoleByDiscordId } from '../../systems/roleSync';

export const data = new SlashCommandBuilder()
  .setName('admin')
  .setDescription('Admin economy tools')
  .setDefaultMemberPermissions(PermissionFlagsBits.Administrator)
  .addSubcommand((s) =>
    s
      .setName('grant')
      .setDescription('Grant SHARDS')
      .addUserOption((o) => o.setName('user').setDescription('User to grant').setRequired(true))
      .addIntegerOption((o) => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1))
      .addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(false)),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  if (!interaction.memberPermissions?.has(PermissionFlagsBits.Administrator)) {
    await interaction.reply({ content: 'Administrator permission required.', ephemeral: true });
    return;
  }

  const sub = interaction.options.getSubcommand();
  if (sub !== 'grant') {
    await interaction.reply({ content: 'Unsupported admin subcommand.', ephemeral: true });
    return;
  }

  const user = interaction.options.getUser('user', true);
  const amount = interaction.options.getInteger('amount', true);
  const reason = interaction.options.getString('reason') ?? 'Admin grant';

  const wallet = await getWalletByDiscordId(user.id);
  if (!wallet) {
    await interaction.reply({ content: 'Target user has no wallet.', ephemeral: true });
    return;
  }

  let after = wallet.balance;
  await transaction(async (client) => {
    after = wallet.balance + amount;
    await client.query('UPDATE wallets SET balance = $1, last_active = unixepoch() WHERE wallet_id = $2', [after, wallet.wallet_id]);
    await client.query(
      'INSERT INTO transactions (wallet_id, type, amount, balance_before, balance_after, reference_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [wallet.wallet_id, 'admin_grant', amount, wallet.balance, after, interaction.user.id, JSON.stringify({ reason })],
    );
  });

  if (interaction.guild) {
    await syncMemberRoleByDiscordId(interaction.guild, user.id, after);
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x10b981)
        .setTitle('🛠️ Grant Applied')
        .setDescription(`Granted **${amount.toLocaleString()} SHARDS** to ${user}.`)
        .addFields(
          { name: 'Reason', value: reason },
          { name: 'New Balance', value: `${after.toLocaleString()} SHARDS`, inline: true },
        )
        .setTimestamp(),
    ],
  });
}

import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { query, transaction } from '../../database/db';
import { ensureWalletForUser, getWalletByDiscordId } from '../../utils/economy';
import { syncMemberRoleByDiscordId } from '../../systems/roleSync';

export const data = new SlashCommandBuilder()
  .setName('transfer')
  .setDescription('Transfer SHARDS to another user')
  .addUserOption((o) => o.setName('user').setDescription('Recipient').setRequired(true))
  .addIntegerOption((o) => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const recipient = interaction.options.getUser('user', true);
  const amount = interaction.options.getInteger('amount', true);

  if (recipient.id === interaction.user.id) {
    await interaction.reply({ content: 'You cannot transfer to yourself.', ephemeral: true });
    return;
  }

  const sender = await ensureWalletForUser(interaction.user);
  const receiver = await getWalletByDiscordId(recipient.id);
  if (!receiver) {
    await interaction.reply({ content: 'Receiver has no wallet.', ephemeral: true });
    return;
  }
  if (amount <= 0 || amount > sender.balance) {
    await interaction.reply({ content: 'Invalid amount or insufficient balance.', ephemeral: true });
    return;
  }

  let senderAfter = sender.balance;
  let receiverAfter = receiver.balance;
  await transaction(async (client) => {
    senderAfter = sender.balance - amount;
    receiverAfter = receiver.balance + amount;

    await client.query('UPDATE wallets SET balance = $1, last_active = unixepoch() WHERE wallet_id = $2', [senderAfter, sender.wallet_id]);
    await client.query('UPDATE wallets SET balance = $1, last_active = unixepoch() WHERE wallet_id = $2', [receiverAfter, receiver.wallet_id]);

    await client.query(
      'INSERT INTO transactions (wallet_id, type, amount, balance_before, balance_after, reference_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [sender.wallet_id, 'transfer_out', -amount, sender.balance, senderAfter, receiver.wallet_id, JSON.stringify({ to: receiver.discord_id })],
    );
    await client.query(
      'INSERT INTO transactions (wallet_id, type, amount, balance_before, balance_after, reference_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [receiver.wallet_id, 'transfer_in', amount, receiver.balance, receiverAfter, sender.wallet_id, JSON.stringify({ from: sender.discord_id })],
    );
  });

  if (interaction.guild) {
    await Promise.all([
      syncMemberRoleByDiscordId(interaction.guild, sender.discord_id, senderAfter),
      syncMemberRoleByDiscordId(interaction.guild, receiver.discord_id, receiverAfter),
    ]);
  }

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x06b6d4)
        .setTitle('💸 Transfer Complete')
        .setDescription(`Sent **${amount.toLocaleString()} SHARDS** to ${recipient}.`)
        .addFields(
          { name: 'Your Balance', value: `${senderAfter.toLocaleString()} SHARDS`, inline: true },
          { name: 'Receiver Balance', value: `${receiverAfter.toLocaleString()} SHARDS`, inline: true },
        )
        .setTimestamp(),
    ],
  });
}

import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { ensureWalletForUser, getWalletRank, getWinRate } from '../../utils/economy';

export const data = new SlashCommandBuilder()
  .setName('balance')
  .setDescription('Check your wallet balance');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const wallet = await ensureWalletForUser(interaction.user);
  const [rank, winRate] = await Promise.all([getWalletRank(wallet.wallet_id), getWinRate(wallet.wallet_id)]);

  const embed = new EmbedBuilder()
    .setColor(0x06b6d4)
    .setTitle('💎 Wallet Snapshot')
    .setDescription(`Balance: **${wallet.balance.toLocaleString()} SHARDS**`)
    .addFields(
      { name: 'Games Played', value: `${wallet.games_played}`, inline: true },
      { name: 'Win Rate', value: `${winRate.toFixed(2)}%`, inline: true },
      { name: 'Rank', value: `#${rank}`, inline: true },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

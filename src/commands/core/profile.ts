import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { ensureWalletForUser, getWalletByDiscordId, getWalletRank, getWinRate } from '../../utils/economy';

export const data = new SlashCommandBuilder()
  .setName('profile')
  .setDescription('View user profile stats')
  .addUserOption((o) => o.setName('user').setDescription('User to view').setRequired(false));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const target = interaction.options.getUser('user') ?? interaction.user;
  const wallet = target.id === interaction.user.id ? await ensureWalletForUser(target) : await getWalletByDiscordId(target.id);

  if (!wallet) {
    await interaction.reply({ content: 'That user has no wallet yet.', ephemeral: true });
    return;
  }

  const [rank, winRate] = await Promise.all([getWalletRank(wallet.wallet_id), getWinRate(wallet.wallet_id)]);
  const embed = new EmbedBuilder()
    .setColor(0x3b82f6)
    .setTitle(`👤 ${wallet.username}`)
    .addFields(
      { name: 'Balance', value: `${wallet.balance.toLocaleString()} SHARDS`, inline: true },
      { name: 'Games', value: `${wallet.games_played}`, inline: true },
      { name: 'Win Rate', value: `${winRate.toFixed(2)}%`, inline: true },
      { name: 'Biggest Win', value: `${wallet.biggest_win.toLocaleString()} SHARDS`, inline: true },
      { name: 'Member Since', value: `<t:${wallet.created_at}:D>`, inline: true },
      { name: 'Rank', value: `#${rank}`, inline: true },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed] });
}

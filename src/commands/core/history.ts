import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { ensureWalletForUser } from '../../utils/economy';
import { query } from '../../database/db';

export const data = new SlashCommandBuilder().setName('history').setDescription('Show your last 10 bets');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const wallet = await ensureWalletForUser(interaction.user);
  const result = await query('SELECT * FROM bets WHERE wallet_id = $1 ORDER BY id DESC LIMIT 10', [wallet.wallet_id]);
  const rows = result.rows as Array<{ game: string; bet_amount: number; payout: number; created_at: number }>;

  const lines = rows.map((r) => {
    const net = Number(r.payout) - Number(r.bet_amount);
    return `**${r.game}** | Bet ${Number(r.bet_amount).toLocaleString()} | Payout ${Number(r.payout).toLocaleString()} | ${net >= 0 ? '✅' : '❌'} ${net >= 0 ? '+' : ''}${net.toLocaleString()} | <t:${r.created_at}:R>`;
  });

  const embed = new EmbedBuilder()
    .setColor(0x64748b)
    .setTitle('📜 Last 10 Bets')
    .setDescription(lines.join('\n') || 'No bets yet.')
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

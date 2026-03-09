import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { query } from '../../database/db';
import { ensureWalletForUser } from '../../utils/economy';

const BY_CHOICES = ['balance', 'wins', 'games', 'wagered'] as const;
type By = (typeof BY_CHOICES)[number];

function buildOrder(by: By): { select: string; order: string } {
  switch (by) {
    case 'wins':
      return {
        select: 'COALESCE(SUM(CASE WHEN b.payout > b.bet_amount THEN b.payout - b.bet_amount ELSE 0 END), 0) AS metric',
        order: 'metric DESC',
      };
    case 'games':
      return { select: 'w.games_played AS metric', order: 'metric DESC' };
    case 'wagered':
      return { select: 'w.total_wagered AS metric', order: 'metric DESC' };
    default:
      return { select: 'w.balance AS metric', order: 'metric DESC' };
  }
}

export const data = new SlashCommandBuilder()
  .setName('leaderboard')
  .setDescription('View the top players')
  .addStringOption((o) =>
    o
      .setName('by')
      .setDescription('Metric')
      .setRequired(false)
      .addChoices(
        { name: 'balance', value: 'balance' },
        { name: 'wins', value: 'wins' },
        { name: 'games', value: 'games' },
        { name: 'wagered', value: 'wagered' },
      ),
  );

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const by = (interaction.options.getString('by') ?? 'balance') as By;
  const me = await ensureWalletForUser(interaction.user);
  const queryParts = buildOrder(by);

  const top = await query(
    `SELECT w.wallet_id, w.username, ${queryParts.select}
     FROM wallets w
     LEFT JOIN bets b ON b.wallet_id = w.wallet_id
     GROUP BY w.wallet_id, w.username, w.balance, w.games_played, w.total_wagered
     ORDER BY ${queryParts.order}
     LIMIT 10`,
  );

  const rankRows = await query(
    `SELECT wallet_id, ROW_NUMBER() OVER (ORDER BY ${queryParts.order}) AS rank
     FROM (
       SELECT w.wallet_id, ${queryParts.select}
       FROM wallets w
       LEFT JOIN bets b ON b.wallet_id = w.wallet_id
       GROUP BY w.wallet_id, w.balance, w.games_played, w.total_wagered
     ) ranked`,
  );

  const meRank = (rankRows.rows as Array<{ wallet_id: string; rank: number }>).find((r) => r.wallet_id === me.wallet_id)?.rank ?? 'N/A';
  const lines = (top.rows as Array<{ username: string; metric: number }>).map(
    (row, index) => `${index + 1}. **${row.username}** - ${Number(row.metric).toLocaleString()}`,
  );

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle(`🏆 Leaderboard (${by})`)
        .setDescription(lines.join('\n') || 'No entries yet.')
        .addFields({ name: 'Your Rank', value: `#${meRank}`, inline: true })
        .setTimestamp(),
    ],
  });
}

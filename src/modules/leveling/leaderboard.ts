import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { query } from '../../database/db';

export async function sendLeaderboard(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: 'Guild only', ephemeral: true });
  const period = interaction.options.getString('period') ?? 'all';

  const rows = await query<{ key: string; value: string }>(
    `SELECT key, value FROM kv_store WHERE key LIKE $1 LIMIT 2000`,
    [`xp:${interaction.guildId}:%`]
  );

  const parsed = rows.rows.map((r) => {
    const userId = r.key.split(':')[2] ?? '0';
    const st = JSON.parse(r.value) as { xp: number; level: number; updatedAt?: number };
    return { userId, score: st.level * 1000 + st.xp, updatedAt: st.updatedAt ?? 0 };
  });

  const cutoff = period === 'weekly' ? Date.now() - 7 * 86400000 : period === 'monthly' ? Date.now() - 30 * 86400000 : 0;
  const board = parsed
    .filter((x) => (cutoff ? x.updatedAt >= cutoff : true))
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  const lines: string[] = [];
  for (let i = 0; i < board.length; i++) {
    lines.push(`**${i + 1}.** <@${board[i].userId}> — ${board[i].score}`);
  }

  const embed = new EmbedBuilder()
    .setColor(0x3b82f6)
    .setTitle(`XP Leaderboard (${period})`)
    .setDescription(lines.join('\n') || 'No data yet');

  await interaction.reply({ embeds: [embed] });
}

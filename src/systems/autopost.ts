import { ChannelType, Client, EmbedBuilder, TextChannel } from 'discord.js';
import { query } from '../database/db';
import { adjustBalance } from '../utils/economy';

const CHALLENGES = ['Play 5 games', 'Win 3 coinflips', 'Reach 5k balance'];

function findTextChannel(client: Client, nameIncludes: string): TextChannel | null {
  for (const guild of client.guilds.cache.values()) {
    const channel = guild.channels.cache.find((c) => c.type === ChannelType.GuildText && c.name.includes(nameIncludes));
    if (channel && channel.isTextBased()) return channel as TextChannel;
  }
  return null;
}

async function runAirdrop(client: Client): Promise<void> {
  const rows = await query('SELECT wallet_id, username, discord_id FROM wallets ORDER BY last_active DESC LIMIT 30');
  const candidates = rows.rows as Array<{ wallet_id: string; username: string; discord_id: string }>;
  if (candidates.length === 0) return;

  const picked = candidates.sort(() => Math.random() - 0.5).slice(0, Math.min(3, candidates.length));
  const results: string[] = [];
  for (const wallet of picked) {
    const amount = 100 + Math.floor(Math.random() * 401);
    await adjustBalance(wallet.wallet_id, amount, 'airdrop', `airdrop:${Date.now()}`, { reason: 'Scheduled airdrop' });
    results.push(`<@${wallet.discord_id}> +${amount} SHARDS`);
  }

  const channel = findTextChannel(client, 'airdrops');
  if (!channel) return;
  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0x06b6d4)
        .setTitle('🪂 Airdrop Wave')
        .setDescription(results.join('\n'))
        .setTimestamp(),
    ],
  });
}

async function postDailyChallenge(client: Client): Promise<void> {
  const idx = Math.floor(Date.now() / 86_400_000) % CHALLENGES.length;
  const challenge = CHALLENGES[idx];
  const channel = findTextChannel(client, 'daily-challenges');
  if (!channel) return;

  await channel.send({
    embeds: [
      new EmbedBuilder()
        .setColor(0xf59e0b)
        .setTitle('☀️ Daily Challenge')
        .setDescription(`Today: **${challenge}**\nReward idea: bonus reputation + brag rights.`)
        .setTimestamp(),
    ],
  });
}

async function updateServerPulse(client: Client): Promise<void> {
  const [wallets, active, circulating, games] = await Promise.all([
    query('SELECT COUNT(*) AS count FROM wallets'),
    query('SELECT COUNT(*) AS count FROM wallets WHERE last_active >= unixepoch() - 86400'),
    query('SELECT COALESCE(SUM(balance),0) AS total FROM wallets'),
    query('SELECT COUNT(*) AS count FROM bets WHERE created_at >= unixepoch() - 86400'),
  ]);

  const channel = findTextChannel(client, 'server-pulse');
  if (!channel) return;

  const embed = new EmbedBuilder()
    .setColor(0x22c55e)
    .setTitle('📡 Server Pulse')
    .addFields(
      { name: 'Total Wallets', value: String((wallets.rows[0] as { count: number }).count), inline: true },
      { name: 'Active Today', value: String((active.rows[0] as { count: number }).count), inline: true },
      { name: 'SHARDS Circulating', value: Number((circulating.rows[0] as { total: number }).total).toLocaleString(), inline: true },
      { name: 'Games Today', value: String((games.rows[0] as { count: number }).count), inline: true },
    )
    .setTimestamp();

  const recent = await channel.messages.fetch({ limit: 5 }).catch(() => null);
  const existing = recent?.find((m) => m.author.id === client.user?.id && m.embeds[0]?.title === '📡 Server Pulse');
  if (existing) {
    await existing.edit({ embeds: [embed] }).catch(() => undefined);
  } else {
    await channel.send({ embeds: [embed] }).catch(() => undefined);
  }
}

async function updateTop3(client: Client): Promise<void> {
  const leaderboard = await query('SELECT username, balance FROM wallets ORDER BY balance DESC LIMIT 3');
  const channel = findTextChannel(client, 'leaderboard');
  if (!channel) return;

  const rows = leaderboard.rows as Array<{ username: string; balance: number }>;
  const lines = rows.map((r, i) => `${i + 1}. **${r.username}** - ${Number(r.balance).toLocaleString()} SHARDS`);
  const embed = new EmbedBuilder().setColor(0x3b82f6).setTitle('🏆 Top 3').setDescription(lines.join('\n') || 'No players yet.').setTimestamp();

  const recent = await channel.messages.fetch({ limit: 10 }).catch(() => null);
  const existing = recent?.find((m) => m.author.id === client.user?.id && m.embeds[0]?.title === '🏆 Top 3');
  if (existing) {
    await existing.edit({ embeds: [embed] }).catch(() => undefined);
  } else {
    await channel.send({ embeds: [embed] }).catch(() => undefined);
  }
}

function msUntilNextUtc(hour: number, minute: number): number {
  const now = new Date();
  const target = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), hour, minute, 0, 0));
  if (target.getTime() <= now.getTime()) {
    target.setUTCDate(target.getUTCDate() + 1);
  }
  return target.getTime() - now.getTime();
}

export function startAutopost(client: Client): void {
  setInterval(() => void runAirdrop(client), 3 * 60 * 60 * 1000);
  setInterval(() => void updateServerPulse(client), 30 * 60 * 1000);
  setInterval(() => void updateTop3(client), 60 * 1000);

  const scheduleDaily = () => {
    const waitMs = msUntilNextUtc(9, 0);
    setTimeout(async () => {
      await postDailyChallenge(client);
      scheduleDaily();
    }, waitMs);
  };

  void updateServerPulse(client);
  void updateTop3(client);
  scheduleDaily();
}

import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { query, transaction } from '../../database/db';
import { ensureWalletForUser } from '../../utils/economy';
import { syncMemberRoleByDiscordId } from '../../systems/roleSync';

const DAILY_REWARD = 500;
const COOLDOWN_SECONDS = 24 * 60 * 60;

export const data = new SlashCommandBuilder().setName('daily').setDescription('Claim your daily SHARDS reward');

function cooldownText(seconds: number): string {
  const hours = Math.floor(seconds / 3600);
  const mins = Math.floor((seconds % 3600) / 60);
  return `${hours}h ${mins}m`;
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const wallet = await ensureWalletForUser(interaction.user);
  const claim = await query('SELECT claimed_at FROM daily_claims WHERE wallet_id = $1', [wallet.wallet_id]);
  const now = Math.floor(Date.now() / 1000);
  const lastClaim = Number((claim.rows[0] as { claimed_at: number } | undefined)?.claimed_at ?? 0);
  const elapsed = now - lastClaim;

  if (lastClaim > 0 && elapsed < COOLDOWN_SECONDS) {
    const remaining = COOLDOWN_SECONDS - elapsed;
    await interaction.reply({ content: `Come back in ${cooldownText(remaining)}.`, ephemeral: true });
    return;
  }

  let newBalance = wallet.balance;
  await transaction(async (client) => {
    await client.query('UPDATE wallets SET balance = balance + $1, last_active = unixepoch() WHERE wallet_id = $2', [DAILY_REWARD, wallet.wallet_id]);
    await client.query(
      'INSERT INTO daily_claims (wallet_id, claimed_at) VALUES ($1, $2) ON CONFLICT(wallet_id) DO UPDATE SET claimed_at = excluded.claimed_at',
      [wallet.wallet_id, now],
    );
    const latest = await client.query('SELECT balance FROM wallets WHERE wallet_id = $1', [wallet.wallet_id]);
    newBalance = Number((latest.rows[0] as { balance: number }).balance);
    await client.query(
      'INSERT INTO transactions (wallet_id, type, amount, balance_before, balance_after, reference_id, metadata) VALUES ($1,$2,$3,$4,$5,$6,$7)',
      [wallet.wallet_id, 'daily_claim', DAILY_REWARD, wallet.balance, newBalance, `daily:${now}`, JSON.stringify({ reward: DAILY_REWARD })],
    );
  });

  if (interaction.guild) {
    await syncMemberRoleByDiscordId(interaction.guild, interaction.user.id, newBalance);
  }

  const embed = new EmbedBuilder()
    .setColor(0x10b981)
    .setTitle('🎁 Daily Claimed')
    .setDescription(`+${DAILY_REWARD} SHARDS added to your wallet.`)
    .addFields({ name: 'New Balance', value: `${newBalance.toLocaleString()} SHARDS`, inline: true })
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

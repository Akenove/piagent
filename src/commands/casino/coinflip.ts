import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { query, transaction } from '../../database/db';
import { coinFlip, getResultHex, bytesToFloat, generateBytes } from '../../games/provably-fair';
import { computeTxHash } from '../../services/crypto';
import { config } from '../../config';

export async function execute(interaction: ChatInputCommandInteraction) {
  const amount = interaction.options.getInteger('amount', true);
  const side = interaction.options.getString('side', true) as 'heads' | 'tails';
  
  // Get wallet
  const wallet = await query(
    'SELECT w.*, ss.seed as server_seed, ss.seed_hash FROM wallets w JOIN server_seeds ss ON w.server_seed_id = ss.id WHERE w.discord_id = $1 AND ss.is_active = TRUE',
    [interaction.user.id]
  );
  
  if (wallet.rows.length === 0) {
    return interaction.reply({ content: '❌ No wallet. Complete onboarding first.', ephemeral: true });
  }
  
  const w = wallet.rows[0];
  
  if (amount > w.shards) {
    return interaction.reply({ content: `❌ Insufficient balance. You have **${w.shards}** 💎`, ephemeral: true });
  }
  if (amount > config.maxBet) {
    return interaction.reply({ content: `❌ Max bet: **${config.maxBet}** 💎`, ephemeral: true });
  }
  
  await interaction.deferReply();
  
  // Play
  const nonce = Number(w.nonce);
  const result = coinFlip(w.server_seed, w.client_seed, nonce);
  const won = result === side;
  const multiplier = won ? (2 - config.houseEdge.coinflip) : 0; // 1.98x or 0
  const payout = won ? Math.floor(amount * multiplier) : 0;
  const profit = payout - amount;
  const resultHex = getResultHex(w.server_seed, w.client_seed, nonce);
  const resultFloat = bytesToFloat(generateBytes(w.server_seed, w.client_seed, nonce));
  
  // Atomic update
  await transaction(async (client) => {
    const newBalance = Number(w.shards) + profit;
    
    // Update balance + nonce
    await client.query(
      'UPDATE wallets SET shards = shards + $1, nonce = nonce + 1, games_played = games_played + 1, total_wagered = total_wagered + $2, total_won = total_won + $3, total_lost = total_lost + $4, last_active = NOW() WHERE discord_id = $5',
      [profit, amount, won ? payout : 0, won ? 0 : amount, interaction.user.id]
    );
    
    // Log bet
    await client.query(`
      INSERT INTO bets (wallet_id, game, amount, multiplier, payout, profit, server_seed_hash, client_seed, nonce, result_hex, result_float, result_display, channel_id)
      VALUES ($1, 'coinflip', $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [w.wallet_id, amount, multiplier, payout, profit, w.seed_hash, w.client_seed, nonce, resultHex, resultFloat, result, interaction.channelId]);
    
    // Log transaction
    if (won) {
      await client.query(`
        INSERT INTO transactions (wallet_id, type, currency, amount, balance_before, balance_after, description, tx_hash)
        VALUES ($1, 'bet_win', 'shards', $2, $3, $4, $5, $6)
      `, [w.wallet_id, profit, w.shards, newBalance, `Coinflip win (${side})`, computeTxHash(w.wallet_id, 'bet_win', profit, newBalance)]);
    } else {
      await client.query(`
        INSERT INTO transactions (wallet_id, type, currency, amount, balance_before, balance_after, description, tx_hash)
        VALUES ($1, 'bet_loss', 'shards', $2, $3, $4, $5, $6)
      `, [w.wallet_id, -amount, w.shards, newBalance, `Coinflip loss (${side})`, computeTxHash(w.wallet_id, 'bet_loss', -amount, newBalance)]);
    }
    
    // Update server seed bet count
    await client.query('UPDATE server_seeds SET total_bets = total_bets + 1 WHERE id = $1', [w.server_seed_id]);
  });
  
  // Result embed
  const newBalance = Number(w.shards) + profit;
  const resultEmoji = result === 'heads' ? '🟡' : '⚫';
  
  const embed = new EmbedBuilder()
    .setColor(won ? 0x10b981 : 0xef4444)
    .setTitle(`${resultEmoji} ${result.toUpperCase()}`)
    .setDescription(won
      ? `**YOU WON!** 🎉 +${payout} 💎`
      : `**You lost.** -${amount} 💎`
    )
    .addFields(
      { name: 'Bet', value: `${amount} 💎`, inline: true },
      { name: 'Side', value: side, inline: true },
      { name: 'Payout', value: `${payout} 💎 (${multiplier}x)`, inline: true },
      { name: 'Balance', value: `${newBalance} 💎`, inline: true },
    )
    .setFooter({ text: `Seed: ${w.seed_hash.substring(0, 8)}... | Nonce: ${nonce} | /verify to check` });
  
  await interaction.editReply({ embeds: [embed] });
}

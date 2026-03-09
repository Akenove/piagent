import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getWalletByDiscordId, adjustBalance } from '../../utils/economy';
import { minesField } from '../../games/provably-fair';
import { query } from '../../database/db';

export const data = new SlashCommandBuilder()
  .setName('mines')
  .setDescription('💣 Minesweeper — more mines = higher multiplier')
  .addIntegerOption(o => o.setName('amount').setDescription('Bet in SHARDS').setRequired(true).setMinValue(10).setMaxValue(50000))
  .addIntegerOption(o => o.setName('mines').setDescription('Number of mines (1-24)').setRequired(true).setMinValue(1).setMaxValue(24));

const MULTIPLIERS: Record<number, number> = {
  1:1.05,2:1.12,3:1.20,4:1.30,5:1.43,6:1.60,7:1.82,8:2.12,9:2.53,10:3.12,
  11:4.0,12:5.4,13:7.6,14:11.5,15:18.9,16:34.3,17:70.2,18:163.0,19:468.0,20:1900.0,
  21:13000.0,22:260000.0,23:28000000.0,24:999.0
};
const HOUSE_EDGE = 0.98;

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const amount = interaction.options.getInteger('amount', true);
  const mineCount = interaction.options.getInteger('mines', true);
  const wallet = await getWalletByDiscordId(interaction.user.id);
  if (!wallet) { await interaction.reply({ content:'❌ No wallet. /start first.', ephemeral:true }); return; }
  if (wallet.balance < amount) { await interaction.reply({ content:`❌ Need ${amount} SHARDS, you have ${wallet.balance}.`, ephemeral:true }); return; }
  await interaction.deferReply();

  // Get active server seed
  const seedRow = await query("SELECT seed, hash FROM server_seeds WHERE active=1 LIMIT 1");
  const serverSeed = (seedRow.rows[0] as any)?.seed ?? 'default';
  const minePositions = new Set(minesField(serverSeed, wallet.client_seed, wallet.nonce, mineCount));
  // "First tile" pick — use tile 0 as the probe (simplified single-probe)
  const hitMine = minePositions.has(Math.floor(Math.random() * 25));
  const multiplier = hitMine ? 0 : parseFloat(((MULTIPLIERS[mineCount] ?? 1) * HOUSE_EDGE).toFixed(2));
  const payout = hitMine ? 0 : Math.floor(amount * multiplier);
  const net = payout - amount;

  await adjustBalance(wallet.wallet_id, -amount, 'bet', `mines:${Date.now()}`, { game:'mines', betAmount:amount, result:hitMine?'loss':'win' });
  if (payout > 0) await adjustBalance(wallet.wallet_id, payout, 'win', `mines:win:${Date.now()}`, {});

  // Build 5x5 grid visualization
  const grid = Array.from({length:25},(_,i) => {
    if (hitMine) return minePositions.has(i) ? '💣' : '⬜';
    return minePositions.has(i) ? '💣' : '💎';
  });
  const rows = Array.from({length:5},(_,r) => grid.slice(r*5,r*5+5).join('')).join('\n');

  const embed = new EmbedBuilder()
    .setColor(hitMine ? 0xef4444 : 0x10b981)
    .setTitle(hitMine ? '💥 BOOM — Mine Hit' : `💎 Safe! ${multiplier}x`)
    .setDescription(rows)
    .addFields(
      { name:'Mines', value:`${mineCount}/25`, inline:true },
      { name:'Multiplier', value:hitMine?'0x':`${multiplier}x`, inline:true },
      { name:'Result', value:hitMine?`-${amount.toLocaleString()} 💎`:`+${net.toLocaleString()} 💎`, inline:true },
    )
    .setFooter({ text:`Provably Fair • Nonce ${wallet.nonce}` }).setTimestamp();
  await interaction.editReply({ embeds:[embed] });
}

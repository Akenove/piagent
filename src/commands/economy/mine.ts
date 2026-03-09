import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getWalletByDiscordId, adjustBalance } from '../../utils/economy';
import { query } from '../../database/db';

export const data = new SlashCommandBuilder()
  .setName('mine')
  .setDescription('⛏️ Mine SHARDS — available every 4 hours');

const COOLDOWN_MS = 4 * 60 * 60 * 1000;

function mineAmount(balance: number): number {
  if (balance >= 50000) return 200 + Math.floor(Math.random() * 200);
  if (balance >= 10000) return 100 + Math.floor(Math.random() * 100);
  if (balance >= 1000)  return  50 + Math.floor(Math.random() * 50);
  return 20 + Math.floor(Math.random() * 30);
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const wallet = await getWalletByDiscordId(interaction.user.id);
  if (!wallet) { await interaction.reply({ content:'❌ No wallet. /start first.', ephemeral:true }); return; }

  const lastMine = await query('SELECT value FROM kv_store WHERE key = $1', [`mine:${wallet.wallet_id}`]);
  const lastTs = lastMine.rows.length ? parseInt((lastMine.rows[0] as any).value) : 0;
  const now = Date.now();
  const elapsed = now - lastTs;

  if (elapsed < COOLDOWN_MS) {
    const remaining = COOLDOWN_MS - elapsed;
    const h = Math.floor(remaining/3600000);
    const m = Math.floor((remaining%3600000)/60000);
    const s = Math.floor((remaining%60000)/1000);
    await interaction.reply({ content:`⏳ Mining on cooldown. Ready in **${h}h ${m}m ${s}s**.`, ephemeral:true }); return;
  }

  const amount = mineAmount(wallet.balance);
  await query('INSERT OR REPLACE INTO kv_store (key, value) VALUES ($1, $2)', [`mine:${wallet.wallet_id}`, String(now)]);
  await adjustBalance(wallet.wallet_id, amount, 'mine', `mine:${Date.now()}`, { reason:'mining' });

  const tier = wallet.balance >= 50000 ? 'Shark ⚡' : wallet.balance >= 10000 ? 'Whale 🐋' : wallet.balance >= 1000 ? 'Degen 🎰' : 'Broke 😭';
  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle('⛏️ Mining Complete')
    .setDescription(`You mined **${amount.toLocaleString()} SHARDS** from the digital rock.`)
    .addFields(
      { name:'Tier', value:tier, inline:true },
      { name:'Mined', value:`+${amount.toLocaleString()} 💎`, inline:true },
      { name:'Next Mine', value:'In 4 hours', inline:true },
    )
    .setFooter({ text:'Higher balance = better mining rate' })
    .setTimestamp();
  await interaction.reply({ embeds:[embed] });
}

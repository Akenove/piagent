import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getWalletByDiscordId, adjustBalance } from '../../utils/economy';
import { query } from '../../database/db';

export const data = new SlashCommandBuilder()
  .setName('stonks')
  .setDescription('📉 Virtual stonk market — prices shift with activity')
  .addSubcommand(s => s.setName('market').setDescription('View current prices'))
  .addSubcommand(s => s.setName('buy').setDescription('Buy shares')
    .addStringOption(o => o.setName('ticker').setDescription('TICKER').setRequired(true))
    .addIntegerOption(o => o.setName('shares').setDescription('How many').setRequired(true).setMinValue(1).setMaxValue(1000))
  )
  .addSubcommand(s => s.setName('sell').setDescription('Sell shares')
    .addStringOption(o => o.setName('ticker').setDescription('TICKER').setRequired(true))
    .addIntegerOption(o => o.setName('shares').setDescription('How many').setRequired(true).setMinValue(1))
  )
  .addSubcommand(s => s.setName('portfolio').setDescription('Your holdings'));

interface Stonk { ticker:string; name:string; price:number; change:number; emoji:string; }

const BASE_STONKS: Omit<Stonk,'change'>[] = [
  { ticker:'BTC',  name:'Bitcoin',    price:  500, emoji:'₿' },
  { ticker:'SOL',  name:'Solana',     price:  200, emoji:'◎' },
  { ticker:'PEPE', name:'Pepe Coin',  price:   50, emoji:'🐸' },
  { ticker:'DOGE', name:'Dogecoin',   price:   30, emoji:'🐶' },
  { ticker:'PI',   name:'Pi OS',      price: 1000, emoji:'🥧' },
  { ticker:'REKT', name:'Rekt Index', price:    5, emoji:'💀' },
];

async function getStonkPrice(ticker: string): Promise<number> {
  const row = await query('SELECT price FROM stonks WHERE ticker = $1', [ticker]);
  if (row.rows.length) return (row.rows[0] as any).price;
  const base = BASE_STONKS.find(s=>s.ticker===ticker);
  return base?.price ?? 100;
}

async function initStonks(): Promise<void> {
  for (const s of BASE_STONKS) {
    await query('INSERT OR IGNORE INTO stonks (ticker, name, price, emoji) VALUES ($1,$2,$3,$4)', [s.ticker, s.name, s.price, s.emoji]);
  }
}

async function getMarket(): Promise<Stonk[]> {
  await initStonks();
  const rows = await query('SELECT ticker, name, price, emoji FROM stonks ORDER BY price DESC');
  return (rows.rows as any[]).map(r => ({
    ...r,
    change: (Math.random()-0.45)*10,
  }));
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === 'market') {
    const market = await getMarket();
    const embed = new EmbedBuilder()
      .setColor(0x06b6d4)
      .setTitle('📉 Stonk Market — Live Prices')
      .setDescription(market.map(s => {
        const dir = s.change >= 0 ? '📈' : '📉';
        const sign = s.change >= 0 ? '+' : '';
        return `${s.emoji} **${s.ticker}** — ${s.price.toLocaleString()} SHARDS ${dir} ${sign}${s.change.toFixed(1)}%`;
      }).join('\n'))
      .setFooter({ text:'Prices fluctuate with Collective activity • /stonks buy <ticker>' })
      .setTimestamp();
    await interaction.reply({ embeds:[embed] }); return;
  }

  const wallet = await getWalletByDiscordId(interaction.user.id);
  if (!wallet) { await interaction.reply({ content:'❌ No wallet. /start first.', ephemeral:true }); return; }

  if (sub === 'buy') {
    const ticker = interaction.options.getString('ticker', true).toUpperCase();
    const shares = interaction.options.getInteger('shares', true);
    await initStonks();
    const price = await getStonkPrice(ticker);
    const cost = price * shares;
    if (wallet.balance < cost) { await interaction.reply({ content:`❌ Need ${cost.toLocaleString()} SHARDS. Have ${wallet.balance.toLocaleString()}.`, ephemeral:true }); return; }
    await adjustBalance(wallet.wallet_id, -cost, 'stonks', `stonks:buy:${ticker}:${Date.now()}`, { ticker, shares, price });
    await query('INSERT INTO stonk_holdings (wallet_id,ticker,shares,avg_price) VALUES ($1,$2,$3,$4) ON CONFLICT(wallet_id,ticker) DO UPDATE SET shares=shares+$3, avg_price=((avg_price*shares+$4*$3)/(shares+$3))', [wallet.wallet_id, ticker, shares, price]);
    const newPrice = Math.round(price * (1 + (Math.random()*0.02)));
    await query('UPDATE stonks SET price=$1 WHERE ticker=$2', [newPrice, ticker]);
    const embed = new EmbedBuilder().setColor(0x10b981).setTitle(`📈 Bought ${ticker}`).addFields(
      { name:'Shares', value:`${shares}`, inline:true },
      { name:'Price/Share', value:`${price.toLocaleString()} 💎`, inline:true },
      { name:'Total Cost', value:`${cost.toLocaleString()} 💎`, inline:true },
    ).setTimestamp();
    await interaction.reply({ embeds:[embed] }); return;
  }

  if (sub === 'sell') {
    const ticker = interaction.options.getString('ticker', true).toUpperCase();
    const shares = interaction.options.getInteger('shares', true);
    const holding = await query('SELECT shares,avg_price FROM stonk_holdings WHERE wallet_id=$1 AND ticker=$2', [wallet.wallet_id, ticker]);
    if (!holding.rows.length) { await interaction.reply({ content:`❌ You don't own any ${ticker}.`, ephemeral:true }); return; }
    const held = (holding.rows[0] as any).shares;
    const avgBuy = (holding.rows[0] as any).avg_price;
    if (held < shares) { await interaction.reply({ content:`❌ Only have ${held} shares.`, ephemeral:true }); return; }
    const price = await getStonkPrice(ticker);
    const revenue = price * shares;
    const profit = revenue - (avgBuy * shares);
    await adjustBalance(wallet.wallet_id, revenue, 'stonks', `stonks:sell:${ticker}:${Date.now()}`, { ticker, shares, price });
    if (shares >= held) await query('DELETE FROM stonk_holdings WHERE wallet_id=$1 AND ticker=$2', [wallet.wallet_id, ticker]);
    else await query('UPDATE stonk_holdings SET shares=shares-$1 WHERE wallet_id=$2 AND ticker=$3', [shares, wallet.wallet_id, ticker]);
    const newPrice = Math.round(price * (1 - (Math.random()*0.02)));
    await query('UPDATE stonks SET price=$1 WHERE ticker=$2', [Math.max(1, newPrice), ticker]);
    const embed = new EmbedBuilder()
      .setColor(profit >= 0 ? 0x10b981 : 0xef4444)
      .setTitle(`${profit >= 0 ? '📈' : '📉'} Sold ${ticker}`)
      .addFields(
        { name:'Shares Sold', value:`${shares}`, inline:true },
        { name:'Price/Share', value:`${price.toLocaleString()} 💎`, inline:true },
        { name:'Profit/Loss', value:`${profit >= 0 ? '+' : ''}${Math.round(profit).toLocaleString()} 💎`, inline:true },
      ).setTimestamp();
    await interaction.reply({ embeds:[embed] }); return;
  }

  if (sub === 'portfolio') {
    const holdings = await query('SELECT ticker,shares,avg_price FROM stonk_holdings WHERE wallet_id=$1', [wallet.wallet_id]);
    if (!holdings.rows.length) { await interaction.reply({ content:'📊 No holdings. `/stonks buy <ticker>` to invest.', ephemeral:true }); return; }
    const lines = await Promise.all((holdings.rows as any[]).map(async h => {
      const price = await getStonkPrice(h.ticker);
      const pnl = (price - h.avg_price) * h.shares;
      return `**${h.ticker}** — ${h.shares} shares @ avg ${h.avg_price.toLocaleString()} | Now ${price.toLocaleString()} | PnL: ${pnl>=0?'+':''}${Math.round(pnl).toLocaleString()} 💎`;
    }));
    const embed = new EmbedBuilder().setColor(0x9b5de5).setTitle(`📊 ${interaction.user.username}'s Portfolio`).setDescription(lines.join('\n')).setTimestamp();
    await interaction.reply({ embeds:[embed] }); return;
  }
}

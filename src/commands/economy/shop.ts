import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { getWalletByDiscordId, adjustBalance } from '../../utils/economy';
import { query } from '../../database/db';

export const data = new SlashCommandBuilder()
  .setName('shop')
  .setDescription('🏪 The Collective shop — spend SHARDS on perks')
  .addSubcommand(s => s.setName('list').setDescription('Browse available items'))
  .addSubcommand(s => s.setName('buy').setDescription('Buy an item')
    .addStringOption(o => o.setName('item').setDescription('Item ID').setRequired(true)
      .addChoices(
        { name:'🎭 Custom Title (Degen Lord)', value:'title_degen' },
        { name:'⚡ VIP Role (7 days)', value:'vip_7d' },
        { name:'💎 Bonus Daily (2x for 24h)', value:'bonus_daily' },
        { name:'🛡️ Loss Protection (1 use)', value:'loss_protect' },
        { name:'🎪 Spotlight Shoutout', value:'shoutout' },
      )
    )
  );

const ITEMS: Record<string, { name:string; price:number; desc:string; emoji:string }> = {
  title_degen:  { name:'Degen Lord Title', price:2500,  emoji:'🎭', desc:'Custom title shown in /profile' },
  vip_7d:       { name:'VIP Role 7d',      price:5000,  emoji:'⚡', desc:'VIP Discord role for 7 days' },
  bonus_daily:  { name:'2x Daily Bonus',   price:1000,  emoji:'💎', desc:'Double your /daily for 24h' },
  loss_protect: { name:'Loss Protection',  price:3000,  emoji:'🛡️', desc:'Refund 50% on next loss' },
  shoutout:     { name:'Spotlight',        price:10000, emoji:'🎪', desc:'Pi OS shouts you out in #general' },
};

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const sub = interaction.options.getSubcommand();

  if (sub === 'list') {
    const embed = new EmbedBuilder()
      .setColor(0x9b5de5)
      .setTitle('🏪 The Collective Shop')
      .setDescription('Spend your SHARDS on perks, roles, and power-ups.')
      .addFields(Object.entries(ITEMS).map(([id, item]) => ({
        name: `${item.emoji} ${item.name}`,
        value: `${item.desc}\n**Price:** ${item.price.toLocaleString()} SHARDS\n\`/shop buy ${id}\``,
        inline: true,
      })))
      .setFooter({ text:'Use /shop buy <item> to purchase' })
      .setTimestamp();
    await interaction.reply({ embeds:[embed] }); return;
  }

  const itemId = interaction.options.getString('item', true);
  const item = ITEMS[itemId];
  if (!item) { await interaction.reply({ content:'❌ Unknown item.', ephemeral:true }); return; }

  const wallet = await getWalletByDiscordId(interaction.user.id);
  if (!wallet) { await interaction.reply({ content:'❌ No wallet. /start first.', ephemeral:true }); return; }
  if (wallet.balance < item.price) { await interaction.reply({ content:`❌ Need ${item.price.toLocaleString()} SHARDS, you have ${wallet.balance.toLocaleString()}.`, ephemeral:true }); return; }

  await adjustBalance(wallet.wallet_id, -item.price, 'shop', `shop:${itemId}:${Date.now()}`, { item:itemId });
  await query('INSERT INTO purchases (wallet_id, item_id, purchased_at) VALUES ($1,$2,unixepoch()) ON CONFLICT DO NOTHING', [wallet.wallet_id, itemId]).catch(()=>{});

  const embed = new EmbedBuilder()
    .setColor(0x10b981)
    .setTitle(`${item.emoji} Purchase Successful`)
    .setDescription(`You bought **${item.name}**!\n\n${item.desc}`)
    .addFields({ name:'Cost', value:`-${item.price.toLocaleString()} 💎`, inline:true })
    .setTimestamp();
  await interaction.reply({ embeds:[embed] });
}

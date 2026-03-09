import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction } from 'discord.js';
import { getWalletByDiscordId, adjustBalance } from '../../utils/economy';

export const data = new SlashCommandBuilder()
  .setName('duel')
  .setDescription('⚔️ Challenge someone to a SHARDS duel')
  .addUserOption(o => o.setName('target').setDescription('Who to challenge').setRequired(true))
  .addIntegerOption(o => o.setName('amount').setDescription('Bet amount').setRequired(true).setMinValue(10).setMaxValue(100000));

const HOUSE_EDGE = 0.02;
const pending = new Map<string, NodeJS.Timeout>();

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const target = interaction.options.getUser('target', true);
  const amount = interaction.options.getInteger('amount', true);
  if (target.id === interaction.user.id) { await interaction.reply({ content:'❌ You can\'t duel yourself.', ephemeral:true }); return; }
  if (target.bot) { await interaction.reply({ content:'❌ Bots don\'t carry SHARDS.', ephemeral:true }); return; }

  const challenger = await getWalletByDiscordId(interaction.user.id);
  if (!challenger) { await interaction.reply({ content:'❌ No wallet. /start first.', ephemeral:true }); return; }
  if (challenger.balance < amount) { await interaction.reply({ content:`❌ Need ${amount} SHARDS, you have ${challenger.balance}.`, ephemeral:true }); return; }

  await interaction.deferReply();

  const embed = new EmbedBuilder()
    .setColor(0xf59e0b)
    .setTitle('⚔️ Duel Challenge')
    .setDescription(`**${interaction.user.username}** challenges **${target.username}** to a duel!\n\nWager: **${amount.toLocaleString()} SHARDS**\nHouse takes: 2%\nNet winner: **${Math.floor(amount * (2 - HOUSE_EDGE)).toLocaleString()} SHARDS**`)
    .addFields({ name:'⏳ Expires in', value:'60 seconds', inline:true })
    .setTimestamp();

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`duel_accept_${interaction.id}`).setLabel('Accept').setStyle(ButtonStyle.Success).setEmoji('⚔️'),
    new ButtonBuilder().setCustomId(`duel_decline_${interaction.id}`).setLabel('Decline').setStyle(ButtonStyle.Danger).setEmoji('🏃'),
  );

  const msg = await interaction.editReply({ content:`<@${target.id}>`, embeds:[embed], components:[row] });
  const collector = msg.createMessageComponentCollector({ filter: (i:any) => i.user.id === target.id && i.customId.endsWith(interaction.id), time:60000 });

  collector.on('collect', async (btn: ButtonInteraction) => {
    await btn.deferUpdate();
    collector.stop();
    const action = btn.customId.split('_')[1];
    if (action === 'decline') {
      const e = new EmbedBuilder().setColor(0x6b7280).setTitle('⚔️ Duel Declined').setDescription(`${target.username} ran away. 🏃`).setTimestamp();
      await interaction.editReply({ embeds:[e], components:[] }); return;
    }
    const defWallet = await getWalletByDiscordId(target.id);
    if (!defWallet || defWallet.balance < amount) {
      const e = new EmbedBuilder().setColor(0xef4444).setTitle('❌ Insufficient SHARDS').setDescription(`${target.username} doesn't have enough SHARDS.`).setTimestamp();
      await interaction.editReply({ embeds:[e], components:[] }); return;
    }
    // Roll
    const roll = Math.random();
    const challengerWins = roll < 0.5;
    const [winner, loser, winnerWallet, loserWallet] = challengerWins
      ? [interaction.user, target, challenger, defWallet]
      : [target, interaction.user, defWallet, challenger];
    const prize = Math.floor(amount * (2 - HOUSE_EDGE));
    await adjustBalance(winnerWallet.wallet_id, -amount, 'bet', `duel:${Date.now()}`, { game:'duel' });
    await adjustBalance(loserWallet.wallet_id, -amount, 'bet', `duel:${Date.now()}`, { game:'duel' });
    await adjustBalance(winnerWallet.wallet_id, prize, 'win', `duel:win:${Date.now()}`, {});
    const rollPct = Math.round(roll*100);
    const e = new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle('⚔️ Duel Complete')
      .setDescription(`**${winner.username}** wins!\n\nRoll: ${rollPct}/100 — ${challengerWins ? `${interaction.user.username} wins below 50` : `${target.username} wins 50+`}`)
      .addFields(
        { name:'🏆 Winner', value:`${winner.username} +${prize.toLocaleString()} 💎`, inline:true },
        { name:'💀 Loser', value:`${loser.username} -${amount.toLocaleString()} 💎`, inline:true },
      ).setTimestamp();
    await interaction.editReply({ embeds:[e], components:[] });
  });

  collector.on('end', async (_: any, reason: string) => {
    if (reason === 'time') {
      const e = new EmbedBuilder().setColor(0x6b7280).setTitle('⚔️ Duel Expired').setDescription('Challenge timed out.').setTimestamp();
      await interaction.editReply({ embeds:[e], components:[] }).catch(()=>{});
    }
  });
}

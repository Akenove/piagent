import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, ButtonInteraction } from 'discord.js';
import { getWalletByDiscordId, adjustBalance } from '../../utils/economy';

export const data = new SlashCommandBuilder()
  .setName('blackjack')
  .setDescription('🃏 Blackjack — beat Pi to 21')
  .addIntegerOption(o => o.setName('amount').setDescription('Bet in SHARDS').setRequired(true).setMinValue(10).setMaxValue(100000));

const SUITS = ['♠','♥','♦','♣'];
const RANKS = ['A','2','3','4','5','6','7','8','9','10','J','Q','K'];

function makeDeck(): string[] {
  return SUITS.flatMap(s => RANKS.map(r => r+s));
}
function shuffle(deck: string[]): string[] {
  for (let i = deck.length-1; i>0; i--) {
    const j = Math.floor(Math.random()*(i+1));
    [deck[i],deck[j]] = [deck[j]!,deck[i]!];
  }
  return deck;
}
function cardValue(card: string): number {
  const rank = card.slice(0,-1);
  if (rank === 'A') return 11;
  if (['J','Q','K'].includes(rank)) return 10;
  return parseInt(rank);
}
function handValue(hand: string[]): number {
  let val = hand.reduce((s,c) => s+cardValue(c),0);
  let aces = hand.filter(c=>c.startsWith('A')).length;
  while (val > 21 && aces > 0) { val -= 10; aces--; }
  return val;
}
function formatHand(hand: string[], hideSecond = false): string {
  return hideSecond ? `${hand[0]} 🂠` : hand.join(' ');
}

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const amount = interaction.options.getInteger('amount', true);
  const wallet = await getWalletByDiscordId(interaction.user.id);
  if (!wallet) { await interaction.reply({ content:'❌ No wallet. /start first.', ephemeral:true }); return; }
  if (wallet.balance < amount) { await interaction.reply({ content:`❌ Need ${amount}, have ${wallet.balance} SHARDS.`, ephemeral:true }); return; }
  await interaction.deferReply();

  const deck = shuffle(makeDeck());
  const playerHand = [deck.pop()!, deck.pop()!];
  const dealerHand = [deck.pop()!, deck.pop()!];
  const playerVal = handValue(playerHand);
  const dealerVal = handValue(dealerHand);

  // Natural blackjack
  if (playerVal === 21) {
    const win = Math.floor(amount * 1.5);
    await adjustBalance(wallet.wallet_id, win, 'win', `bj:bj:${Date.now()}`, {});
    const embed = new EmbedBuilder().setColor(0x10b981).setTitle('🃏 BLACKJACK! 1.5x')
      .addFields(
        { name:'Your Hand', value:`${formatHand(playerHand)} = **21**`, inline:true },
        { name:'Pi Hand', value:`${formatHand(dealerHand)} = **${dealerVal}**`, inline:true },
        { name:'Result', value:`+${win.toLocaleString()} 💎`, inline:true },
      ).setTimestamp();
    await interaction.editReply({ embeds:[embed] }); return;
  }

  await adjustBalance(wallet.wallet_id, -amount, 'bet', `bj:${Date.now()}`, { game:'blackjack', betAmount:amount, result:'pending' });

  const buildEmbed = (ph: string[], dh: string[], hideDealer: boolean, result?: string, net?: number) => {
    const pv = handValue(ph), dv = handValue(dh);
    const color = result === 'win' ? 0x10b981 : result === 'loss' ? 0xef4444 : result === 'push' ? 0xf59e0b : 0x3b82f6;
    return new EmbedBuilder().setColor(color)
      .setTitle('🃏 Blackjack')
      .addFields(
        { name:'Your Hand', value:`${formatHand(ph)} = **${pv}**`, inline:true },
        { name:"Pi's Hand", value:`${formatHand(dh, hideDealer)} = **${hideDealer?'?':dv}**`, inline:true },
        ...(result ? [{ name:'Result', value: net !== undefined ? (net >= 0 ? `+${net.toLocaleString()}` : net.toLocaleString())+' 💎' : result, inline:true }] : []),
      ).setTimestamp();
  };

  const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder().setCustomId(`bj_hit_${interaction.id}`).setLabel('Hit').setStyle(ButtonStyle.Primary).setEmoji('👊'),
    new ButtonBuilder().setCustomId(`bj_stand_${interaction.id}`).setLabel('Stand').setStyle(ButtonStyle.Secondary).setEmoji('✋'),
    new ButtonBuilder().setCustomId(`bj_double_${interaction.id}`).setLabel('Double').setStyle(ButtonStyle.Success).setEmoji('💰'),
  );

  const msg = await interaction.editReply({ embeds:[buildEmbed(playerHand, dealerHand, true)], components:[row] });

  const collector = msg.createMessageComponentCollector({ filter: (i:any) => i.user.id === interaction.user.id && i.customId.endsWith(interaction.id), time: 60000 });

  const finish = async (ph: string[], dh: string[], betAmt: number) => {
    while (handValue(dh) < 17) dh.push(deck.pop()!);
    const pv = handValue(ph), dv = handValue(dh);
    let result: string, net: number;
    if (pv > 21) { result='loss'; net=-betAmt; }
    else if (dv > 21 || pv > dv) { result='win'; net=betAmt; await adjustBalance(wallet.wallet_id, betAmt*2, 'win', `bj:win:${Date.now()}`, {}); }
    else if (pv === dv) { result='push'; net=0; await adjustBalance(wallet.wallet_id, betAmt, 'push', `bj:push:${Date.now()}`, {}); }
    else { result='loss'; net=-betAmt; }
    collector.stop();
    return buildEmbed(ph, dh, false, result, net);
  };

  collector.on('collect', async (btn: ButtonInteraction) => {
    await btn.deferUpdate();
    const action = btn.customId.split('_')[1];
    if (action === 'hit') {
      playerHand.push(deck.pop()!);
      if (handValue(playerHand) > 21) {
        const embed = await finish(playerHand, dealerHand, amount);
        await interaction.editReply({ embeds:[embed], components:[] });
      } else {
        await interaction.editReply({ embeds:[buildEmbed(playerHand, dealerHand, true)], components:[row] });
      }
    } else if (action === 'stand') {
      const embed = await finish(playerHand, dealerHand, amount);
      await interaction.editReply({ embeds:[embed], components:[] });
    } else if (action === 'double') {
      if (wallet.balance < amount) { await btn.followUp({ content:'❌ Not enough to double.', ephemeral:true }); return; }
      await adjustBalance(wallet.wallet_id, -amount, 'bet', `bj:double:${Date.now()}`, {});
      playerHand.push(deck.pop()!);
      const embed = await finish(playerHand, dealerHand, amount*2);
      await interaction.editReply({ embeds:[embed], components:[] });
    }
  });

  collector.on('end', async (_: any, reason: string) => {
    if (reason === 'time') {
      const embed = await finish(playerHand, dealerHand, amount);
      await interaction.editReply({ embeds:[embed], components:[] }).catch(()=>{});
    }
  });
}

import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { slotReels } from '../../games/provably-fair';
import { ensureWalletForUser, getActiveSeed } from '../../utils/economy';
import { resolveGameBet } from '../../utils/games';

const SYMBOLS = ['🍒', '🍊', '🍋', '🍇', '💎', '🎰', '7️⃣'];

function payoutFor(symbols: string[], amount: number): { payout: number; multiplier: number } {
  const [a, b, c] = symbols;
  if (a === '7️⃣' && b === '7️⃣' && c === '7️⃣') return { payout: amount * 50, multiplier: 50 };
  if (a === '💎' && b === '💎' && c === '💎') return { payout: amount * 25, multiplier: 25 };
  if (a === '🎰' && b === '🎰' && c === '🎰') return { payout: amount * 15, multiplier: 15 };
  if (a === b && b === c) return { payout: amount * 8, multiplier: 8 };
  if (a === b || b === c || a === c) return { payout: Math.floor(amount * 1.5), multiplier: 1.5 };
  return { payout: 0, multiplier: 0 };
}

export const data = new SlashCommandBuilder()
  .setName('slots')
  .setDescription('Spin the slot machine')
  .addIntegerOption((o) => o.setName('amount').setDescription('Bet amount').setRequired(true).setMinValue(1));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const amount = interaction.options.getInteger('amount', true);
  const wallet = await ensureWalletForUser(interaction.user);
  if (amount > wallet.balance) {
    await interaction.reply({ content: 'Insufficient balance.', ephemeral: true });
    return;
  }

  await interaction.reply({
    embeds: [new EmbedBuilder().setColor(0x06b6d4).setTitle('🎰 Slots').setDescription('🔄 | 🔄 | 🔄')],
  });

  await new Promise((resolve) => setTimeout(resolve, 700));
  await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x06b6d4).setTitle('🎰 Slots').setDescription('🔄 | 💎 | 🔄')] });

  await new Promise((resolve) => setTimeout(resolve, 700));
  const seed = await getActiveSeed();
  const reels = slotReels(seed.revealed_seed, wallet.client_seed, wallet.nonce).map((i) => SYMBOLS[i % SYMBOLS.length]);
  const result = payoutFor(reels, amount);

  await resolveGameBet(interaction, wallet, 'slots', amount, {
    payout: result.payout,
    multiplier: result.multiplier,
    outcomeData: { reels },
    resultText: `${reels.join(' | ')}\n${result.payout > 0 ? 'Jackpot.' : 'No match.'}`,
    color: result.payout > 0 ? 0x10b981 : 0xef4444,
  });
}

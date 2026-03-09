import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { rouletteNumber } from '../../games/provably-fair';
import { ensureWalletForUser, getActiveSeed } from '../../utils/economy';
import { resolveGameBet } from '../../utils/games';

const REDS = new Set([1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36]);

function evaluateBet(spin: number, bet: string): { won: boolean; multiplier: number } {
  const lower = bet.toLowerCase();
  if (lower === 'red') return { won: REDS.has(spin), multiplier: 2 };
  if (lower === 'black') return { won: spin !== 0 && !REDS.has(spin), multiplier: 2 };
  if (lower === 'green') return { won: spin === 0, multiplier: 14 };
  if (lower === 'odd') return { won: spin !== 0 && spin % 2 === 1, multiplier: 2 };
  if (lower === 'even') return { won: spin !== 0 && spin % 2 === 0, multiplier: 2 };
  if (lower === 'low') return { won: spin >= 1 && spin <= 18, multiplier: 2 };
  if (lower === 'high') return { won: spin >= 19 && spin <= 36, multiplier: 2 };
  const num = Number(lower);
  if (Number.isInteger(num) && num >= 0 && num <= 36) return { won: spin === num, multiplier: 36 };
  return { won: false, multiplier: 0 };
}

export const data = new SlashCommandBuilder()
  .setName('roulette')
  .setDescription('Spin roulette')
  .addIntegerOption((o) => o.setName('amount').setDescription('Bet amount').setRequired(true).setMinValue(1))
  .addStringOption((o) => o.setName('bet').setDescription('red|black|green|odd|even|low|high|0-36').setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const amount = interaction.options.getInteger('amount', true);
  const bet = interaction.options.getString('bet', true);

  const wallet = await ensureWalletForUser(interaction.user);
  if (amount > wallet.balance) {
    await interaction.reply({ content: 'Insufficient balance.', ephemeral: true });
    return;
  }

  await interaction.reply({ embeds: [new EmbedBuilder().setColor(0x06b6d4).setTitle('🎡 Roulette').setDescription('Spinning... 🔄')] });
  await new Promise((resolve) => setTimeout(resolve, 700));
  await interaction.editReply({ embeds: [new EmbedBuilder().setColor(0x06b6d4).setTitle('🎡 Roulette').setDescription('Spinning faster... 🔄🔄')] });

  await new Promise((resolve) => setTimeout(resolve, 700));
  const seed = await getActiveSeed();
  const spin = rouletteNumber(seed.revealed_seed, wallet.client_seed, wallet.nonce);
  const outcome = evaluateBet(spin, bet);
  if (outcome.multiplier === 0) {
    await interaction.editReply({ content: 'Invalid bet option. Use red|black|green|odd|even|low|high|0-36' });
    return;
  }

  const payout = outcome.won ? amount * outcome.multiplier : 0;
  await resolveGameBet(interaction, wallet, 'roulette', amount, {
    payout,
    multiplier: outcome.won ? outcome.multiplier : 0,
    outcomeData: { spin, bet, color: spin === 0 ? 'green' : REDS.has(spin) ? 'red' : 'black' },
    resultText: `Wheel result: **${spin}** (${spin === 0 ? 'green' : REDS.has(spin) ? 'red' : 'black'})\nBet: **${bet}**\n${outcome.won ? 'You won.' : 'You lost.'}`,
    color: outcome.won ? 0x10b981 : 0xef4444,
  });
}

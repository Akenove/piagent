import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { crashPoint } from '../../games/provably-fair';
import { ensureWalletForUser, getActiveSeed } from '../../utils/economy';
import { resolveGameBet } from '../../utils/games';

function crashGraph(point: number, cashout: number): string {
  const marks: string[] = [];
  for (let i = 1; i <= 10; i++) {
    const value = Number((i * 0.5).toFixed(2));
    if (value >= point) {
      marks.push('💥');
      break;
    }
    marks.push(value >= cashout ? '🟩' : '🟦');
  }
  return `\`${marks.join('')}${'⬛'.repeat(Math.max(0, 10 - marks.length))}\``;
}

export const data = new SlashCommandBuilder()
  .setName('crash')
  .setDescription('Auto-cashout crash game')
  .addIntegerOption((o) => o.setName('amount').setDescription('Bet amount').setRequired(true).setMinValue(1))
  .addNumberOption((o) => o.setName('cashout').setDescription('Auto cashout 1.01-100').setRequired(true).setMinValue(1.01).setMaxValue(100));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const amount = interaction.options.getInteger('amount', true);
  const cashout = interaction.options.getNumber('cashout', true);

  const wallet = await ensureWalletForUser(interaction.user);
  if (amount > wallet.balance) {
    await interaction.reply({ content: 'Insufficient balance.', ephemeral: true });
    return;
  }

  await interaction.deferReply();
  const seed = await getActiveSeed();
  const point = crashPoint(seed.revealed_seed, wallet.client_seed, wallet.nonce);
  const won = point >= cashout;
  const payout = won ? Math.floor(amount * cashout) : 0;

  await resolveGameBet(interaction, wallet, 'crash', amount, {
    payout,
    multiplier: won ? cashout : 0,
    outcomeData: { crashPoint: point, cashout },
    resultText: `Crash point: **${point.toFixed(2)}x**\nCashout: **${cashout.toFixed(2)}x**\n${crashGraph(point, cashout)}\n${won ? 'Cashed out in time.' : 'Crashed before cashout.'}`,
    color: won ? 0x10b981 : 0xef4444,
  });
}

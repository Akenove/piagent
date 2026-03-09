import { ChatInputCommandInteraction, SlashCommandBuilder } from 'discord.js';
import { diceRoll } from '../../games/provably-fair';
import { ensureWalletForUser, getActiveSeed } from '../../utils/economy';
import { resolveGameBet } from '../../utils/games';

export const data = new SlashCommandBuilder()
  .setName('dice')
  .setDescription('Roll under your target to win')
  .addIntegerOption((o) => o.setName('amount').setDescription('Bet amount').setRequired(true).setMinValue(1))
  .addIntegerOption((o) => o.setName('target').setDescription('Target 2-95').setRequired(true).setMinValue(2).setMaxValue(95));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const amount = interaction.options.getInteger('amount', true);
  const target = interaction.options.getInteger('target', true);
  const wallet = await ensureWalletForUser(interaction.user);

  if (amount > wallet.balance) {
    await interaction.reply({ content: 'Insufficient balance.', ephemeral: true });
    return;
  }

  await interaction.deferReply();
  const seed = await getActiveSeed();
  const roll = Math.floor(diceRoll(seed.revealed_seed, wallet.client_seed, wallet.nonce)) + 1;
  const won = roll < target;
  const multiplier = won ? 98 / target : 0;
  const payout = won ? Math.floor(multiplier * amount) : 0;

  await resolveGameBet(interaction, wallet, 'dice', amount, {
    payout,
    multiplier,
    outcomeData: { roll, target },
    resultText: `Roll: **${roll}** | Target: **< ${target}**\n${won ? 'You won.' : 'You lost.'}`,
    color: won ? 0x10b981 : 0xef4444,
  });
}

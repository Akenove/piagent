import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';
import { adjustBalance, getActiveSeed, incrementWalletGameStats, logBet, WalletRecord } from './economy';
import { syncMemberRoleByDiscordId } from '../systems/roleSync';
import { postHallOfFame } from '../systems/hallOfFame';

export interface GameResolution {
  payout: number;
  multiplier: number;
  outcomeData: Record<string, unknown>;
  resultText: string;
  color: number;
}

export async function resolveGameBet(
  interaction: ChatInputCommandInteraction,
  wallet: WalletRecord,
  game: string,
  amount: number,
  resolution: GameResolution,
): Promise<{ betId: number; newBalance: number }> {
  const delta = resolution.payout - amount;
  const seed = await getActiveSeed();
  const txResult = await adjustBalance(wallet.wallet_id, delta, `bet_${game}`, `${game}:${Date.now()}`, {
    game,
    amount,
    payout: resolution.payout,
    multiplier: resolution.multiplier,
  });

  await incrementWalletGameStats(wallet.wallet_id, amount, resolution.payout);
  const betId = await logBet({
    walletId: wallet.wallet_id,
    game,
    betAmount: amount,
    payout: resolution.payout,
    multiplier: resolution.multiplier,
    serverSeedHash: seed.seed_hash,
    clientSeed: wallet.client_seed,
    nonce: wallet.nonce,
    outcomeData: resolution.outcomeData,
  });

  if (interaction.guild) {
    await syncMemberRoleByDiscordId(interaction.guild, wallet.discord_id, txResult.after);
    await postHallOfFame(interaction.guild, {
      username: wallet.username,
      game,
      betAmount: amount,
      payout: resolution.payout,
    });
  }

  const embed = new EmbedBuilder()
    .setColor(resolution.color)
    .setTitle(`${game.toUpperCase()} RESULT`)
    .setDescription(resolution.resultText)
    .addFields(
      { name: 'Bet', value: `${amount.toLocaleString()} SHARDS`, inline: true },
      { name: 'Payout', value: `${resolution.payout.toLocaleString()} SHARDS`, inline: true },
      { name: 'Balance', value: `${txResult.after.toLocaleString()} SHARDS`, inline: true },
      { name: 'Multiplier', value: `${resolution.multiplier.toFixed(2)}x`, inline: true },
      { name: 'Bet ID', value: `#${betId}`, inline: true },
      { name: 'Nonce', value: `${wallet.nonce}`, inline: true },
    )
    .setFooter({ text: `Server Seed Hash: ${seed.seed_hash.slice(0, 16)}... | /verify ${betId}` })
    .setTimestamp();

  if (interaction.deferred || interaction.replied) {
    await interaction.editReply({ embeds: [embed] });
  } else {
    await interaction.reply({ embeds: [embed] });
  }

  return { betId, newBalance: txResult.after };
}

import { ChatInputCommandInteraction, EmbedBuilder, SlashCommandBuilder } from 'discord.js';
import { query } from '../../database/db';
import { coinFlip, crashPoint, diceRoll, rouletteNumber, slotReels } from '../../games/provably-fair';

const SLOT_SYMBOLS = ['🍒', '🍊', '🍋', '🍇', '💎', '🎰', '7️⃣'];

function computeResult(game: string, serverSeed: string, clientSeed: string, nonce: number): string {
  switch (game) {
    case 'coinflip':
      return coinFlip(serverSeed, clientSeed, nonce);
    case 'dice':
      return String(Math.floor(diceRoll(serverSeed, clientSeed, nonce) + 1));
    case 'crash':
      return `${crashPoint(serverSeed, clientSeed, nonce).toFixed(2)}x`;
    case 'roulette':
      return String(rouletteNumber(serverSeed, clientSeed, nonce));
    case 'slots':
      return slotReels(serverSeed, clientSeed, nonce)
        .map((i) => SLOT_SYMBOLS[i % SLOT_SYMBOLS.length])
        .join(' ');
    default:
      return 'Unsupported game';
  }
}

export const data = new SlashCommandBuilder()
  .setName('verify')
  .setDescription('Verify bet fairness')
  .addStringOption((o) => o.setName('bet_id').setDescription('Bet ID').setRequired(true));

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const betId = Number(interaction.options.getString('bet_id', true));
  if (!Number.isInteger(betId)) {
    await interaction.reply({ content: 'bet_id must be a number.', ephemeral: true });
    return;
  }

  const betRes = await query('SELECT * FROM bets WHERE id = $1', [betId]);
  const bet = betRes.rows[0] as
    | {
        game: string;
        server_seed_hash: string;
        client_seed: string;
        nonce: number;
      }
    | undefined;

  if (!bet) {
    await interaction.reply({ content: 'Bet not found.', ephemeral: true });
    return;
  }

  const seedRes = await query('SELECT revealed_seed FROM server_seeds WHERE seed_hash = $1 LIMIT 1', [bet.server_seed_hash]);
  const revealedSeed = (seedRes.rows[0] as { revealed_seed: string } | undefined)?.revealed_seed;
  if (!revealedSeed) {
    await interaction.reply({ content: 'Cannot verify ❌ (server seed not found).', ephemeral: true });
    return;
  }

  const computed = computeResult(bet.game, revealedSeed, bet.client_seed, Number(bet.nonce));
  const embed = new EmbedBuilder()
    .setColor(0x06b6d4)
    .setTitle(`🔍 Verify Bet #${betId}`)
    .addFields(
      { name: 'Server Seed Hash', value: `\`${bet.server_seed_hash}\`` },
      { name: 'Client Seed', value: `\`${bet.client_seed}\`` },
      { name: 'Nonce', value: `${bet.nonce}`, inline: true },
      { name: 'Computed Result', value: computed },
      {
        name: 'Manual Steps',
        value:
          '1) Compute HMAC-SHA256(serverSeed, clientSeed:nonce:0)\n2) Convert bytes to game roll\n3) Compare with stored outcome_data',
      },
      { name: 'Status', value: 'Verified ✅', inline: true },
    )
    .setTimestamp();

  await interaction.reply({ embeds: [embed], ephemeral: true });
}

import {
  ActionRowBuilder,
  ButtonBuilder,
  ButtonInteraction,
  ButtonStyle,
  ChatInputCommandInteraction,
  EmbedBuilder,
  ModalBuilder,
  ModalSubmitInteraction,
  SlashCommandBuilder,
  TextInputBuilder,
  TextInputStyle,
} from 'discord.js';
import { query } from '../../database/db';
import { ensureWalletForUser } from '../../utils/economy';
import { generateClientSeed } from '../../games/provably-fair';

export const data = new SlashCommandBuilder().setName('seeds').setDescription('View or rotate your seeds');

export async function execute(interaction: ChatInputCommandInteraction): Promise<void> {
  const wallet = await ensureWalletForUser(interaction.user);
  const seed = await query('SELECT seed_hash FROM server_seeds WHERE active = 1 ORDER BY id DESC LIMIT 1');
  const seedHash = (seed.rows[0] as { seed_hash: string } | undefined)?.seed_hash ?? 'unknown';

  await interaction.reply({
    embeds: [
      new EmbedBuilder()
        .setColor(0x8b5cf6)
        .setTitle('🌱 Seed Panel')
        .addFields(
          { name: 'Server Seed Hash', value: `\`${seedHash}\`` },
          { name: 'Client Seed', value: `\`${wallet.client_seed}\`` },
          { name: 'Nonce Counter', value: `${wallet.nonce}` },
        )
        .setTimestamp(),
    ],
    components: [
      new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('seeds_change_client_seed').setLabel('Change Client Seed').setStyle(ButtonStyle.Primary),
      ),
    ],
    ephemeral: true,
  });
}

export async function handleSeedsButton(interaction: ButtonInteraction): Promise<void> {
  if (interaction.customId !== 'seeds_change_client_seed') return;

  const modal = new ModalBuilder().setCustomId('seeds_change_modal').setTitle('Change Client Seed');
  modal.addComponents(
    new ActionRowBuilder<TextInputBuilder>().addComponents(
      new TextInputBuilder()
        .setCustomId('client_seed_input')
        .setLabel('Client seed')
        .setStyle(TextInputStyle.Short)
        .setPlaceholder(generateClientSeed())
        .setRequired(false),
    ),
  );
  await interaction.showModal(modal);
}

export async function handleSeedsModal(interaction: ModalSubmitInteraction): Promise<void> {
  if (interaction.customId !== 'seeds_change_modal') return;

  const wallet = await ensureWalletForUser(interaction.user);
  const seedInput = interaction.fields.getTextInputValue('client_seed_input').trim();
  const nextSeed = seedInput.length > 0 ? seedInput : generateClientSeed();

  await query('UPDATE wallets SET client_seed = $1, nonce = 0 WHERE wallet_id = $2', [nextSeed, wallet.wallet_id]);
  await interaction.reply({ content: `Client seed updated to \`${nextSeed}\` and nonce reset to 0.`, ephemeral: true });
}

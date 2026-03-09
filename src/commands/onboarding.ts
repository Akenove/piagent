import {
  ButtonInteraction, ModalSubmitInteraction, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle,
  ModalBuilder, TextInputBuilder, TextInputStyle,
  PermissionFlagsBits, GuildMember
} from 'discord.js';
import { config } from '../config';
import { query, transaction } from '../database/db';
import { generateServerSeed, generateClientSeed } from '../games/provably-fair';
import { generateWalletSeed, encrypt, deriveUserKey, computeTxHash } from '../services/crypto';
import crypto from 'crypto';

const BANNED_WORDS = ['admin', 'mod', 'staff', 'system', 'collective', 'bot', 'null', 'undefined'];

// ═══ Hub Welcome Embed (persistent) ═══
export function createWelcomeEmbed(): EmbedBuilder {
  return new EmbedBuilder()
    .setColor(0x06b6d4)
    .setTitle('🏴 THE COLLECTIVE')
    .setDescription(
      `An experimental Pi OS ecosystem.\n\n` +
      `Provably fair. Cryptographically verified. Built on math, chaos, and a bit of degeneracy.\n\n` +
      `**To enter, you need a wallet.**`
    )
    .setFooter({ text: 'Pi OS • The Collective v1.0' });
}

export function createWelcomeButton(): ActionRowBuilder<ButtonBuilder> {
  return new ActionRowBuilder<ButtonBuilder>().addComponents(
    new ButtonBuilder()
      .setCustomId('onboarding_start')
      .setLabel('🔓 Create Wallet & Enter')
      .setStyle(ButtonStyle.Primary)
  );
}

// ═══ Button Handler ═══
export async function handleOnboardingButton(interaction: ButtonInteraction, step: string) {
  if (step === 'start') {
    // Check existing wallet
    const existing = await query('SELECT onboarding_step FROM wallets WHERE discord_id = $1', [interaction.user.id]);
    if (existing.rows.length > 0 && existing.rows[0].onboarding_step >= 4) {
      return interaction.reply({ content: 'You already have a wallet! Use `/balance` to check.', ephemeral: true });
    }

    const termsEmbed = new EmbedBuilder()
      .setColor(0x06b6d4)
      .setTitle('⚖️ TERMS OF THE COLLECTIVE')
      .setDescription(
        `**1.** EXPERIMENTAL Pi OS software. Not a financial platform.\n\n` +
        `**2.** All currency (SHARDS, GEMS) is virtual — **ZERO real-world value.**\n\n` +
        `**3.** All games are **PROVABLY FAIR** (HMAC-SHA256). Every result is verifiable.\n\n` +
        `**4.** ONE account. ONE wallet. Alts = permanent ban.\n\n` +
        `**5.** Wallet encrypted with **AES-256-GCM**.\n\n` +
        `**6.** Withdrawals: 1/day, rate limited, verified.\n\n` +
        `**7.** Have fun. Don't be a dick.\n\n` +
        `🧪 *Pi OS experiment. Have fun! XD* 😄`
      )
      .setFooter({ text: 'Terms v1.0' });

    const buttons = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('terms_accept').setLabel('✅ I Accept').setStyle(ButtonStyle.Success),
      new ButtonBuilder().setCustomId('terms_decline').setLabel('❌ Decline').setStyle(ButtonStyle.Danger)
    );

    await interaction.reply({ embeds: [termsEmbed], components: [buttons], ephemeral: true });
  }

  if (step === 'terms_accept') {
    const modal = new ModalBuilder()
      .setCustomId('username_modal')
      .setTitle('🏷️ Choose Your Identity');

    modal.addComponents(
      new ActionRowBuilder<TextInputBuilder>().addComponents(
        new TextInputBuilder()
          .setCustomId('username_input')
          .setLabel('Username (3-20 chars, permanent)')
          .setStyle(TextInputStyle.Short)
          .setMinLength(3)
          .setMaxLength(20)
          .setPlaceholder('e.g. CryptoKing_42')
          .setRequired(true)
      )
    );

    await interaction.showModal(modal);
  }
}

// ═══ Username Modal ═══
export async function handleUsernameModal(interaction: ModalSubmitInteraction) {
  const username = interaction.fields.getTextInputValue('username_input').trim();
  const usernameLower = username.toLowerCase();
  const errors: string[] = [];

  if (!/^[a-zA-Z0-9_]{3,20}$/.test(username)) {
    errors.push('Only letters, numbers, underscores (3-20 chars).');
  }
  if (BANNED_WORDS.some(w => usernameLower.includes(w))) {
    errors.push('That username contains a restricted word.');
  }

  const taken = await query('SELECT 1 FROM wallets WHERE username_lower = $1', [usernameLower]);
  if (taken.rows.length > 0) {
    errors.push(`"${username}" is already taken.`);
  }

  if (errors.length > 0) {
    return interaction.reply({ content: `❌ **Invalid:**\n${errors.join('\n')}\n\nClick the button to retry.`, ephemeral: true });
  }

  // Generate wallet
  await interaction.deferReply({ ephemeral: true });

  const loadingEmbed = new EmbedBuilder()
    .setColor(0x06b6d4)
    .setTitle('🔐 GENERATING YOUR WALLET...')
    .setDescription('```\n████████░░░░░░░░░ 40%\n```\n⏳ Encrypting...');
  await interaction.editReply({ embeds: [loadingEmbed] });

  try {
    const walletSeed = generateWalletSeed();
    const walletId = crypto.randomUUID();
    const key = deriveUserKey(walletId, config.masterKey);
    const encrypted = encrypt(walletSeed, key);
    const clientSeed = generateClientSeed();

    // Get or create server seed
    let seedRow = await query('SELECT id, seed_hash FROM server_seeds WHERE is_active = TRUE LIMIT 1');
    if (seedRow.rows.length === 0) {
      const { seed, hash } = generateServerSeed();
      seedRow = await query(
        'INSERT INTO server_seeds (seed, seed_hash) VALUES ($1, $2) RETURNING id, seed_hash',
        [seed, hash]
      );
    }

    // Atomic wallet creation
    await transaction(async (client) => {
      await client.query(`
        INSERT INTO wallets (wallet_id, discord_id, username, username_lower, seed_encrypted, seed_iv, seed_tag,
          terms_accepted, terms_accepted_at, onboarding_step, client_seed, server_seed_id, shards,
          account_created_at, joined_server_at)
        VALUES ($1,$2,$3,$4,$5,$6,$7,TRUE,NOW(),3,$8,$9,500,$10,$11)
      `, [
        walletId, interaction.user.id, username, usernameLower,
        encrypted.ciphertext, encrypted.iv, encrypted.tag,
        clientSeed, seedRow.rows[0].id,
        interaction.user.createdAt,
        (interaction.member as GuildMember)?.joinedAt || new Date()
      ]);

      await client.query(`
        INSERT INTO transactions (wallet_id, type, currency, amount, balance_before, balance_after, description, tx_hash)
        VALUES ($1, 'onboarding_bonus', 'shards', 500, 0, 500, 'Welcome to The Collective', $2)
      `, [walletId, computeTxHash(walletId, 'onboarding_bonus', 500, 500)]);

      await client.query(`
        INSERT INTO daily_limits (wallet_id) VALUES ($1)
      `, [walletId]);
    });

    // Success
    const successEmbed = new EmbedBuilder()
      .setColor(0x10b981)
      .setTitle('✅ WALLET CREATED')
      .setDescription(
        `Welcome, **${username}**.\n\n` +
        `🏷️ **Username:** \`${username}\`\n` +
        `🆔 **Wallet:** \`${walletId.substring(0, 8)}...${walletId.slice(-4)}\`\n` +
        `💎 **Balance:** 500 SHARDS\n` +
        `🔐 **Security:** AES-256-GCM\n` +
        `⚡ **Seed:** \`${clientSeed.substring(0, 12)}...\`\n\n` +
        `Your wallet is encrypted. Not even admins can see your data.`
      )
      .setFooter({ text: 'Pi OS • The Collective v1.0' });

    const enterBtn = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('onboarding_complete').setLabel('🚀 Enter The Collective').setStyle(ButtonStyle.Success)
    );

    await interaction.editReply({ embeds: [successEmbed], components: [enterBtn] });
  } catch (err: any) {
    console.error('Wallet generation error:', err);
    await interaction.editReply({ content: `❌ Error: ${err.message}. Try again or contact admin.` });
  }
}

// ═══ Channel Reveal ═══
export async function handleOnboardingComplete(interaction: ButtonInteraction) {
  const guild = interaction.guild!;
  const member = interaction.member as GuildMember;

  // Find or create role
  let role = guild.roles.cache.find(r => r.name === config.roles.member);
  if (!role) {
    role = await guild.roles.create({
      name: config.roles.member,
      color: 0x06b6d4,
      reason: 'The Collective onboarding',
    });
  }

  await member.roles.add(role);
  await query('UPDATE wallets SET onboarding_step = 4 WHERE discord_id = $1', [interaction.user.id]);

  const wallet = await query('SELECT username FROM wallets WHERE discord_id = $1', [interaction.user.id]);
  const name = wallet.rows[0]?.username || 'anon';

  const welcomeEmbed = new EmbedBuilder()
    .setColor(0x06b6d4)
    .setTitle(`🏴 WELCOME, ${name}`)
    .setDescription(
      `💰 \`/daily\` — Claim daily SHARDS\n` +
      `🎰 \`/coinflip\` — Your first bet\n` +
      `📊 \`/profile\` — View your stats\n` +
      `🔐 \`/fairness\` — How we prove it's fair\n\n` +
      `The house edge is real. But you can **VERIFY** every result.\n\n` +
      `good luck, degen. 🫡`
    );

  await interaction.update({ embeds: [welcomeEmbed], components: [] });
}

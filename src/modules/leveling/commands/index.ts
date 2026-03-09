import { SlashCommandBuilder } from 'discord.js';
import { sendRankCard } from '../rankCard';
import { sendLeaderboard } from '../leaderboard';
import { query } from '../../../database/db';

export const rankCommand = {
  data: new SlashCommandBuilder()
    .setName('rank')
    .setDescription('Show your rank card')
    .addUserOption((o) => o.setName('user').setDescription('Target user')),
  execute: sendRankCard,
};

export const leaderboardCommand = {
  data: new SlashCommandBuilder()
    .setName('xpleaderboard')
    .setDescription('XP leaderboard')
    .addStringOption((o) =>
      o
        .setName('period')
        .setDescription('weekly/monthly/all')
        .addChoices({ name: 'Weekly', value: 'weekly' }, { name: 'Monthly', value: 'monthly' }, { name: 'All-time', value: 'all' })
    ),
  execute: sendLeaderboard,
};

export const xpSettingsCommand = {
  data: new SlashCommandBuilder()
    .setName('xp')
    .setDescription('XP settings')
    .addSubcommand((s) =>
      s
        .setName('settings')
        .setDescription('Set XP gain rates')
        .addIntegerOption((o) => o.setName('message').setDescription('xp/msg').setRequired(true))
        .addIntegerOption((o) => o.setName('voice').setDescription('xp/min voice').setRequired(true))
    ),
  async execute(interaction: any) {
    const msg = interaction.options.getInteger('message', true);
    const voice = interaction.options.getInteger('voice', true);
    await query(
      `INSERT INTO kv_store(key,value,updated_at) VALUES($1,$2,unixepoch()) ON CONFLICT(key) DO UPDATE SET value=excluded.value,updated_at=unixepoch()`,
      [`xp:cfg:${interaction.guildId}`, JSON.stringify({ msg, voice })]
    );
    await interaction.reply({ content: `XP settings saved. message=${msg}, voice=${voice}`, ephemeral: true });
  },
};

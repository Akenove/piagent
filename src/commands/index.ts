import { Client, Collection, REST, Routes, SlashCommandBuilder } from 'discord.js';
import { ModuleCommand } from '../modules/types';
import { config } from '../config';

// Command definitions
const commands = [
  // Economy
  new SlashCommandBuilder().setName('balance').setDescription('Check your wallet balance')
    .addUserOption(o => o.setName('user').setDescription('User to check').setRequired(false)),
  new SlashCommandBuilder().setName('daily').setDescription('Claim your daily SHARDS reward'),
  new SlashCommandBuilder().setName('profile').setDescription('View your stats')
    .addUserOption(o => o.setName('user').setDescription('User to view').setRequired(false)),
  new SlashCommandBuilder().setName('transfer').setDescription('Send SHARDS to another user')
    .addUserOption(o => o.setName('user').setDescription('Recipient').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('withdraw').setDescription('Withdraw SHARDS (1/day, rate limited)')
    .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true).setMinValue(100).setMaxValue(10000)),
  
  // Casino
  new SlashCommandBuilder().setName('coinflip').setDescription('Flip a coin — heads or tails')
    .addIntegerOption(o => o.setName('amount').setDescription('Bet amount').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('side').setDescription('Pick a side').setRequired(true)
      .addChoices({ name: '🪙 Heads', value: 'heads' }, { name: '🪙 Tails', value: 'tails' })),
  new SlashCommandBuilder().setName('dice').setDescription('Roll dice — over or under')
    .addIntegerOption(o => o.setName('amount').setDescription('Bet amount').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('direction').setDescription('Over or under').setRequired(true)
      .addChoices({ name: '⬆️ Over', value: 'over' }, { name: '⬇️ Under', value: 'under' }))
    .addIntegerOption(o => o.setName('target').setDescription('Target (2-98)').setRequired(true).setMinValue(2).setMaxValue(98)),
  new SlashCommandBuilder().setName('slots').setDescription('Spin the slot machine')
    .addIntegerOption(o => o.setName('amount').setDescription('Bet amount').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('crash').setDescription('Ride the multiplier — cash out before crash')
    .addIntegerOption(o => o.setName('amount').setDescription('Bet amount').setRequired(true).setMinValue(1)),
  new SlashCommandBuilder().setName('roulette').setDescription('Spin the roulette wheel')
    .addIntegerOption(o => o.setName('amount').setDescription('Bet amount').setRequired(true).setMinValue(1))
    .addStringOption(o => o.setName('bet').setDescription('Bet type (red/black/green/number)').setRequired(true)),
  new SlashCommandBuilder().setName('duel').setDescription('Challenge another user')
    .addUserOption(o => o.setName('user').setDescription('Opponent').setRequired(true))
    .addIntegerOption(o => o.setName('amount').setDescription('Wager').setRequired(true).setMinValue(1)),
  
  // Fairness
  new SlashCommandBuilder().setName('verify').setDescription('Verify any bet cryptographically')
    .addStringOption(o => o.setName('bet_id').setDescription('Bet ID').setRequired(true)),
  new SlashCommandBuilder().setName('seeds').setDescription('View or change your client seed')
    .addStringOption(o => o.setName('new_seed').setDescription('New client seed').setRequired(false)),
  new SlashCommandBuilder().setName('fairness').setDescription('Learn how provably fair works'),
  
  // Social
  new SlashCommandBuilder().setName('leaderboard').setDescription('View top players')
    .addStringOption(o => o.setName('category').setDescription('Category').setRequired(false)
      .addChoices(
        { name: '💎 Shards', value: 'shards' },
        { name: '🏆 Wins', value: 'wins' },
        { name: '🎰 Wagered', value: 'wagered' },
        { name: '⭐ Rep', value: 'rep' }
      )),
  
  // Admin
  new SlashCommandBuilder().setName('admin').setDescription('Admin commands')
    .addSubcommand(s => s.setName('grant').setDescription('Grant shards')
      .addUserOption(o => o.setName('user').setDescription('User').setRequired(true))
      .addIntegerOption(o => o.setName('amount').setDescription('Amount').setRequired(true)))
    .addSubcommand(s => s.setName('deploy-channels').setDescription('Deploy Collective channels'))
    .addSubcommand(s => s.setName('seed-rotate').setDescription('Force rotate server seed'))
    .addSubcommand(s => s.setName('economy-report').setDescription('View economy stats')),
];

export async function registerCommands(client: Client, moduleCommands: ModuleCommand[] = []) {
  const rest = new REST().setToken(config.token);
  const all = [...commands, ...moduleCommands.map((m) => m.data)];

  try {
    console.log('📝 Registering slash commands...');
    await rest.put(Routes.applicationGuildCommands(config.clientId, config.guildId), { body: all.map((c) => c.toJSON()) });
    console.log(`✅ ${all.length} commands registered`);
  } catch (err: any) {
    console.error('❌ Command registration failed:', err.message);
  }

  const handlers = new Collection<string, any>();

  for (const cmd of commands) {
    handlers.set(cmd.name, {
      data: cmd,
      execute: async (interaction: any) => {
        await interaction.reply({ content: '🚧 Coming soon...', ephemeral: true });
      },
    });
  }

  for (const m of moduleCommands) {
    handlers.set(m.data.name, {
      data: m.data,
      execute: async (interaction: any) => m.execute(interaction, { client }),
    });
  }

  (client as any).commands = handlers;
}

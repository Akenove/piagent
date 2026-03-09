import { SlashCommandBuilder } from 'discord.js';
import { setAfk } from '../afk';
import { createGiveaway } from '../giveaways';
import { createPoll } from '../polls';
import { createReactionRolePost } from '../reactionRoles';
import { createReminder } from '../reminders';
import { closeTicket, createTicket } from '../tickets';

export const reactionRoleCommand = {
  data: new SlashCommandBuilder()
    .setName('reactionrole')
    .setDescription('Create a reaction role button')
    .addSubcommand((s) =>
      s
        .setName('create')
        .setDescription('Create button')
        .addRoleOption((o) => o.setName('role').setDescription('Role').setRequired(true))
        .addStringOption((o) => o.setName('label').setDescription('Button label').setRequired(true))
    ),
  execute: createReactionRolePost,
};

export const ticketCommand = {
  data: new SlashCommandBuilder()
    .setName('ticket')
    .setDescription('Ticket tools')
    .addSubcommand((s) => s.setName('create').setDescription('Create ticket').addStringOption((o) => o.setName('topic').setDescription('Topic').setRequired(true)))
    .addSubcommand((s) => s.setName('close').setDescription('Close this ticket')),
  async execute(interaction: any) {
    return interaction.options.getSubcommand() === 'create' ? createTicket(interaction) : closeTicket(interaction);
  },
};

export const pollCommand = {
  data: new SlashCommandBuilder()
    .setName('poll')
    .setDescription('Create timed poll')
    .addSubcommand((s) =>
      s
        .setName('create')
        .setDescription('Create poll')
        .addStringOption((o) => o.setName('question').setDescription('Question').setRequired(true))
        .addStringOption((o) => o.setName('options').setDescription('Comma-separated options').setRequired(true))
        .addIntegerOption((o) => o.setName('minutes').setDescription('Duration minutes'))
    ),
  execute: createPoll,
};

export const giveawayCommand = {
  data: new SlashCommandBuilder()
    .setName('giveaway')
    .setDescription('Create giveaway')
    .addSubcommand((s) =>
      s
        .setName('create')
        .setDescription('Create one')
        .addStringOption((o) => o.setName('prize').setDescription('Prize').setRequired(true))
        .addIntegerOption((o) => o.setName('minutes').setDescription('Duration').setRequired(true))
        .addIntegerOption((o) => o.setName('winners').setDescription('Winner count'))
    ),
  execute: createGiveaway,
};

export const remindCommand = {
  data: new SlashCommandBuilder()
    .setName('remind')
    .setDescription('Set reminder')
    .addSubcommand((s) =>
      s
        .setName('me')
        .setDescription('DM reminder')
        .addStringOption((o) => o.setName('text').setDescription('Reminder text').setRequired(true))
        .addIntegerOption((o) => o.setName('minutes').setDescription('Minutes').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('channel')
        .setDescription('Channel reminder')
        .addStringOption((o) => o.setName('text').setDescription('Reminder text').setRequired(true))
        .addIntegerOption((o) => o.setName('minutes').setDescription('Minutes').setRequired(true))
        .addChannelOption((o) => o.setName('channel').setDescription('Target channel').setRequired(true))
    ),
  execute: createReminder,
};

export const afkCommand = {
  data: new SlashCommandBuilder()
    .setName('afk')
    .setDescription('Set AFK status')
    .addSubcommand((s) => s.setName('set').setDescription('Set AFK').addStringOption((o) => o.setName('reason').setDescription('Reason').setRequired(true))),
  async execute(interaction: any) {
    const reason = interaction.options.getString('reason', true);
    setAfk(interaction.user.id, reason);
    await interaction.reply({ content: `AFK set: ${reason}`, ephemeral: true });
  },
};

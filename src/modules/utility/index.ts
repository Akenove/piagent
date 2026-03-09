import { BotModule } from '../types';
import { handleAfkMessage } from './afk';
import { maybeStar } from './starboard';
import { handleReactionRole } from './reactionRoles';
import { afkCommand, giveawayCommand, pollCommand, reactionRoleCommand, remindCommand, ticketCommand } from './commands';
import { onMemberJoin, onMemberLeave } from './welcome';

export function createUtilityModule(): BotModule {
  return {
    name: 'utility',
    description: 'Welcome, reaction roles, tickets, polls, giveaways, reminders, starboard, AFK',
    commands: [reactionRoleCommand as any, ticketCommand as any, pollCommand as any, giveawayCommand as any, remindCommand as any, afkCommand as any],
    init: ({ client }) => {
      client.on('guildMemberAdd', (m) => onMemberJoin(m).catch(() => undefined));
      client.on('guildMemberRemove', (m) => onMemberLeave(m as any).catch(() => undefined));
    },
    handlers: {
      onInteraction: async (i) => {
        if (!i.isButton() || !i.customId.startsWith('rr:') || !i.member) return;
        const msg = await handleReactionRole(i.customId, i.member as any);
        await i.reply({ content: msg, ephemeral: true });
      },
      onMessage: async (m) => {
        await handleAfkMessage(m);
      },
    },
  };
}

export { maybeStar };

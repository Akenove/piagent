import { BotModule } from '../types';
import { leaderboardCommand, rankCommand, xpSettingsCommand } from './commands';
import { assignLevelRewards, grantXp, onMessageXp, onVoiceStateXp } from './xp';

export function createLevelingModule(): BotModule {
  return {
    name: 'leveling',
    description: 'XP/levels/rank cards/leaderboard/rewards',
    commands: [rankCommand as any, leaderboardCommand as any, xpSettingsCommand as any],
    handlers: {
      onMessage: async (message) => {
        const before = message.guild ? await grantXp(message.guild.id, message.author.id, 0).catch(() => ({ level: 0, xp: 0 })) : { level: 0, xp: 0 };
        await onMessageXp(message);
        if (!message.guild) return;
        const after = await grantXp(message.guild.id, message.author.id, 0);
        if (after.level > before.level && message.member) {
          assignLevelRewards(message.member, after.level).catch?.(() => undefined);
          message.channel.send(`🎉 ${message.author} reached level ${after.level}!`).catch(() => undefined);
        }
      },
      onVoiceState: onVoiceStateXp,
    },
  };
}

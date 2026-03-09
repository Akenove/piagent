import { BotModule } from '../types';
import { aiCommand } from './commands/ai';
import { maybeAutoTranslate } from './translate';

export function createAiModule(): BotModule {
  return {
    name: 'ai',
    description: 'Multi-model AI chat + memory + summarize + translate',
    commands: [aiCommand as any],
    handlers: {
      onMessage: async (msg) => {
        maybeAutoTranslate(msg).catch(() => undefined);
      },
    },
  };
}

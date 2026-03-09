import { Client, Collection, Events, Interaction } from 'discord.js';
import { BotModule, ModuleCommand, ModuleContext } from './types';
import { createSecurityModule } from './security';
import { createAiModule } from './ai';
import { createLevelingModule } from './leveling';
import { createUtilityModule } from './utility';

export interface ModuleRegistry {
  modules: BotModule[];
  commands: ModuleCommand[];
}

function moduleEnabled(moduleName: string, enabledByDefault = true): boolean {
  const key = `MODULE_${moduleName.toUpperCase()}`;
  const env = process.env[key];
  if (env == null) return enabledByDefault;
  return ['1', 'true', 'yes', 'on'].includes(env.toLowerCase());
}

export async function initModules(client: Client): Promise<ModuleRegistry> {
  const ctx: ModuleContext = { client };

  const candidates: BotModule[] = [
    createSecurityModule(),
    createAiModule(),
    createLevelingModule(),
    createUtilityModule(),
  ];

  const modules: BotModule[] = [];
  const commands: ModuleCommand[] = [];

  for (const m of candidates) {
    if (!moduleEnabled(m.name, m.enabledByDefault ?? true)) continue;
    modules.push(m);
    if (m.commands?.length) commands.push(...m.commands);
    try {
      await m.init?.(ctx);
    } catch (e) {
      console.error(`[modules] ${m.name} init failed`, e);
    }
  }

  // wire runtime hooks once
  client.on(Events.InteractionCreate, async (interaction: Interaction) => {
    for (const m of modules) {
      const handlers = m.handlers;
      if (!handlers) continue;
      try {
        if (interaction.isButton() && handlers.onButton) await handlers.onButton(interaction, ctx);
        else if (interaction.isModalSubmit() && handlers.onModal) await handlers.onModal(interaction, ctx);
        if (handlers.onInteraction) await handlers.onInteraction(interaction, ctx);
      } catch (err) {
        console.error(`[modules] ${m.name} interaction hook failed`, err);
      }
    }
  });

  client.on(Events.MessageCreate, async (msg) => {
    for (const m of modules) {
      const fn = m.handlers?.onMessage;
      if (!fn) continue;
      Promise.resolve(fn(msg, ctx)).catch((e: unknown) => console.error(`[modules] ${m.name} message hook`, e));
    }
  });

  client.on(Events.VoiceStateUpdate, async (oldState, newState) => {
    for (const m of modules) {
      const fn = m.handlers?.onVoiceState;
      if (!fn) continue;
      try {
        await fn(oldState, newState, ctx);
      } catch (e) {
        console.error(`[modules] ${m.name} voice hook`, e);
      }
    }
  });

  return { modules, commands };
}

export async function cleanupModules(client: Client, modules: BotModule[]) {
  const ctx: ModuleContext = { client };
  for (const m of modules) {
    await m.cleanup?.(ctx);
  }
}

export function attachModuleCommands(client: Client, commands: ModuleCommand[]) {
  const col = ((client as any).commands as Collection<string, any>) ?? new Collection();
  for (const cmd of commands) {
    col.set(cmd.data.name, {
      data: cmd.data,
      execute: (interaction: any) => cmd.execute(interaction, { client }),
    });
  }
  (client as any).commands = col;
}

import {
  ButtonInteraction,
  ChatInputCommandInteraction,
  Client,
  Events,
  Interaction,
  ModalSubmitInteraction,
  SlashCommandBuilder,
} from 'discord.js';

export type ModuleEventName = keyof typeof Events | 'messageCreate' | 'voiceStateUpdate';

export interface ModuleContext {
  client: Client;
}

export interface ModuleCommand {
  data: SlashCommandBuilder;
  execute: (interaction: ChatInputCommandInteraction, ctx: ModuleContext) => Promise<void> | void;
}

export interface ModuleHandlers {
  onInteraction?: (interaction: Interaction, ctx: ModuleContext) => Promise<void> | void;
  onButton?: (interaction: ButtonInteraction, ctx: ModuleContext) => Promise<void> | void;
  onModal?: (interaction: ModalSubmitInteraction, ctx: ModuleContext) => Promise<void> | void;
  onMessage?: (message: any, ctx: ModuleContext) => Promise<void> | void;
  onVoiceState?: (oldState: any, newState: any, ctx: ModuleContext) => Promise<void> | void;
}

export interface BotModule {
  name: string;
  description: string;
  enabledByDefault?: boolean;
  commands?: ModuleCommand[];
  handlers?: ModuleHandlers;
  init?: (ctx: ModuleContext) => Promise<void> | void;
  cleanup?: (ctx: ModuleContext) => Promise<void> | void;
}

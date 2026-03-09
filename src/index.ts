import { Client, GatewayIntentBits, Collection, Events, Interaction } from 'discord.js';
import { config } from './config';
import { initDatabase } from './database/db';
import { handleInteraction } from './events/interactionCreate';
import { registerCommands } from './commands';
import { startWebServer } from './api/server';
import { attachModuleCommands, cleanupModules, initModules } from './modules/loader';

const client = new Client({
  intents: [
    GatewayIntentBits.Guilds,
    GatewayIntentBits.GuildMembers,
    GatewayIntentBits.GuildMessages,
    GatewayIntentBits.GuildMessageReactions,
    GatewayIntentBits.MessageContent,
  ],
});

// Command collection
(client as any).commands = new Collection();

let loadedModules: any[] = [];

client.once(Events.ClientReady, (c) => {
  console.log(`🤖 PiAgent online as ${c.user.tag}`);
  console.log(`   Guild: ${config.guildId}`);
  console.log(`   Category: ${config.categoryId}`);
});

client.on(Events.InteractionCreate, (interaction: Interaction) => {
  handleInteraction(interaction, client);
});

// Boot sequence
async function boot() {
  console.log('🏴 THE COLLECTIVE — Booting...');
  
  // 1. Database
  try {
    await initDatabase();
  } catch (e: any) {
    console.error('⚠️ DB init failed (will retry on demand):', e.message);
  }

  // 2. Web server
  try {
    await startWebServer();
  } catch (e: any) {
    console.error('⚠️ Web server failed:', e.message);
  }
  
  // 2. Load modules first so their slash commands are included
  const reg = await initModules(client);
  loadedModules = reg.modules;

  // 3. Register core + module commands
  await registerCommands(client, reg.commands);
  attachModuleCommands(client, reg.commands);
  
  // 4. Login
  await client.login(config.token);
}

process.on('SIGINT', async () => {
  await cleanupModules(client, loadedModules);
  process.exit(0);
});

boot().catch(err => {
  console.error('💥 Boot failed:', err);
  process.exit(1);
});

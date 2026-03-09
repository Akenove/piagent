import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import dotenv from 'dotenv'; dotenv.config();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
async function run() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN!);
  await new Promise(r => client.once('ready', r));
  const guild = await client.guilds.fetch(process.env.GUILD_ID!);
  await guild.channels.fetch();
  const cats = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
  console.log(`\n=== GUILD CHANNEL AUDIT ===\nTotal: ${guild.channels.cache.size}\n`);
  for (const [,cat] of cats) {
    const kids = guild.channels.cache.filter(c => (c as any).parentId === cat.id);
    console.log(`📁 [${cat.id}] ${cat.name} (${kids.size} channels)`);
    for (const [,ch] of kids) {
      const type = ChannelType[ch.type];
      console.log(`   [${ch.id}] ${ch.name} [${type}]`);
    }
  }
  const orphans = guild.channels.cache.filter(c => !(c as any).parentId && c.type !== ChannelType.GuildCategory);
  if (orphans.size) { console.log('\n📌 ORPHAN CHANNELS:'); for (const [,c] of orphans) console.log(`  [${c.id}] ${c.name}`); }
  await client.destroy(); process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });

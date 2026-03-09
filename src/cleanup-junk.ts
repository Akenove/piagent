import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import dotenv from 'dotenv'; dotenv.config();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function run() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN!);
  await new Promise(r => client.once('ready', r));
  const guild = await client.guilds.fetch(process.env.GUILD_ID!);
  await guild.channels.fetch();

  // Junk channels to delete: separators + "1" test channel
  const JUNK_IDS = [
    '1477778005886636046', // "1" — test channel
    '1477809637981163540', // ───-💰-economy-───
    '1477809628505964717', // ───-🎰-casino-───
    '1477809789076508993', // ───-🤖-pi-os-───
    '1477809400553934920', // ───-⚡-info-───
    '1477809781149405325', // ───-🏛-governance-───
    '1477809797100474490', // ───-🎭-social-───
    '1477809620192858384', // ───-🔍-alpha-───
  ];

  for (const id of JUNK_IDS) {
    const ch = guild.channels.cache.get(id);
    if (!ch) { console.log(`⚠️  ${id} not found`); continue; }
    try {
      await ch.delete('Cleaning junk/separator channels');
      console.log(`🗑️  Deleted: ${ch.name}`);
      await sleep(600);
    } catch(e: any) {
      console.log(`❌ ${ch.name}: ${e.message?.slice(0,50)}`);
    }
  }

  // Show what's left in main category
  await guild.channels.fetch();
  const mainCat = guild.channels.cache.get(process.env.CATEGORY_ID!);
  const remaining = guild.channels.cache.filter(c => (c as any).parentId === process.env.CATEGORY_ID);
  console.log(`\n📁 Main category remaining: ${remaining.size} channels`);
  for (const [,ch] of remaining) console.log(`  ${ch.name}`);

  await client.destroy(); process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });

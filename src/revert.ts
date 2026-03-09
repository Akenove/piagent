import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const GUILD_ID = process.env.GUILD_ID!;
const ORIGINAL_CAT = process.env.CATEGORY_ID!; // 1477777771382968482
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function run() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN!);
  await new Promise(r => client.once('ready', r));
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();

  // New categories I created — move all their channels back to original, then those cats will be empty
  const NEW_CAT_NAMES = [
    '🏴 the collective',
    '🔭 alpha intel',
    '🎰 the casino',
    '💰 the vault',
    '🏛️ the council',
    '🤖 pi os',
    '🎭 community',
  ];

  const newCats = guild.channels.cache.filter(
    c => c.type === ChannelType.GuildCategory &&
    NEW_CAT_NAMES.includes(c.name.toLowerCase())
  );

  console.log(`Found ${newCats.size} new categories to revert`);

  // Move all channels from new cats back to original
  for (const [, cat] of newCats) {
    const children = guild.channels.cache.filter(c => (c as any).parentId === cat.id);
    console.log(`\n📁 ${cat.name} → moving ${children.size} channels back`);
    for (const [, ch] of children) {
      try {
        await (ch as any).edit({ parent: ORIGINAL_CAT, lockPermissions: false });
        console.log(`  ✅ Moved back: ${ch.name}`);
        await sleep(600);
      } catch (e: any) {
        console.log(`  ⚠️ ${ch.name}: ${e.message}`);
      }
    }
  }

  // Delete new (empty) categories
  await sleep(2000);
  await guild.channels.fetch();
  for (const [, cat] of newCats) {
    const remaining = guild.channels.cache.filter(c => (c as any).parentId === cat.id);
    if (remaining.size === 0) {
      try {
        await cat.delete('Reverting to original structure');
        console.log(`🗑️  Deleted empty category: ${cat.name}`);
        await sleep(500);
      } catch (e: any) {
        console.log(`⚠️  Could not delete ${cat.name}: ${e.message}`);
      }
    } else {
      console.log(`⚠️  ${cat.name} still has ${remaining.size} channels, skipping delete`);
    }
  }

  await client.destroy();
  console.log('\n✅ Revert complete — all channels back in original category');
  process.exit(0);
}

run().catch(e => { console.error(e.message); process.exit(1); });

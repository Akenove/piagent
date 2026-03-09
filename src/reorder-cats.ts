import { Client, GatewayIntentBits, ChannelType } from 'discord.js';
import dotenv from 'dotenv'; dotenv.config();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function run() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN!);
  await new Promise(r => client.once('ready', r));
  const guild = await client.guilds.fetch(process.env.GUILD_ID!);
  await guild.channels.fetch();

  // Get all categories
  const cats = guild.channels.cache.filter(c => c.type === ChannelType.GuildCategory);
  console.log('Current categories:');
  cats.sort((a,b) => a.position - b.position).forEach(c => console.log(`  [${c.position}] ${c.name} (${c.id})`));

  // Desired order (top to bottom)
  const order = [
    '1477777771382968482', // 🏴 THE COLLECTIVE
  ];
  
  // Find dynamic cat IDs by name
  const findCat = (name: string) => cats.find(c => c.name.toLowerCase().includes(name.toLowerCase()))?.id;
  
  const alphaCat = findCat('ALPHA INTEL');
  const casinoCat = findCat('casino');
  const vaultCat = findCat('vault');
  const councilCat = findCat('council');
  const piOsCat = findCat('PI OS');
  const communityCat = findCat('COMMUNITY');
  
  if (alphaCat) order.push(alphaCat);
  if (casinoCat) order.push(casinoCat);
  if (vaultCat) order.push(vaultCat);
  if (councilCat) order.push(councilCat);
  if (piOsCat) order.push(piOsCat);
  if (communityCat) order.push(communityCat);
  order.push('1470858890970136768'); // 🔊 VOICE
  order.push('1477809597547941950'); // Extended

  console.log('\nReordering...');
  for (let i = 0; i < order.length; i++) {
    const ch = guild.channels.cache.get(order[i]);
    if (!ch) continue;
    try {
      await (ch as any).edit({ position: i });
      console.log(`  ✅ [${i}] ${ch.name}`);
    } catch(e: any) { console.log(`  ⚠️ ${ch.name}: ${e.message?.slice(0,50)}`); }
    await sleep(500);
  }

  await client.destroy();
  console.log('\n✅ Categories reordered.');
  process.exit(0);
}
run().catch(e => { console.error('💥', e.message); process.exit(1); });

import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();
const CATEGORY_ID = process.env.CATEGORY_ID!;
const GUILD_ID = process.env.GUILD_ID!;
const TOKEN = process.env.DISCORD_TOKEN!;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

async function run() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(TOKEN);
  await new Promise(r => client.once('ready', r));
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();

  // Find overflow cat
  const overflowCat = guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && c.name.includes('extended')
  )!;

  // List current channels in main category
  const catChs = [...guild.channels.cache.values()].filter(c => c && (c as any).parentId === CATEGORY_ID);
  console.log(`Current: ${catChs.length} channels`);
  catChs.forEach(c => console.log(' -', c!.name));

  // Move 3 more low-priority out
  const MOVE_MORE = ['jackpot', 'hall-of-rekt', 'moonshot'];
  for (const slug of MOVE_MORE) {
    const ch = guild.channels.cache.find(
      c => (c as any).parentId === CATEGORY_ID && c.name.toLowerCase().includes(slug)
    );
    if (!ch) { console.log(`⏭️ Not found: ${slug}`); continue; }
    await (ch as any).setParent(overflowCat.id, { lockPermissions: false });
    console.log(`✅ Moved: ${ch.name}`);
    await sleep(800);
  }

  // Create last 3 separators
  const LAST_SEPS = ['─── 🏛 governance ───', '─── 🤖 pi-os ───', '─── 🎭 social ───'];
  await guild.channels.fetch();
  for (const sep of LAST_SEPS) {
    if (guild.channels.cache.find(c => c.name === sep && (c as any).parentId === CATEGORY_ID)) {
      console.log(`⏭️ EXISTS: ${sep}`); continue;
    }
    await guild.channels.create({
      name: sep, type: ChannelType.GuildText, parent: CATEGORY_ID,
      permissionOverwrites: [{
        id: guild.roles.everyone.id,
        allow: [PermissionFlagsBits.ViewChannel],
        deny: [PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions, PermissionFlagsBits.CreatePublicThreads],
      }],
    });
    console.log(`✅ Sep: ${sep}`);
    await sleep(1500);
  }

  // Final reorder
  await sleep(2000);
  await guild.channels.fetch();
  const ORDER = [
    'hub',
    '⚡ info', 'rules', 'announc', 'stats', 'leaderboard', 'events',
    '🔍 alpha', 'scanner', 'token-scanner', 'whale', 'launch', 'signal', 'alert', 'alpha', 'oracle', 'intel',
    '🎰 casino', 'coinflip', 'dice', 'crash', 'roulette', 'slot', 'mine', 'duel', 'blackjack', 'the-pit',
    '💰 economy', 'bank', 'daily', 'mining', 'market', 'airdrop', 'stonk', 'provably', 'loan',
    '🏛 governance', 'governance', 'proposal', 'court', 'laws', 'passed', 'treasury',
    '🤖 pi-os', 'pi-lab', 'pi-os', 'pi-log', 'verify', 'analytic',
    '🎭 social', 'meme', 'achievement',
  ];
  const catChs2 = [...guild.channels.cache.values()].filter(c => c && (c as any).parentId === CATEGORY_ID);
  console.log(`\nFinal category: ${catChs2.length} channels`);

  const positions: { id: string; position: number }[] = [];
  let pos = 0;
  for (const kw of ORDER) {
    const match = catChs2.find(c => c && c.name.toLowerCase().includes(kw.toLowerCase()) && !positions.find(p => p.id === c.id));
    if (match) positions.push({ id: match.id, position: pos++ });
  }
  for (const c of catChs2) {
    if (c && !positions.find(p => p.id === c.id)) positions.push({ id: c.id, position: pos++ });
  }

  await (client as any).rest.patch(`/guilds/${GUILD_ID}/channels`, {
    body: positions.map(p => ({ id: p.id, position: p.position }))
  });
  console.log(`✅ Reordered ${positions.length} channels`);

  await client.destroy();
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });

import {
  Client, GatewayIntentBits, ChannelType, PermissionFlagsBits,
} from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const CATEGORY_ID = process.env.CATEGORY_ID!;
const GUILD_ID = process.env.GUILD_ID!;
const TOKEN = process.env.DISCORD_TOKEN!;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// Channels to move to overflow (not delete — just secondary category)
// These are the least-visited, most redundant channels
const MOVE_OUT = [
  'pi-world', 'daily-brief', 'ct-intel', 'hot-takes', 'prediction-market', 'tournament'
];

// Separators to create (6 remaining after "info" was made)
const REMAINING_SEPS = [
  '─── 🔍 alpha ───',
  '─── 🎰 casino ───',
  '─── 💰 economy ───',
  '─── 🏛 governance ───',
  '─── 🤖 pi-os ───',
  '─── 🎭 social ───',
];

const ORDER_KEYWORDS = [
  'hub',
  '⚡ info', 'rules', 'announc', 'stats', 'leaderboard', 'events',
  '🔍 alpha', 'scanner', 'token-scanner', 'whale', 'launch', 'signal', 'alert', 'alpha', 'oracle', 'intel',
  '🎰 casino', 'coinflip', 'dice', 'crash', 'roulette', 'slot', 'mine', 'duel', 'blackjack', 'jackpot', 'the-pit',
  '💰 economy', 'bank', 'daily', 'mining', 'market', 'airdrop', 'stonk', 'provably', 'loan', 'moonshot', 'hall-of-rekt',
  '🏛 governance', 'governance', 'proposal', 'court', 'laws', 'passed', 'treasury',
  '🤖 pi-os', 'pi-lab', 'pi-os', 'pi-log', 'verify', 'analytic',
  '🎭 social', 'meme', 'achievement',
];

async function run() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(TOKEN);
  await new Promise(r => client.once('ready', r));
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();

  // ── Create overflow category ──
  console.log('\n── Creating overflow category...');
  let overflowCat = guild.channels.cache.find(
    c => c.type === ChannelType.GuildCategory && c.name.includes('extended')
  );
  if (!overflowCat) {
    overflowCat = await guild.channels.create({
      name: '🗃️・extended',
      type: ChannelType.GuildCategory,
      permissionOverwrites: [
        { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
      ],
    });
    console.log('  ✅ Created overflow category');
    await sleep(1000);
  } else {
    console.log('  ⏭️  Overflow category exists');
  }

  // ── Move channels to overflow ──
  console.log('\n── Moving channels to overflow...');
  await guild.channels.fetch();
  for (const slug of MOVE_OUT) {
    const ch = guild.channels.cache.find(
      c => (c as any).parentId === CATEGORY_ID && c.name.toLowerCase().includes(slug)
    );
    if (!ch) { console.log(`  ⏭️  Not found: ${slug}`); continue; }
    try {
      await (ch as any).setParent(overflowCat!.id, { lockPermissions: false });
      console.log(`  ✅ Moved: ${ch.name} → overflow`);
      await sleep(800);
    } catch (err: any) {
      console.log(`  ❌ ${slug}: ${err.message}`);
    }
  }

  // ── Create remaining separators ──
  console.log('\n── Creating remaining separators...');
  await guild.channels.fetch();
  for (const sep of REMAINING_SEPS) {
    const exists = guild.channels.cache.find(
      c => c.name === sep && (c as any).parentId === CATEGORY_ID
    );
    if (exists) { console.log(`  ⏭️  EXISTS: ${sep}`); continue; }
    try {
      await guild.channels.create({
        name: sep,
        type: ChannelType.GuildText,
        parent: CATEGORY_ID,
        permissionOverwrites: [
          {
            id: guild.roles.everyone.id,
            allow: [PermissionFlagsBits.ViewChannel],
            deny: [
              PermissionFlagsBits.SendMessages, PermissionFlagsBits.AddReactions,
              PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.CreatePrivateThreads,
            ],
          },
        ],
      });
      console.log(`  ✅ Created: ${sep}`);
      await sleep(1500);
    } catch (err: any) {
      console.log(`  ❌ ${sep}: ${err.message}`);
    }
  }

  // ── Final reorder ──
  console.log('\n── Final reorder...');
  await sleep(2000);
  await guild.channels.fetch();
  const catChannels = [...guild.channels.cache.values()].filter(
    c => c && (c as any).parentId === CATEGORY_ID
  );
  console.log(`  Total in category: ${catChannels.length}`);

  const positions: { id: string; position: number }[] = [];
  let pos = 0;
  for (const kw of ORDER_KEYWORDS) {
    const match = catChannels.find(c => {
      if (!c) return false;
      const n = c.name.toLowerCase();
      return n.includes(kw.toLowerCase()) && !positions.find(p => p.id === c.id);
    });
    if (match) positions.push({ id: match.id, position: pos++ });
  }
  for (const c of catChannels) {
    if (c && !positions.find(p => p.id === c.id)) positions.push({ id: c.id, position: pos++ });
  }

  await (client as any).rest.patch(`/guilds/${GUILD_ID}/channels`, {
    body: positions.map(p => ({ id: p.id, position: p.position }))
  });
  console.log(`  ✅ Reordered ${positions.length} channels`);

  await client.destroy();
  console.log('\n🏴 Cleanup done. Background renames next.\n');
  process.exit(0);
}

run().catch(e => { console.error('💥', e.message); process.exit(1); });

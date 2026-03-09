import {
  Client, GatewayIntentBits, ChannelType, PermissionFlagsBits,
  CategoryChannel, GuildChannel
} from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const CATEGORY_ID = process.env.CATEGORY_ID!;
const GUILD_ID = process.env.GUILD_ID!;
const TOKEN = process.env.DISCORD_TOKEN!;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const SEPARATORS = [
  '─── ⚡ info ───',
  '─── 🔍 alpha ───',
  '─── 🎰 casino ───',
  '─── 💰 economy ───',
  '─── 🏛 governance ───',
  '─── 🤖 pi-os ───',
  '─── 🎭 social ───',
];

// Keyword order for positioning (partial match)
const ORDER_KEYWORDS = [
  'hub',
  '⚡ info', 'rules', 'announc', 'stats', 'leaderboard', 'events',
  '🔍 alpha', 'scanner', 'token-scanner', 'whale', 'launch', 'signal', 'alert',
  'alpha', 'oracle', 'intel', 'ct-intel', 'daily-brief', 'pi-world',
  '🎰 casino', 'coinflip', 'dice', 'crash', 'roulette', 'slot', 'mine',
  'duel', 'blackjack', 'the-pit', 'prediction', 'jackpot', 'tournament',
  '💰 economy', 'bank', 'daily', 'mining', 'market', 'airdrop', 'stonk',
  'provably', 'loan', 'hall-of-rekt', 'moonshot', 'hot-take',
  '🏛 governance', 'governance', 'proposal', 'laws', 'passed', 'court', 'treasury',
  '🤖 pi-os', 'pi-lab', 'pi-os', 'pi-log', 'verify', 'analytic',
  '🎭 social', 'meme', 'achievement',
];

async function run() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(TOKEN);
  await new Promise(r => client.once('ready', r));
  const guild = await client.guilds.fetch(GUILD_ID);
  let all = await guild.channels.fetch();

  // ── STEP 1: Create separators ──
  console.log('\n── Step 1: Creating separators...');
  const existingNames = [...all.values()]
    .filter(c => c && (c as any).parentId === CATEGORY_ID)
    .map(c => c!.name);

  for (const sep of SEPARATORS) {
    if (existingNames.some(n => n === sep)) {
      console.log(`  ⏭️  EXISTS: ${sep}`);
      continue;
    }
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
              PermissionFlagsBits.SendMessages,
              PermissionFlagsBits.AddReactions,
              PermissionFlagsBits.CreatePublicThreads,
              PermissionFlagsBits.CreatePrivateThreads,
            ],
          },
          {
            id: (await client.guilds.fetch(GUILD_ID)).members.me!.id,
            allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ManageChannels],
          },
        ],
      });
      console.log(`  ✅ Created: ${sep}`);
      await sleep(1500);
    } catch (err: any) {
      console.log(`  ❌ ${sep}: ${err.message}`);
    }
  }

  // ── STEP 2: Reorder everything ──
  console.log('\n── Step 2: Reordering...');
  await sleep(2000);
  all = await guild.channels.fetch();
  const catChannels = [...all.values()].filter(c => c && (c as any).parentId === CATEGORY_ID);

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
  // Append anything not matched
  for (const c of catChannels) {
    if (c && !positions.find(p => p.id === c.id)) {
      positions.push({ id: c.id, position: pos++ });
    }
  }

  await (client as any).rest.patch(`/guilds/${GUILD_ID}/channels`, {
    body: positions.map(p => ({ id: p.id, position: p.position }))
  });
  console.log(`  ✅ Reordered ${positions.length} channels`);

  await client.destroy();

  // ── STEP 3: Background renames (slow, ~80 min) ──
  console.log('\n── Step 3: Background renames starting...');
  console.log('   Rate limit: 2 per 10 min → 330s between each rename');
  console.log('   This will run in a separate process.\n');
  process.exit(0);
}

run().catch(e => { console.error('💥', e.message); process.exit(1); });

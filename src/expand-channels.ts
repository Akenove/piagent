/**
 * Expand The Collective — Phase 2
 * Adding: Governance, Economy, Pi OS, Events, Treasury, Achievements
 * GOLDEN RULE: NEVER delete existing channels.
 */
import {
  Client, GatewayIntentBits, ChannelType, PermissionFlagsBits,
  EmbedBuilder, TextChannel
} from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const CATEGORY_ID = process.env.CATEGORY_ID!;
const GUILD_ID = process.env.GUILD_ID!;
const TOKEN = process.env.DISCORD_TOKEN!;

const NEW_CHANNELS: Array<{ name: string; topic: string; type?: ChannelType.GuildText | ChannelType.GuildAnnouncement | ChannelType.GuildForum }> = [
  // ─── GOVERNANCE / DAO ───────────────────────────────
  { name: '🏛️・governance',       topic: '/propose /vote — Shape the future of The Collective' },
  { name: '📋・active-proposals',  topic: 'Live votes. Your voice matters.' },
  { name: '📜・passed-laws',       topic: 'History of what The Collective decided.' },

  // ─── ECONOMY / MARKET ───────────────────────────────
  { name: '📈・stonks',            topic: '/stonks buy/sell — Trade virtual stocks. Pi OS prices them.' },
  { name: '🛒・black-market',      topic: '/shop /buy — Roles, perks, cosmetics, power-ups.' },
  { name: '⛏️・mining-rig',        topic: '/mine — Earn SHARDS every 4h. No luck needed.' },
  { name: '🪂・airdrops',          topic: 'Random SHARD drops. Be active, be rewarded.' },

  // ─── PI OS / AI ──────────────────────────────────────
  { name: '🤖・pi-os-lab',         topic: '/pi status — Live AI brain. Talk to Pi directly.' },
  { name: '🧠・oracle',            topic: 'Pi\'s market predictions, insights, and alpha.' },
  { name: '📡・pi-logs',           topic: 'What Pi is doing right now. Full transparency.' },

  // ─── COLLECTIVE TREASURY ─────────────────────────────
  { name: '💎・treasury',          topic: 'The Collective fund. Every SHARD tracked. Pi manages.' },
  { name: '📊・analytics',         topic: 'Live economy stats. House edge. Total wagered. Distribution.' },

  // ─── ACHIEVEMENTS / RPG ──────────────────────────────
  { name: '🏅・achievements',      topic: 'Unlock milestones. Flex your history.' },
  { name: '⚔️・duels-arena',       topic: '/duel — Challenge others. Winner takes all.' },
  { name: '🎪・events',            topic: 'Tournaments. Challenges. Limited-time games.' },

  // ─── COMMUNITY ───────────────────────────────────────
  { name: '📰・intel',             topic: 'Crypto news, market moves. Pi OS curated.' },
  { name: '🐸・memes',             topic: 'The culture. 4chan energy. CT vibes.' },
];

// Pinned intros for key channels
const CHANNEL_INTROS: Record<string, { title: string; desc: string; color: number }> = {
  'governance': {
    title: '🏛️ THE COLLECTIVE GOVERNANCE',
    desc: `This is where **The Collective decides its future**.\n\n**How it works:**\n\`/propose\` — Submit a proposal (costs 500 SHARDS)\n\`/vote yes|no <id>\` — Cast your vote\n\n**Voting power:** 1 SHARD = 1 vote\n**Quorum:** 10% of wallets must vote\n**Duration:** 48 hours\n\n*The math decides. Not the loudest voice.*`,
    color: 0x8b5cf6,
  },
  'stonks': {
    title: '📈 THE COLLECTIVE STOCK MARKET',
    desc: `**Pi OS manages the prices.** Based on real activity inside The Collective.\n\n\`/stonks\` — View market\n\`/stonks buy <ticker> <amount>\` — Buy\n\`/stonks sell <ticker> <amount>\` — Sell\n\`/stonks portfolio\` — Your positions\n\n**Tickers:**\n\`$SHARD\` · \`$DEGEN\` · \`$BAKED\` · \`$CHAOS\` · \`$HOUSE\`\n\n*Prices fluctuate based on collective activity. Pi doesn't lie.*`,
    color: 0x10b981,
  },
  'treasury': {
    title: '💎 THE COLLECTIVE TREASURY',
    desc: `Every SHARD that flows through The Collective is tracked here.\n\n**Sources:**\n• 2% house edge from all games\n• Proposal fees (500 SHARDS each)\n• Shop revenue\n\n**Usage (voted by governance):**\n• Prize pools for events\n• Airdrops to active members\n• Development funding\n\n*Full transparency. Pi manages. Community decides.*`,
    color: 0xf59e0b,
  },
  'pi-os-lab': {
    title: '🤖 PI OS LABORATORY',
    desc: `**Direct access to the Pi OS brain.**\n\n\`/pi status\` — Is Pi awake?\n\`/pi ask <question>\` — Ask Pi anything\n\`/pi predict <asset>\` — Market prediction\n\`/pi logs\` — What Pi did recently\n\n*Pi is not just a bot. Pi is the operating system of The Collective.*\n\n*Everything you see here is powered by Pi OS running on distributed infrastructure.*`,
    color: 0x06b6d4,
  },
  'oracle': {
    title: '🧠 THE ORACLE',
    desc: `**Pi\'s public predictions and alpha.**\n\nPosted automatically when Pi detects:\n• Significant market moves\n• Unusual on-chain activity\n• Governance implications\n• Economy shifts inside The Collective\n\n*Read. Decide. Act. Pi doesn\'t guarantee. Pi informs.*`,
    color: 0x6366f1,
  },
};

async function expand() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(TOKEN);
  await new Promise(r => client.once('ready', r));

  const guild = await client.guilds.fetch(GUILD_ID);
  const allChannels = await guild.channels.fetch();
  const existingNames = allChannels
    .filter(c => c !== null && (c as any).parentId === CATEGORY_ID)
    .map(c => c!.name.toLowerCase());

  console.log(`\n🏴 THE COLLECTIVE — Phase 2 Expansion`);
  console.log(`Existing: ${existingNames.length} channels\n`);

  let created = 0, skipped = 0;
  const createdChannels: Map<string, TextChannel> = new Map();

  for (const ch of NEW_CHANNELS) {
    const slug = ch.name.split('・')[1] || '';
    if (existingNames.some(n => n.includes(slug.toLowerCase()))) {
      console.log(`  ⏭️  SKIP: ${ch.name}`);
      skipped++;
      continue;
    }

    try {
      const created_ch = await guild.channels.create({
        name: ch.name,
        type: ch.type ?? ChannelType.GuildText,
        parent: CATEGORY_ID,
        topic: ch.topic,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        ],
      });
      console.log(`  ✅ CREATED: ${ch.name}`);
      created++;
      if (slug) createdChannels.set(slug, created_ch as TextChannel);
      await new Promise(r => setTimeout(r, 600));
    } catch (err: any) {
      console.log(`  ❌ FAILED: ${ch.name} — ${err.message}`);
    }
  }

  // Post intros to key channels
  console.log('\n📌 Posting channel intros...');
  await new Promise(r => setTimeout(r, 2000));

  for (const [slug, intro] of Object.entries(CHANNEL_INTROS)) {
    const ch = createdChannels.get(slug);
    if (!ch) continue;
    try {
      await ch.send({
        embeds: [
          new EmbedBuilder()
            .setColor(intro.color)
            .setTitle(intro.title)
            .setDescription(intro.desc)
            .setFooter({ text: 'Pi OS • The Collective v1.0' })
        ]
      });
      console.log(`  📌 Intro → #${slug}`);
      await new Promise(r => setTimeout(r, 500));
    } catch (err: any) {
      console.log(`  ⚠️  Intro failed for #${slug}: ${err.message}`);
    }
  }

  console.log(`\n📊 Phase 2: ${created} created, ${skipped} skipped`);
  await client.destroy();
  console.log('🏴 Expansion complete.\n');
  process.exit(0);
}

expand().catch(err => {
  console.error('💥', err.message);
  process.exit(1);
});

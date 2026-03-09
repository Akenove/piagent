import { ActionRowBuilder, ButtonBuilder, ButtonStyle } from "discord.js";
/**
 * The Collective — Real Mission
 * Crypto Degen Service Platform
 * Add missing TOOL channels + reorder everything
 * GOLDEN RULE: NEVER delete existing channels
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

// MISSING tool channels to add
const NEW_TOOL_CHANNELS = [
  { name: '🔍・token-scanner',  topic: 'Paste any CA → Pi analyzes: honeypot, liquidity, holders, rug probability, dev wallet.' },
  { name: '🐋・whale-watch',    topic: 'Big wallet movements. Pi tracks the smart money so you don\'t have to.' },
  { name: '🚀・launch-radar',   topic: 'New token launches. pump.fun, Raydium, Jupiter. Pi filters the noise.' },
  { name: '📡・signals',        topic: 'Pi\'s trade signals. TA + on-chain + sentiment. BTC, SOL, ETH, alts.' },
  { name: '🔔・alerts',         topic: 'Set custom price/wallet alerts. /alert add <CA> <condition>' },
  { name: '🕵️・alpha',          topic: 'Curated alpha from CT. Pi reads so you don\'t miss.' },
];

// Final desired order (by name slug)
const ORDER = [
  // ── START HERE
  'hub', 'rules-and-lore', 'announcements',
  // ── TOOLS (main value)
  'token-scanner', 'whale-watch', 'launch-radar', 'signals', 'alerts', 'alpha',
  // ── MARKET INTEL
  'oracle', 'intel', 'memes', 'the-pit',
  // ── CASINO
  'coinflip', 'dice', 'crash', 'roulette', 'slots', 'mines', 'duels-arena',
  // ── ECONOMY
  'bank', 'daily-drop', 'mining-rig', 'black-market', 'airdrops', 'stonks',
  // ── DAO
  'governance', 'active-proposals', 'passed-laws', 'treasury', 'analytics',
  // ── PI OS
  'pi-os-lab', 'pi-logs', 'provably-fair', 'verify', 'achievements', 'events', 'leaderboard', 'stats',
];

// Intro messages for new tool channels
const TOOL_INTROS: Record<string, { title: string; desc: string; color: number }> = {
  'token-scanner': {
    title: '🔍 TOKEN SCANNER',
    color: 0x06b6d4,
    desc: `**Paste any contract address. Pi does the rest.**\n\n` +
      `\`/scan <CA>\` or just drop the address in chat.\n\n` +
      `**What Pi checks:**\n` +
      `• Honeypot detection\n` +
      `• Liquidity depth & lock status\n` +
      `• Holder distribution (whale concentration)\n` +
      `• Dev wallet activity\n` +
      `• Similar contract patterns (known rug templates)\n` +
      `• Social presence score\n` +
      `• Rugpull probability (0-100)\n\n` +
      `*No token is safe until Pi says so.*`,
  },
  'whale-watch': {
    title: '🐋 WHALE WATCH',
    color: 0x3b82f6,
    desc: `**Pi tracks the smart money. You act on it.**\n\n` +
      `Auto-posted when:\n` +
      `• Wallet moves >$50k\n` +
      `• Known VC/fund wallet active\n` +
      `• Multiple whales accumulating same token\n` +
      `• Smart money exiting a position\n\n` +
      `\`/whale add <wallet>\` — Track a specific wallet\n` +
      `\`/whale top\` — Most active whales today\n\n` +
      `*They know something. Pi tells you what.*`,
  },
  'launch-radar': {
    title: '🚀 LAUNCH RADAR',
    color: 0xf59e0b,
    desc: `**New token launches. Filtered. Scored. Delivered.**\n\n` +
      `Pi monitors:\n` +
      `• pump.fun launches\n` +
      `• Raydium new pools\n` +
      `• Jupiter new listings\n` +
      `• Trending on DexScreener\n\n` +
      `**Pi's filter criteria:**\n` +
      `• Min liquidity threshold\n` +
      `• Dev wallet not dumping\n` +
      `• Community activity signal\n` +
      `• No honeypot patterns\n\n` +
      `*Not every launch. Only the ones worth watching.*`,
  },
  'signals': {
    title: '📡 PI SIGNALS',
    color: 0x10b981,
    desc: `**Pi's trade signals. No noise. Only calls.**\n\n` +
      `Based on:\n` +
      `• Technical analysis (EMA, RSI, MACD, S/R)\n` +
      `• On-chain data (funding rates, open interest)\n` +
      `• CT sentiment analysis\n` +
      `• Macro context\n\n` +
      `**Signal format:**\n` +
      `\`📡 BTC LONG | Entry: $95,200 | TP: $97,500 | SL: $94,000 | Confidence: 72%\`\n\n` +
      `*Pi doesn\'t guarantee. Pi informs. DYOR.*`,
  },
  'alpha': {
    title: '🕵️ ALPHA CHANNEL',
    color: 0x8b5cf6,
    desc: `**The signal in the noise. Pi reads CT so you don\'t miss.**\n\n` +
      `Auto-posted when Pi detects:\n` +
      `• KOL with track record posting a call\n` +
      `• Unusual options/perp activity\n` +
      `• Dev team wallet movement\n` +
      `• Exchange listing rumors gaining traction\n` +
      `• Narrative shifts (what\'s CT talking about)\n\n` +
      `*Alpha decays fast. Pi catches it early.*`,
  },
};

// Hub mission statement rewrite
const HUB_MISSION = {
  title: '🏴 THE COLLECTIVE',
  color: 0x06b6d4,
  desc: `**The crypto degen command center.**\n\n` +
    `Not a casino. Not a Discord server.\n` +
    `A **living platform** — powered by Pi OS.\n\n` +
    `**What we provide:**\n` +
    `🔍 Token safety scanning\n` +
    `🐋 Whale wallet tracking\n` +
    `🚀 Launch radar (pump.fun, Raydium)\n` +
    `📡 Pi's trade signals\n` +
    `🧠 Market oracle & alpha\n` +
    `🎰 Provably fair casino (entertainment)\n` +
    `💎 In-game economy with real mechanics\n` +
    `🏛️ DAO governance — community decides\n\n` +
    `**To access tools, you need a wallet.**`,
};

async function run() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(TOKEN);
  await new Promise(r => client.once('ready', r));

  const guild = await client.guilds.fetch(GUILD_ID);
  let allChannels = await guild.channels.fetch();
  const existingNames = allChannels
    .filter(c => c !== null && (c as any).parentId === CATEGORY_ID)
    .map(c => c!.name.toLowerCase());

  console.log(`\n🏴 THE COLLECTIVE — Reorder + Expand`);
  console.log(`Existing: ${existingNames.length} channels\n`);

  // 1. Add missing tool channels
  console.log('── Adding tool channels...');
  const newlyCreated: Map<string, TextChannel> = new Map();
  
  for (const ch of NEW_TOOL_CHANNELS) {
    const slug = ch.name.split('・')[1];
    if (existingNames.some(n => n.includes(slug))) {
      console.log(`  ⏭️  SKIP: ${ch.name}`);
      continue;
    }
    try {
      const created = await guild.channels.create({
        name: ch.name,
        type: ChannelType.GuildText,
        parent: CATEGORY_ID,
        topic: ch.topic,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
        ],
      });
      console.log(`  ✅ ${ch.name}`);
      newlyCreated.set(slug, created as TextChannel);
      await new Promise(r => setTimeout(r, 600));
    } catch (err: any) {
      console.log(`  ❌ ${ch.name}: ${err.message}`);
    }
  }

  // 2. Post tool intros
  console.log('\n── Posting tool intros...');
  for (const [slug, intro] of Object.entries(TOOL_INTROS)) {
    const ch = newlyCreated.get(slug);
    if (!ch) continue;
    try {
      await ch.send({
        embeds: [new EmbedBuilder().setColor(intro.color).setTitle(intro.title).setDescription(intro.desc).setFooter({ text: 'Pi OS • The Collective v1.0' })]
      });
      console.log(`  📌 ${slug}`);
      await new Promise(r => setTimeout(r, 400));
    } catch {}
  }

  // 3. Reorder channels
  console.log('\n── Reordering channels...');
  await new Promise(r => setTimeout(r, 2000));
  allChannels = await guild.channels.fetch();
  
  const categoryChannels = allChannels.filter(
    c => c !== null && (c as any).parentId === CATEGORY_ID
  );

  // Build position map
  const positions: { channel: any; position: number }[] = [];
  let pos = 0;

  for (const slug of ORDER) {
    const match = categoryChannels.find(c =>
      c !== null && c.name.toLowerCase().includes(slug.toLowerCase())
    );
    if (match) {
      positions.push({ channel: match.id, position: pos++ });
    }
  }

  // Any remaining channels not in ORDER go at end
  for (const ch of categoryChannels.values()) {
    if (!ch) continue;
    const alreadyPlaced = positions.some(p => p.channel === ch.id);
    if (!alreadyPlaced) {
      positions.push({ channel: ch.id, position: pos++ });
    }
  }

  try {
    await guild.channels.setPositions(
      positions.map(p => ({ channel: p.channel, position: p.position, parent: CATEGORY_ID }))
    );
    console.log(`  ✅ Reordered ${positions.length} channels`);
  } catch (err: any) {
    console.log(`  ⚠️  Reorder partial: ${err.message}`);
  }

  // 4. Update hub mission
  console.log('\n── Updating #hub...');
  await new Promise(r => setTimeout(r, 1000));
  allChannels = await guild.channels.fetch();
  const hub = allChannels.find(
    c => c !== null && (c as any).parentId === CATEGORY_ID && c.name.includes('hub')
  ) as TextChannel | undefined;
  
  if (hub) {
    try {
      const msgs = await (hub as any).messages.fetch({ limit: 5 });
      const botMsg = msgs.find((m: any) => m.author.bot);
      const embed = new EmbedBuilder()
        .setColor(HUB_MISSION.color)
        .setTitle(HUB_MISSION.title)
        .setDescription(HUB_MISSION.desc)
        .setFooter({ text: 'Pi OS • The Collective v1.0' });

      
      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('onboarding_start').setLabel('🔓 Create Wallet & Enter').setStyle(ButtonStyle.Primary)
      );

      if (botMsg) {
        await botMsg.edit({ embeds: [embed], components: [row] });
        console.log('  ✅ Hub message updated');
      } else {
        await (hub as any).send({ embeds: [embed], components: [row] });
        console.log('  ✅ Hub message posted');
      }
    } catch (err: any) {
      console.log(`  ⚠️  Hub update: ${err.message}`);
    }
  }

  await client.destroy();
  console.log('\n🏴 Mission complete. The Collective is now a real platform.\n');
  process.exit(0);
}

run().catch(err => {
  console.error('💥', err.message);
  process.exit(1);
});

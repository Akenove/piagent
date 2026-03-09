/**
 * THE COLLECTIVE — Final Channel Polish
 * Sets server icon, banner, and sends welcome embeds to key channels
 */
import { Client, GatewayIntentBits, ChannelType, EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle, TextChannel } from 'discord.js';
import dotenv from 'dotenv'; dotenv.config();
import * as fs from 'fs';
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));
const GUILD_ID = process.env.GUILD_ID!;

async function run() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN!);
  await new Promise(r => client.once('ready', r));
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();

  // ═══ 1. Server Icon ═══
  console.log('\n══ SERVER BRANDING ══');
  const iconPath = '/Users/arvin2/Projects/the-collective-bot/branding/v2/04-18-41-discord-icon-mask-premium.png';
  if (fs.existsSync(iconPath)) {
    try {
      await guild.setIcon(iconPath);
      console.log('✅ Server icon set (mask premium)');
    } catch(e: any) { console.log('⚠️ Icon:', e.message?.slice(0,60)); }
    await sleep(1000);
  }

  // Banner (requires boost level 2)
  const bannerPath = '/Users/arvin2/Projects/the-collective-bot/branding/v2/04-14-52-banner-limo-scene.png';
  if (fs.existsSync(bannerPath)) {
    try {
      await guild.setBanner(bannerPath);
      console.log('✅ Server banner set (limo scene)');
    } catch(e: any) { console.log('⚠️ Banner:', e.message?.slice(0,80)); }
    await sleep(1000);
  }

  // ═══ 2. Channel Embeds ═══
  console.log('\n══ CHANNEL EMBEDS ══');

  const embedConfigs: { id: string; embed: EmbedBuilder; components?: ActionRowBuilder<ButtonBuilder>[]; }[] = [
    // Rules channel
    {
      id: '1477799177064026235',
      embed: new EmbedBuilder()
        .setColor(0xFF1493)
        .setTitle('📜 THE LAWS OF THE COLLECTIVE')
        .setDescription(
          '**Welcome to the underground. Read carefully — ignorance is not a defense.**\n\n' +
          '**§1 — RESPECT THE CODE**\n' +
          '> No scamming, no phishing, no rugpulling. You cross one of us, you cross all of us.\n\n' +
          '**§2 — WHAT HAPPENS HERE, STAYS HERE**\n' +
          '> Alpha shared in The Collective is for members only. Leaking = instant exile.\n\n' +
          '**§3 — NO SPAM, NO SHILLING**\n' +
          '> Unsolicited token promotions, NFT spam, or "check my project" = permanent ban.\n\n' +
          '**§4 — EARN YOUR PLACE**\n' +
          '> Reputation is everything. Contribute alpha, help others, play fair. Your rank reflects your value.\n\n' +
          '**§5 — PROVABLY FAIR**\n' +
          '> Every game, every bet, every transaction is verifiable. We don\'t trust — we verify.\n\n' +
          '**§6 — ONE WALLET, ONE MEMBER**\n' +
          '> Multi-accounting = ban. Alt wallets = ban. Bot manipulation = ban + seizure.\n\n' +
          '**§7 — PI OS IS LAW**\n' +
          '> Pi OS monitors everything. Automated enforcement is instant and final.'
        )
        .setImage('https://i.imgur.com/placeholder.png') // TODO: upload rules image
        .setFooter({ text: 'Break the rules → lose your wallet → lose your access. Simple.' }),
    },
    // Announcements
    {
      id: '1477799180780175461',
      embed: new EmbedBuilder()
        .setColor(0xFF1493)
        .setTitle('🏴 THE COLLECTIVE IS LIVE')
        .setDescription(
          '**The largest private crypto network just opened its doors.**\n\n' +
          '🔭 **Alpha Intel** — Token scanner, whale tracking, launch radar, KOL watch, trade signals\n' +
          '🎰 **Casino** — 8 provably fair games: coinflip, dice, crash, roulette, slots, mines, blackjack, duels\n' +
          '💰 **Economy** — Bank, daily rewards, mining, stonks market, black market shop, loan shark\n' +
          '🏛️ **DAO** — Governance proposals, voting, treasury transparency, court system\n' +
          '🤖 **Pi OS** — AI engine running 24/7: scanning, analyzing, protecting\n\n' +
          '**This is not just a Discord. This is a platform.**\n\n' +
          'Everything you do earns SHARDS. Everything you earn is verifiable. Every game is provably fair.\n\n' +
          '> *"We don\'t trust. We verify."*'
        )
        .setFooter({ text: 'The Collective • Powered by Pi OS' }),
      components: [
        new ActionRowBuilder<ButtonBuilder>().addComponents(
          new ButtonBuilder().setCustomId('onboarding_start').setLabel('🔓 Create Wallet').setStyle(ButtonStyle.Primary),
          new ButtonBuilder().setURL('https://bakedpi.tech').setLabel('🌐 Website').setStyle(ButtonStyle.Link),
          new ButtonBuilder().setURL('https://x.com/baked_pi01').setLabel('𝕏 Follow').setStyle(ButtonStyle.Link),
        ),
      ],
    },
    // Casino welcome
    {
      id: '1477799189399208139', // coinflip (first casino channel people see)
      embed: new EmbedBuilder()
        .setColor(0xFF1493)
        .setTitle('🎰 THE CASINO')
        .setDescription(
          '**8 games. All provably fair. All instant.**\n\n' +
          '🪙 `/coinflip` — 50/50, 1.96x payout\n' +
          '🎲 `/dice` — Roll under target, dynamic odds\n' +
          '📈 `/crash` — Ride the multiplier, cash out in time\n' +
          '🎡 `/roulette` — European rules, 36 numbers\n' +
          '🎰 `/slots` — 7 symbols, up to 50x jackpot\n' +
          '💣 `/mines` — Minesweeper meets gambling\n' +
          '🃏 `/blackjack` — Beat Pi to 21\n' +
          '⚔️ `/duel @user` — 1v1 wagered battle\n\n' +
          '**Every bet generates a cryptographic hash.** Verify any result with `/verify <bet_id>`.\n\n' +
          '> House edge: 1-5% depending on game. 100% of house earnings go to DAO treasury.'
        )
        .setFooter({ text: 'Provably fair • HMAC-SHA256 • Verifiable on-chain' }),
    },
    // Alpha Intel welcome
    {
      id: '1477802183977205851', // scanner
      embed: new EmbedBuilder()
        .setColor(0xFF1493)
        .setTitle('🔭 ALPHA INTEL CENTER')
        .setDescription(
          '**Pi OS scans the blockchain 24/7 so you don\'t have to.**\n\n' +
          '🔍 **Scanner** — `/scan <address>` → instant rug check, liquidity analysis, dev wallet tracking\n' +
          '🐋 **Whale Watch** — Large wallet movements auto-posted in real-time\n' +
          '🚀 **Launch Radar** — New tokens filtered by Pi\'s risk model\n' +
          '📡 **Signals** — TA + on-chain + sentiment, with confidence scores\n' +
          '🔔 **Alerts** — `/alert add <CA> <condition>` → custom notifications\n' +
          '🕵️ **Alpha** — Curated CT intel, KOL calls, unusual flow\n' +
          '🧠 **Oracle** — Pi\'s daily market analysis, 09:00 UTC\n\n' +
          '> All data is Pi-verified. No paid promotions. No sponsored calls. Pure signal.'
        )
        .setFooter({ text: 'Pi OS Alpha Engine v2.0 • Trust the data, not the narrative' }),
    },
    // Economy welcome
    {
      id: '1477799218696552710', // bank
      embed: new EmbedBuilder()
        .setColor(0xFF1493)
        .setTitle('💰 THE VAULT — ECONOMY SYSTEM')
        .setDescription(
          '**SHARDS are the lifeblood of The Collective.**\n\n' +
          '💰 `/balance` — Check your wallet\n' +
          '🎁 `/daily` — Claim 500 SHARDS every 24h (streak bonuses!)\n' +
          '⛏️ `/mine` — Generate SHARDS every 4h, rate scales with tier\n' +
          '💸 `/transfer @user <amount>` — Send SHARDS instantly\n' +
          '📈 `/stonks buy/sell` — Virtual stock market\n' +
          '🛒 `/shop` — Spend on roles, titles, power-ups\n' +
          '🏦 `/loan <amount>` — Borrow at Pi OS rates (default = liquidation)\n\n' +
          '**Tier System:**\n' +
          '> 🥉 Bronze (0-999) → 🥈 Silver (1K-9.9K) → 🥇 Gold (10K-99K) → 💎 Diamond (100K+) → 👑 Whale (1M+)\n\n' +
          '> Every transaction is logged in the public ledger. Full transparency, zero trust required.'
        )
        .setFooter({ text: 'Powered by Pi OS • Provably fair economy' }),
    },
  ];

  for (const cfg of embedConfigs) {
    const ch = guild.channels.cache.get(cfg.id) as TextChannel | undefined;
    if (!ch) { console.log(`⚠️ Channel ${cfg.id} not found`); continue; }
    try {
      // Check if bot already posted an embed
      const msgs = await ch.messages.fetch({ limit: 10 });
      const existing = msgs.find(m => m.author.id === client.user!.id && m.embeds.length > 0);
      if (existing) {
        await existing.edit({ embeds: [cfg.embed], components: cfg.components || [] });
        console.log(`✅ Updated embed in #${ch.name}`);
      } else {
        await ch.send({ embeds: [cfg.embed], components: cfg.components || [] });
        console.log(`✅ Sent embed to #${ch.name}`);
      }
    } catch(e: any) { console.log(`❌ #${ch.name}: ${e.message?.slice(0,60)}`); }
    await sleep(1000);
  }

  // ═══ 3. Category ordering ═══
  console.log('\n══ CATEGORY ORDER ══');
  const catOrder = [
    '1477777771382968482', // 🏴 THE COLLECTIVE (main info)
    // Alpha Intel cat
    // Casino cat
    // Vault cat
    // Council cat
    // PI OS cat
    // Community cat
    '1470858890970136768', // 🔊 VOICE
    '1477809597547941950', // Extended
  ];
  
  // Set positions
  let pos = 0;
  for (const catId of catOrder) {
    const cat = guild.channels.cache.get(catId);
    if (cat) {
      try {
        await (cat as any).edit({ position: pos });
        console.log(`✅ ${cat.name} → position ${pos}`);
        pos++;
      } catch(e: any) { console.log(`⚠️ ${cat.name}: ${e.message?.slice(0,50)}`); }
      await sleep(500);
    }
  }

  await client.destroy();
  console.log('\n🏴 Final polish complete.\n');
  process.exit(0);
}
run().catch(e => { console.error('💥', e.message); process.exit(1); });

import {
  Client, GatewayIntentBits, ChannelType, PermissionFlagsBits,
  EmbedBuilder, TextChannel, ActionRowBuilder, ButtonBuilder, ButtonStyle
} from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const CATEGORY_ID = process.env.CATEGORY_ID!;
const GUILD_ID = process.env.GUILD_ID!;
const TOKEN = process.env.DISCORD_TOKEN!;

// New channels with rich content
const ADDITIONS: Array<{
  name: string;
  topic: string;
  intro: { title: string; desc: string; color: number; fields?: { name: string; value: string; inline?: boolean }[] };
}> = [
  // ── GAMES
  {
    name: '🃏・blackjack',
    topic: '/blackjack — You vs Pi. 21 wins. Pi deals, math decides.',
    intro: {
      title: '🃏 BLACKJACK — You vs Pi',
      color: 0x1a1a2e,
      desc: `**The classic. Simplified. Provably fair.**\n\n\`/blackjack <amount>\` — Start a hand\n\`/hit\` — Draw a card\n\`/stand\` — Hold your hand\n\`/double\` — Double down (2x bet, 1 more card)\n\n**Rules:**\n• Closest to 21 without going over wins\n• Pi (dealer) hits until 17+\n• Blackjack = 1.5x payout\n• Bust = you lose\n\n*Every shuffle is HMAC-SHA256 verified. The deck doesn't lie.*`,
      fields: [{ name: 'House Edge', value: '0.5%', inline: true }, { name: 'Max Bet', value: '50,000 💎', inline: true }, { name: 'Payout', value: '1.5x (BJ) / 2x (win)', inline: true }]
    }
  },
  {
    name: '🎯・prediction-market',
    topic: 'Bet on real events — BTC price, news, crypto outcomes. Pi resolves.',
    intro: {
      title: '🎯 PREDICTION MARKET',
      color: 0x7c3aed,
      desc: `**The market always knows. Prove you do too.**\n\nBet SHARDS on real-world outcomes. Pi resolves all markets based on verifiable data.\n\n**Active Markets:**\n> 🟡 \`BTC-W1\` — BTC above $95k by Sunday? **Pays 1.8x**\n> 🔴 \`SOL-ATH\` — SOL new ATH this month? **Pays 3.2x**\n> 🟢 \`PUMP-10M\` — Any pump.fun token hits $10M MC this week? **Pays 2.1x**\n\n\`/predict list\` — All open markets\n\`/predict bet <market> <yes|no> <amount>\` — Place bet\n\`/predict my\` — Your open positions\n\n*Pi reads the chain. You can't fake the outcome.*`,
    }
  },
  {
    name: '🏟️・tournament',
    topic: 'Weekly tournaments. Biggest stack wins the pot. Pi runs it all.',
    intro: {
      title: '🏟️ TOURNAMENT ARENA',
      color: 0xdc2626,
      desc: `**Every week. One winner. Everything on the line.**\n\n**How it works:**\n1. Entry fee: 500 💎\n2. All entries go to prize pool (Pi takes 5% for treasury)\n3. Play any casino game over 7 days\n4. Highest net profit wins **entire pool**\n\n**Current Tournament:** \`Week 9 — The Gauntlet\`\n**Prize Pool:** 12,500 💎 (and growing)\n**Players:** 25\n**Ends:** Sunday 23:59 UTC\n\n\`/tournament join\` — Enter this week's tournament\n\`/tournament leaderboard\` — Current standings\n\`/tournament history\` — Past winners\n\n*Past winner \`DegenKing_77\` turned 500 into 8,400 in one session.*`,
    }
  },
  {
    name: '🎰・jackpot',
    topic: 'Weekly lottery. Buy tickets. Pi draws. One number changes everything.',
    intro: {
      title: '🎰 THE JACKPOT',
      color: 0xfbbf24,
      desc: `**Every ticket is a chance. Math picks the winner.**\n\n**How it works:**\n• 1 ticket = 100 💎\n• Buy unlimited tickets\n• Every Sunday at 00:00 UTC, Pi draws a winner\n• Winner takes **80% of the pot**\n• 10% burns, 10% goes to treasury\n\n**Current Jackpot:** 🎰 **47,800 💎**\n**Tickets sold:** 598\n**Your tickets:** 0\n**Draw in:** 4 days, 16 hours\n\n\`/jackpot buy <amount>\` — Buy tickets\n\`/jackpot mytickets\` — Your entries\n\`/jackpot history\` — Past winners\n\n*Completely provably fair. The draw seed is published 24h before.*`,
    }
  },
  {
    name: '🏦・loan-shark',
    topic: 'Need SHARDS fast? Pi lends. But Pi always collects.',
    intro: {
      title: '🏦 LOAN SHARK',
      color: 0x166534,
      desc: `**Pi lends. Pi always collects. Don't miss a payment.**\n\nNeed SHARDS to make a play? Borrow from Pi. Pay it back with interest.\n\n**Loan Terms:**\n\`\`\`\nAmount    Interest    Duration\n━━━━━━━━━━━━━━━━━━━━━━━━━━━\n100-999     5%        24 hours\n1,000-4,999  10%       48 hours\n5,000-9,999  18%       72 hours\n10,000+      25%        7 days\n\`\`\`\n\n**Miss a payment:** +10% penalty per hour\n**Default:** Pi takes collateral (50% of your wallet)\n\n\`/loan borrow <amount>\` — Take a loan\n\`/loan repay\` — Pay it back early\n\`/loan status\` — Your current debt\n\n*Pi doesn't forget. Pi doesn't sleep.*`,
    }
  },
  // ── CULTURE
  {
    name: '💀・hall-of-rekt',
    topic: 'The Wall of Shame. Biggest losses. Owned publicly. Learn from the fallen.',
    intro: {
      title: '💀 HALL OF REKT',
      color: 0x450a0a,
      desc: `**The Wall of Shame. Your worst moments, immortalized.**\n\nEvery time someone loses 1,000+ 💎 in a single bet, Pi posts it here.\n\nName. Amount. Game. Time. No mercy.\n\n\`\`\`\n#1  degen_lord99   -48,200 💎  CRASH  (cashed out at 1.01x)\n#2  moonboy_eth    -25,000 💎  SLOTS  (3x 7 7 7 = didn't hit)\n#3  alphamaxxor    -18,500 💎  DICE   (rolled 99 → needed under 2)\n#4  ngmi_forever   -12,000 💎  COIN   (heads 9 times, picked tails)\n#5  paperhands_99  -10,000 💎  CRASH  (cashed at 1.00x)\n\`\`\`\n\n*Getting rekt is part of the journey. Hiding it isn't.*`,
    }
  },
  {
    name: '🌙・moonshots',
    topic: 'The Wall of Fame. Biggest wins. Legendary plays. Hall of legends.',
    intro: {
      title: '🌙 MOONSHOTS — HALL OF LEGENDS',
      color: 0x78350f,
      desc: `**The plays that made history. The winners who went to the moon.**\n\nEvery 5,000+ 💎 win gets posted here by Pi. No edits. No lies.\n\n\`\`\`\n#1  BASED_GOD_777   +127,400 💎  CRASH  (cashed at 127.44x 🔥)\n#2  satoshi_slayer  +84,000 💎   ROUL   (straight up, 36x, twice)\n#3  pi_believer     +61,200 💎   DICE   (100x multiplier, max bet)\n#4  degenesis       +44,800 💎   BJ     (7 hands, doubled every time)\n#5  collective_chad +33,300 💎   SLOTS  (triple 7 jackpot)\n\`\`\`\n\n*This is what the game is about. This is why we play.*`,
    }
  },
  {
    name: '🔥・hot-takes',
    topic: 'CT energy. Raw opinions. Alpha or cope. The community decides.',
    intro: {
      title: '🔥 HOT TAKES',
      color: 0xea580c,
      desc: `**Say what CT won't. The community judges.**\n\nDrop your takes. Bull or bear. Based or cringe. If 10 people react 🔥, Pi pins it for the week.\n\n**Hall of Based Takes:**\n> *"BTC is just a meme with better marketing than PEPE"* — 🔥 47\n> *"The only real alpha is being early enough to be called a scammer"* — 🔥 38  \n> *"Yield farming is just gambling with extra steps"* — 🔥 31\n> *"If your crypto thesis needs a thread to explain, it's already too late"* — 🔥 29\n\nTop 3 takes each week win 500 💎.\n\n*No financial advice. Only vibes.*`,
    }
  },
  {
    name: '🤝・ct-intel',
    topic: 'What CT is saying right now. Pi monitors, curates, delivers.',
    intro: {
      title: '🤝 CT INTEL',
      color: 0x0369a1,
      desc: `**CT never sleeps. Pi reads everything.**\n\nPi monitors Crypto Twitter 24/7. When signal cuts through the noise — it lands here.\n\n**What gets posted:**\n• KOL wallets moving before their tweets\n• Coordinated buys across multiple accounts\n• Whale accumulation before announcements\n• Dev wallet activity that doesn't match public narrative\n• Unusual options flow on CME/Deribit\n\n**Format:**\n\`\`\`\n📡 [SIGNAL] BTC options\n$120k call bought 3 hours before Powell speech\nSize: $2.4M notional\nExpiry: 30 days\nPi confidence: HIGH\n\`\`\`\n\n*Not financial advice. Just data. You decide.*`,
    }
  },
  {
    name: '🌐・pi-world',
    topic: 'The Collective map. Where are we? Who are we? Pi tracks it all.',
    intro: {
      title: '🌐 PI WORLD — THE COLLECTIVE MAP',
      color: 0x0891b2,
      desc: `**The Collective is everywhere. Pi maps it.**\n\nLive stats about The Collective — updated by Pi every hour.\n\n**📊 Right Now:**\n\`\`\`\nTotal Wallets:      ████░░░░ 847\nActive Today:       ██░░░░░░ 203\nTotal SHARDS:       ████████ 4,281,900\nGames Today:        ███░░░░░ 1,847\nBiggest Win Today:  ██████░░ 28,400 💎\nBiggest Loss Today: ███░░░░░ 12,200 💎\nHouse Edge Earned:  ████░░░░ 8,340 💎 → Treasury\nTournament Pool:    ██░░░░░░ 12,500 💎\n\`\`\`\n\n**Top Nations:**\n🇹🇷 Turkey · 🇺🇸 USA · 🇸🇬 Singapore · 🇩🇪 Germany · 🇬🇧 UK\n\n*Pi knows where you are. Jk. (or not)*`,
    }
  },
  {
    name: '☀️・daily-brief',
    topic: 'Pi\'s morning briefing. Every day at 09:00 UTC. Market, economy, events.',
    intro: {
      title: '☀️ PI\'s DAILY BRIEF',
      color: 0xf59e0b,
      desc: `**Every day at 09:00 UTC, Pi wakes up and tells you what matters.**\n\nFormat:\n\`\`\`\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n☀️ THE COLLECTIVE — Daily Brief\nMarch 2, 2026 | Pi OS\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n📈 MACRO\nBTC: $94,200 (-1.2%) | ETH: $3,180 (+0.4%)\nSOL: $198 (-2.1%) | Fear & Greed: 52 (Neutral)\n\n🎰 COLLECTIVE ECONOMY\nShards in circulation: 4.2M\nYesterday's volume: 847K wagered\nHouse earnings: 16,940 (treasury)\nBiggest winner: anon_8472 (+48,200)\n\n🚀 LAUNCH RADAR\n3 new tokens Pi flagged as low risk\nSee #launch-radar for details\n\n🎯 PI'S CALL\nNeutral on BTC short term.\nWatching SOL support at $190.\n\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\`\`\`\n*Pi says GM. Now go make some money.*`,
    }
  },
  {
    name: '⚖️・court',
    topic: 'Accuse someone. Community judges. Pi executes the verdict.',
    intro: {
      title: '⚖️ THE COURT OF THE COLLECTIVE',
      color: 0x4c1d95,
      desc: `**Justice is community-driven here. Pi enforces the verdict.**\n\nThink someone cheated? Acted against The Collective? Bring them to court.\n\n**Process:**\n1. Pay 500 💎 filing fee (refunded if you win)\n2. State your case in a thread\n3. Defendant has 24h to respond\n4. Community votes (48h)\n5. Pi executes verdict\n\n**Possible Verdicts:**\n• Acquitted → defendant gets 500 💎 from accuser\n• Guilty → fine (500-5,000 💎), temp ban, or permanent ban\n• Contempt → Pi mutes you for 24h for wasting everyone's time\n\n**Active Cases:** 0\n**Past Cases:** 3 (2 guilty, 1 acquitted)\n\n\`/court file @user <reason>\` — Open a case\n\`/court cases\` — View active cases`,
    }
  },
];

// Reorder including new channels
const FULL_ORDER = [
  'hub','rules-and-lore','announcements',
  'token-scanner','whale-watch','launch-radar','signals','alerts','alpha','ct-intel',
  'oracle','daily-brief','intel','pi-world',
  'hot-takes','memes','the-pit',
  'coinflip','dice','crash','roulette','slots','mines','blackjack','duels-arena',
  'prediction-market','jackpot','tournament',
  'bank','daily-drop','mining-rig','loan-shark','black-market','airdrops','stonks',
  'moonshots','hall-of-rekt',
  'governance','active-proposals','passed-laws','court','treasury','analytics',
  'pi-os-lab','pi-logs','provably-fair','verify','achievements','events','leaderboard','stats',
];

async function run() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(TOKEN);
  await new Promise(r => client.once('ready', r));

  const guild = await client.guilds.fetch(GUILD_ID);
  let all = await guild.channels.fetch();
  const existingNames = [...all.values()]
    .filter(c => c && (c as any).parentId === CATEGORY_ID)
    .map(c => c!.name.toLowerCase());

  console.log(`\n🏴 MEGA EXPANSION — ${ADDITIONS.length} new channels`);
  const newChannels: Map<string, TextChannel> = new Map();

  for (const ch of ADDITIONS) {
    const slug = ch.name.split('・')[1];
    if (existingNames.some(n => n.includes(slug.toLowerCase().split('-')[0]))) {
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
      newChannels.set(slug, created as TextChannel);
      await new Promise(r => setTimeout(r, 700));
    } catch (err: any) {
      console.log(`  ❌ ${ch.name}: ${err.message}`);
    }
  }

  // Post rich intro content
  console.log('\n📌 Posting channel content...');
  for (const ch of ADDITIONS) {
    const slug = ch.name.split('・')[1];
    const channel = newChannels.get(slug);
    if (!channel) continue;

    try {
      const embed = new EmbedBuilder()
        .setColor(ch.intro.color)
        .setTitle(ch.intro.title)
        .setDescription(ch.intro.desc)
        .setFooter({ text: 'Pi OS • The Collective v1.0' });

      if (ch.intro.fields) {
        embed.addFields(ch.intro.fields);
      }

      await channel.send({ embeds: [embed] });
      console.log(`  📌 ${slug}`);
      await new Promise(r => setTimeout(r, 400));
    } catch (err: any) {
      console.log(`  ⚠️  ${slug}: ${err.message}`);
    }
  }

  // Full reorder
  console.log('\n🔀 Reordering everything...');
  await new Promise(r => setTimeout(r, 2000));
  all = await guild.channels.fetch();
  const catChannels = [...all.values()].filter(c => c && (c as any).parentId === CATEGORY_ID);

  const positionData: { id: string; position: number }[] = [];
  let pos = 0;
  for (const slug of FULL_ORDER) {
    const match = catChannels.find(c => c!.name.toLowerCase().includes(slug.split('-')[0]));
    if (match && !positionData.find(p => p.id === match.id)) {
      positionData.push({ id: match.id, position: pos++ });
    }
  }
  for (const c of catChannels) {
    if (c && !positionData.find(p => p.id === c.id)) {
      positionData.push({ id: c.id, position: pos++ });
    }
  }

  try {
    await (client as any).rest.patch(`/guilds/${GUILD_ID}/channels`, {
      body: positionData.map(p => ({ id: p.id, position: p.position }))
    });
    console.log(`  ✅ ${positionData.length} channels reordered`);
  } catch (err: any) {
    console.log(`  ⚠️  ${err.message}`);
  }

  await client.destroy();
  console.log('\n🏴 Mega expansion complete.\n');
  process.exit(0);
}

run().catch(err => { console.error('💥', err.message); process.exit(1); });

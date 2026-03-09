/**
 * THE COLLECTIVE — Full Discord Architecture Rebuild
 * Uses EVERY Discord channel feature:
 * - Multiple categories (proper grouping)
 * - Announcement channels (for mass publish)
 * - Forum channels (for governance proposals)
 * - Voice channels (community hangout)
 * - Stage channels (events/AMAs)
 * - Slowmode per channel
 * - Role-based permission overwrites
 * - Channel topics + default thread auto-archive
 * GOLDEN RULE: NEVER delete anything — only move + add
 */
import {
  Client, GatewayIntentBits, ChannelType, PermissionFlagsBits,
  GuildChannel, TextChannel, ForumChannel, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle, CategoryChannel
} from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const GUILD_ID = process.env.GUILD_ID!;
const TOKEN = process.env.DISCORD_TOKEN!;
const ORIGINAL_CAT = process.env.CATEGORY_ID!; // 1477777771382968482
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// ═══════════════════════════════════════════════════════
// CATEGORY DEFINITIONS
// ═══════════════════════════════════════════════════════
const CATEGORIES = [
  {
    name: '🏴 the collective',
    desc: 'Hub & information',
    channels: [
      { name: '📡・hub',          type: ChannelType.GuildText,         topic: 'Start here. Create your wallet, learn the rules, enter The Collective.', slowmode: 0,  perms: 'hub' },
      { name: '📜・rules',         type: ChannelType.GuildText,         topic: 'The laws of The Collective. Read before playing.', slowmode: 0, perms: 'readonly' },
      { name: '📣・announcements', type: ChannelType.GuildAnnouncement, topic: 'Official announcements from Pi OS. Follow to get pings.', slowmode: 0, perms: 'readonly' },
      { name: '📊・server-pulse',  type: ChannelType.GuildText,         topic: 'Live economy stats — updated every 30 minutes by Pi OS.', slowmode: 0, perms: 'readonly' },
      { name: '🏆・leaderboard',   type: ChannelType.GuildText,         topic: 'Top wallets by balance, wins, and games played. Updated live.', slowmode: 0, perms: 'readonly' },
      { name: '🎪・events',        type: ChannelType.GuildText,         topic: 'Upcoming events, tournaments, weekly challenges.', slowmode: 0, perms: 'readonly' },
    ]
  },
  {
    name: '🔭 alpha intel',
    desc: 'Market intelligence tools',
    channels: [
      { name: '🔭・scanner',   type: ChannelType.GuildText, topic: 'Paste any CA → Pi analyzes: honeypot, liquidity, holders, rug score. /scan <address>', slowmode: 5,  perms: 'slow' },
      { name: '🐋・whales',    type: ChannelType.GuildText, topic: 'Large wallet movements. Pi monitors smart money 24/7. Auto-posted.', slowmode: 0, perms: 'readonly' },
      { name: '🚀・launches',  type: ChannelType.GuildText, topic: 'New token launches (pump.fun, Raydium, Jupiter) filtered by Pi risk model.', slowmode: 0, perms: 'readonly' },
      { name: '📡・signals',   type: ChannelType.GuildText, topic: 'Pi trade signals: TA + on-chain + sentiment. BTC/SOL/ETH/alts with confidence scores.', slowmode: 0, perms: 'readonly' },
      { name: '🔔・alerts',    type: ChannelType.GuildText, topic: 'Custom price/wallet alerts. /alert add <CA> <condition>', slowmode: 5, perms: 'slow' },
      { name: '🧠・alpha',     type: ChannelType.GuildText, topic: 'Curated alpha from CT. Pi reads so you don\'t miss. KOL calls, unusual flow, narrative shifts.', slowmode: 30, perms: 'slow' },
      { name: '🔮・oracle',    type: ChannelType.GuildText, topic: 'Pi\'s daily market analysis. Macro, regime detection, sector rotation. Posted 09:00 UTC.', slowmode: 0, perms: 'readonly' },
      { name: '🗞️・intel',     type: ChannelType.GuildText, topic: 'Curated market news and on-chain highlights from Pi OS.', slowmode: 0, perms: 'readonly' },
    ]
  },
  {
    name: '🎰 the casino',
    desc: 'Provably fair games',
    channels: [
      { name: '🪙・coinflip', type: ChannelType.GuildText, topic: '/coinflip <amount> <heads|tails> — 50/50, 1.96x payout. House edge 2%.', slowmode: 3, perms: 'game' },
      { name: '🎲・dice',     type: ChannelType.GuildText, topic: '/dice <amount> <target> — Roll under target. Payout = 98/target. House edge 2%.', slowmode: 3, perms: 'game' },
      { name: '📈・crash',    type: ChannelType.GuildText, topic: '/crash <amount> <cashout> — Set your cashout multiplier. House edge 1%.', slowmode: 3, perms: 'game' },
      { name: '🎡・roulette', type: ChannelType.GuildText, topic: '/roulette <amount> <red|black|green|0-36|odd|even|low|high> — European rules.', slowmode: 5, perms: 'game' },
      { name: '🍒・slots',    type: ChannelType.GuildText, topic: '/slots <amount> — 7 symbols. Triple 7 = 50x jackpot. 💎💎💎 = 25x. House edge 5%.', slowmode: 5, perms: 'game' },
      { name: '💣・mines',    type: ChannelType.GuildText, topic: '/mines <amount> <mines> — Minesweeper. More mines = higher multiplier.', slowmode: 5, perms: 'game' },
      { name: '🃏・blackjack',type: ChannelType.GuildText, topic: '/blackjack <amount> — You vs Pi. Closest to 21 wins. 1.5x on blackjack.', slowmode: 5, perms: 'game' },
      { name: '⚔️・duels',   type: ChannelType.GuildText, topic: '/duel @user <amount> — 1v1 wagered battle. Winner takes all minus 2% house.', slowmode: 10, perms: 'game' },
      { name: '🌀・the-pit',  type: ChannelType.GuildText, topic: 'Degen talk. Brag about wins. Cry about losses. No filter.', slowmode: 0, perms: 'chat' },
    ]
  },
  {
    name: '💰 the vault',
    desc: 'Economy & finance',
    channels: [
      { name: '🏦・bank',      type: ChannelType.GuildText, topic: '/balance /transfer /withdraw /history — Your financial command center.', slowmode: 5, perms: 'game' },
      { name: '🎁・daily',     type: ChannelType.GuildText, topic: '/daily — Claim 500 SHARDS every 24 hours. Don\'t break the streak.', slowmode: 5, perms: 'game' },
      { name: '⛏️・mining',   type: ChannelType.GuildText, topic: '/mine — Generate SHARDS every 4 hours. Passive income for active members.', slowmode: 10, perms: 'game' },
      { name: '🏪・market',    type: ChannelType.GuildText, topic: '/shop — Buy roles, perks, titles with SHARDS. /shop list for all items.', slowmode: 5, perms: 'game' },
      { name: '🪂・airdrops',  type: ChannelType.GuildText, topic: 'Random Pi airdrops every 3 hours to active wallets. Watch this channel.', slowmode: 0, perms: 'readonly' },
      { name: '📉・stonks',    type: ChannelType.GuildText, topic: '/stonks — Virtual stock market. Prices move with Collective activity. Buy low.', slowmode: 10, perms: 'game' },
      { name: '🔐・provably-fair', type: ChannelType.GuildText, topic: '/verify <bet_id> — Prove any bet was fair. /seeds — View/change your seeds.', slowmode: 0, perms: 'game' },
      { name: '📋・vault-logs', type: ChannelType.GuildText, topic: 'All transactions — immutable ledger. Fully transparent. Nothing hidden.', slowmode: 0, perms: 'readonly' },
    ]
  },
  {
    name: '🏛️ the council',
    desc: 'DAO governance',
    channels: [
      { name: '🏛️・chamber',   type: ChannelType.GuildForum, topic: 'Submit and vote on proposals. One thread per proposal. Democracy in action.', slowmode: 0, perms: 'forum' },
      { name: '📜・constitution', type: ChannelType.GuildText, topic: 'The laws of The Collective. Passed proposals become law here.', slowmode: 0, perms: 'readonly' },
      { name: '⚖️・court',      type: ChannelType.GuildText, topic: '/court file @user <reason> — Dispute resolution. 500 SHARDS filing fee.', slowmode: 30, perms: 'slow' },
      { name: '💎・treasury',   type: ChannelType.GuildText, topic: 'Treasury balance, house edge earnings, allocations. Full transparency.', slowmode: 0, perms: 'readonly' },
      { name: '📊・analytics',  type: ChannelType.GuildText, topic: 'Deep economy analytics. Volume, win rates, player stats, Pi OS performance.', slowmode: 0, perms: 'readonly' },
    ]
  },
  {
    name: '🤖 pi os',
    desc: 'AI infrastructure',
    channels: [
      { name: '🧪・pi-lab',    type: ChannelType.GuildText, topic: 'Pi OS experiments, new features in testing, beta feedback welcome.', slowmode: 0, perms: 'chat' },
      { name: '📡・pi-logs',   type: ChannelType.GuildText, topic: 'Pi OS activity feed. Every action Pi takes is logged here.', slowmode: 0, perms: 'readonly' },
      { name: '✅・verify',    type: ChannelType.GuildText, topic: '/verify <bet_id> — Audit any bet. Provably fair verification engine.', slowmode: 0, perms: 'game' },
      { name: '🏅・achievements', type: ChannelType.GuildText, topic: 'Achievements unlocked by The Collective members. Auto-posted by Pi OS.', slowmode: 0, perms: 'readonly' },
    ]
  },
  {
    name: '🎭 community',
    desc: 'Social layer',
    channels: [
      { name: '💬・memes',      type: ChannelType.GuildText, topic: '4chan/CT energy. Pepe, Wojak, degen culture. No cringe.', slowmode: 3, perms: 'chat' },
      { name: '🔥・general',    type: ChannelType.GuildText, topic: 'The town square. Talk shit, share alpha, discuss anything.', slowmode: 0, perms: 'chat' },
      { name: '📞・lounge',     type: ChannelType.GuildVoice, topic: 'Chill voice chat. Always open.', slowmode: 0, perms: 'voice' },
      { name: '🎙️・war-room',  type: ChannelType.GuildVoice, topic: 'Market calls and strategy sessions. When it matters.', slowmode: 0, perms: 'voice' },
      { name: '🎭・events-stage', type: ChannelType.GuildStageVoice, topic: 'AMAs, announcements, community events. Pi OS hosts here.', slowmode: 0, perms: 'stage' },
    ]
  },
];

// ═══════════════════════════════════════════════════════
// PERMISSION TEMPLATES
// ═══════════════════════════════════════════════════════
function getPerms(type: string, guild: any, memberRoleId: string, botId: string) {
  const e = guild.roles.everyone.id;
  const base = {
    hub: [
      { id: e,          allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory], deny: [PermissionFlagsBits.SendMessages] },
      { id: botId,      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages] },
    ],
    readonly: [
      { id: e,          deny: [PermissionFlagsBits.ViewChannel] },
      { id: memberRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions], deny: [PermissionFlagsBits.SendMessages] },
      { id: botId,      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages] },
    ],
    game: [
      { id: e,          deny: [PermissionFlagsBits.ViewChannel] },
      { id: memberRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.UseApplicationCommands], deny: [PermissionFlagsBits.SendMessages] },
      { id: botId,      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages] },
    ],
    slow: [
      { id: e,          deny: [PermissionFlagsBits.ViewChannel] },
      { id: memberRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.UseApplicationCommands] },
      { id: botId,      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages] },
    ],
    chat: [
      { id: e,          deny: [PermissionFlagsBits.ViewChannel] },
      { id: memberRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.AddReactions, PermissionFlagsBits.AttachFiles, PermissionFlagsBits.UseApplicationCommands] },
      { id: botId,      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages] },
    ],
    forum: [
      { id: e,          deny: [PermissionFlagsBits.ViewChannel] },
      { id: memberRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.ReadMessageHistory, PermissionFlagsBits.SendMessages, PermissionFlagsBits.CreatePublicThreads, PermissionFlagsBits.AddReactions, PermissionFlagsBits.UseApplicationCommands] },
      { id: botId,      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.SendMessages, PermissionFlagsBits.EmbedLinks, PermissionFlagsBits.ManageMessages, PermissionFlagsBits.ManageThreads] },
    ],
    voice: [
      { id: e,          deny: [PermissionFlagsBits.ViewChannel] },
      { id: memberRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.Stream] },
      { id: botId,      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ManageChannels] },
    ],
    stage: [
      { id: e,          deny: [PermissionFlagsBits.ViewChannel] },
      { id: memberRoleId, allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect], deny: [PermissionFlagsBits.Speak] },
      { id: botId,      allow: [PermissionFlagsBits.ViewChannel, PermissionFlagsBits.Connect, PermissionFlagsBits.Speak, PermissionFlagsBits.ManageChannels, PermissionFlagsBits.MuteMembers] },
    ],
  } as Record<string, any[]>;
  return base[type] || base.chat;
}

// ═══════════════════════════════════════════════════════
// MAIN
// ═══════════════════════════════════════════════════════
async function run() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(TOKEN);
  await new Promise(r => client.once('ready', r));
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();

  // Get/create roles
  let memberRole = guild.roles.cache.find(r => r.name === 'Collective Member');
  if (!memberRole) {
    memberRole = await guild.roles.create({ name: 'Collective Member', color: 0x06b6d4, reason: 'The Collective' });
    console.log('✅ Created @Collective Member role');
  }
  const botId = guild.members.me!.id;
  console.log(`Bot ID: ${botId} | Member Role: ${memberRole.id}`);

  // Build existing channel map (name → id)
  const existingMap = new Map<string, string>();
  guild.channels.cache.forEach(ch => {
    if (ch) existingMap.set(ch.name.toLowerCase(), ch.id);
  });
  console.log(`\nExisting channels: ${existingMap.size}`);

  // Process each category
  for (const catDef of CATEGORIES) {
    console.log(`\n══ ${catDef.name} ══`);

    // Find or create category
    let cat = guild.channels.cache.find(
      c => c.type === ChannelType.GuildCategory && c.name.toLowerCase() === catDef.name.toLowerCase()
    ) as CategoryChannel | undefined;

    if (!cat) {
      cat = await guild.channels.create({
        name: catDef.name,
        type: ChannelType.GuildCategory,
        permissionOverwrites: [
          { id: guild.roles.everyone.id, deny: [PermissionFlagsBits.ViewChannel] },
          { id: memberRole.id, allow: [PermissionFlagsBits.ViewChannel] },
        ],
      }) as CategoryChannel;
      console.log(`  📁 Created category: ${catDef.name}`);
      await sleep(800);
    } else {
      console.log(`  📁 Existing category: ${catDef.name}`);
    }

    // Process channels
    for (const chDef of catDef.channels) {
      const cleanName = chDef.name.replace(/[^\w\s\-・]/g, '').toLowerCase().trim();
      const slug = chDef.name.split('・')[1] || chDef.name;

      // Check if channel exists anywhere in guild
      const existingCh = guild.channels.cache.find(
        c => c.name.toLowerCase().includes(slug.toLowerCase()) && 
             c.type === chDef.type
      );

      if (existingCh) {
        // Move to correct category + update settings
        try {
          const updates: any = { parent: cat.id, lockPermissions: false };
          await (existingCh as GuildChannel).edit(updates);

          // Set topic and slowmode for text channels
          if (existingCh.type === ChannelType.GuildText || existingCh.type === ChannelType.GuildAnnouncement) {
            await (existingCh as TextChannel).edit({
              topic: chDef.topic,
              rateLimitPerUser: chDef.slowmode,
            });
          }

          // Update permissions
          const perms = getPerms(chDef.perms, guild, memberRole!.id, botId);
          for (const p of perms) {
            await (existingCh as GuildChannel).permissionOverwrites.edit(p.id, {
              ...(p.allow ? Object.fromEntries(Object.entries(PermissionFlagsBits).filter(([k]) => p.allow?.some((a: any) => a === PermissionFlagsBits[k as keyof typeof PermissionFlagsBits])).map(([k, v]) => [k, true])) : {}),
            }).catch(() => {});
          }

          console.log(`    ➡️  Moved: ${existingCh.name} → ${catDef.name}`);
        } catch (err: any) {
          console.log(`    ⚠️  Move failed ${slug}: ${err.message}`);
        }
      } else {
        // Create new channel
        try {
          const createOpts: any = {
            name: chDef.name,
            type: chDef.type,
            parent: cat.id,
            permissionOverwrites: getPerms(chDef.perms, guild, memberRole!.id, botId),
            reason: 'The Collective full rebuild',
          };

          if (chDef.type === ChannelType.GuildText || chDef.type === ChannelType.GuildAnnouncement) {
            createOpts.topic = chDef.topic;
            createOpts.rateLimitPerUser = chDef.slowmode;
          }

          if (chDef.type === ChannelType.GuildForum) {
            createOpts.topic = chDef.topic;
            createOpts.defaultThreadRateLimitPerUser = 300; // 5min between posts
            createOpts.defaultAutoArchiveDuration = 10080; // 7 days
            createOpts.availableTags = [
              { name: '📋 Proposal', emoji: { name: '📋' } },
              { name: '✅ Passed',   emoji: { name: '✅' } },
              { name: '❌ Failed',   emoji: { name: '❌' } },
              { name: '⏳ Voting',   emoji: { name: '⏳' } },
            ];
          }

          await guild.channels.create(createOpts);
          console.log(`    ✅ Created: ${chDef.name} [${ChannelType[chDef.type]}]`);
          await sleep(1200);
        } catch (err: any) {
          console.log(`    ❌ Create failed ${chDef.name}: ${err.message}`);
        }
      }
      await sleep(400);
    }
  }

  // Post welcome in hub
  console.log('\n── Posting hub welcome...');
  await sleep(2000);
  await guild.channels.fetch();
  const hub = guild.channels.cache.find(
    c => c.name.includes('hub') && c.type === ChannelType.GuildText
  ) as TextChannel | undefined;

  if (hub) {
    try {
      const msgs = await hub.messages.fetch({ limit: 5 });
      const botMsg = msgs.find(m => m.author.bot && m.components.length > 0);
      const embed = new EmbedBuilder()
        .setColor(0x06b6d4)
        .setTitle('🏴 THE COLLECTIVE')
        .setDescription(
          `**The crypto degen command center.**\n\n` +
          `Not just a Discord server — a **living platform** powered by Pi OS.\n\n` +
          `**What you get:**\n` +
          `🔭 Token safety scanning\n` +
          `🐋 Whale wallet tracking\n` +
          `🚀 Launch radar (pump.fun, Raydium)\n` +
          `📡 Pi's trade signals\n` +
          `🎰 Provably fair casino (8 games)\n` +
          `💎 SHARDS economy with real mechanics\n` +
          `🏛️ DAO governance — you decide the rules\n` +
          `🤖 Pi OS — the AI running it all\n\n` +
          `**To access everything, create your wallet below.**`
        )
        .addFields(
          { name: '💎 Starting Balance', value: '500 SHARDS', inline: true },
          { name: '⏱️ Onboarding', value: '60 seconds', inline: true },
          { name: '💰 Cost', value: 'Free forever', inline: true },
        )
        .setFooter({ text: 'Pi OS v1.0 • The Collective • bakedpi.tech' });

      const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
        new ButtonBuilder().setCustomId('onboarding_start').setLabel('🔓 Create Wallet & Enter').setStyle(ButtonStyle.Primary),
        new ButtonBuilder().setURL('https://bakedpi.tech').setLabel('🌐 Website').setStyle(ButtonStyle.Link),
      );

      if (botMsg) {
        await botMsg.edit({ embeds: [embed], components: [row] });
        console.log('  ✅ Updated hub message');
      } else {
        await hub.send({ embeds: [embed], components: [row] });
        console.log('  ✅ Posted hub message');
      }
    } catch (err: any) {
      console.log(`  ⚠️  Hub: ${err.message}`);
    }
  }

  await client.destroy();
  console.log('\n🏴 Full rebuild complete. The Collective is properly structured.\n');
  process.exit(0);
}

run().catch(e => { console.error('💥', e.message); process.exit(1); });

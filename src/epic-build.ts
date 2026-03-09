/**
 * THE COLLECTIVE — Epic Build v3.0
 * - NEVER deletes existing channels
 * - Moves channels into proper categories
 * - Adds voice, stage, forum, announcement channels
 * - Sets topics, slowmode, proper permissions on everything
 */
import {
  Client, GatewayIntentBits, ChannelType, PermissionFlagsBits,
  GuildChannel, TextChannel, CategoryChannel, EmbedBuilder,
  ActionRowBuilder, ButtonBuilder, ButtonStyle
} from 'discord.js';
import dotenv from 'dotenv'; dotenv.config();

const GUILD_ID = process.env.GUILD_ID!;
const TOKEN   = process.env.DISCORD_TOKEN!;
const sleep   = (ms: number) => new Promise(r => setTimeout(r, ms));

// ─── Channel IDs we know ─────────────────────────────────────────
const IDS = {
  // Existing cats to keep/rename
  CAT_MAIN:        '1477777771382968482', // ⏬  → rename to 🏴 THE COLLECTIVE
  CAT_CASINO:      '1477815146146435173', // 🎰 the casino  (keep)
  CAT_VAULT:       '1477815224336777317', // 💰 the vault   (keep)
  CAT_COUNCIL:     '1477815292108210440', // 🏛️ the council  (keep)
  CAT_EXTENDED:    '1477809597547941950', // 🗃️・extended    (keep as overflow)
  CAT_VOICE_OLD:   '1470858890970136768', // VOICE (existing, keep)
  // Channels to move FROM ⏬ to new cats
  HUB:             '1477799173246947389',
  RULES:           '1477799177064026235',
  ANNOUNCEMENTS:   '1477799180780175461',
  LEADERBOARD:     '1477799226523254947',
  EVENTS:          '1477800109331845245',
  SERVER_PULSE:    '1477815049803399268',
  SCANNER:         '1477802183977205851',
  WHALE_WATCH:     '1477802188381229289',
  LAUNCHES:        '1477815093474496655',
  LAUNCH_RADAR:    '1477802192294379541',
  SIGNALS:         '1477802196467847228',
  ALERTS:          '1477802200578265129',
  ALPHA:           '1477802205770678364',
  ORACLE:          '1477800081221488783',
  INTEL:           '1477800114264342671',
  WHALES:          '1477815084607733894',
  PI_LOGS:         '1477800084845363221',
  PI_LAB:          '1471879206932840570',
  PI_OS_LAB:       '1477800075991449672',
  ACHIEVEMENTS:    '1477800098548158634',
  VERIFY_CH:       '1477799234408419412',
  MEMES:           '1477800118437679225',
  GENERAL:         '1477815395099607191',
  GOVERNANCE:      '1477800045376962560',
  ACTIVE_PROPS:    '1477800049453961318',
  PASSED_LAWS:     '1477800054210301962',
  BLACK_MARKET:    '1477800063240769860',
  BANK:            '1477799218696552710',
  DAILY_DROP:      '1477799222542729249',
  MINING_RIG:      '1477800067309244540',
  AIRDROPS:        '1477800071809470525',
  STONKS:          '1477800058396213248',
  LOAN_SHARK:      '1477806075896922194',
  VAULT_LOGS:      '1477815283379863715',
  ANALYTICS:       '1477800093900865536',
  TREASURY_MAIN:   '1477799230578888919', // 📊・stats → rename
  LOUNGE_VC:       '1477815403769233509',
  WAR_ROOM_VC:     '1477815412086538362',
  EVENTS_STAGE:    '1477815420743454720',
  // Already in correct cats
  PROVABLY_FAIR:   '1477799185716740307', // in vault
  COINFLIP:        '1477799189399208139', // in casino
  DICE:            '1477799194054885547',
  CRASH:           '1477799199289512006',
  ROULETTE:        '1477799203098066955',
  SLOTS:           '1477799206960889897',
  MINES:           '1477799212321210459',
  DUELS:           '1477800105015902208',
  BLACKJACK:       '1477806057068957937',
  THE_PIT:         '1477799238640599141',
  CHAMBER:         '1477815297309413397', // forum in council
  COURT:           '1477806093894946816',
  CONSTITUTION:    '1477815305563537479',
  TREASURY_COUNCIL:'1477800089840783381',
};

async function run() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(TOKEN);
  await new Promise(r => client.once('ready', r));
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();

  // Roles
  let memberRole = guild.roles.cache.find(r => r.name === 'Collective Member');
  if (!memberRole) {
    memberRole = await guild.roles.create({ name:'Collective Member', color:0x06b6d4, reason:'The Collective' });
    await sleep(500);
  }
  const everyone  = guild.roles.everyone.id;
  const mId       = memberRole.id;
  const botId     = guild.members.me!.id;

  // ─── Permission helpers ──────────────────────────────────────────
  const P = PermissionFlagsBits;
  const perms = {
    hub: [
      { id:everyone, allow:[P.ViewChannel,P.ReadMessageHistory], deny:[P.SendMessages,P.AddReactions] },
      { id:mId,      allow:[P.ViewChannel,P.ReadMessageHistory,P.AddReactions,P.UseApplicationCommands], deny:[P.SendMessages] },
      { id:botId,    allow:[P.ViewChannel,P.SendMessages,P.EmbedLinks,P.ManageMessages,P.AttachFiles] },
    ],
    readonly: [
      { id:everyone, deny:[P.ViewChannel] },
      { id:mId,      allow:[P.ViewChannel,P.ReadMessageHistory,P.AddReactions], deny:[P.SendMessages] },
      { id:botId,    allow:[P.ViewChannel,P.SendMessages,P.EmbedLinks,P.ManageMessages] },
    ],
    game: [
      { id:everyone, deny:[P.ViewChannel] },
      { id:mId,      allow:[P.ViewChannel,P.ReadMessageHistory,P.UseApplicationCommands,P.AddReactions], deny:[P.SendMessages] },
      { id:botId,    allow:[P.ViewChannel,P.SendMessages,P.EmbedLinks,P.ManageMessages] },
    ],
    chat: [
      { id:everyone, deny:[P.ViewChannel] },
      { id:mId,      allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.AddReactions,P.AttachFiles,P.UseApplicationCommands] },
      { id:botId,    allow:[P.ViewChannel,P.SendMessages,P.EmbedLinks,P.ManageMessages] },
    ],
    slow5: [
      { id:everyone, deny:[P.ViewChannel] },
      { id:mId,      allow:[P.ViewChannel,P.SendMessages,P.ReadMessageHistory,P.AddReactions,P.UseApplicationCommands] },
      { id:botId,    allow:[P.ViewChannel,P.SendMessages,P.EmbedLinks,P.ManageMessages] },
    ],
    forum: [
      { id:everyone, deny:[P.ViewChannel] },
      { id:mId,      allow:[P.ViewChannel,P.ReadMessageHistory,P.SendMessages,P.CreatePublicThreads,P.AddReactions,P.UseApplicationCommands] },
      { id:botId,    allow:[P.ViewChannel,P.SendMessages,P.EmbedLinks,P.ManageMessages,P.ManageThreads] },
    ],
    voice: [
      { id:everyone, deny:[P.ViewChannel] },
      { id:mId,      allow:[P.ViewChannel,P.Connect,P.Speak,P.Stream,P.UseVAD] },
      { id:botId,    allow:[P.ViewChannel,P.Connect,P.Speak,P.MuteMembers] },
    ],
    stage: [
      { id:everyone, deny:[P.ViewChannel] },
      { id:mId,      allow:[P.ViewChannel,P.Connect], deny:[P.Speak] },
      { id:botId,    allow:[P.ViewChannel,P.Connect,P.Speak,P.MuteMembers,P.ManageChannels] },
    ],
  };

  async function applyPerms(ch: GuildChannel, type: keyof typeof perms) {
    for (const p of perms[type]) {
      await ch.permissionOverwrites.edit(p.id, {
        ...(p.allow ? Object.fromEntries((p.allow as bigint[]).map(bit => [Object.keys(P).find(k=>(P as any)[k]===bit)??String(bit), true])) : {}),
        ...(p.deny  ? Object.fromEntries((p.deny  as bigint[]).map(bit => [Object.keys(P).find(k=>(P as any)[k]===bit)??String(bit), false])) : {}),
      }).catch(()=>{});
    }
  }

  async function moveAndConfig(channelId: string, parentId: string, opts: {
    topic?: string; slowmode?: number; perms?: keyof typeof perms; name?: string;
  } = {}) {
    const ch = guild.channels.cache.get(channelId);
    if (!ch) { console.log(`  ⚠️  Channel ${channelId} not found`); return; }
    try {
      const editOpts: any = { parent: parentId, lockPermissions: false };
      if (opts.name) editOpts.name = opts.name;
      await (ch as GuildChannel).edit(editOpts);
      if ((ch.type===ChannelType.GuildText||ch.type===ChannelType.GuildAnnouncement) && (opts.topic||opts.slowmode!==undefined)) {
        const textOpts: any = {};
        if (opts.topic) textOpts.topic = opts.topic;
        if (opts.slowmode !== undefined) textOpts.rateLimitPerUser = opts.slowmode;
        await (ch as TextChannel).edit(textOpts).catch(()=>{});
      }
      if (opts.perms) await applyPerms(ch as GuildChannel, opts.perms);
      console.log(`  ✅ ${ch.name} → configured`);
    } catch(e:any) { console.log(`  ⚠️  ${ch.name}: ${e.message?.slice(0,60)}`); }
    await sleep(600);
  }

  async function getOrCreateCat(name: string): Promise<CategoryChannel> {
    const existing = guild.channels.cache.find(
      c => c.type===ChannelType.GuildCategory && c.name.toLowerCase()===name.toLowerCase()
    ) as CategoryChannel|undefined;
    if (existing) { console.log(`  📁 Using: ${name}`); return existing; }
    const cat = await guild.channels.create({ name, type:ChannelType.GuildCategory,
      permissionOverwrites:[{ id:everyone, deny:[P.ViewChannel] },{ id:mId, allow:[P.ViewChannel] }],
    }) as CategoryChannel;
    console.log(`  📁 Created: ${name}`); await sleep(800); return cat;
  }

  async function createIfMissing(nameFragment: string, catId: string, opts: {
    name: string; type?: number; topic?: string; slowmode?: number;
    perms?: keyof typeof perms; tags?: string[];
  }) {
    const exists = guild.channels.cache.find(c => c.name.includes(nameFragment) && (c as any).parentId === catId);
    if (exists) { console.log(`  ✓ exists: ${exists.name}`); return; }
    const createOpts: any = { name:opts.name, type:opts.type??ChannelType.GuildText, parent:catId,
      permissionOverwrites: perms[opts.perms??'chat'], reason:'The Collective Epic Build' };
    if (opts.topic) createOpts.topic = opts.topic;
    if (opts.slowmode) createOpts.rateLimitPerUser = opts.slowmode;
    if (opts.type === ChannelType.GuildForum) {
      createOpts.defaultAutoArchiveDuration = 10080;
      createOpts.defaultThreadRateLimitPerUser = 300;
      if (opts.tags) createOpts.availableTags = opts.tags.map(t=>({ name:t }));
    }
    await guild.channels.create(createOpts);
    console.log(`  ✅ Created: ${opts.name}`); await sleep(1200);
  }

  // ═══════════════════════════════════════════════════════
  // 1. RENAME MAIN CATEGORY
  // ═══════════════════════════════════════════════════════
  console.log('\n══ 1. RENAME MAIN CATEGORY ══');
  const mainCat = guild.channels.cache.get(IDS.CAT_MAIN) as CategoryChannel;
  if (mainCat && mainCat.name !== '🏴・THE COLLECTIVE') {
    await mainCat.edit({ name:'🏴・THE COLLECTIVE' }).catch(()=>{});
    console.log('  ✅ Renamed to 🏴・THE COLLECTIVE');
    await sleep(600);
  }

  // ═══════════════════════════════════════════════════════
  // 2. CREATE MISSING CATEGORIES
  // ═══════════════════════════════════════════════════════
  console.log('\n══ 2. CATEGORIES ══');
  const catAlpha    = await getOrCreateCat('🔭・ALPHA INTEL');
  const catPiOs     = await getOrCreateCat('🤖・PI OS');
  const catCommunity= await getOrCreateCat('🎭・COMMUNITY');

  const catCasino   = guild.channels.cache.get(IDS.CAT_CASINO) as CategoryChannel;
  const catVault    = guild.channels.cache.get(IDS.CAT_VAULT)  as CategoryChannel;
  const catCouncil  = guild.channels.cache.get(IDS.CAT_COUNCIL)as CategoryChannel;

  // ═══════════════════════════════════════════════════════
  // 3. CONFIGURE MAIN CATEGORY CHANNELS (hub, rules, announcements)
  // ═══════════════════════════════════════════════════════
  console.log('\n══ 3. MAIN CATEGORY (INFO) ══');
  await moveAndConfig(IDS.HUB,           IDS.CAT_MAIN, { topic:'Start here — create your wallet, learn the rules, enter The Collective. /start', perms:'hub' });
  await moveAndConfig(IDS.RULES,         IDS.CAT_MAIN, { topic:'The laws of The Collective. Breaking rules = loss of access.', perms:'readonly' });
  await moveAndConfig(IDS.ANNOUNCEMENTS, IDS.CAT_MAIN, { topic:'Official announcements. Follow this channel to get pinged everywhere.', perms:'readonly' });
  await moveAndConfig(IDS.LEADERBOARD,   IDS.CAT_MAIN, { topic:'Top wallets by balance, games, and wins. Live updates.', perms:'readonly' });
  await moveAndConfig(IDS.SERVER_PULSE,  IDS.CAT_MAIN, { topic:'Live economy stats — wallets, SHARDS, games today. Auto-updated every 30min.', perms:'readonly' });
  await moveAndConfig(IDS.EVENTS,        IDS.CAT_MAIN, { topic:'Upcoming tournaments, challenges, and Pi OS events.', perms:'readonly' });

  // ═══════════════════════════════════════════════════════
  // 4. ALPHA INTEL
  // ═══════════════════════════════════════════════════════
  console.log('\n══ 4. ALPHA INTEL ══');
  await moveAndConfig(IDS.SCANNER,     catAlpha.id, { topic:'/scan <address> — Pi checks honeypot, liquidity lock, dev wallet, rug score. Instant.', slowmode:5, perms:'slow5' });
  await moveAndConfig(IDS.WHALES,      catAlpha.id, { topic:'Large wallet movements auto-posted by Pi OS. Smart money tracking, 24/7.', perms:'readonly' });
  await moveAndConfig(IDS.WHALE_WATCH, catAlpha.id, { topic:'Whale wallet watchlist — tracked addresses and their moves.', perms:'readonly' });
  await moveAndConfig(IDS.LAUNCHES,    catAlpha.id, { topic:'New token launches (pump.fun, Raydium, Jupiter) filtered by Pi risk model.', perms:'readonly' });
  await moveAndConfig(IDS.LAUNCH_RADAR,catAlpha.id, { topic:'Launch radar — advanced new token detection with risk scoring.', perms:'readonly' });
  await moveAndConfig(IDS.SIGNALS,     catAlpha.id, { topic:'Pi trade signals: TA + on-chain + sentiment. With confidence score + invalidation.', perms:'readonly' });
  await moveAndConfig(IDS.ALERTS,      catAlpha.id, { topic:'/alert add <CA> <condition> — custom price and wallet alerts.', slowmode:5, perms:'slow5' });
  await moveAndConfig(IDS.ALPHA,       catAlpha.id, { topic:'Curated alpha from CT. KOL calls, unusual options flow, narrative shifts.', slowmode:30, perms:'slow5' });
  await moveAndConfig(IDS.ORACLE,      catAlpha.id, { topic:"Pi's daily market analysis. Macro regime, sector rotation, smart money. 09:00 UTC.", perms:'readonly' });
  await moveAndConfig(IDS.INTEL,       catAlpha.id, { topic:'Market news curated by Pi OS — signal, not noise.', perms:'readonly' });

  // ═══════════════════════════════════════════════════════
  // 5. CASINO
  // ═══════════════════════════════════════════════════════
  console.log('\n══ 5. CASINO ══');
  await moveAndConfig(IDS.COINFLIP,  catCasino.id, { topic:'/coinflip <amount> <heads|tails> — 50/50, 1.96x. House edge 2%. Provably fair.', slowmode:3, perms:'game' });
  await moveAndConfig(IDS.DICE,      catCasino.id, { topic:'/dice <amount> <target 2-95> — Roll under target. Payout=98/target. House 2%.', slowmode:3, perms:'game' });
  await moveAndConfig(IDS.CRASH,     catCasino.id, { topic:'/crash <amount> <cashout> — Ride the multiplier. Set cashout. House 1%.', slowmode:3, perms:'game' });
  await moveAndConfig(IDS.ROULETTE,  catCasino.id, { topic:'/roulette <amount> <red|black|green|0-36|odd|even> — European rules. House 2.7%.', slowmode:5, perms:'game' });
  await moveAndConfig(IDS.SLOTS,     catCasino.id, { topic:'/slots <amount> — 7 symbols. 💎💎💎=25x. 7️⃣7️⃣7️⃣=50x jackpot. House 5%.', slowmode:5, perms:'game' });
  await moveAndConfig(IDS.MINES,     catCasino.id, { topic:'/mines <amount> <1-24 mines> — Minesweeper. More mines = higher multiplier.', slowmode:5, perms:'game' });
  await moveAndConfig(IDS.BLACKJACK, catCasino.id, { topic:'/blackjack <amount> — Beat Pi to 21. Hit/Stand/Double. Blackjack pays 1.5x.', slowmode:5, perms:'game' });
  await moveAndConfig(IDS.DUELS,     catCasino.id, { topic:'/duel @user <amount> — 1v1 wagered battle. Winner takes all minus 2% house.', slowmode:10, perms:'game' });
  await moveAndConfig(IDS.THE_PIT,   catCasino.id, { topic:'Degen talk. Brag about wins. Cry about losses. No rules here.', perms:'chat' });
  // Move jackpot, moonshots, hall-of-rekt from extended → casino
  await moveAndConfig('1477806071409152111', catCasino.id, { topic:'🎰 Jackpot events — Pi OS announces big prize pools here.', perms:'readonly' });
  await moveAndConfig('1477806080133435492', catCasino.id, { topic:'💀 Hall of Rekt — biggest losses in The Collective history. Auto-posted.', perms:'readonly' });
  await moveAndConfig('1477806084717543554', catCasino.id, { topic:'🌙 Moonshots — biggest wins. Auto-posted when profit > 5000 SHARDS.', perms:'readonly' });

  // ═══════════════════════════════════════════════════════
  // 6. VAULT (Economy)
  // ═══════════════════════════════════════════════════════
  console.log('\n══ 6. VAULT ══');
  await moveAndConfig(IDS.BANK,         catVault.id, { topic:'/balance /transfer /withdraw /history — your financial command center.', slowmode:5, perms:'game' });
  await moveAndConfig(IDS.DAILY_DROP,   catVault.id, { topic:"/daily — claim 500 SHARDS every 24h. Don't break the streak.", slowmode:5, perms:'game' });
  await moveAndConfig(IDS.MINING_RIG,   catVault.id, { topic:'/mine — generate SHARDS every 4h. Rate scales with balance tier.', slowmode:10, perms:'game' });
  await moveAndConfig(IDS.AIRDROPS,     catVault.id, { topic:'Random Pi airdrops every 3h to active wallets. Watch this channel.', perms:'readonly' });
  await moveAndConfig(IDS.STONKS,       catVault.id, { topic:'/stonks market|buy|sell|portfolio — virtual stonk market. Prices shift with activity.', slowmode:10, perms:'game' });
  await moveAndConfig(IDS.BLACK_MARKET, catVault.id, { topic:'/shop list|buy — spend SHARDS on roles, titles, power-ups.', slowmode:5, perms:'game' });
  await moveAndConfig(IDS.LOAN_SHARK,   catVault.id, { topic:'/loan <amount> — borrow SHARDS at Pi OS rates. Default = liquidation.', slowmode:10, perms:'game' });
  await moveAndConfig(IDS.PROVABLY_FAIR,catVault.id, { topic:'/verify <bet_id> — audit any bet. HMAC-SHA256 provably fair engine.', perms:'game' });
  await moveAndConfig(IDS.VAULT_LOGS,   catVault.id, { topic:'All transactions — immutable public ledger. Full transparency.', perms:'readonly' });

  // ═══════════════════════════════════════════════════════
  // 7. COUNCIL (DAO)
  // ═══════════════════════════════════════════════════════
  console.log('\n══ 7. COUNCIL ══');
  await moveAndConfig(IDS.CHAMBER,         catCouncil.id, { topic:'Submit and vote on proposals. One thread per proposal. DAO democracy.', perms:'forum' });
  await moveAndConfig(IDS.CONSTITUTION,    catCouncil.id, { topic:'The laws of The Collective — passed proposals become permanent law here.', perms:'readonly' });
  await moveAndConfig(IDS.COURT,           catCouncil.id, { topic:'/court file @user <reason> — dispute resolution. 500 SHARDS filing fee.', slowmode:60, perms:'slow5' });
  await moveAndConfig(IDS.TREASURY_COUNCIL,catCouncil.id, { topic:'House edge earnings, treasury balance, allocations. Full transparency.', perms:'readonly' });
  await moveAndConfig(IDS.ANALYTICS,       catCouncil.id, { topic:'Deep economy analytics — volume, win rates, player stats, Pi OS performance.', perms:'readonly' });
  await moveAndConfig(IDS.GOVERNANCE,      catCouncil.id, { topic:'Governance discussion — proposals, voting, Collective direction.', slowmode:30, perms:'slow5' });
  await moveAndConfig(IDS.ACTIVE_PROPS,    catCouncil.id, { topic:'Active proposals currently open for voting. /vote <id> <yes|no>', perms:'readonly' });
  await moveAndConfig(IDS.PASSED_LAWS,     catCouncil.id, { topic:'Passed and rejected proposals — the complete governance history.', perms:'readonly' });

  // ═══════════════════════════════════════════════════════
  // 8. PI OS
  // ═══════════════════════════════════════════════════════
  console.log('\n══ 8. PI OS ══');
  await moveAndConfig(IDS.PI_LOGS,     catPiOs.id, { topic:'Every action Pi OS takes is logged here. Full operational transparency.', perms:'readonly' });
  await moveAndConfig(IDS.PI_LAB,      catPiOs.id, { topic:'Pi OS experiments — new features in beta, testing ground.', perms:'chat' });
  await moveAndConfig(IDS.PI_OS_LAB,   catPiOs.id, { topic:'Pi OS dev lab — advanced experiments and system testing.', perms:'chat' });
  await moveAndConfig(IDS.ACHIEVEMENTS,catPiOs.id, { topic:'Achievements unlocked by Collective members. Auto-posted by Pi OS.', perms:'readonly' });
  await moveAndConfig(IDS.VERIFY_CH,   catPiOs.id, { topic:'/verify <bet_id> — provably fair verification. HMAC-SHA256. Trust the math.', perms:'game' });

  // ═══════════════════════════════════════════════════════
  // 9. COMMUNITY + VOICE + STAGE
  // ═══════════════════════════════════════════════════════
  console.log('\n══ 9. COMMUNITY ══');
  await moveAndConfig(IDS.GENERAL,     catCommunity.id, { topic:'The town square. Talk anything. Zero filter.', perms:'chat' });
  await moveAndConfig(IDS.MEMES,       catCommunity.id, { topic:'4chan energy. Pepe, Wojak, degen culture. No cringe allowed.', slowmode:3, perms:'chat' });
  await moveAndConfig('1477806089310568458', catCommunity.id, { topic:'Hot takes only. Wrong opinions welcome.', slowmode:10, perms:'chat' }); // hot-takes
  await moveAndConfig('1477806066900271285', catCommunity.id, { topic:'Tournaments — compete for SHARDS prizes. Pi OS runs the bracket.', perms:'readonly' }); // tournament
  await moveAndConfig('1477806061921501194', catCommunity.id, { topic:'/predict <event> <amount> — bet on real-world outcomes.', slowmode:10, perms:'slow5' }); // prediction-market

  // Voice channels
  await moveAndConfig(IDS.LOUNGE_VC,   catCommunity.id, { perms:'voice' });
  await moveAndConfig(IDS.WAR_ROOM_VC, catCommunity.id, { perms:'voice' });
  await moveAndConfig(IDS.EVENTS_STAGE,catCommunity.id, { perms:'stage' });

  // ═══════════════════════════════════════════════════════
  // 10. CREATE MISSING CHANNELS
  // ═══════════════════════════════════════════════════════
  console.log('\n══ 10. CREATE MISSING CHANNELS ══');
  await createIfMissing('kol-watch', catAlpha.id, {
    name:'👀・kol-watch', topic:'KOL wallet tracking — when influencers buy, you know first.', perms:'readonly'
  });
  await createIfMissing('chart-pat', catAlpha.id, {
    name:'📈・chart-patterns', topic:'Pi OS flags chart patterns — breakouts, H&S, double tops, flags.', perms:'readonly'
  });
  await createIfMissing('pi-news', catAlpha.id, {
    name:'📰・pi-news', type:ChannelType.GuildAnnouncement,
    topic:'Daily Pi OS news briefing. Follow to receive in your server.', perms:'readonly'
  });
  await createIfMissing('dice-hist', catVault.id, {
    name:'📋・tx-history', topic:'All wallet transactions. Public ledger. Fully auditable.', perms:'readonly'
  });
  await createIfMissing('game-hist', catCasino.id, {
    name:'🎯・game-feed', topic:'Live game results feed — wins, losses, big plays. Auto-posted by Pi OS.', perms:'readonly'
  });
  await createIfMissing('proposals-f', catCouncil.id, {
    name:'📋・proposals',
    type:ChannelType.GuildForum,
    topic:'Submit governance proposals. 500 SHARDS to post. Each proposal = one thread.',
    perms:'forum',
    tags:['📋 Draft','⏳ Voting','✅ Passed','❌ Rejected','🔥 Hot']
  });
  await createIfMissing('after-dark', catCommunity.id, {
    name:'🌙・after-dark', topic:'Late night degen chat. No sleep, only SHARDS.', perms:'chat'
  });
  await createIfMissing('drops-vc', catCommunity.id, {
    name:'🎙️・drops-vc', type:ChannelType.GuildVoice,
    topic:'Voice channel for collab drops and AMAs.', perms:'voice'
  });

  // ═══════════════════════════════════════════════════════
  // 11. UPDATE HUB EMBED
  // ═══════════════════════════════════════════════════════
  console.log('\n══ 11. HUB EMBED ══');
  await sleep(2000);
  await guild.channels.fetch();
  const hubCh = guild.channels.cache.get(IDS.HUB) as TextChannel|undefined;
  if (hubCh) {
    const msgs = await hubCh.messages.fetch({ limit:10 }).catch(()=>null);
    const botMsg = msgs?.find(m => m.author.bot && m.components.length > 0);
    const embed = new EmbedBuilder()
      .setColor(0x06b6d4)
      .setTitle('🏴 THE COLLECTIVE')
      .setDescription(
        '**The crypto degen command center.**\n\n' +
        'Not just a Discord — a **living platform** powered by Pi OS.\n\n' +
        '🔭 **Alpha Intel** — token scanner, whale tracking, launch radar, signals\n' +
        '🎰 **Casino** — 9 provably fair games (coinflip, dice, crash, roulette, slots, mines, blackjack, duels)\n' +
        '💰 **Vault** — bank, daily rewards, mining, stonks, shop, loan shark\n' +
        '🏛️ **Council** — DAO governance, proposals, treasury\n' +
        '🤖 **Pi OS** — the AI running everything, 24/7\n' +
        '🎭 **Community** — memes, general, voice, events\n\n' +
        '**Create your wallet below. 500 SHARDS on arrival.**'
      )
      .addFields(
        { name:'💎 Starting Balance', value:'500 SHARDS', inline:true },
        { name:'⏱️ Setup Time', value:'60 seconds', inline:true },
        { name:'💰 Cost', value:'Free forever', inline:true },
      )
      .setImage('https://bakedpi.tech/og.png')
      .setFooter({ text:'Pi OS v2.0 • The Collective • bakedpi.tech' });
    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder().setCustomId('onboarding_start').setLabel('🔓 Create Wallet & Enter').setStyle(ButtonStyle.Primary),
      new ButtonBuilder().setURL('https://bakedpi.tech').setLabel('🌐 Website').setStyle(ButtonStyle.Link),
      new ButtonBuilder().setURL('https://x.com/baked_pi01').setLabel('𝕏 Twitter').setStyle(ButtonStyle.Link),
    );
    if (botMsg) await botMsg.edit({ embeds:[embed], components:[row] }).catch(()=>{});
    else await hubCh.send({ embeds:[embed], components:[row] }).catch(()=>{});
    console.log('  ✅ Hub embed updated');
  }

  await client.destroy();
  console.log('\n🏴 Epic Build v3.0 complete.\n');
  process.exit(0);
}
run().catch(e => { console.error('💥', e.message); process.exit(1); });

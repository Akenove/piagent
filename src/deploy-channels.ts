import {
  Client, GatewayIntentBits, ChannelType, PermissionFlagsBits,
  EmbedBuilder, ActionRowBuilder, ButtonBuilder, ButtonStyle,
  TextChannel
} from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const CATEGORY_ID = process.env.CATEGORY_ID!;
const GUILD_ID = process.env.GUILD_ID!;
const TOKEN = process.env.DISCORD_TOKEN!;

const CHANNELS: Array<{ name: string; topic: string; type?: ChannelType.GuildText | ChannelType.GuildAnnouncement }> = [
  { name: '📡・hub',            topic: 'Welcome. Create your wallet and enter.' },
  { name: '📜・rules-and-lore', topic: 'The laws of The Collective.' },
  { name: '📣・announcements',  topic: 'Official updates.', type: ChannelType.GuildAnnouncement },
  { name: '🔐・provably-fair',  topic: 'How we prove every result is fair.' },
  { name: '🪙・coinflip',       topic: '/coinflip — 50/50, 1.96x payout' },
  { name: '🎲・dice',           topic: '/dice — Roll over or under' },
  { name: '📈・crash',          topic: '/crash — Ride the multiplier' },
  { name: '🎡・roulette',       topic: '/roulette — European roulette' },
  { name: '🎰・slots',          topic: '/slots — Pull the lever' },
  { name: '💣・mines',          topic: '/mines — Avoid the mines' },
  { name: '💰・bank',           topic: '/balance /transfer /withdraw' },
  { name: '🎁・daily-drop',     topic: '/daily — Claim your daily SHARDS' },
  { name: '🏆・leaderboard',    topic: 'Top players. Updated live.' },
  { name: '📊・stats',          topic: '/profile — Your stats and history' },
  { name: '🔎・verify',         topic: '/verify — Cryptographically verify any bet' },
  { name: '💬・the-pit',        topic: 'Degen chat. Memes. Banter. Welcome.' },
];

async function deploy() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(TOKEN);
  await new Promise(r => client.once('ready', r));

  const guild = await client.guilds.fetch(GUILD_ID);
  const allChannels = await guild.channels.fetch();
  const existingNames = allChannels
    .filter(c => c !== null && (c as any).parentId === CATEGORY_ID)
    .map(c => c!.name.toLowerCase());

  console.log(`\n🏴 THE COLLECTIVE — Channel Deploy`);
  console.log(`Existing in category: [${existingNames.join(', ')}]\n`);

  let created = 0, skipped = 0;

  for (const ch of CHANNELS) {
    const slug = ch.name.split('・')[1] || ch.name.replace(/[^\w]/g, '');
    if (existingNames.some(n => n.includes(slug.toLowerCase()))) {
      console.log(`  ⏭️  SKIP: ${ch.name}`);
      skipped++;
      continue;
    }

    try {
      await guild.channels.create({
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
      await new Promise(r => setTimeout(r, 600));
    } catch (err: any) {
      console.log(`  ❌ FAILED: ${ch.name} — ${err.message}`);
    }
  }

  console.log(`\n📊 ${created} created, ${skipped} skipped`);

  // Post welcome embed in hub
  await new Promise(r => setTimeout(r, 2000));
  const refreshed = await guild.channels.fetch();
  const hub = refreshed.find(c =>
    c !== null && (c as any).parentId === CATEGORY_ID && c.name.includes('hub')
  ) as TextChannel | undefined;

  if (hub) {
    const embed = new EmbedBuilder()
      .setColor(0x06b6d4)
      .setTitle('🏴 THE COLLECTIVE')
      .setDescription(
        `An experimental Pi OS ecosystem.\n\n` +
        `Provably fair. Cryptographically verified.\n` +
        `Built on math, chaos, and degeneracy.\n\n` +
        `**To enter, you need a wallet.**`
      )
      .setFooter({ text: 'Pi OS • The Collective v1.0' });

    const row = new ActionRowBuilder<ButtonBuilder>().addComponents(
      new ButtonBuilder()
        .setCustomId('onboarding_start')
        .setLabel('🔓 Create Wallet & Enter')
        .setStyle(ButtonStyle.Primary)
    );

    await hub.send({ embeds: [embed], components: [row] });
    console.log('✅ Welcome embed → #hub');
  }

  await client.destroy();
  console.log('🏴 Deploy complete.\n');
  process.exit(0);
}

deploy().catch(err => {
  console.error('💥', err.message);
  process.exit(1);
});

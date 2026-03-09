import { Client, GatewayIntentBits } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();

const CATEGORY_ID = process.env.CATEGORY_ID!;
const GUILD_ID = process.env.GUILD_ID!;
const TOKEN = process.env.DISCORD_TOKEN!;

const ORDER_SLUGS = [
  'hub','rules-and-lore','announcements',
  'token-scanner','whale-watch','launch-radar','signals','alerts','alpha',
  'oracle','intel','memes','the-pit',
  'coinflip','dice','crash','roulette','slots','mines','duels-arena',
  'bank','daily-drop','mining-rig','black-market','airdrops','stonks',
  'governance','active-proposals','passed-laws','treasury','analytics',
  'pi-os-lab','pi-logs','provably-fair','verify','achievements','events','leaderboard','stats',
];

async function run() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(TOKEN);
  await new Promise(r => client.once('ready', r));

  const guild = await client.guilds.fetch(GUILD_ID);
  const all = await guild.channels.fetch();
  const catChannels = [...all.values()].filter(c => c && (c as any).parentId === CATEGORY_ID);

  const positionData: { id: string; position: number }[] = [];
  let pos = 0;

  for (const slug of ORDER_SLUGS) {
    const match = catChannels.find(c => c!.name.toLowerCase().includes(slug));
    if (match) positionData.push({ id: match.id, position: pos++ });
  }
  // Remaining
  for (const c of catChannels) {
    if (c && !positionData.find(p => p.id === c.id)) {
      positionData.push({ id: c.id, position: pos++ });
    }
  }

  // Use REST directly - one bulk call
  const rest = (client as any).rest;
  await rest.patch(`/guilds/${GUILD_ID}/channels`, {
    body: positionData.map(p => ({ id: p.id, position: p.position }))
  });
  
  console.log(`✅ Reordered ${positionData.length} channels`);
  await client.destroy();
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });

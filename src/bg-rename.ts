import { Client, GatewayIntentBits, GuildChannel } from 'discord.js';
import dotenv from 'dotenv';
dotenv.config();
const CATEGORY_ID = process.env.CATEGORY_ID!;
const GUILD_ID = process.env.GUILD_ID!;
const TOKEN = process.env.DISCORD_TOKEN!;
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

// [searchSlug, newCleanName]
const RENAMES: [string, string][] = [
  ['token-scanner', 'scanner'],
  ['whale-watch',   'whales'],
  ['launch-radar',  'launches'],
  ['rules-and-lore','rules'],
  ['duels-arena',   'duels'],
  ['daily-drop',    'daily'],
  ['mining-rig',    'mining'],
  ['black-market',  'market'],
  ['active-proposals','proposals'],
  ['passed-laws',   'laws'],
  ['pi-os-lab',     'pi-lab'],
  ['achievements',  'achievements'], // already good but standardize
];

async function run() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(TOKEN);
  await new Promise(r => client.once('ready', r));
  const guild = await client.guilds.fetch(GUILD_ID);

  console.log(`\n🧹 Background rename started — ${RENAMES.length} renames, ~${Math.ceil(RENAMES.length * 5.5)}min`);

  for (let i = 0; i < RENAMES.length; i++) {
    const [slug, newName] = RENAMES[i];
    await guild.channels.fetch();
    const ch = guild.channels.cache.find(
      c => (c as any).parentId === CATEGORY_ID && c.name.toLowerCase().includes(slug)
    ) as GuildChannel | undefined;

    if (!ch) { console.log(`[${i+1}/${RENAMES.length}] ⏭️  Not found: ${slug}`); continue; }
    if (ch.name === newName) { console.log(`[${i+1}/${RENAMES.length}] ⏭️  Already: ${newName}`); continue; }

    try {
      await ch.setName(newName, 'The Collective cleanup');
      console.log(`[${i+1}/${RENAMES.length}] ✅ ${ch.name} → ${newName}`);
    } catch (err: any) {
      if (err.status === 429 || err.code === 429) {
        const wait = (err.retryAfter || 600) * 1000;
        console.log(`[${i+1}/${RENAMES.length}] ⏳ Rate limited, wait ${wait/1000}s...`);
        await sleep(wait + 2000);
        i--; continue;
      }
      console.error(`[${i+1}/${RENAMES.length}] ❌ ${slug}: ${err.message}`);
    }

    if (i < RENAMES.length - 1) {
      const eta = new Date(Date.now() + 330000).toLocaleTimeString('tr-TR', {timeZone:'Europe/Istanbul'});
      console.log(`  ⏳ Next rename at ~${eta} (330s cooldown)...`);
      await sleep(330_000); // 5.5 min
    }
  }

  console.log('\n✅ All renames complete!');
  await client.destroy();
  process.exit(0);
}
run().catch(e => { console.error(e.message); process.exit(1); });

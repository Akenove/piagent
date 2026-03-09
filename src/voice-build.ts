import { Client, GatewayIntentBits, ChannelType, PermissionFlagsBits } from 'discord.js';
import dotenv from 'dotenv'; dotenv.config();
const sleep = (ms: number) => new Promise(r => setTimeout(r, ms));

const VOICE_CAT = '1470858890970136768';
const GUILD_ID  = process.env.GUILD_ID!;
const P = PermissionFlagsBits;

// Existing voice channels to move here
const MOVE_TO_VOICE = [
  '1477815403769233509', // 📞・lounge
  '1477815412086538362', // 🎙️・war-room
  '1477815420743454720', // 🎭・events-stage
];

// Existing generic channels to rename
const RENAME = [
  { id:'1470859043554856980', name:'🎮・gaming-vc' },
  { id:'1470859402037821524', name:'📈・trading-vc' },
  { id:'1470859419569885357', name:'🔥・degen-vc'  },
  { id:'1470860411019591793', name:'🎙️・pi-stage'  }, // existing stage
];

// New voice channels to create
const CREATE_NEW = [
  { name:'🔊・lounge',       type:ChannelType.GuildVoice,      userLimit:0  },
  { name:'⚔️・war-room',     type:ChannelType.GuildVoice,      userLimit:10 },
  { name:'🎰・casino-vc',    type:ChannelType.GuildVoice,      userLimit:20 },
  { name:'🧠・alpha-call',   type:ChannelType.GuildVoice,      userLimit:15 },
  { name:'🎭・events-stage', type:ChannelType.GuildStageVoice, userLimit:0  },
  { name:'🎵・music',        type:ChannelType.GuildVoice,      userLimit:50 },
];

async function run() {
  const client = new Client({ intents: [GatewayIntentBits.Guilds] });
  await client.login(process.env.DISCORD_TOKEN!);
  await new Promise(r => client.once('ready', r));
  const guild = await client.guilds.fetch(GUILD_ID);
  await guild.channels.fetch();

  let member = guild.roles.cache.find(r => r.name === 'Collective Member');
  if (!member) member = await guild.roles.create({ name:'Collective Member', color:0x06b6d4 });
  const everyone = guild.roles.everyone.id;
  const botId    = guild.members.me!.id;

  const voicePerms = [
    { id:everyone, deny:[P.ViewChannel, P.Connect] },
    { id:member.id, allow:[P.ViewChannel, P.Connect, P.Speak, P.Stream, P.UseVAD, P.UseEmbeddedActivities] },
    { id:botId,     allow:[P.ViewChannel, P.Connect, P.Speak, P.MuteMembers, P.DeafenMembers, P.MoveMembers] },
  ];
  const stagePerms = [
    { id:everyone, deny:[P.ViewChannel, P.Connect] },
    { id:member.id, allow:[P.ViewChannel, P.Connect, P.RequestToSpeak], deny:[P.Speak] },
    { id:botId,     allow:[P.ViewChannel, P.Connect, P.Speak, P.MuteMembers, P.ManageChannels] },
  ];

  // 1. Rename existing generic voice channels
  console.log('── Renaming existing voice channels ──');
  for (const r of RENAME) {
    const ch = guild.channels.cache.get(r.id);
    if (!ch) { console.log(`  ⚠️  ${r.id} not found`); continue; }
    try {
      await (ch as any).edit({ name:r.name, parent:VOICE_CAT, lockPermissions:false });
      const isStage = ch.type === ChannelType.GuildStageVoice;
      for (const p of (isStage ? stagePerms : voicePerms)) {
        await (ch as any).permissionOverwrites.edit(p.id, {
          ...(p.allow ? Object.fromEntries((p.allow as bigint[]).map(bit=>[Object.keys(P).find(k=>(P as any)[k]===bit)??'',true])) : {}),
          ...(p.deny  ? Object.fromEntries((p.deny  as bigint[]).map(bit=>[Object.keys(P).find(k=>(P as any)[k]===bit)??'',false])): {}),
        }).catch(()=>{});
      }
      console.log(`  ✅ ${ch.name} → ${r.name}`);
    } catch(e:any) { console.log(`  ❌ ${r.id}: ${e.message?.slice(0,60)}`); }
    await sleep(700);
  }

  // 2. Move existing Collective voice channels into VOICE cat
  console.log('\n── Moving Collective voice channels ──');
  for (const id of MOVE_TO_VOICE) {
    const ch = guild.channels.cache.get(id);
    if (!ch) { console.log(`  ⚠️  ${id} not found`); continue; }
    try {
      await (ch as any).edit({ parent:VOICE_CAT, lockPermissions:false });
      const isStage = ch.type === ChannelType.GuildStageVoice;
      for (const p of (isStage ? stagePerms : voicePerms)) {
        await (ch as any).permissionOverwrites.edit(p.id, {
          ...(p.allow ? Object.fromEntries((p.allow as bigint[]).map(bit=>[Object.keys(P).find(k=>(P as any)[k]===bit)??'',true])) : {}),
          ...(p.deny  ? Object.fromEntries((p.deny  as bigint[]).map(bit=>[Object.keys(P).find(k=>(P as any)[k]===bit)??'',false])): {}),
        }).catch(()=>{});
      }
      console.log(`  ✅ Moved: ${ch.name}`);
    } catch(e:any) { console.log(`  ❌ ${id}: ${e.message?.slice(0,60)}`); }
    await sleep(700);
  }

  // 3. Create missing voice channels
  console.log('\n── Creating new voice channels ──');
  for (const ch of CREATE_NEW) {
    const exists = guild.channels.cache.find(
      c => (c as any).parentId === VOICE_CAT && c.name.toLowerCase().includes(ch.name.replace(/[^\w]/g,'').toLowerCase().slice(2,10))
    );
    if (exists) { console.log(`  ✓ exists: ${exists.name}`); continue; }
    try {
      const isStage = ch.type === ChannelType.GuildStageVoice;
      await guild.channels.create({
        name: ch.name,
        type: ch.type as any,
        parent: VOICE_CAT,
        userLimit: ch.userLimit,
        permissionOverwrites: isStage ? stagePerms : voicePerms,
        reason: 'The Collective Voice Build',
      });
      console.log(`  ✅ Created: ${ch.name}`);
    } catch(e:any) { console.log(`  ❌ ${ch.name}: ${e.message?.slice(0,60)}`); }
    await sleep(1000);
  }

  // 4. Rename the category itself
  const cat = guild.channels.cache.get(VOICE_CAT);
  if (cat) {
    await (cat as any).edit({ name:'🔊・VOICE' }).catch(()=>{});
    console.log('\n  ✅ Category renamed → 🔊・VOICE');
  }

  // Final audit
  await guild.channels.fetch();
  const kids = guild.channels.cache.filter(c => (c as any).parentId === VOICE_CAT);
  console.log(`\n📁 🔊・VOICE (${kids.size} channels):`);
  for (const [,c] of kids) console.log(`  ${c.name} [${ChannelType[c.type]}]`);

  await client.destroy(); process.exit(0);
}
run().catch(e => { console.error('💥', e.message); process.exit(1); });

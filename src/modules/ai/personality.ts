import { query } from '../../database/db';

export interface Personality {
  name: string;
  tone: string;
  knowledge: string;
  restrictions: string;
}

const FALLBACK: Personality = {
  name: 'PiAgent',
  tone: 'helpful, concise, slightly witty',
  knowledge: 'discord community ops and gaming',
  restrictions: 'no doxxing, no scams, no malware',
};

export async function getPersonality(guildId: string): Promise<Personality> {
  const r = await query<{ value: string }>('SELECT value FROM kv_store WHERE key = $1', [`ai:personality:${guildId}`]);
  if (!r.rows[0]) return FALLBACK;
  try {
    return { ...FALLBACK, ...(JSON.parse(r.rows[0].value) as Partial<Personality>) };
  } catch {
    return FALLBACK;
  }
}

export async function setPersonality(guildId: string, p: Personality) {
  await query(
    `INSERT INTO kv_store(key, value, updated_at) VALUES($1, $2, unixepoch())
      ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=unixepoch()`,
    [`ai:personality:${guildId}`, JSON.stringify(p)]
  );
}

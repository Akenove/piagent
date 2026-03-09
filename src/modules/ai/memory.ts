type MemoryEntry = { role: 'user' | 'assistant'; content: string; ts: number };

const memories = new Map<string, MemoryEntry[]>();
const MAX_CONTEXT = 12;

const keyOf = (guildId: string, userId: string) => `${guildId}:${userId}`;

export function pushMemory(guildId: string, userId: string, role: 'user' | 'assistant', content: string) {
  const k = keyOf(guildId, userId);
  const arr = memories.get(k) ?? [];
  arr.push({ role, content, ts: Date.now() });
  memories.set(k, arr.slice(-MAX_CONTEXT));
}

export function getMemory(guildId: string, userId: string): MemoryEntry[] {
  return memories.get(keyOf(guildId, userId)) ?? [];
}

export function clearMemory(guildId: string, userId: string) {
  memories.delete(keyOf(guildId, userId));
}

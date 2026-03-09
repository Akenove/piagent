import { ChatInputCommandInteraction } from 'discord.js';
import { getMemory, pushMemory } from './memory';
import { getPersonality } from './personality';

const MODEL_MAP: Record<string, string> = {
  gpt4o: 'openai/gpt-4o-mini',
  sonnet: 'anthropic/claude-3.5-sonnet',
  gemini: 'google/gemini-2.0-flash-001',
};

export async function askOpenRouter(
  guildId: string,
  userId: string,
  prompt: string,
  modelAlias: keyof typeof MODEL_MAP = 'gpt4o'
): Promise<string> {
  const apiKey = process.env.OPENROUTER_API_KEY;
  if (!apiKey) return 'OpenRouter API key missing. Set OPENROUTER_API_KEY.';

  const model = MODEL_MAP[modelAlias] ?? MODEL_MAP.gpt4o;
  const p = await getPersonality(guildId);
  const mem = getMemory(guildId, userId);

  const messages = [
    {
      role: 'system',
      content: `You are ${p.name}. Tone: ${p.tone}. Knowledge: ${p.knowledge}. Restrictions: ${p.restrictions}.`,
    },
    ...mem.map((m) => ({ role: m.role, content: m.content })),
    { role: 'user', content: prompt },
  ];

  const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'Content-Type': 'application/json',
      'HTTP-Referer': 'https://piagent.local',
      'X-Title': 'PiAgent',
    },
    body: JSON.stringify({ model, messages, stream: false, temperature: 0.7 }),
  });

  if (!res.ok) {
    const text = await res.text().catch(() => 'unknown');
    return `AI request failed (${res.status}): ${text.slice(0, 200)}`;
  }

  const json = (await res.json()) as { choices?: Array<{ message?: { content?: string } }> };
  const content = json.choices?.[0]?.message?.content ?? 'No response.';
  pushMemory(guildId, userId, 'user', prompt);
  pushMemory(guildId, userId, 'assistant', content);
  return content;
}

export async function handleAiChatCommand(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: 'Guild only', ephemeral: true });
  const input = interaction.options.getString('prompt', true);
  const model = (interaction.options.getString('model') ?? 'gpt4o') as keyof typeof MODEL_MAP;
  await interaction.deferReply();

  const answer = await askOpenRouter(interaction.guildId, interaction.user.id, input, model);
  // don't ask why this works: Discord cap + AI rambles
  await interaction.editReply(answer.length > 1950 ? `${answer.slice(0, 1950)}...` : answer);
}

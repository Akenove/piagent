import { ChatInputCommandInteraction, TextChannel } from 'discord.js';
import { askOpenRouter } from './chat';

export async function summarizeChannel(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId || !interaction.channel) return interaction.reply({ content: 'Guild channel only', ephemeral: true });
  const count = interaction.options.getInteger('messages') ?? 30;
  const channel = interaction.channel as TextChannel;

  await interaction.deferReply({ ephemeral: true });
  const msgs = await channel.messages.fetch({ limit: Math.min(Math.max(count, 5), 100) }).catch(() => null);
  if (!msgs) return interaction.editReply('Could not fetch messages.');

  const lines = [...msgs.values()]
    .reverse()
    .map((m) => `${m.author.username}: ${m.content}`)
    .filter((t) => t.trim().length > 0)
    .slice(-80)
    .join('\n');

  const prompt = `Summarize this Discord conversation in bullet points and include action items.\n\n${lines}`;
  const out = await askOpenRouter(interaction.guildId, interaction.user.id, prompt, 'gpt4o');
  await interaction.editReply(out.slice(0, 1950));
}

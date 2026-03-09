import { ChatInputCommandInteraction, Message } from 'discord.js';
import { askOpenRouter } from './chat';

const autoTranslateGuilds = new Set<string>();

export function toggleAutoTranslate(guildId: string, on: boolean) {
  on ? autoTranslateGuilds.add(guildId) : autoTranslateGuilds.delete(guildId);
}

export async function runTranslate(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: 'Guild only', ephemeral: true });
  const text = interaction.options.getString('text', true);
  const target = interaction.options.getString('target', true);
  await interaction.deferReply({ ephemeral: true });
  const out = await askOpenRouter(interaction.guildId, interaction.user.id, `Translate to ${target}: ${text}`, 'gemini');
  await interaction.editReply(out.slice(0, 1950));
}

export async function maybeAutoTranslate(msg: Message) {
  if (!msg.guild || msg.author.bot || !autoTranslateGuilds.has(msg.guild.id)) return;
  if (msg.content.length < 10) return;
  if (msg.content.startsWith('http')) return;
  const translated = await askOpenRouter(msg.guild.id, msg.author.id, `Detect language then translate this to English: ${msg.content}`, 'gemini');
  msg.reply(`🌐 ${translated.slice(0, 1800)}`).catch(() => undefined);
}

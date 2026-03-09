import { SlashCommandBuilder } from 'discord.js';
import { handleAiChatCommand } from '../chat';
import { getPersonality, setPersonality } from '../personality';
import { summarizeChannel } from '../summarize';
import { runTranslate } from '../translate';
import { query } from '../../../database/db';

export const aiCommand = {
  data: new SlashCommandBuilder()
    .setName('ai')
    .setDescription('PiAgent AI tools')
    .addSubcommand((s) =>
      s
        .setName('chat')
        .setDescription('Chat with AI')
        .addStringOption((o) => o.setName('prompt').setDescription('Prompt').setRequired(true))
        .addStringOption((o) =>
          o
            .setName('model')
            .setDescription('Model')
            .setRequired(false)
            .addChoices(
              { name: 'GPT-4o mini', value: 'gpt4o' },
              { name: 'Claude Sonnet', value: 'sonnet' },
              { name: 'Gemini', value: 'gemini' }
            )
        )
    )
    .addSubcommand((s) =>
      s
        .setName('personality')
        .setDescription('Set AI personality')
        .addStringOption((o) => o.setName('name').setDescription('Assistant name').setRequired(true))
        .addStringOption((o) => o.setName('tone').setDescription('Tone').setRequired(true))
    )
    .addSubcommand((s) => s.setName('summarize').setDescription('Summarize this channel').addIntegerOption((o) => o.setName('messages').setDescription('Message count')))
    .addSubcommand((s) =>
      s
        .setName('translate')
        .setDescription('Translate text')
        .addStringOption((o) => o.setName('text').setDescription('Text').setRequired(true))
        .addStringOption((o) => o.setName('target').setDescription('Target language').setRequired(true))
    )
    .addSubcommand((s) =>
      s
        .setName('model')
        .setDescription('Set default model')
        .addStringOption((o) =>
          o
            .setName('value')
            .setDescription('model alias')
            .setRequired(true)
            .addChoices({ name: 'gpt4o', value: 'gpt4o' }, { name: 'sonnet', value: 'sonnet' }, { name: 'gemini', value: 'gemini' })
        )
    ),

  async execute(interaction: any) {
    if (!interaction.guildId) return interaction.reply({ content: 'Guild-only', ephemeral: true });
    const sub = interaction.options.getSubcommand();
    if (sub === 'chat') return handleAiChatCommand(interaction);
    if (sub === 'summarize') return summarizeChannel(interaction);
    if (sub === 'translate') return runTranslate(interaction);

    if (sub === 'personality') {
      const name = interaction.options.getString('name', true);
      const tone = interaction.options.getString('tone', true);
      const curr = await getPersonality(interaction.guildId);
      await setPersonality(interaction.guildId, { ...curr, name, tone });
      return interaction.reply({ content: `AI personality updated: ${name} (${tone})`, ephemeral: true });
    }

    const value = interaction.options.getString('value', true);
    await query(
      `INSERT INTO kv_store(key, value, updated_at) VALUES($1, $2, unixepoch()) ON CONFLICT(key) DO UPDATE SET value=excluded.value, updated_at=unixepoch()`,
      [`ai:model:${interaction.guildId}`, value]
    );
    await interaction.reply({ content: `Default AI model set to ${value}.`, ephemeral: true });
  },
};

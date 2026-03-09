import { ChatInputCommandInteraction, EmbedBuilder } from 'discord.js';

export async function createPoll(interaction: ChatInputCommandInteraction) {
  const q = interaction.options.getString('question', true);
  const opts = interaction.options.getString('options', true).split(',').map((s) => s.trim()).filter(Boolean).slice(0, 10);
  const mins = interaction.options.getInteger('minutes') ?? 10;
  const numbers = ['1️⃣','2️⃣','3️⃣','4️⃣','5️⃣','6️⃣','7️⃣','8️⃣','9️⃣','🔟'];

  const embed = new EmbedBuilder()
    .setColor(0x3b82f6)
    .setTitle('Poll')
    .setDescription(opts.map((o, i) => `${numbers[i]} ${o}`).join('\n'))
    .addFields({ name: 'Question', value: q }, { name: 'Ends', value: `<t:${Math.floor(Date.now() / 1000) + mins * 60}:R>` });

  const msg = await interaction.reply({ embeds: [embed], fetchReply: true });
  for (let i = 0; i < opts.length; i++) msg.react(numbers[i]).catch(() => undefined);
}

import { AttachmentBuilder, ChatInputCommandInteraction } from 'discord.js';
import { createCanvas, loadImage } from '@napi-rs/canvas';
import { getXpState } from './xp';

export async function sendRankCard(interaction: ChatInputCommandInteraction) {
  if (!interaction.guildId) return interaction.reply({ content: 'Guild only', ephemeral: true });
  const target = interaction.options.getUser('user') ?? interaction.user;
  const state = await getXpState(interaction.guildId, target.id);

  const canvas = createCanvas(900, 280);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#0b1020';
  ctx.fillRect(0, 0, 900, 280);

  ctx.fillStyle = '#3B82F6';
  ctx.fillRect(40, 200, 820, 26);
  const pct = Math.max(0.05, Math.min(1, state.xp / (100 + state.level * 75)));
  ctx.fillStyle = '#93C5FD';
  ctx.fillRect(40, 200, Math.floor(820 * pct), 26);

  ctx.font = 'bold 40px sans-serif';
  ctx.fillStyle = '#fff';
  ctx.fillText(target.username, 190, 105);

  ctx.font = '26px sans-serif';
  ctx.fillStyle = '#cbd5e1';
  ctx.fillText(`Level ${state.level} • XP ${state.xp}`, 190, 150);

  if (target.displayAvatarURL()) {
    try {
      const img = await loadImage(target.displayAvatarURL({ extension: 'png', size: 256 }));
      ctx.save();
      ctx.beginPath();
      ctx.arc(100, 110, 64, 0, Math.PI * 2);
      ctx.clip();
      ctx.drawImage(img, 36, 46, 128, 128);
      ctx.restore();
    } catch {}
  }

  const attachment = new AttachmentBuilder(await canvas.encode('png'), { name: 'rank-card.png' });
  await interaction.reply({ files: [attachment] });
}

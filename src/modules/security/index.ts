import { BotModule } from '../types';
import { securityCommand } from './commands/security';
import { buildVerifyCommand, handleVerifyButton } from './verification';
import { detectMassJoin } from './antiRaid';
import { scanMessageForPhishing } from './phishing';
import { flushAuditLogToChannel, logSecurityEvent } from './auditLog';
import { wireAntiNuke } from './antiNuke';

export function createSecurityModule(): BotModule {
  return {
    name: 'security',
    description: 'Anti-raid, anti-nuke, phishing, verification and audit logging',
    commands: [securityCommand as any, buildVerifyCommand() as any],
    init: async ({ client }) => {
      wireAntiNuke(client);
      client.on('guildMemberAdd', async (member) => {
        const result = await detectMassJoin(member);
        if (result.triggered) {
          await logSecurityEvent(member.guild.id, result.reason ?? 'anti-raid trigger');
          flushAuditLogToChannel(client, member.guild.id, result.reason ?? 'anti-raid trigger').catch(() => undefined);
        }
      });
    },
    handlers: {
      onInteraction: async (interaction, { client }) => {
        if (!interaction.guildId) return;
        if (interaction.isButton() && interaction.customId.startsWith('security_verify:') && interaction.member) {
          const result = await handleVerifyButton(interaction.customId, interaction.member as any);
          if (result.ok) {
            await interaction.reply({ content: 'Verified ✅ Welcome in.', ephemeral: true });
            await logSecurityEvent(interaction.guildId, `verified ${interaction.user.tag}`);
          } else {
            await interaction.reply({ content: `Verification failed: ${result.reason}`, ephemeral: true });
          }
        }
        if (interaction.isChatInputCommand()) {
          flushAuditLogToChannel(client, interaction.guildId, `/${interaction.commandName} used by ${interaction.user.tag}`).catch(() => undefined);
        }
      },
      onMessage: async (msg, { client }) => {
        if (!msg.guild) return;
        const blocked = await scanMessageForPhishing(msg);
        if (blocked) {
          flushAuditLogToChannel(client, msg.guild.id, `Deleted phishing-like message from ${msg.author.tag}`).catch(() => undefined);
        }
      },
    },
  };
}

export { detectMassJoin };

import { Interaction, Client, ChatInputCommandInteraction, ButtonInteraction, ModalSubmitInteraction } from 'discord.js';
import { handleOnboardingButton, handleUsernameModal, handleOnboardingComplete } from '../commands/onboarding';

export async function handleInteraction(interaction: Interaction, client: Client) {
  try {
    // Slash commands
    if (interaction.isChatInputCommand()) {
      const command = (client as any).commands.get(interaction.commandName);
      if (!command) return;
      await command.execute(interaction);
      return;
    }

    // Buttons
    if (interaction.isButton()) {
      const btn = interaction as ButtonInteraction;
      switch (btn.customId) {
        case 'onboarding_start':
          await handleOnboardingButton(btn, 'start');
          break;
        case 'terms_accept':
          await handleOnboardingButton(btn, 'terms_accept');
          break;
        case 'terms_decline':
          await btn.reply({ content: 'Maybe next time. 👋', ephemeral: true });
          break;
        case 'onboarding_complete':
          await handleOnboardingComplete(btn);
          break;
        default:
          // Game buttons (cashout, double-or-nothing, etc.)
          if (btn.customId.startsWith('game_')) {
            // TODO: route to game handlers
          }
          break;
      }
      return;
    }

    // Modals
    if (interaction.isModalSubmit()) {
      const modal = interaction as ModalSubmitInteraction;
      if (modal.customId === 'username_modal') {
        await handleUsernameModal(modal);
      }
      return;
    }
  } catch (error: any) {
    console.error('Interaction error:', error);
    const reply = interaction.isRepliable() ? interaction : null;
    if (reply) {
      const msg = { content: '❌ Something went wrong.', ephemeral: true };
      if ((interaction as any).replied || (interaction as any).deferred) {
        await (interaction as any).followUp(msg).catch(() => {});
      } else {
        await (interaction as any).reply(msg).catch(() => {});
      }
    }
  }
}

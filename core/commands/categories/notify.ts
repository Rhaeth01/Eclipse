import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';

export function registerNotify(registry: CommandRegistry): void {
  registry.describeCategory('notify', 'Configuration des notifications');

  const defs: SubcommandDef[] = [
    {
      category: 'notify',
      name: 'test',
      description: 'Envoie une notification de test',
      async execute(interaction, ctx) {
        ctx.dm.broadcastNotification('command_used', '🔔 Notification de test Eclipse.', 'Test notification');
        await interaction.reply({ content: '🔔 Notification de test envoyée à l\'UI.', ephemeral: true });
      },
    },
    {
      category: 'notify',
      name: 'webhook',
      description: 'Configure un webhook Discord pour les notifications',
      build: s =>
        s
          .addStringOption(o => o.setName('url').setDescription('URL du webhook Discord (vide pour effacer)').setRequired(false))
          .addStringOption(o => o.setName('action').setDescription('Actions à forwarder').setRequired(false)),
      async execute(interaction, _ctx) {
        const url = interaction.options.getString('url');
        if (!url) {
          await interaction.reply({ content: '🗑️ Webhook de notification effacé. (TODO: persister)', ephemeral: true });
          return;
        }
        try {
          await fetch(url, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ content: '🔔 Eclipse — webhook de notification configuré.' }),
          });
          await interaction.reply({ content: '✅ Webhook de notification configuré. (TODO: persister)', ephemeral: true });
        } catch {
          await interaction.reply({ content: '❌ Webhook invalide ou inaccessible.', ephemeral: true });
        }
      },
    },
    {
      category: 'notify',
      name: 'status',
      description: 'Affiche la config des notifications',
      async execute(interaction, _ctx) {
        const text = `**🔔 Notifications**\n\n🌐 Centre in-app: ✅\n🍞 Toasts desktop: ✅\n🔗 Webhook: non configuré\n\nEvents surveillés: ghostping, spy_message, spy_voice, direct_message, keyword_ping, friend_removed, guild_removed, role_add/remove.`;
        await interaction.reply({ content: text, ephemeral: true });
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}

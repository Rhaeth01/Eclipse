import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';
import type { CloneService } from '../../services/CloneService';

export function registerClone(registry: CommandRegistry, cloneService: CloneService): void {
  registry.describeCategory('clone', 'Clonage de serveurs');

  const defs: SubcommandDef[] = [
    {
      category: 'clone',
      name: 'server',
      description: 'Clone un serveur (rôles, salons, emojis)',
      build: s =>
        s
          .addStringOption(o => o.setName('source').setDescription('ID du serveur source').setRequired(true))
          .addStringOption(o => o.setName('nom').setDescription('Nom du nouveau serveur').setRequired(true)),
      contexts: [0],
      async execute(interaction, ctx) {
        const sourceId = interaction.options.getString('source');
        const name = interaction.options.getString('nom');
        const rest = ctx.dm.getRest();
        if (!sourceId || !name) {
          await interaction.reply({ content: '❌ ID source et nom requis.', ephemeral: true });
          return;
        }
        if (!rest) {
          await interaction.reply({ content: '❌ REST non disponible.', ephemeral: true });
          return;
        }
        await interaction.reply({ content: `🔄 Clonage du serveur \`${sourceId}\` en cours...`, ephemeral: true });
        try {
          const result = await cloneService.cloneGuild(sourceId, name, rest, p => {
            ctx.dm.broadcastToast('Clone', `${p.step} (${p.current}/${p.total})`);
          });
          if (result.success) {
            await interaction.editReply({
              content: `✅ Serveur cloné !\n🆔 ${result.newGuildId}\n🛡️ Rôles: ${result.rolesCreated}\n💬 Salons: ${result.channelsCreated}\n😀 Emojis: ${result.emojisCreated}`,
            });
          } else {
            await interaction.editReply({ content: `❌ Erreur: ${result.error}` });
          }
        } catch (err) {
          await interaction.editReply({ content: `❌ Erreur: ${err}` });
        }
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}

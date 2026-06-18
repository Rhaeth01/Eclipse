import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';

export function registerRecovery(registry: CommandRegistry): void {
  registry.describeCategory('recovery', 'Backup & restore du compte');

  const defs: SubcommandDef[] = [
    {
      category: 'recovery',
      group: 'backup',
      name: 'create',
      description: 'Crée un backup complet du compte',
      async execute(interaction, ctx) {
        const selfbot = ctx.dm.getSelfbot();
        if (!selfbot) {
          await interaction.reply({ content: '❌ Selfbot non connecté.', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
          const result = await ctx.backupService.createBackup(selfbot);
          await interaction.editReply({ content: `💾 Backup créé: \`${result.filePath.split('/').pop() || result.filePath}\`\n${result.data.friends?.length || 0} amis, ${result.data.guilds?.length || 0} serveurs.` });
        } catch (err) {
          await interaction.editReply({ content: `❌ Erreur backup: ${err}` });
        }
      },
    },
    {
      category: 'recovery',
      group: 'backup',
      name: 'list',
      description: 'Liste les backups disponibles',
      async execute(interaction, ctx) {
        const backups = ctx.backupService.listBackups();
        if (backups.length === 0) {
          await interaction.reply({ content: '📁 Aucun backup trouvé.', ephemeral: true });
          return;
        }
        let text = `**💾 Backups (${backups.length})**\n\n`;
        for (const b of backups.slice(0, 20)) text += `• \`${b}\`\n`;
        await interaction.reply({ content: text, ephemeral: true });
      },
    },
    {
      category: 'recovery',
      group: 'backup',
      name: 'load',
      description: 'Affiche le contenu d\'un backup (sans restaurer)',
      build: s => s.addStringOption(o => o.setName('fichier').setDescription('Nom du fichier backup').setRequired(true)),
      async execute(interaction, ctx) {
        const fileName = interaction.options.getString('fichier');
        if (!fileName) {
          await interaction.reply({ content: '❌ Fichier requis.', ephemeral: true });
          return;
        }
        try {
          const data = ctx.backupService.loadBackup(fileName);
          const text = `**📁 ${fileName}**\n\n👤 User: ${data.metadata?.username || '?'}\n👥 Amis: ${data.friends?.length || 0}\n🏰 Serveurs: ${data.guilds?.length || 0}\n💬 Salons DM: ${data.channels?.length || 0}\n📅 Créé: ${data.metadata?.createdAt || '?'}`;
          await interaction.reply({ content: text, ephemeral: true });
        } catch (err) {
          await interaction.reply({ content: `❌ ${err}`, ephemeral: true });
        }
      },
    },
    {
      category: 'recovery',
      group: 'backup',
      name: 'delete',
      description: 'Supprime un backup',
      build: s => s.addStringOption(o => o.setName('fichier').setDescription('Nom du fichier backup').setRequired(true)),
      async execute(interaction, ctx) {
        const fileName = interaction.options.getString('fichier');
        if (!fileName) {
          await interaction.reply({ content: '❌ Fichier requis.', ephemeral: true });
          return;
        }
        const ok = ctx.backupService.deleteBackup(fileName);
        await interaction.reply({ content: ok ? `🗑️ Backup \`${fileName}\` supprimé.` : `❌ Backup introuvable.`, ephemeral: true });
      },
    },
    {
      category: 'recovery',
      group: 'backup',
      name: 'restore',
      description: 'Restaure un backup (réajoute les amis)',
      build: s => s.addStringOption(o => o.setName('fichier').setDescription('Nom du fichier backup').setRequired(true)),
      async execute(interaction, ctx) {
        const fileName = interaction.options.getString('fichier');
        const selfbot = ctx.dm.getSelfbot();
        if (!fileName || !selfbot) {
          await interaction.reply({ content: '❌ Fichier et selfbot connecté requis.', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
          const report = await ctx.backupService.restoreBackup(fileName, selfbot);
          let text = `💾 Restauration de \`${fileName}\`\n\n👥 Amis réajoutés: ${report.friendsAdded}\n❌ Échecs: ${report.friendsFailed}`;
          if (report.missingGuilds.length > 0) {
            text += `\n\n🏰 Serveurs manquants (${report.missingGuilds.length}) — rejoignez-les manuellement:`;
            for (const g of report.missingGuilds.slice(0, 10)) text += `\n• ${g.name} (\`${g.id}\`)`;
          }
          await interaction.editReply({ content: text });
        } catch (err) {
          await interaction.editReply({ content: `❌ Erreur: ${err}` });
        }
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}

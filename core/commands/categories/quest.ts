import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';

export function registerQuest(registry: CommandRegistry): void {
  registry.describeCategory('quest', 'Quêtes Discord auto-complétion');

  const defs: SubcommandDef[] = [
    {
      category: 'quest',
      name: 'list',
      description: 'Liste les quêtes disponibles',
      async execute(interaction, ctx) {
        const quests = ctx.questService.getActiveQuests();
        if (quests.length === 0) {
          await interaction.reply({ content: '🎯 Aucune quête disponible. Utilisez `/quest fetch` pour rafraîchir.', ephemeral: true });
          return;
        }
        let text = `**🎯 Quêtes (${quests.length})**\n\n`;
        for (const q of quests) {
          const running = ctx.questService.getRunningQuests().includes(q.id);
          text += `${running ? '▶️' : '⏸️'} **${q.title}** (${q.type})\n   ${q.description}\n   Récompense: ${q.reward?.name || '?'}\n`;
        }
        await interaction.reply({ content: text, ephemeral: true });
      },
    },
    {
      category: 'quest',
      name: 'fetch',
      description: 'Récupère les quêtes depuis Discord',
      async execute(interaction, ctx) {
        await interaction.deferReply({ ephemeral: true });
        try {
          const quests = await ctx.questService.fetchAvailableQuests();
          await interaction.editReply({ content: `✅ ${quests.length} quêtes récupérées. Utilisez \`/quest list\` pour les voir.` });
        } catch (err) {
          await interaction.editReply({ content: `❌ Erreur: ${err}` });
        }
      },
    },
    {
      category: 'quest',
      name: 'start',
      description: 'Démarre la complétion auto d\'une quête',
      build: s => s.addStringOption(o => o.setName('id').setDescription('ID de la quête').setRequired(true)),
      async execute(interaction, ctx) {
        const questId = interaction.options.getString('id');
        if (!questId) {
          await interaction.reply({ content: '❌ ID requis.', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
          await ctx.questService.startQuestCompletion(questId);
          await interaction.editReply({ content: `▶️ Complétion démarrée pour la quête \`${questId}\`.` });
        } catch (err) {
          await interaction.editReply({ content: `❌ Erreur: ${err}` });
        }
      },
    },
    {
      category: 'quest',
      name: 'stop',
      description: 'Arrête la complétion d\'une quête',
      build: s => s.addStringOption(o => o.setName('id').setDescription('ID de la quête').setRequired(true)),
      async execute(interaction, ctx) {
        const questId = interaction.options.getString('id');
        if (!questId) {
          await interaction.reply({ content: '❌ ID requis.', ephemeral: true });
          return;
        }
        ctx.questService.stopQuestCompletion(questId);
        await interaction.reply({ content: `⏹️ Complétion arrêtée pour la quête \`${questId}\`.`, ephemeral: true });
      },
    },
    {
      category: 'quest',
      name: 'claim',
      description: 'Réclame la récompense d\'une quête',
      build: s => s.addStringOption(o => o.setName('id').setDescription('ID de la quête').setRequired(true)),
      async execute(interaction, ctx) {
        const questId = interaction.options.getString('id');
        if (!questId) {
          await interaction.reply({ content: '❌ ID requis.', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
          const ok = await ctx.questService.claimReward(questId);
          await interaction.editReply({ content: ok ? `🎁 Récompense réclamée pour \`${questId}\`.` : `❌ Impossible de réclamer.` });
        } catch (err) {
          await interaction.editReply({ content: `❌ Erreur: ${err}` });
        }
      },
    },
    {
      category: 'quest',
      name: 'mock',
      description: 'Crée des quêtes de test (dev)',
      async execute(interaction, ctx) {
        const quests = ctx.questService.createMockQuests();
        await interaction.reply({ content: `🧪 ${quests.length} quêtes mock créées.`, ephemeral: true });
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}

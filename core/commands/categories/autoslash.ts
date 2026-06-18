import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';

export function registerAutoslash(registry: CommandRegistry): void {
  registry.describeCategory('autoslash', 'Automatisation des slash commands');

  const defs: SubcommandDef[] = [
    {
      category: 'autoslash',
      group: 'bump',
      name: 'enable',
      description: 'Active le bump auto (Disboard)',
      build: s =>
        s
          .addIntegerOption(o => o.setName('interval').setDescription('Interval en minutes (défaut: 120, min: 60)').setRequired(false))
          .addIntegerOption(o => o.setName('offset').setDescription('Décalage initial en min (défaut: 0)').setRequired(false))
          .addStringOption(o => o.setName('guild_id').setDescription('ID du serveur (requis en DM)').setRequired(false))
          .addStringOption(o => o.setName('channel_id').setDescription('ID du salon (requis en DM)').setRequired(false)),
      async execute(interaction, ctx) {
        const targetGuildId = interaction.options.getString('guild_id') || interaction.guildId;
        const targetChannelId = interaction.options.getString('channel_id') || interaction.channelId;
        if (!targetGuildId || !targetChannelId) {
          await interaction.reply({ content: '❌ ID serveur et salon requis en DM.', ephemeral: true });
          return;
        }
        let interval = interaction.options.getInteger('interval') || 120;
        const offset = interaction.options.getInteger('offset') || 0;
        if (interval < 60) interval = 120;
        if (interval > 1440) interval = 1440;
        const result = ctx.autoSlashService.enableBump(targetGuildId, targetChannelId, interval, offset);
        if (result && !result.success) {
          await interaction.reply({ content: `❌ Erreur: ${result.error}`, ephemeral: true });
          return;
        }
        const firstBumpTime = offset > 0 ? `dans ${offset} minutes` : `immédiatement`;
        await interaction.reply({ content: `🔼 Bump auto activé ! Premier bump ${firstBumpTime}, ensuite toutes les ${interval} minutes.`, ephemeral: true });
      },
    },
    {
      category: 'autoslash',
      group: 'bump',
      name: 'disable',
      description: 'Désactive le bump auto',
      build: s => s.addStringOption(o => o.setName('guild_id').setDescription('ID du serveur (requis en DM)').setRequired(false)),
      async execute(interaction, ctx) {
        const targetGuildId = interaction.options.getString('guild_id') || interaction.guildId;
        if (!targetGuildId) {
          await interaction.reply({ content: '❌ ID serveur requis en DM.', ephemeral: true });
          return;
        }
        ctx.autoSlashService.disableBump(targetGuildId);
        await interaction.reply({ content: '🔼 Bump auto désactivé.', ephemeral: true });
      },
    },
    {
      category: 'autoslash',
      group: 'bump',
      name: 'status',
      description: 'Statut du bump auto',
      build: s => s.addStringOption(o => o.setName('guild_id').setDescription('ID du serveur (requis en DM)').setRequired(false)),
      async execute(interaction, ctx) {
        const targetGuildId = interaction.options.getString('guild_id') || interaction.guildId;
        if (!targetGuildId) {
          await interaction.reply({ content: '❌ ID serveur requis en DM.', ephemeral: true });
          return;
        }
        const status = ctx.autoSlashService.getBumpStatus(targetGuildId);
        if (!status || !status.enabled) {
          await interaction.reply({ content: `🔼 Bump auto: Désactivé`, ephemeral: true });
          return;
        }
        const timeLeft = ctx.autoSlashService.getTimeUntilBump(targetGuildId);
        const formatted = ctx.autoSlashService.formatTimeRemaining(timeLeft);
        await interaction.reply({ content: `🔼 **Bump Auto**\n✅ Activé\n📍 Salon: <#${status.channelId}>\n⏱️ Interval: ${status.interval / 60000} min\n🕐 Prochain bump: ${formatted}`, ephemeral: true });
      },
    },
    {
      category: 'autoslash',
      group: 'bump',
      name: 'list',
      description: 'Liste tous les bumps auto actifs',
      async execute(interaction, ctx) {
        const active = ctx.autoSlashService.getActiveBumps();
        if (active.length === 0) {
          await interaction.reply({ content: '🔼 Aucun bump auto actif.', ephemeral: true });
          return;
        }
        let text = `**🔼 Bumps auto actifs (${active.length})**\n\n`;
        for (const b of active) text += `• Serveur \`${b.guildId}\` — Salon <#${b.channelId}> — ${b.interval / 60000} min\n`;
        await interaction.reply({ content: text, ephemeral: true });
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}

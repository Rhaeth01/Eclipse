import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';

export function registerMisc(registry: CommandRegistry): void {
  registry.describeCategory('misc', 'Commandes diverses');

  const defs: SubcommandDef[] = [
    {
      category: 'misc',
      name: 'afk',
      description: 'Mode AFK',
      build: s => s.addStringOption(o => o.setName('message').setDescription('Raison').setRequired(false)),
      async execute(interaction, ctx) {
        const message = interaction.options.getString('message') || 'Je suis AFK';
        ctx.dm.setGlobalAfkMessage(message);
        await interaction.reply({ content: `💤 Mode AFK activé: "${message}"`, ephemeral: true });
      },
    },
    {
      category: 'misc',
      name: 'ghostping',
      description: 'Mention furtive',
      build: s => s.addUserOption(o => o.setName('cible').setDescription('Victime').setRequired(true)),
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible');
        if (!target) {
          await ctx.dm.safeEphemeralReply(interaction, '❌ Cible invalide.');
          return;
        }
        try {
          if (!ctx.dm.selfbot || !interaction.channelId) throw new Error('Selfbot non connecté');
          if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
          const channel = await ctx.dm.selfbot.channels.fetch(interaction.channelId);
          if (!channel || !channel.isText()) throw new Error('Canal invalide');
          const ghostMsg = await (channel as any).send(`${target}`);
          await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
          await ghostMsg.delete().catch(() => {});
          await interaction.deleteReply().catch(() => {});
        } catch {
          await ctx.dm.safeEphemeralReply(interaction, '❌ Impossible d\'envoyer le ghostping via le compte utilisateur.');
        }
      },
    },
    {
      category: 'misc',
      name: 'uptime',
      description: 'Temps de fonctionnement du selfbot',
      async execute(interaction, ctx) {
        const selfbot = ctx.dm.selfbot as any;
        const readyAt = selfbot?.readyAt ?? selfbot?.readyTimestamp;
        if (!readyAt) {
          await interaction.reply({ content: '❌ Selfbot non connecté.', ephemeral: true });
          return;
        }
        const ms = Date.now() - (typeof readyAt === 'number' ? readyAt : readyAt.getTime());
        const h = Math.floor(ms / 3600000);
        const m = Math.floor((ms % 3600000) / 60000);
        const s = Math.floor((ms % 60000) / 1000);
        await interaction.reply({ content: `⏱️ Uptime: ${h}h ${m}m ${s}s`, ephemeral: true });
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}

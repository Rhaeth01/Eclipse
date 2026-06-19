import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';
import { steps } from '../../shared/constants';

export function registerTroll(registry: CommandRegistry): void {
  registry.describeCategory('troll', 'Commandes de trolling');

  const defs: SubcommandDef[] = [
    {
      category: 'troll',
      name: 'mimic',
      description: 'Imite quelqu\'un avec webhook',
      contexts: [0],
      build: s =>
        s
          .addUserOption(o => o.setName('cible').setDescription('Utilisateur à imiter').setRequired(true))
          .addStringOption(o => o.setName('message').setDescription('Message à envoyer').setRequired(true)),
      async execute(interaction) {
        const target = interaction.options.getUser('cible');
        const mimicText = interaction.options.getString('message');
        if (!target || !mimicText) {
          await interaction.reply({ content: '❌ Arguments manquants.', ephemeral: true });
          return;
        }
        const channel = interaction.channel;
        if (!channel?.isTextBased()) {
          await interaction.reply({ content: '❌ Canal invalide.', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
          let targetChannel: any = channel;
          let threadId: string | undefined;
          if ((channel as any).isThread()) {
            targetChannel = (channel as any).parent;
            threadId = (channel as any).id;
          }
          const webhook = await targetChannel.createWebhook(target.username, { avatar: target.displayAvatarURL() });
          await webhook.send({ content: mimicText, threadId });
          await webhook.delete();
          await interaction.editReply({ content: `✅ Message envoyé en tant que ${target.tag}` });
        } catch {
          await interaction.editReply({ content: '❌ Impossible de créer le webhook.' }).catch(() => {});
        }
      },
    },
    {
      category: 'troll',
      name: 'invisibleping',
      description: 'Mention fantôme — surligne sans notifier',
      build: s =>
        s
          .addUserOption(o => o.setName('cible').setDescription('Victime').setRequired(true))
          .addStringOption(o => o.setName('message').setDescription('Texte accompagnant la mention').setRequired(false)),
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

          const suffix = interaction.options.getString('message') ?? '';
          const content = `<@${target.id}>${suffix ? ' ' + suffix : ''}`;

          await channel.send({
            content,
            allowed_mentions: { parse: [], users: [], roles: [], replied_user: false },
            flags: 4096,
          });

          await interaction.deleteReply().catch(() => {});
        } catch {
          await ctx.dm.safeEphemeralReply(interaction, "❌ Impossible d'envoyer la mention fantôme via le compte utilisateur.");
        }
      },
    },
    {
      category: 'troll',
      name: 'annoy',
      description: 'Spam mention silencieux (1-5)',
      build: s =>
        s
          .addUserOption(o => o.setName('cible').setDescription('Victime').setRequired(true))
          .addIntegerOption(o => o.setName('nombre').setDescription('Nombre de mentions (1-5, défaut: 3)').setRequired(false)),
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible');
        const count = Math.min(interaction.options.getInteger('nombre') || 3, 5);
        if (!target) {
          await ctx.dm.safeEphemeralReply(interaction, '❌ Cible invalide.');
          return;
        }
        try {
          if (!interaction.deferred && !interaction.replied) await interaction.deferReply({ ephemeral: true });
          const channel = ctx.dm.selfbot && interaction.channelId ? await ctx.dm.selfbot.channels.fetch(interaction.channelId) : null;
          if (!channel || !channel.isText()) throw new Error('Canal invalide');
          for (let i = 0; i < count; i++) {
            const msg = await (channel as any).send(`<@${target.id}> 👋`);
            setTimeout(() => msg.delete().catch(() => {}), 500);
            await new Promise(r => setTimeout(r, 800));
          }
          await interaction.deleteReply().catch(() => {});
        } catch {
          await ctx.dm.safeEphemeralReply(interaction, '❌ Impossible d\'envoyer les messages via le compte utilisateur.');
        }
      },
    },
    {
      category: 'troll',
      name: 'fuckyou',
      description: 'Animation middle finger',
      async execute(interaction, ctx) {
        try {
          const msg = await ctx.dm.sendAsSelfbot(interaction, '┌─┐');
          await new Promise(r => setTimeout(r, 800));
          await msg.edit('┌─┐\n┴─┴').catch(() => {});
          await new Promise(r => setTimeout(r, 800));
          await msg.edit('┌─┐\n┴─┴\nಠ_ರೃ').catch(() => {});
          await new Promise(r => setTimeout(r, 800));
          await msg.edit('╭∩╮（︶︿︶）╭∩╮').catch(() => {});
        } catch {
          await ctx.dm.safeEphemeralReply(interaction, '❌ Impossible d\'envoyer le message via le compte utilisateur.');
        }
      },
    },
    {
      category: 'troll',
      name: 'fakevirus',
      description: 'Animation fake trojan download',
      async execute(interaction, ctx) {
        try {
          const msg = await ctx.dm.sendAsSelfbot(interaction, '⚠️ **WARNING** ⚠️\nInjecting Trojan.Win32.Discord...');
          await new Promise(r => setTimeout(r, 1500));
          await msg.edit('⚙️ Executing exploit... [root@localhost]').catch(() => {});
          await new Promise(r => setTimeout(r, 1500));
          await msg.edit('📥 Downloading payloads... 45%').catch(() => {});
          await new Promise(r => setTimeout(r, 1500));
          await msg.edit('📥 Downloading payloads... 100%').catch(() => {});
          await new Promise(r => setTimeout(r, 1500));
          await msg.edit('✅ System compromised! IP logged.').catch(() => {});
        } catch {
          await ctx.dm.safeEphemeralReply(interaction, '❌ Impossible d\'envoyer le message via le compte utilisateur.');
        }
      },
    },
    {
      category: 'troll',
      name: 'hack',
      description: 'Simulation de hack (fake)',
      build: s => s.addUserOption(o => o.setName('cible').setDescription('Victime').setRequired(true)),
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible');
        if (!target) {
          await ctx.dm.safeEphemeralReply(interaction, '❌ Cible requise.');
          return;
        }
        try {
          const msg = await ctx.dm.sendAsSelfbot(interaction, `🕵️ **HACKING ${target.username.toUpperCase()}...**`);
          for (const step of steps) {
            await new Promise(r => setTimeout(r, 1500));
            await msg.edit(step).catch(() => {});
          }
          await new Promise(r => setTimeout(r, 1000));
          await msg
            .edit(`🎉 **${target.username}** a été hacké avec succès!\n📧 Email: ${target.username.toLowerCase()}@hacked.com\n🔑 Password: ${'x'.repeat(10)}\n💰 Solde: 0.00$ (pauvre!)`)
            .catch(() => {});
        } catch {
          await ctx.dm.safeEphemeralReply(interaction, '❌ Impossible d\'envoyer le message via le compte utilisateur.');
        }
      },
    },
    {
      category: 'troll',
      name: 'disconnect',
      description: 'Fait semblant de se déconnecter',
      async execute(interaction, ctx) {
        try {
          await ctx.dm.sendAsSelfbot(interaction, 'Déconnexion simulée...');
        } catch {
          await ctx.dm.safeEphemeralReply(interaction, '❌ Impossible d\'envoyer le message via le compte utilisateur.');
        }
      },
    },
    {
      category: 'troll',
      name: 'deletesend',
      description: 'Active/désactive la suppression auto des messages d\'un user',
      build: s => s.addUserOption(o => o.setName('cible').setDescription('Utilisateur cible').setRequired(true)),
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible');
        if (!target) {
          await interaction.reply({ content: '❌ Cible invalide.', ephemeral: true });
          return;
        }
        if (target.id === ctx.dm.selfbot?.user?.id) {
          await interaction.reply({ content: '❌ Tu ne peux pas te cibler toi-même.', ephemeral: true });
          return;
        }
        const isActive = ctx.trollService.isDeleteSendActive(target.id);
        if (isActive) {
          ctx.trollService.removeDeleteSend(target.id);
          await interaction.reply({ content: `✅ Deletesend désactivé pour ${target.tag}.`, ephemeral: true });
        } else {
          ctx.trollService.addDeleteSend(target.id);
          await interaction.reply({ content: `🗑️ Deletesend activé pour ${target.tag}. Ses messages seront supprimés automatiquement.`, ephemeral: true });
        }
      },
    },
    {
      category: 'troll',
      name: 'typing',
      description: 'Indicateur d\'écriture perpétuel (60s)',
      async execute(interaction, ctx) {
        if (ctx.getSilentTyping()) {
          await interaction.reply({ content: '🤫 Silent typing activé, indicateur bloqué.', ephemeral: true });
          return;
        }
        await interaction.reply({ content: '⌨️ Indicateur d\'écriture activé pendant 60s...', ephemeral: true });
        const channel = interaction.channel;
        if (channel?.isTextBased()) {
          const intervalId = setInterval(() => (channel as any).sendTyping().catch(() => {}), 8000);
          setTimeout(() => clearInterval(intervalId), 60000);
        }
        void ctx;
      },
    },
    {
      category: 'troll',
      name: 'reactroll',
      description: 'Réagit automatiquement aux messages d\'un user (toggle)',
      build: s =>
        s
          .addUserOption(o => o.setName('cible').setDescription('Victime').setRequired(true))
          .addStringOption(o => o.setName('emoji').setDescription('Emoji à réagir').setRequired(true)),
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible');
        const emoji = interaction.options.getString('emoji');
        if (!target || !emoji) {
          await interaction.reply({ content: '❌ Cible et emoji requis.', ephemeral: true });
          return;
        }
        const active = ctx.trollService.toggleReactroll(target.id, emoji);
        await interaction.reply({ content: active ? `🤖 Reactroll activé pour ${target.tag}.` : `🤖 Reactroll désactivé pour ${target.tag}.`, ephemeral: true });
      },
    },
    {
      category: 'troll',
      name: 'autoreply',
      description: 'Répond auto à un user (toggle)',
      build: s =>
        s
          .addUserOption(o => o.setName('cible').setDescription('Victime').setRequired(true))
          .addStringOption(o => o.setName('message').setDescription('Message de réponse').setRequired(true)),
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible');
        const msg = interaction.options.getString('message');
        if (!target || !msg) {
          await interaction.reply({ content: '❌ Cible et message requis.', ephemeral: true });
          return;
        }
        const active = ctx.trollService.toggleAutoreply(target.id, msg);
        await interaction.reply({ content: active ? `🤖 Autoreply activé pour ${target.tag}.` : `🤖 Autoreply désactivé pour ${target.tag}.`, ephemeral: true });
      },
    },
    {
      category: 'troll',
      name: 'dmall',
      description: 'Envoie un message à tous les membres (admin)',
      build: s => s.addStringOption(o => o.setName('message').setDescription('Message à envoyer').setRequired(true)),
      contexts: [0],
      async execute(interaction, ctx) {
        if (!interaction.guild) {
          await interaction.reply({ content: '❌ Serveur uniquement.', ephemeral: true });
          return;
        }
        if (interaction.user.id !== interaction.guild.ownerId) {
          await interaction.reply({ content: '❌ Seul le propriétaire du serveur peut utiliser cette commande.', ephemeral: true });
          return;
        }
        const msg = interaction.options.getString('message');
        if (!msg) {
          await interaction.reply({ content: '❌ Message requis.', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true });
        let members: any[] = [];
        try {
          await interaction.guild.members.fetch();
          members = Array.from(interaction.guild.members.cache.values());
        } catch {
          members = Array.from(interaction.guild.members.cache.values());
        }
        let sent = 0;
        for (const member of members) {
          if (!member.id || member.user?.bot) continue;
          try {
            await member.send(`**Message de ${interaction.guild.name}:**\n${msg}`);
            sent++;
            await new Promise(r => setTimeout(r, 400 + Math.random() * 200));
          } catch {
            // MP fermés
          }
        }
        await interaction.editReply({ content: `✅ Message envoyé à ${sent} membres!` });
        void ctx;
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}

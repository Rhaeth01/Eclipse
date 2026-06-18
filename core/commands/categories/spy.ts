import { EmbedBuilder } from 'discord.js';
import type { CommandRegistry, SubcommandDef, ContextMenuDef } from '../CommandRegistry';

export function registerSpy(registry: CommandRegistry): void {
  registry.describeCategory('spy', 'Surveillance et espionnage');

  const defs: SubcommandDef[] = [
    {
      category: 'spy',
      name: 'toggle',
      description: 'Active/désactive la surveillance d\'un utilisateur',
      build: s => s.addUserOption(o => o.setName('cible').setDescription('Personne à surveiller').setRequired(true)),
      contexts: [0],
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible');
        if (!target || !interaction.guild) {
          await interaction.reply({ content: '❌ Cible requise (serveur uniquement).', ephemeral: true });
          return;
        }
        const isSpying = ctx.spyService.isTargetActive(target.id, interaction.guild.id);
        if (isSpying) {
          ctx.spyService.removeTarget(target.id, interaction.guild.id);
          await interaction.reply({ content: `👁️ Surveillance arrêtée pour ${target.tag}.`, ephemeral: true });
        } else {
          ctx.spyService.addTarget(target.id, interaction.guild.id);
          await interaction.reply({ content: `👁️ Surveillance activée pour ${target.tag} dans ce serveur.`, ephemeral: true });
        }
      },
    },
    {
      category: 'spy',
      name: 'list',
      description: 'Liste les cibles surveillées',
      async execute(interaction, ctx) {
        const targets = ctx.spyService.getTargets();
        if (targets.size === 0) {
          await interaction.reply({ content: '👁️ Aucune cible surveillée.', ephemeral: true });
          return;
        }
        let text = '**👁️ Cibles surveillées**\n\n';
        for (const [userId, guilds] of targets) {
          text += `• <@${userId}> — ${guilds.size} serveur(s)\n`;
        }
        await interaction.reply({ content: text, ephemeral: true });
      },
    },
    {
      category: 'spy',
      name: 'remove',
      description: 'Arrête la surveillance d\'un utilisateur',
      build: s => s.addUserOption(o => o.setName('cible').setDescription('Cible à ne plus surveiller').setRequired(true)),
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible');
        if (!target) {
          await interaction.reply({ content: '❌ Cible requise.', ephemeral: true });
          return;
        }
        const guilds = ctx.spyService.getUserGuilds(target.id);
        if (!guilds || guilds.size === 0) {
          await interaction.reply({ content: `👁️ ${target.tag} n'était pas surveillé.`, ephemeral: true });
          return;
        }
        for (const g of guilds) ctx.spyService.removeTarget(target.id, g);
        await interaction.reply({ content: `👁️ Surveillance arrêtée pour ${target.tag}.`, ephemeral: true });
      },
    },
    {
      category: 'spy',
      name: 'clear',
      description: 'Arrête toute surveillance',
      async execute(interaction, ctx) {
        ctx.spyService.clear();
        await interaction.reply({ content: '👁️ Toutes les cibles effacées.', ephemeral: true });
      },
    },
    {
      category: 'spy',
      name: 'snipe',
      description: 'Dernier message supprimé dans ce salon',
      async execute(interaction, ctx) {
        const snipe = ctx.dm.snipeCache.get(interaction.channelId);
        if (!snipe) {
          await interaction.reply({ content: '❌ Aucun message à snipe.', ephemeral: true });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('🎯 Message supprimé')
          .setDescription(snipe.content)
          .setFooter({ text: `Par ${snipe.author}` })
          .setTimestamp(snipe.timestamp)
          .setColor(0x5865F2);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
    {
      category: 'spy',
      name: 'editsnipe',
      description: 'Dernier message édité dans ce salon',
      async execute(interaction, ctx) {
        const editSnipe = ctx.dm.editsnipeCache.get(interaction.channelId);
        if (!editSnipe) {
          await interaction.reply({ content: '❌ Aucun message à editsnipe.', ephemeral: true });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle('✏️ Message édité')
          .setDescription(editSnipe.oldContent)
          .setFooter({ text: `Par ${editSnipe.author}` })
          .setTimestamp(editSnipe.timestamp)
          .setColor(0x57F287);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
  ];

  for (const d of defs) registry.sub(d);

  // Menus contextuels utilisateur
  const ghostpingMenu: ContextMenuDef = {
    type: 'user',
    name: 'Ghostping',
    async execute(interaction, ctx) {
      const targetUser = (interaction as any).targetUser;
      const channel = interaction.channel;
      if (!channel || !('send' in channel)) {
        await interaction.reply({ content: '❌ Canal invalide.', ephemeral: true });
        return;
      }
      try {
        const ghostMsg = await (channel as any).send(`${targetUser}`);
        if (ghostMsg) {
          await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
          await ghostMsg.delete().catch(() => {});
          await interaction.reply({ content: `👻 Ghostping envoyé à ${targetUser.tag}`, ephemeral: true });
        }
      } catch {
        await interaction.reply({ content: '❌ Impossible d\'envoyer le ghostping.', ephemeral: true });
      }
      void ctx;
    },
  };
  registry.menu(ghostpingMenu);

  const spyUserMenu: ContextMenuDef = {
    type: 'user',
    name: 'Spy User',
    async execute(interaction, ctx) {
      const targetUser = (interaction as any).targetUser;
      if (!interaction.guild) {
        await interaction.reply({ content: '❌ Serveur uniquement.', ephemeral: true });
        return;
      }
      const isSpying = ctx.spyService.isTargetActive(targetUser.id, interaction.guild.id);
      if (isSpying) {
        ctx.spyService.removeTarget(targetUser.id, interaction.guild.id);
        await interaction.reply({ content: `👁️ Surveillance arrêtée pour ${targetUser.tag}.`, ephemeral: true });
      } else {
        ctx.spyService.addTarget(targetUser.id, interaction.guild.id);
        await interaction.reply({ content: `👁️ Surveillance activée pour ${targetUser.tag} dans ce serveur.`, ephemeral: true });
      }
    },
  };
  registry.menu(spyUserMenu);

  // Menus contextuels message
  const translateMenu: ContextMenuDef = {
    type: 'message',
    name: 'Translate',
    async execute(interaction, ctx) {
      const targetMessage = (interaction as any).targetMessage;
      const content = targetMessage?.content || '';
      if (!content) {
        await interaction.reply({ content: '❌ Aucun texte à traduire.', ephemeral: true });
        return;
      }
      try {
        const encoded = encodeURIComponent(content);
        const url = `https://translate.googleapis.com/translate_a/single?client=gtx&sl=auto&tl=fr&dt=t&q=${encoded}`;
        const res = await fetch(url);
        const data = (await res.json()) as any;
        const translated = data?.[0]?.map((s: any) => s[0]).join('') || content;
        await interaction.reply({ content: `🌐 **Traduit (→fr)**: ${translated}`, ephemeral: true });
      } catch {
        await interaction.reply({ content: '❌ Erreur de traduction.', ephemeral: true });
      }
      void ctx;
    },
  };
  registry.menu(translateMenu);

  const copyRawMenu: ContextMenuDef = {
    type: 'message',
    name: 'Copy Raw',
    async execute(interaction, _ctx) {
      const targetMessage = (interaction as any).targetMessage;
      const content = targetMessage?.content || '(contenu vide)';
      await interaction.reply({ content: `📋 Contenu brut:\n\`\`\`\n${content.slice(0, 1800)}\n\`\`\``, ephemeral: true });
    },
  };
  registry.menu(copyRawMenu);
}

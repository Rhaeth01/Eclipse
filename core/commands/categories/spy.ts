import { EmbedBuilder } from 'discord.js';
import type { CommandRegistry, SubcommandDef, ContextMenuDef } from '../CommandRegistry';
import { steps } from '../../shared/constants';

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
      if (!ctx.dm.selfbot || !interaction.channelId) {
        await interaction.reply({ content: '❌ Selfbot non connecté.', ephemeral: true });
        return;
      }
      try {
        const sbChannel = await ctx.dm.selfbot.channels.fetch(interaction.channelId);
        if (!sbChannel || !sbChannel.isText()) throw new Error('Canal invalide');
        const ghostMsg = await sbChannel.send(`${targetUser}`);
        if (ghostMsg) {
          await new Promise(r => setTimeout(r, 500 + Math.random() * 1000));
          await ghostMsg.delete().catch(() => {});
          await interaction.reply({ content: `👻 Ghostping envoyé à ${targetUser.tag}`, ephemeral: true });
        }
      } catch {
        await interaction.reply({ content: '❌ Impossible d\'envoyer le ghostping.', ephemeral: true });
      }
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

  const invisiblePingMenu: ContextMenuDef = {
    type: 'user',
    name: 'Invisible Ping',
    async execute(interaction, ctx) {
      const targetUser = (interaction as any).targetUser;
      if (!ctx.dm.selfbot || !interaction.channelId) {
        await interaction.reply({ content: '❌ Selfbot non connecté.', ephemeral: true });
        return;
      }
      try {
        const sbChannel = await ctx.dm.selfbot.channels.fetch(interaction.channelId);
        if (!sbChannel || !sbChannel.isText()) throw new Error('Canal invalide');
        // "Invisible ping" (silent mention) : la cible voit le highlight (le
        // client rend `<@id>` comme @pseudo + couleur mention) mais zéro
        // notification (flags: 4096 SUPPRESS_NOTIFICATIONS + allowed_mentions
        // vide). Indétectable par l'anti-spam selfbot contrairement à la
        // technique ZWSP qui déclenchait une vraie notification.
        await sbChannel.send({
          content: `<@${targetUser.id}>`,
          allowed_mentions: { parse: [], users: [], roles: [], replied_user: false },
          flags: 4096,
        });
        await interaction.reply({ content: `👻 Mention fantôme envoyée à ${targetUser.tag}`, ephemeral: true });
      } catch {
        await interaction.reply({ content: "❌ Impossible d'envoyer la mention fantôme.", ephemeral: true });
      }
    },
  };
  registry.menu(invisiblePingMenu);

  // ── USER menus: info ───────────────────────────────────────────────────
  const userInfoMenu: ContextMenuDef = {
    type: 'user',
    name: 'User Info',
    async execute(interaction, _ctx) {
      const targetUser = (interaction as any).targetUser;
      const member = interaction.guild?.members?.cache?.get?.(targetUser.id);
      const embed = new EmbedBuilder()
        .setTitle(`👤 ${targetUser.tag}`)
        .setThumbnail(targetUser.displayAvatarURL?.() ?? targetUser.avatarURL?.())
        .addFields(
          { name: 'ID', value: targetUser.id, inline: true },
          { name: 'Créé le', value: `<t:${Math.floor((targetUser.createdTimestamp ?? Date.now()) / 1000)}:R>`, inline: true },
          { name: 'Bot', value: targetUser.bot ? 'Oui' : 'Non', inline: true }
        )
        .setColor(0x5865F2);
      if (member) {
        embed.addFields(
          { name: 'Rejoint le', value: `<t:${Math.floor((member.joinedTimestamp ?? 0) / 1000)}:R>`, inline: true },
          { name: 'Rôles', value: `${(member.roles?.cache?.size ?? 1) - 1} rôles`, inline: true }
        );
      }
      await interaction.reply({ embeds: [embed], ephemeral: true });
    },
  };
  registry.menu(userInfoMenu);

  const viewAvatarMenu: ContextMenuDef = {
    type: 'user',
    name: 'View Avatar',
    async execute(interaction, _ctx) {
      const targetUser = (interaction as any).targetUser;
      const url = targetUser.displayAvatarURL?.({ size: 4096 }) ?? targetUser.avatarURL?.({ size: 4096 });
      if (!url) {
        await interaction.reply({ content: '❌ Avatar introuvable.', ephemeral: true });
        return;
      }
      const embed = new EmbedBuilder()
        .setTitle(`🖼️ Avatar de ${targetUser.tag}`)
        .setImage(url)
        .setColor(0x5865F2);
      await interaction.reply({ embeds: [embed], ephemeral: true });
    },
  };
  registry.menu(viewAvatarMenu);

  // ── USER menus: troll ──────────────────────────────────────────────────
  const hackUserMenu: ContextMenuDef = {
    type: 'user',
    name: 'Hack User',
    async execute(interaction, ctx) {
      const targetUser = (interaction as any).targetUser;
      try {
        const msg = await ctx.dm.sendAsSelfbot(interaction, `🕵️ **HACKING ${targetUser.username.toUpperCase()}...**`);
        for (const step of steps) {
          await new Promise(r => setTimeout(r, 1500));
          await msg.edit(step).catch(() => {});
        }
        await new Promise(r => setTimeout(r, 1000));
        await msg
          .edit(`🎉 **${targetUser.username}** a été hacké avec succès!\n📧 Email: ${targetUser.username.toLowerCase()}@hacked.com\n🔑 Password: ${'x'.repeat(10)}\n💰 Solde: 0.00$ (pauvre!)`)
          .catch(() => {});
      } catch {
        await interaction.reply({ content: "❌ Impossible d'envoyer le message via le compte utilisateur.", ephemeral: true });
      }
    },
  };
  registry.menu(hackUserMenu);

  const toggleDeleteSendMenu: ContextMenuDef = {
    type: 'user',
    name: 'Toggle DeleteSend',
    async execute(interaction, ctx) {
      const targetUser = (interaction as any).targetUser;
      if (targetUser.id === ctx.dm.selfbot?.user?.id) {
        await interaction.reply({ content: '❌ Tu ne peux pas te cibler toi-même.', ephemeral: true });
        return;
      }
      const isActive = ctx.trollService.isDeleteSendActive(targetUser.id);
      if (isActive) {
        ctx.trollService.removeDeleteSend(targetUser.id);
        await interaction.reply({ content: `🗑️ Deletesend désactivé pour ${targetUser.tag}.`, ephemeral: true });
      } else {
        ctx.trollService.addDeleteSend(targetUser.id);
        await interaction.reply({ content: `🗑️ Deletesend activé pour ${targetUser.tag}. Ses messages seront supprimés automatiquement.`, ephemeral: true });
      }
    },
  };
  registry.menu(toggleDeleteSendMenu);

  // ── USER menus: admin ──────────────────────────────────────────────────
  const kickUserMenu: ContextMenuDef = {
    type: 'user',
    name: 'Kick User',
    async execute(interaction, ctx) {
      const targetUser = (interaction as any).targetUser;
      if (!interaction.guild) {
        await interaction.reply({ content: '❌ Serveur uniquement.', ephemeral: true });
        return;
      }
      if (targetUser.id === ctx.dm.selfbot?.user?.id) {
        await interaction.reply({ content: '❌ Tu ne peux pas te kicker toi-même.', ephemeral: true });
        return;
      }
      try {
        await ctx.dm.kickMember(interaction.guild.id, targetUser.id, 'Via context menu Eclipse');
        await interaction.reply({ content: `👢 <@${targetUser.id}> expulsé.`, ephemeral: true });
      } catch {
        await interaction.reply({ content: '❌ Permissions insuffisantes.', ephemeral: true });
      }
    },
  };
  registry.menu(kickUserMenu);

  const banUserMenu: ContextMenuDef = {
    type: 'user',
    name: 'Ban User',
    async execute(interaction, ctx) {
      const targetUser = (interaction as any).targetUser;
      if (!interaction.guild) {
        await interaction.reply({ content: '❌ Serveur uniquement.', ephemeral: true });
        return;
      }
      if (targetUser.id === ctx.dm.selfbot?.user?.id) {
        await interaction.reply({ content: '❌ Tu ne peux pas te bannir toi-même.', ephemeral: true });
        return;
      }
      try {
        await ctx.dm.banMember(interaction.guild.id, targetUser.id, 'Via context menu Eclipse');
        await interaction.reply({ content: `🔨 <@${targetUser.id}> banni.`, ephemeral: true });
      } catch {
        await interaction.reply({ content: '❌ Permissions insuffisantes.', ephemeral: true });
      }
    },
  };
  registry.menu(banUserMenu);

  // ── MESSAGE menus: text transformations ───────────────────────────────
  const mockTextMenu: ContextMenuDef = {
    type: 'message',
    name: 'Mock Text',
    async execute(interaction, ctx) {
      const targetMessage = (interaction as any).targetMessage;
      const text = targetMessage?.content || '';
      if (!text) {
        await interaction.reply({ content: '❌ Aucun texte à mocker.', ephemeral: true });
        return;
      }
      let mocked = '';
      for (let i = 0; i < text.length; i++) mocked += i % 2 === 0 ? text[i].toLowerCase() : text[i].toUpperCase();
      await ctx.dm.stealthReply(interaction, mocked);
    },
  };
  registry.menu(mockTextMenu);

  const reverseTextMenu: ContextMenuDef = {
    type: 'message',
    name: 'Reverse Text',
    async execute(interaction, ctx) {
      const targetMessage = (interaction as any).targetMessage;
      const text = targetMessage?.content || '';
      if (!text) {
        await interaction.reply({ content: '❌ Aucun texte à inverser.', ephemeral: true });
        return;
      }
      const reversed = text.split('').reverse().join('');
      await ctx.dm.stealthReply(interaction, `🔄 ${reversed}`);
    },
  };
  registry.menu(reverseTextMenu);

  // Menus contextuels message existants (Translate, Copy Raw)
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

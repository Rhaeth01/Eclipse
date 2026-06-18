import { EmbedBuilder } from 'discord.js';
import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';

export function registerInfo(registry: CommandRegistry): void {
  registry.describeCategory('info', 'Informations et lookup');

  const defs: SubcommandDef[] = [
    {
      category: 'info',
      name: 'userinfo',
      description: 'Infos utilisateur',
      build: s => s.addUserOption(o => o.setName('cible').setDescription('Cible').setRequired(false)),
      async execute(interaction) {
        const target = interaction.options.getUser('cible') || interaction.user;
        const member = interaction.guild?.members.cache.get(target.id);
        const embed = new EmbedBuilder()
          .setTitle(`👤 ${target.tag}`)
          .setThumbnail(target.displayAvatarURL())
          .addFields(
            { name: 'ID', value: target.id, inline: true },
            { name: 'Créé le', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
            { name: 'Bot', value: target.bot ? 'Oui' : 'Non', inline: true }
          )
          .setColor(0x5865F2);
        if (member) {
          embed.addFields(
            { name: 'Rejoint le', value: `<t:${Math.floor((member.joinedTimestamp || 0) / 1000)}:R>`, inline: true },
            { name: 'Rôles', value: `${member.roles.cache.size - 1} rôles`, inline: true }
          );
        }
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
    {
      category: 'info',
      name: 'avatar',
      description: 'Avatar utilisateur',
      build: s => s.addUserOption(o => o.setName('cible').setDescription('Cible').setRequired(false)),
      async execute(interaction) {
        const target = interaction.options.getUser('cible') || interaction.user;
        const embed = new EmbedBuilder()
          .setTitle(`🖼️ Avatar de ${target.tag}`)
          .setImage(target.displayAvatarURL({ size: 4096 }))
          .setColor(0x5865F2);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
    {
      category: 'info',
      name: 'serverinfo',
      description: 'Infos du serveur',
      build: s => s.addStringOption(o => o.setName('guild_id').setDescription('ID du serveur (requis en DM)').setRequired(false)),
      async execute(interaction) {
        const targetGuildId = interaction.options.getString('guild_id') || interaction.guildId;
        if (!targetGuildId) {
          await interaction.reply({ content: '❌ ID du serveur requis en DM.', ephemeral: true });
          return;
        }
        const guild = interaction.client.guilds.cache.get(targetGuildId);
        if (!guild) {
          await interaction.reply({ content: '❌ Serveur introuvable dans le cache.', ephemeral: true });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle(`🏰 ${guild.name}`)
          .setThumbnail(guild.iconURL())
          .addFields(
            { name: 'ID', value: guild.id, inline: true },
            { name: 'Membres', value: `${guild.memberCount}`, inline: true },
            { name: 'Créé le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
            { name: 'Propriétaire', value: `<@${guild.ownerId}>`, inline: true },
            { name: 'Salons', value: `${guild.channels.cache.size}`, inline: true }
          )
          .setColor(0x5865F2);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
    {
      category: 'info',
      name: 'stats',
      description: 'Statistiques du compte',
      async execute(interaction, ctx) {
        const selfbot = ctx.dm.selfbot;
        const user = selfbot?.user;
        if (!user || !selfbot) {
          await interaction.reply({ content: '❌ Selfbot non connecté.', ephemeral: true });
          return;
        }
        const guilds = selfbot.guilds.cache.size;
        const friendsRel = (selfbot as any).relationships;
        let friends = 0;
        if (friendsRel?.friendCache) friends = friendsRel.friendCache.size;
        else if (friendsRel?.cache) friends = friendsRel.cache.filter((r: any) => r === 1 || r.type === 1).size;
        const text = `**📊 Statistiques**\n\n👤 Nom: ${user.tag}\n🆔 ID: ${user.id}\n📅 Créé: <t:${Math.floor(user.createdTimestamp / 1000)}:R>\n🏰 Serveurs: ${guilds}\n👥 Amis: ${friends}`.trim();
        await interaction.reply({ content: text, ephemeral: true });
      },
    },
    {
      category: 'info',
      name: 'roleinfo',
      description: 'Infos sur un rôle',
      build: s => s.addRoleOption(o => o.setName('role').setDescription('Rôle').setRequired(true)),
      contexts: [0],
      async execute(interaction) {
        const role = interaction.options.getRole('role');
        if (!role) {
          await interaction.reply({ content: '❌ Rôle requis.', ephemeral: true });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle(`🛡️ ${role.name}`)
          .addFields(
            { name: 'ID', value: role.id, inline: true },
            { name: 'Couleur', value: `#${(role as any).color?.toString(16).padStart(6, '0') || '000000'}`, inline: true },
            { name: 'Position', value: `${(role as any).position ?? '?'}`, inline: true },
            { name: 'Membres', value: `${(role as any).members?.size ?? '?'}`, inline: true }
          )
          .setColor((role as any).color || 0x5865F2);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
    {
      category: 'info',
      name: 'channelinfo',
      description: 'Infos sur un salon',
      build: s => s.addChannelOption(o => o.setName('salon').setDescription('Salon').setRequired(true)),
      contexts: [0],
      async execute(interaction) {
        const channel = interaction.options.getChannel('salon') as any;
        if (!channel) {
          await interaction.reply({ content: '❌ Salon requis.', ephemeral: true });
          return;
        }
        const embed = new EmbedBuilder()
          .setTitle(`💬 ${channel.name}`)
          .addFields(
            { name: 'ID', value: channel.id, inline: true },
            { name: 'Type', value: `${channel.type}`, inline: true },
            { name: 'Catégorie', value: channel.parent ? `<#${channel.parent.id}>` : 'Aucune', inline: true },
            { name: 'Créé le', value: `<t:${Math.floor((channel.createdTimestamp || 0) / 1000)}:R>`, inline: true }
          )
          .setColor(0x5865F2);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
    {
      category: 'info',
      name: 'servericon',
      description: 'Icône du serveur',
      contexts: [0],
      async execute(interaction) {
        const guild = interaction.guild;
        if (!guild) {
          await interaction.reply({ content: '❌ Serveur uniquement.', ephemeral: true });
          return;
        }
        const icon = guild.iconURL({ size: 4096 });
        if (!icon) {
          await interaction.reply({ content: '❌ Ce serveur n\'a pas d\'icône.', ephemeral: true });
          return;
        }
        const embed = new EmbedBuilder().setTitle(`🖼️ Icône de ${guild.name}`).setImage(icon).setColor(0x5865F2);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
    {
      category: 'info',
      name: 'banner',
      description: 'Bannière d\'un utilisateur',
      build: s => s.addUserOption(o => o.setName('cible').setDescription('Cible').setRequired(false)),
      async execute(interaction) {
        const target = interaction.options.getUser('cible') || interaction.user;
        const banner = (target as any).bannerURL?.({ size: 4096 }) ?? null;
        if (!banner) {
          await interaction.reply({ content: `❌ ${target.tag} n'a pas de bannière.`, ephemeral: true });
          return;
        }
        const embed = new EmbedBuilder().setTitle(`🖼️ Bannière de ${target.tag}`).setImage(banner).setColor(0x5865F2);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
    {
      category: 'info',
      name: 'emoteinfo',
      description: 'Infos sur un emoji',
      build: s => s.addStringOption(o => o.setName('emoji').setDescription('Emoji (custom)').setRequired(true)),
      contexts: [0],
      async execute(interaction) {
        const emojiStr = interaction.options.getString('emoji');
        if (!emojiStr) {
          await interaction.reply({ content: '❌ Emoji requis.', ephemeral: true });
          return;
        }
        const match = emojiStr.match(/<a?:(\w+):(\d+)>/);
        if (!match) {
          await interaction.reply({ content: '❌ Emoji custom invalide. Format: `<:nom:id>`', ephemeral: true });
          return;
        }
        const [, name, id] = match;
        const animated = emojiStr.startsWith('<a:');
        const url = `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=256`;
        const embed = new EmbedBuilder()
          .setTitle(`😀 ${name}`)
          .addFields(
            { name: 'ID', value: id, inline: true },
            { name: 'Animé', value: animated ? 'Oui' : 'Non', inline: true }
          )
          .setImage(url)
          .setColor(0x5865F2);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}

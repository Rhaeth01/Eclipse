import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';
import { buildEclipseEmbed, ECLIPSE_COLOR, ECLIPSE_ERROR_COLOR, eclipseAck } from '../../shared/embeds';

export function registerInfo(registry: CommandRegistry): void {
  registry.describeCategory('info', 'Informations et lookup');

  const defs: SubcommandDef[] = [
    {
      category: 'info',
      name: 'userinfo',
      description: 'Infos utilisateur',
      build: s => s.addUserOption(o => o.setName('cible').setDescription('Cible').setRequired(false)),
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible') || interaction.user;
        const selfbotGuild = interaction.guildId
          ? ctx.dm.selfbot?.guilds?.cache?.get(interaction.guildId)
          : null;
        const member = selfbotGuild?.members?.cache?.get(target.id)
          ?? interaction.guild?.members?.cache?.get(target.id);
        const fields = [
          { name: 'ID', value: target.id, inline: true },
          { name: 'Créé le', value: `<t:${Math.floor(target.createdTimestamp / 1000)}:R>`, inline: true },
          { name: 'Bot', value: target.bot ? 'Oui' : 'Non', inline: true },
        ];
        if (member) {
          fields.push(
            { name: 'Rejoint le', value: `<t:${Math.floor((member.joinedTimestamp || 0) / 1000)}:R>`, inline: true },
            { name: 'Rôles', value: `${member.roles.cache.size - 1} rôles`, inline: true },
          );
        }
        const embed = buildEclipseEmbed({
          title: `👤 ${target.tag}`,
          thumbnail: target.displayAvatarURL(),
          fields,
        }, interaction);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
    {
      category: 'info',
      name: 'avatar',
      description: 'Avatar utilisateur',
      build: s => s.addUserOption(o => o.setName('cible').setDescription('Cible').setRequired(false)),
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible') || interaction.user;
        const selfbotGuild = interaction.guildId
          ? ctx.dm.selfbot?.guilds?.cache?.get(interaction.guildId)
          : null;
        const member = selfbotGuild?.members?.cache?.get(target.id);
        const serverAvatar = member?.displayAvatarURL?.({ size: 4096 });
        const avatarUrl = serverAvatar && serverAvatar.length > 0
          ? serverAvatar
          : target.displayAvatarURL({ size: 4096 });
        const embed = buildEclipseEmbed({
          title: `🖼️ Avatar de ${target.tag}`,
          image: avatarUrl,
          footerText: serverAvatar && serverAvatar.length > 0 ? 'Avatar spécifique à ce serveur' : undefined,
        }, interaction);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
    {
      category: 'info',
      name: 'serverinfo',
      description: 'Infos du serveur',
      build: s => s.addStringOption(o => o.setName('guild_id').setDescription('ID du serveur (requis en DM)').setRequired(false)),
      async execute(interaction, ctx) {
        const targetGuildId =
          interaction.options.getString('guild_id') ||
          interaction.guildId ||
          interaction.guild?.id;
        if (!targetGuildId) {
          await interaction.reply(eclipseAck('❌ ID du serveur requis en DM.', interaction, true));
          return;
        }
        let guild: any = null;
        if (interaction.guild?.id === targetGuildId) guild = interaction.guild;
        if (!guild) guild = ctx.dm.selfbot?.guilds?.cache?.get(targetGuildId);
        if (!guild) guild = interaction.client?.guilds?.cache?.get?.(targetGuildId);
        if (!guild) {
          await interaction.reply(eclipseAck('❌ Serveur introuvable (ni le selfbot ni l\'App Bot ne le connaissent).', interaction, true));
          return;
        }
        const embed = buildEclipseEmbed({
          title: `🏰 ${guild.name}`,
          thumbnail: guild.iconURL() ?? null,
          fields: [
            { name: 'ID', value: guild.id, inline: true },
            { name: 'Membres', value: `${guild.memberCount}`, inline: true },
            { name: 'Créé le', value: `<t:${Math.floor(guild.createdTimestamp / 1000)}:R>`, inline: true },
            { name: 'Propriétaire', value: `<@${guild.ownerId}>`, inline: true },
            { name: 'Salons', value: `${guild.channels.cache.size}`, inline: true },
          ],
        }, interaction);
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
          await interaction.reply(eclipseAck('❌ Selfbot non connecté.', interaction, true));
          return;
        }
        const guilds = selfbot.guilds.cache.size;
        const friendsRel = (selfbot as any).relationships;
        let friends = 0;
        if (friendsRel?.friendCache) friends = friendsRel.friendCache.size;
        else if (friendsRel?.cache) friends = friendsRel.cache.filter((r: any) => r === 1 || r.type === 1).size;
        const embed = buildEclipseEmbed({
          title: `📊 ${user.tag}`,
          thumbnail: user.displayAvatarURL?.() ?? null,
          fields: [
            { name: 'ID', value: user.id, inline: true },
            { name: 'Créé le', value: `<t:${Math.floor(user.createdTimestamp / 1000)}:R>`, inline: true },
            { name: 'Serveurs', value: `${guilds}`, inline: true },
            { name: 'Amis', value: `${friends}`, inline: true },
          ],
        }, interaction);
        await interaction.reply({ embeds: [embed], ephemeral: true });
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
          await interaction.reply(eclipseAck('❌ Rôle requis.', interaction, true));
          return;
        }
        const memberCount = (role as any).members?.size ?? '?';
        const embed = buildEclipseEmbed({
          title: `🛡️ ${role.name}`,
          fields: [
            { name: 'ID', value: role.id, inline: true },
            { name: 'Couleur', value: `#${(role as any).color?.toString(16).padStart(6, '0') || '000000'}`, inline: true },
            { name: 'Position', value: `${(role as any).position ?? '?'}`, inline: true },
            { name: 'Membres', value: `${memberCount}`, inline: true },
          ],
          color: (role as any).color || ECLIPSE_COLOR,
        }, interaction);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
    {
      category: 'info',
      name: 'channelinfo',
      description: 'Infos sur un salon',
      build: s => s.addChannelOption(o => o.setName('salon').setDescription('Salon').setRequired(true)),
      contexts: [0],
      async execute(interaction, ctx) {
        const channel = interaction.options.getChannel('salon') as any;
        if (!channel) {
          await interaction.reply(eclipseAck('❌ Salon requis.', interaction, true));
          return;
        }
        const selfbotChannel = ctx.dm.selfbot?.channels?.cache?.get?.(channel.id);
        const channelType = selfbotChannel?.type ?? channel.type;
        const embed = buildEclipseEmbed({
          title: `💬 ${channel.name}`,
          fields: [
            { name: 'ID', value: channel.id, inline: true },
            { name: 'Type', value: `${channelType}`, inline: true },
            { name: 'Catégorie', value: channel.parent ? `<#${channel.parent.id}>` : 'Aucune', inline: true },
            { name: 'Créé le', value: `<t:${Math.floor((channel.createdTimestamp || 0) / 1000)}:R>`, inline: true },
          ],
        }, interaction);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
    {
      category: 'info',
      name: 'servericon',
      description: 'Icône du serveur',
      contexts: [0],
      async execute(interaction, ctx) {
        const guild = interaction.guild;
        if (!guild) {
          await interaction.reply(eclipseAck('❌ Serveur uniquement.', interaction, true));
          return;
        }
        const selfbotGuild = ctx.dm.selfbot?.guilds?.cache?.get?.(guild.id);
        const icon = selfbotGuild?.iconURL?.() ?? guild.iconURL({ size: 4096 });
        if (!icon) {
          await interaction.reply(eclipseAck('❌ Ce serveur n\'a pas d\'icône.', interaction, true));
          return;
        }
        const embed = buildEclipseEmbed({ title: `🖼️ Icône de ${guild.name}`, image: icon }, interaction);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
    {
      category: 'info',
      name: 'banner',
      description: 'Bannière d\'un utilisateur',
      build: s => s.addUserOption(o => o.setName('cible').setDescription('Cible').setRequired(false)),
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible') || interaction.user;
        const selfbotUser = ctx.dm.selfbot?.users?.cache?.get?.(target.id);
        const selfbotBanner = selfbotUser && (selfbotUser as any).bannerURL
          ? (selfbotUser as any).bannerURL({ size: 4096 })
          : null;
        const banner = selfbotBanner ?? (target as any).bannerURL?.({ size: 4096 }) ?? null;
        if (!banner) {
          await interaction.reply(eclipseAck(`❌ ${target.tag} n'a pas de bannière.`, interaction, true));
          return;
        }
        const embed = buildEclipseEmbed({ title: `🖼️ Bannière de ${target.tag}`, image: banner }, interaction);
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
          await interaction.reply(eclipseAck('❌ Emoji requis.', interaction, true));
          return;
        }
        const match = emojiStr.match(/<a?:(\w+):(\d+)>/);
        if (!match) {
          await interaction.reply(eclipseAck('❌ Emoji custom invalide. Format: `<:nom:id>`', interaction, true));
          return;
        }
        const [, name, id] = match;
        const animated = emojiStr.startsWith('<a:');
        const url = `https://cdn.discordapp.com/emojis/${id}.${animated ? 'gif' : 'png'}?size=256`;
        const embed = buildEclipseEmbed({
          title: `😀 ${name}`,
          fields: [
            { name: 'ID', value: id, inline: true },
            { name: 'Animé', value: animated ? 'Oui' : 'Non', inline: true },
          ],
          image: url,
        }, interaction);
        await interaction.reply({ embeds: [embed], ephemeral: true });
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}

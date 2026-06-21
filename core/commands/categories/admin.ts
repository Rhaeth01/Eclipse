import { SlashCommandSubcommandBuilder, PermissionFlagsBits } from 'discord.js';
import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';

export function registerAdmin(registry: CommandRegistry): void {
  registry.describeCategory('admin', 'Commandes de modération');

  const defs: SubcommandDef[] = [
    {
      category: 'admin',
      name: 'clear',
      description: 'Supprime vos messages',
      build: s => s.addIntegerOption(o => o.setName('count').setDescription('Nombre (défaut: 10)').setRequired(false)),
      contexts: [0, 1, 2],
      async execute(interaction, ctx) {
        const count = interaction.options.getInteger('count') || 10;
        await interaction.reply({ content: `🔄 Suppression de ${count} messages...`, ephemeral: true });
        const channel = interaction.channel;
        if (channel?.isTextBased()) {
          const messages = await channel.messages.fetch({ limit: 100 });
          const myMessages = messages.filter(m => m.author.id === ctx.dm.selfbot?.user?.id).first(count);
          for (const m of myMessages) {
            await m.delete().catch(() => {});
            await new Promise(r => setTimeout(r, 600));
          }
          await interaction.editReply({ content: `✅ ${myMessages.length} messages supprimés.` });
        }
      },
    },
    {
      category: 'admin',
      name: 'purge',
      description: 'Supprime des messages par catégorie',
      build: s =>
        s
          .addStringOption(o =>
            o
              .setName('type')
              .setDescription('Type de messages')
              .addChoices(
                { name: 'Tous', value: 'all' },
                { name: 'Bots', value: 'bots' },
                { name: 'Embeds', value: 'embeds' },
                { name: 'Images', value: 'images' }
              )
              .setRequired(true)
          )
          .addIntegerOption(o => o.setName('count').setDescription('Nombre (défaut: 50)').setRequired(false)),
      contexts: [0],
      permissions: PermissionFlagsBits.ManageMessages,
      async execute(interaction, _ctx) {
        const purgeType = interaction.options.getString('type') || 'all';
        const count = interaction.options.getInteger('count') || 50;
        const channel = interaction.channel;
        if (!channel?.isTextBased()) {
          await interaction.reply({ content: '❌ Canal invalide.', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
          const messages = await channel.messages.fetch({ limit: count });
          let toDelete: any[] = [];
          if (purgeType === 'all') toDelete = [...messages.values()];
          else if (purgeType === 'bots') toDelete = messages.filter((m: any) => m.author.bot).toJSON();
          else if (purgeType === 'embeds') toDelete = messages.filter((m: any) => m.embeds.length > 0).toJSON();
          else if (purgeType === 'images') toDelete = messages.filter((m: any) => m.attachments.size > 0).toJSON();
          for (const msg of toDelete) {
            await msg.delete().catch(() => {});
            await new Promise(r => setTimeout(r, 200));
          }
          await interaction.editReply({ content: `✅ ${toDelete.length} messages supprimés (${purgeType}).` });
        } catch {
          await interaction.editReply({ content: '❌ Erreur de purge.' });
        }
      },
    },
    {
      category: 'admin',
      name: 'role',
      description: 'Donne ou retire un rôle',
      build: s =>
        s
          .addUserOption(o => o.setName('cible').setDescription('Utilisateur cible').setRequired(true))
          .addRoleOption(o => o.setName('role').setDescription('Rôle à donner/retirer').setRequired(true)),
      contexts: [0],
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible');
        const role = interaction.options.getRole('role');
        if (!target || !role) {
          await interaction.reply({ content: '❌ Arguments requis.', ephemeral: true });
          return;
        }
        const member = interaction.guild?.members.cache.get(target.id);
        if (!member) {
          await interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        try {
          if (member.roles.cache.has(role.id)) {
            await (member.roles as any).remove(role);
            await interaction.editReply({ content: `🔓 Rôle ${role.name} retiré à ${target.username}` });
          } else {
            await (member.roles as any).add(role);
            await interaction.editReply({ content: `🔒 Rôle ${role.name} ajouté à ${target.username}` });
          }
        } catch {
          await interaction.editReply({ content: '❌ Permissions insuffisantes.' }).catch(() => {});
        }
      },
    },
    {
      category: 'admin',
      name: 'kick',
      description: 'Expulse un membre',
      build: s =>
        s
          .addUserOption(o => o.setName('cible').setDescription('Cible').setRequired(true))
          .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)),
      contexts: [0],
      permissions: PermissionFlagsBits.KickMembers,
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible');
        const reason = interaction.options.getString('raison') ?? undefined;
        if (!target || !interaction.guild) {
          await interaction.reply({ content: '❌ Cible requise (serveur uniquement).', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        try {
          await ctx.dm.kickMember(interaction.guild.id, target.id, reason);
          await interaction.editReply({ content: `👢 <@${target.id}> expulsé.` });
        } catch {
          await interaction.editReply({ content: '❌ Permissions insuffisantes.' }).catch(() => {});
        }
      },
    },
    {
      category: 'admin',
      name: 'ban',
      description: 'Bannit un membre',
      build: s =>
        s
          .addUserOption(o => o.setName('cible').setDescription('Cible').setRequired(true))
          .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)),
      contexts: [0],
      permissions: PermissionFlagsBits.BanMembers,
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible');
        const reason = interaction.options.getString('raison') ?? undefined;
        if (!target || !interaction.guild) {
          await interaction.reply({ content: '❌ Cible requise (serveur uniquement).', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        try {
          await ctx.dm.banMember(interaction.guild.id, target.id, reason);
          await interaction.editReply({ content: `🔨 <@${target.id}> banni.` });
        } catch {
          await interaction.editReply({ content: '❌ Permissions insuffisantes.' }).catch(() => {});
        }
      },
    },
    {
      category: 'admin',
      name: 'hackban',
      description: 'Bannit par ID',
      build: s =>
        s
          .addStringOption(o => o.setName('id').setDescription('ID utilisateur').setRequired(true))
          .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)),
      contexts: [0],
      async execute(interaction, ctx) {
        const id = interaction.options.getString('id');
        const reason = interaction.options.getString('raison') ?? undefined;
        if (!id || !interaction.guild) {
          await interaction.reply({ content: '❌ ID requis (serveur uniquement).', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        try {
          await ctx.dm.banMember(interaction.guild.id, id, reason);
          await interaction.editReply({ content: `🔨 <@${id}> banni par ID.` });
        } catch {
          await interaction.editReply({ content: '❌ Permissions insuffisantes.' }).catch(() => {});
        }
      },
    },
    {
      category: 'admin',
      name: 'unban',
      description: 'Débannit par ID',
      build: s => s.addStringOption(o => o.setName('id').setDescription('ID utilisateur').setRequired(true)),
      contexts: [0],
      async execute(interaction, ctx) {
        const id = interaction.options.getString('id');
        if (!id || !interaction.guild) {
          await interaction.reply({ content: '❌ ID requis (serveur uniquement).', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        try {
          await ctx.dm.unbanMember(interaction.guild.id, id);
          await interaction.editReply({ content: `✅ <@${id}> débanni.` });
        } catch {
          await interaction.editReply({ content: '❌ Permissions insuffisantes.' }).catch(() => {});
        }
      },
    },
    {
      category: 'admin',
      name: 'slowmode',
      description: 'Mode lent',
      build: s => s.addIntegerOption(o => o.setName('secondes').setDescription('Secondes (0 pour désactiver)').setRequired(true)),
      contexts: [0],
      async execute(interaction) {
        const seconds = interaction.options.getInteger('secondes') ?? 0;
        const channel = interaction.channel as any;
        if (!channel?.setRateLimitPerUser) {
          await interaction.reply({ content: '❌ Canal invalide.', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        try {
          await channel.setRateLimitPerUser(seconds);
          await interaction.editReply({ content: `⏱️ Slowmode: ${seconds}s.` });
        } catch {
          await interaction.editReply({ content: '❌ Permissions insuffisantes.' }).catch(() => {});
        }
      },
    },
    {
      category: 'admin',
      name: 'lock',
      description: 'Verrouille le salon',
      contexts: [0],
      async execute(interaction) {
        const channel = interaction.channel as any;
        if (!channel?.permissionOverwrites) {
          await interaction.reply({ content: '❌ Canal invalide.', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
          await channel.permissionOverwrites.edit(interaction.guild!.id, { SendMessages: false });
          await interaction.editReply({ content: '🔒 Salon verrouillé.' });
        } catch {
          await interaction.editReply({ content: '❌ Permissions insuffisantes.' }).catch(() => {});
        }
      },
    },
    {
      category: 'admin',
      name: 'unlock',
      description: 'Déverrouille le salon',
      contexts: [0],
      async execute(interaction) {
        const channel = interaction.channel as any;
        if (!channel?.permissionOverwrites) {
          await interaction.reply({ content: '❌ Canal invalide.', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
          await channel.permissionOverwrites.edit(interaction.guild!.id, { SendMessages: null });
          await interaction.editReply({ content: '🔓 Salon déverrouillé.' });
        } catch {
          await interaction.editReply({ content: '❌ Permissions insuffisantes.' }).catch(() => {});
        }
      },
    },
    {
      category: 'admin',
      name: 'nuke',
      description: 'Clone et supprime le salon',
      contexts: [0],
      permissions: PermissionFlagsBits.ManageChannels,
      async execute(interaction) {
        const channel = interaction.channel as any;
        if (!channel?.clone || !interaction.guild) {
          await interaction.reply({ content: '❌ Canal invalide.', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true });
        try {
          const pos = channel.position;
          const cloned = await channel.clone();
          await interaction.editReply({ content: '💣 Salon nucléé.' }).catch(() => {});
          void pos;
          await channel.delete().catch(() => {});
          await cloned.setPosition(pos).catch(() => {});
          await cloned.send('💣 Salon nucléé.').catch(() => {});
        } catch {
          await interaction.editReply({ content: '❌ Permissions insuffisantes.' }).catch(() => {});
        }
      },
    },
    {
      category: 'admin',
      name: 'mute',
      description: 'Mute (timeout) un membre',
      build: s =>
        s
          .addUserOption(o => o.setName('cible').setDescription('Cible').setRequired(true))
          .addIntegerOption(o => o.setName('minutes').setDescription('Durée en minutes').setRequired(true))
          .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(false)),
      contexts: [0],
      async execute(interaction) {
        const target = interaction.options.getUser('cible');
        const minutes = interaction.options.getInteger('minutes');
        const reason = interaction.options.getString('raison') ?? undefined;
        if (!target || !minutes || minutes <= 0) {
          await interaction.reply({ content: '❌ Cible et durée requises.', ephemeral: true });
          return;
        }
        const member = interaction.guild?.members.cache.get(target.id);
        if (!member) {
          await interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        try {
          await member.timeout(minutes * 60 * 1000, reason);
          await interaction.editReply({ content: `🔇 <@${target.id}> mute ${minutes} min.` });
        } catch {
          await interaction.editReply({ content: '❌ Permissions insuffisantes.' }).catch(() => {});
        }
      },
    },
    {
      category: 'admin',
      name: 'unmute',
      description: 'Lève le mute (timeout) d\'un membre',
      build: s => s.addUserOption(o => o.setName('cible').setDescription('Cible').setRequired(true)),
      contexts: [0],
      async execute(interaction) {
        const target = interaction.options.getUser('cible');
        if (!target) {
          await interaction.reply({ content: '❌ Cible requise.', ephemeral: true });
          return;
        }
        const member = interaction.guild?.members.cache.get(target.id);
        if (!member) {
          await interaction.reply({ content: '❌ Membre introuvable.', ephemeral: true });
          return;
        }
        await interaction.deferReply({ ephemeral: true }).catch(() => {});
        try {
          await member.timeout(null);
          await interaction.editReply({ content: `🔊 <@${target.id}> unmute.` });
        } catch {
          await interaction.editReply({ content: '❌ Permissions insuffisantes.' }).catch(() => {});
        }
      },
    },
    {
      category: 'admin',
      name: 'warn',
      description: 'Avertit un membre (loggé en DB)',
      build: s =>
        s
          .addUserOption(o => o.setName('cible').setDescription('Cible').setRequired(true))
          .addStringOption(o => o.setName('raison').setDescription('Raison').setRequired(true)),
      contexts: [0],
      async execute(interaction, ctx) {
        const target = interaction.options.getUser('cible');
        const reason = interaction.options.getString('raison');
        if (!target || !reason) {
          await interaction.reply({ content: '❌ Cible et raison requises.', ephemeral: true });
          return;
        }
        try {
          ctx.dbService.addFriend?.({ id: target.id, username: `${target.tag} [WARN: ${reason}]` });
          await interaction.reply({ content: `⚠️ <@${target.id}> averti: ${reason}`, ephemeral: true });
        } catch {
          await interaction.reply({ content: `⚠️ <@${target.id}> averti: ${reason}`, ephemeral: true });
        }
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}

import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';

export function registerSniper(registry: CommandRegistry): void {
  registry.describeCategory('sniper', 'Nitro sniper & giveaway joiner');

  const defs: SubcommandDef[] = [
    {
      category: 'sniper',
      name: 'toggle',
      description: 'Active/désactive le nitro sniper ou le giveaway joiner',
      build: s =>
        s
          .addStringOption(o =>
            o
              .setName('feature')
              .setDescription('Feature à basculer')
              .addChoices(
                { name: 'Nitro Sniper', value: 'nitroSniper' },
                { name: 'Giveaway Joiner', value: 'giveawayJoiner' },
                { name: 'Block Detection', value: 'blockDetection' },
                { name: 'Ping Detection', value: 'pingDetection' }
              )
              .setRequired(true)
          )
          .addBooleanOption(o => o.setName('etat').setDescription('true=activer, false=désactiver').setRequired(false)),
      async execute(interaction, ctx) {
        const feature = interaction.options.getString('feature') as
          | 'nitroSniper'
          | 'giveawayJoiner'
          | 'blockDetection'
          | 'pingDetection'
          | undefined;
        if (!feature) {
          await interaction.reply({ content: '❌ Feature requise.', ephemeral: true });
          return;
        }
        const config = ctx.sniperService.getConfig();
        const newState = interaction.options.getBoolean('etat') ?? !config[feature];
        ctx.sniperService.updateConfig({ [feature]: newState });
        await interaction.reply({ content: `🎯 ${feature}: ${newState ? '✅ activé' : '❌ désactivé'}.`, ephemeral: true });
      },
    },
    {
      category: 'sniper',
      name: 'status',
      description: 'Affiche la config du sniper',
      async execute(interaction, ctx) {
        const config = ctx.sniperService.getConfig();
        const text = `**🎯 Config Sniper**\n\nNitro Sniper: ${config.nitroSniper ? '✅' : '❌'}\nGiveaway Joiner: ${config.giveawayJoiner ? '✅' : '❌'}\nBlock Detection: ${config.blockDetection ? '✅' : '❌'}\nPing Detection: ${config.pingDetection ? '✅' : '❌'}\nWhitelist: ${config.whitelistUsers?.length || 0} users\nBlacklist: ${config.blacklistGuilds?.length || 0} guilds`;
        await interaction.reply({ content: text, ephemeral: true });
      },
    },
    {
      category: 'sniper',
      name: 'whitelist',
      description: 'Ajoute/retire un user de la whitelist',
      build: s =>
        s
          .addUserOption(o => o.setName('user').setDescription('Utilisateur').setRequired(true))
          .addStringOption(o => o.setName('action').setDescription('Action').addChoices({ name: 'Ajouter', value: 'add' }, { name: 'Retirer', value: 'remove' }).setRequired(true)),
      async execute(interaction, ctx) {
        const user = interaction.options.getUser('user');
        const action = interaction.options.getString('action');
        if (!user || !action) {
          await interaction.reply({ content: '❌ Arguments requis.', ephemeral: true });
          return;
        }
        const config = ctx.sniperService.getConfig();
        let list = config.whitelistUsers ?? [];
        if (action === 'add') {
          if (!list.includes(user.id)) list = [...list, user.id];
        } else {
          list = list.filter(id => id !== user.id);
        }
        ctx.sniperService.updateConfig({ whitelistUsers: list });
        await interaction.reply({ content: `📝 Whitelist: ${user.tag} ${action === 'add' ? 'ajouté' : 'retiré'} (${list.length} users).`, ephemeral: true });
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}

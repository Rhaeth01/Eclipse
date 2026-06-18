import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';

export function registerSettings(registry: CommandRegistry): void {
  registry.describeCategory('settings', 'Paramètres Eclipse');

  const defs: SubcommandDef[] = [
    {
      category: 'settings',
      name: 'stealth',
      description: 'Active/désactive le mode furtif (réponses éphémères)',
      build: s => s.addBooleanOption(o => o.setName('etat').setDescription('true=activer, false=désactiver').setRequired(false)),
      async execute(interaction, ctx) {
        const current = ctx.getCommandStealth();
        const newState = interaction.options.getBoolean('etat') ?? !current;
        ctx.setCommandStealth(newState);
        await interaction.reply({ content: `🥷 Mode furtif: ${newState ? '✅ activé' : '❌ désactivé'}.`, ephemeral: true });
      },
    },
    {
      category: 'settings',
      name: 'silent',
      description: 'Active/désactive le silent typing',
      build: s => s.addBooleanOption(o => o.setName('etat').setDescription('true=activer, false=désactiver').setRequired(false)),
      async execute(interaction, ctx) {
        const current = ctx.getSilentTyping();
        const newState = interaction.options.getBoolean('etat') ?? !current;
        ctx.setSilentTyping(newState);
        await interaction.reply({ content: `🤫 Silent typing: ${newState ? '✅ activé' : '❌ désactivé'}.`, ephemeral: true });
      },
    },
    {
      category: 'settings',
      name: 'deploy',
      description: 'Redéploie les slash commands',
      async execute(interaction, ctx) {
        await interaction.reply({ content: '🔄 Redéploiement...', ephemeral: true });
        const result = await ctx.dm.redeployCommands();
        await interaction.editReply({ content: result });
      },
    },
    {
      category: 'settings',
      name: 'status',
      description: 'Affiche les paramètres actuels',
      async execute(interaction, ctx) {
        const text = `**⚙️ Paramètres**\n\n🥷 Mode furtif: ${ctx.getCommandStealth() ? '✅' : '❌'}\n🤫 Silent typing: ${ctx.getSilentTyping() ? '✅' : '❌'}`;
        await interaction.reply({ content: text, ephemeral: true });
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}

import type { CommandRegistry, SubcommandDef } from '../CommandRegistry';
import type { ScriptService } from '../../services/ScriptService';

export function registerScript(registry: CommandRegistry, scriptService: ScriptService): void {
  registry.describeCategory('script', 'Moteur de scripts personnalisés');

  const defs: SubcommandDef[] = [
    {
      category: 'script',
      name: 'list',
      description: 'Liste les scripts disponibles',
      async execute(interaction, _ctx) {
        const scripts = scriptService.list();
        if (scripts.length === 0) {
          await interaction.reply({ content: '📜 Aucun script trouvé dans `core/scripts/`.', ephemeral: true });
          return;
        }
        let text = `**📜 Scripts (${scripts.length})**\n\n`;
        for (const s of scripts) text += `${s.loaded ? '✅' : '⏸️'} **${s.name}** — ${s.description}${s.error ? ` ⚠️ ${s.error}` : ''}\n`;
        await interaction.reply({ content: text, ephemeral: true });
      },
    },
    {
      category: 'script',
      name: 'load',
      description: 'Charge (ou recharge) un script',
      build: s => s.addStringOption(o => o.setName('nom').setDescription('Nom du script').setRequired(true)),
      async execute(interaction, _ctx) {
        const name = interaction.options.getString('nom')!;
        const info = scriptService.load(name);
        await interaction.reply({ content: info.loaded ? `✅ Script \`${name}\` chargé: ${info.description}` : `❌ ${info.error}`, ephemeral: true });
      },
    },
    {
      category: 'script',
      name: 'run',
      description: 'Exécute un script chargé',
      build: s =>
        s
          .addStringOption(o => o.setName('nom').setDescription('Nom du script').setRequired(true))
          .addStringOption(o => o.setName('args').setDescription('Arguments (séparés par espace)').setRequired(false)),
      async execute(interaction, _ctx) {
        const name = interaction.options.getString('nom')!;
        const args = interaction.options.getString('args')?.split(' ') ?? [];
        await interaction.deferReply({ ephemeral: true });
        try {
          const result = await scriptService.run(name, args);
          await interaction.editReply({ content: result });
        } catch (err: any) {
          const msg = err?.code === 'ERR_SCRIPT_EXECUTION_TIMEOUT'
            ? `❌ Script \`${name}\` a dépassé le timeout de 5s.`
            : `❌ Erreur: ${err?.message ?? err}`;
          await interaction.editReply({ content: msg }).catch(() => {});
        }
      },
    },
    {
      category: 'script',
      name: 'unload',
      description: 'Décharge un script',
      build: s => s.addStringOption(o => o.setName('nom').setDescription('Nom du script').setRequired(true)),
      async execute(interaction, _ctx) {
        const name = interaction.options.getString('nom')!;
        const ok = scriptService.unload(name);
        await interaction.reply({ content: ok ? `✅ Script \`${name}\` déchargé.` : `❌ Script \`${name}\` non chargé.`, ephemeral: true });
      },
    },
    {
      category: 'script',
      name: 'watch',
      description: 'Active le hot-reload d\'un script',
      build: s => s.addStringOption(o => o.setName('nom').setDescription('Nom du script').setRequired(true)),
      async execute(interaction, _ctx) {
        const name = interaction.options.getString('nom')!;
        scriptService.load(name);
        scriptService.watch(name);
        await interaction.reply({ content: `👁️ Hot-reload activé pour \`${name}\`.`, ephemeral: true });
      },
    },
  ];

  for (const d of defs) registry.sub(d);
}
